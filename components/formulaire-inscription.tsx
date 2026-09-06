"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { verifierEmail, DOMAINE_CENTRALE } from "@/lib/email";
import { messageErreur } from "@/lib/errors";
import { Bouton, Champ, ChampMotDePasse, Etiquette } from "@/components/ui";

const LONGUEUR_MIN = 8;

export function FormulaireInscription({
  suite,
  configure,
}: {
  suite?: string;
  configure: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [compteCree, setCompteCree] = useState(false);

  async function creerCompte(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    const verdict = verifierEmail(email);
    if (!verdict.ok) {
      setErreur(verdict.raison);
      return;
    }
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
      const { data, error } = await supabase.auth.signUp({
        email: verdict.email,
        password: motDePasse,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${
            suite ? `?suite=${encodeURIComponent(suite)}` : ""
          }`,
        },
      });
      if (error) throw error;

      if (data.session) {
        router.push(suite || "/tableau");
        router.refresh();
        return;
      }

      setEmail(verdict.email);
      setCompteCree(true);
    } catch (err) {
      setErreur(messageErreur(err as never, "Impossible de créer le compte. Réessayez."));
    } finally {
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

  if (compteCree) {
    return (
      <div className="auth-panel p-6 sm:p-8">
        <p className="eyebrow">Compte créé</p>
        <h2 className="display text-xl text-chalk mt-2 mb-4">Confirmez votre adresse</h2>
        <p className="text-sm text-mist leading-relaxed">
          Un e-mail de confirmation vient d&apos;être envoyé à{" "}
          <span className="text-chalk break-all">{email}</span>. Cliquez sur le lien qu&apos;il
          contient pour activer votre compte, puis connectez-vous.
        </p>
        <Link href="/connexion" className="inline-block mt-6">
          <Bouton type="button" variante="secondaire">← Retour à la connexion</Bouton>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={creerCompte} className="auth-panel p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow">Inscription</p>
          <p className="text-sm text-mist mt-1">Avec votre adresse Centrale</p>
        </div>
        <span className="auth-status-dot" aria-hidden />
      </div>

      <div className="space-y-4">
        <Champ
          name="email"
          type="email"
          etiquette="Adresse e-mail Centrale"
          autoComplete="email"
          autoFocus
          spellCheck={false}
          placeholder={`prenom.nom@${DOMAINE_CENTRALE}`}
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (erreur) setErreur(null); }}
        />

        <ChampMotDePasse
          name="password"
          etiquette="Mot de passe"
          autoComplete="new-password"
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
        Créer mon compte
      </Bouton>

      <div className="flex items-start gap-3 mt-6 pt-5 border-t border-line/80">
        <span className="mt-1 w-2 h-2 rounded-full bg-menthe shrink-0" aria-hidden />
        <p className="text-[11px] text-dim leading-relaxed">
          Déjà un compte ?{" "}
          <Link
            href={`/connexion${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`}
            className="text-chalk hover:text-klein transition-colors font-medium"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </form>
  );
}
