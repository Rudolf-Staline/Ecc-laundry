import { redirect } from "next/navigation";
import { creerClientServeur } from "./server";
import { supabaseConfigure } from "@/lib/config";
import type { Profile } from "@/lib/types";

/**
 * Profil courant, ou `null` si personne n'est connecté — ou si Supabase n'est
 * pas encore branché : une installation neuve doit atterrir sur la page de
 * connexion, qui explique la marche à suivre, et non sur une erreur 500.
 */
export async function profilCourant(): Promise<Profile | null> {
  if (!supabaseConfigure) return null;

  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

/** Exige une session ; renvoie vers la connexion sinon. */
export async function exigerProfil(cheminRetour?: string): Promise<Profile> {
  const profil = await profilCourant();
  const suite = cheminRetour ? `?suite=${encodeURIComponent(cheminRetour)}` : "";

  if (!profil) {
    // Authentifié mais sans ligne `profiles` : le signaler plutôt que de
    // renvoyer silencieusement vers la connexion (le middleware ne fait pas
    // rebondir ce cas vers /tableau, mais autant prévenir la personne).
    // Ne s'applique que si Supabase est effectivement branché : sinon
    // `creerClientServeur` lève faute de variables d'environnement, et une
    // installation neuve doit atterrir sur /connexion, pas sur une erreur 500.
    if (supabaseConfigure) {
      const supabase = await creerClientServeur();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const separateur = suite ? "&" : "?";
        const erreur = encodeURIComponent("Profil introuvable. Contactez l'administration.");
        redirect(`/connexion${suite}${separateur}erreur=${erreur}`);
      }
    }
    redirect(`/connexion${suite}`);
  }
  return profil;
}

/** Exige un compte administrateur. */
export async function exigerAdmin(): Promise<Profile> {
  const profil = await exigerProfil("/admin");
  if (profil.role !== "admin") redirect("/tableau");
  return profil;
}
