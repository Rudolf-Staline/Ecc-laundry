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
  if (!profil) {
    const suite = cheminRetour ? `?suite=${encodeURIComponent(cheminRetour)}` : "";
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
