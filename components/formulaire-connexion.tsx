"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { verifierEmail, DOMAINE_CENTRALE } from "@/lib/email";
import { messageErreur } from "@/lib/errors";
import { Bouton, Champ, ChampMotDePasse, Etiquette } from "@/components/ui";

type Etape = "connexion" | "oubli";

export function FormulaireConnexion({
  suite,
  erreurInitiale,
  configure,
}: {
  suite?: string;
  erreurInitiale?: string;
  configure: boolean;
}) {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(erreurInitiale ?? null);
  const [enCours, setEnCours] = useState(false);
  const [lienEnvoye, setLienEnvoye] = useState(false);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    const verdict = verifierEmail(email);
    if (!verdict.ok) {
      setErreur(verdict.raison);
      return;
    }

    setEnCours(true);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase.auth.signInWithPassword({
        email: verdict.email,
        password: motDePasse,
      });
      if (error) throw error;
      router.push(suite || "/tableau");
      router.refresh();
    } catch (err) {
      setErreur(messageErreur(err as never, "Connexion impossible. Réessayez."));
      setEnCours(false);
    }
  }

  async function demanderReinitialisation(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    const verdict = verifierEmail(email);
    if (!verdict.ok) {
      setErreur(verdict.raison);
      return;
    }

    setEnCours(true);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase.auth.resetPasswordForEmail(verdict.email, {
        redirectTo: `${window.location.origin}/auth/callback?suite=${encodeURIComponent("/reinitialiser-mot-de-passe")}`,
      });
      if (error) throw error;
      setEmail(verdict.email);
      setLienEnvoye(true);
    } catch (err) {
      setErreur(messageErreur(err as never, "Impossible d'envoyer le lien. Réessayez dans un instant."));
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

  if (etape === "oubli") {
    if (lienEnvoye) {
      return (
        <div className="auth-panel p-6 sm:p-8">
          <p className="eyebrow">Mot de passe oublié</p>
          <h2 className="display text-xl text-chalk mt-2 mb-4">Vérifiez vos e-mails</h2>
          <p className="text-sm text-mist leading-relaxed">
            Si un compte existe pour <span className="text-chalk break-all">{email}</span>,
            un lien de réinitialisation vient de lui être envoyé. Pensez à vérifier vos
            courriers indésirables.
          </p>
          <button
            type="button"
            onClick={() => { setEtape("connexion"); setLienEnvoye(false); }}
            className="text-xs text-klein hover:text-klein-2 transition-colors mt-6"
          >
            ← Retour à la connexion
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={demanderReinitialisation} className="auth-panel p-6 sm:p-8">
        <p className="eyebrow">Mot de passe oublié</p>
        <h2 className="display text-xl text-chalk mt-2 mb-1">Réinitialiser votre mot de passe</h2>
        <p className="text-sm text-mist mb-6 leading-relaxed">
          Un lien de réinitialisation sera envoyé à votre adresse centralienne.
        </p>

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
          erreur={erreur ?? undefined}
        />

        <Bouton type="submit" variante="primaire" taille="lg" enCours={enCours} className="w-full mt-5">
          Envoyer le lien
        </Bouton>

        <button
          type="button"
          onClick={() => { setEtape("connexion"); setErreur(null); }}
          className="text-xs text-dim hover:text-chalk transition-colors mt-5"
        >
          ← Retour à la connexion
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={seConnecter} className="auth-panel p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow">Connexion</p>
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
          autoComplete="current-password"
          value={motDePasse}
          onChange={(e) => { setMotDePasse(e.target.value); if (erreur) setErreur(null); }}
          erreur={erreur ?? undefined}
        />
      </div>

      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={() => { setEtape("oubli"); setErreur(null); setMotDePasse(""); }}
          className="text-xs text-klein hover:text-klein-2 transition-colors"
        >
          Mot de passe oublié ?
        </button>
      </div>

      <Bouton type="submit" variante="primaire" taille="lg" enCours={enCours} className="w-full mt-5">
        Se connecter
      </Bouton>

      <div className="flex items-start gap-3 mt-6 pt-5 border-t border-line/80">
        <span className="mt-1 w-2 h-2 rounded-full bg-menthe shrink-0" aria-hidden />
        <p className="text-[11px] text-dim leading-relaxed">
          Pas encore de compte ?{" "}
          <Link
            href={`/inscription${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`}
            className="text-chalk hover:text-klein transition-colors font-medium"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </form>
  );
}
