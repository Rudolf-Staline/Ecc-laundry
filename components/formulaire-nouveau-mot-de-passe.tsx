"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { Bouton, ChampMotDePasse, Etiquette } from "@/components/ui";
import { Tambour } from "@/components/marque";

const LONGUEUR_MIN = 8;

type Etat = "verification" | "invalide" | "pret" | "termine";

export function FormulaireNouveauMotDePasse({ configure }: { configure: boolean }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>("verification");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!configure) return;
    const supabase = creerClientNavigateur();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEtat(session ? "pret" : "invalide");
    });
  }, [configure]);

  async function definirMotDePasse(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (motDePasse.length < LONGUEUR_MIN) {
      setErreur(`Le mot de passe doit compter au moins ${LONGUEUR_MIN} caractères.`);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setEnCours(true);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) throw error;
      setEtat("termine");
      setTimeout(() => {
        router.push("/tableau");
        router.refresh();
      }, 1200);
    } catch (err) {
      setErreur(messageErreur(err as never, "Impossible d'enregistrer le mot de passe. Réessayez."));
      setEnCours(false);
    }
  }

  if (!configure) {
    return (
      <div className="auth-panel p-6 sm:p-7 border-ember/30">
        <Etiquette ton="occupe" point>Configuration requise</Etiquette>
        <h2 className="display text-xl mt-4 text-chalk">Supabase n&apos;est pas branché</h2>
        <p className="text-sm text-mist mt-3 leading-relaxed">
          Renseignez les variables d&apos;environnement puis appliquez les migrations.
          Le <code className="font-mono text-chalk">README.md</code> détaille la marche à suivre.
        </p>
      </div>
    );
  }

  if (etat === "verification") {
    return (
      <div className="auth-panel p-6 sm:p-8 flex items-center gap-3">
        <Tambour size={28} spinning className="text-klein" />
        <p className="text-sm text-mist">Vérification du lien…</p>
      </div>
    );
  }

  if (etat === "invalide") {
    return (
      <div className="auth-panel p-6 sm:p-8">
        <p className="eyebrow">Lien invalide</p>
        <h2 className="display text-xl text-chalk mt-2 mb-4">Ce lien a expiré</h2>
        <p className="text-sm text-mist leading-relaxed">
          Les liens de réinitialisation ne sont valables qu&apos;une fois et pendant un temps limité.
          Redemandez-en un depuis l&apos;écran de connexion.
        </p>
        <Link href="/connexion" className="inline-block mt-6">
          <Bouton type="button" variante="secondaire">← Retour à la connexion</Bouton>
        </Link>
      </div>
    );
  }

  if (etat === "termine") {
    return (
      <div className="auth-panel p-6 sm:p-8">
        <p className="eyebrow">Mot de passe mis à jour</p>
        <h2 className="display text-xl text-chalk mt-2 mb-4">C&apos;est fait</h2>
        <p className="text-sm text-mist leading-relaxed">
          Direction votre tableau de bord…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={definirMotDePasse} className="auth-panel p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow">Réinitialisation</p>
          <p className="text-sm text-mist mt-1">Choisissez un nouveau mot de passe</p>
        </div>
        <span className="auth-status-dot" aria-hidden />
      </div>

      <div className="space-y-4">
        <ChampMotDePasse
          name="password"
          etiquette="Nouveau mot de passe"
          autoComplete="new-password"
          autoFocus
          value={motDePasse}
          onChange={(e) => { setMotDePasse(e.target.value); if (erreur) setErreur(null); }}
          aide={`Au moins ${LONGUEUR_MIN} caractères.`}
        />

        <ChampMotDePasse
          name="confirmation"
          etiquette="Confirmer le mot de passe"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => { setConfirmation(e.target.value); if (erreur) setErreur(null); }}
          erreur={erreur ?? undefined}
        />
      </div>

      <Bouton type="submit" variante="primaire" taille="lg" enCours={enCours} className="w-full mt-5">
        Enregistrer
      </Bouton>
    </form>
  );
}
