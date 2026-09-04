"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { verifierEmail, DOMAINE_CENTRALE } from "@/lib/email";
import { messageErreur } from "@/lib/errors";
import { Bouton, Champ, Etiquette } from "@/components/ui";
import { Tambour } from "@/components/marque";

type Etape = "email" | "code";

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
  const [etape, setEtape] = useState<Etape>("email");
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(erreurInitiale ?? null);
  const [enCours, setEnCours] = useState(false);
  const [renvoye, setRenvoye] = useState(false);
  const champCode = useRef<HTMLInputElement>(null);

  async function envoyerCode(e: React.FormEvent) {
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
      const { error } = await supabase.auth.signInWithOtp({
        email: verdict.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback${
            suite ? `?suite=${encodeURIComponent(suite)}` : ""
          }`,
        },
      });
      if (error) throw error;

      setPrenom(verdict.prenom);
      setEmail(verdict.email);
      setEtape("code");
      setTimeout(() => champCode.current?.focus(), 60);
    } catch (err) {
      setErreur(messageErreur(err as never, "Impossible d'envoyer le code. Réessayez dans un instant."));
    } finally {
      setEnCours(false);
    }
  }

  async function verifierCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const jeton = code.replace(/\D/g, "");
    if (jeton.length !== 6) {
      setErreur("Le code comporte six chiffres.");
      return;
    }

    setEnCours(true);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase.auth.verifyOtp({ email, token: jeton, type: "email" });
      if (error) throw error;
      router.push(suite || "/tableau");
      router.refresh();
    } catch (err) {
      setErreur(messageErreur(err as never, "Code incorrect ou expiré."));
      setEnCours(false);
    }
  }

  async function renvoyer() {
    setEnCours(true);
    setErreur(null);
    try {
      const supabase = creerClientNavigateur();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setRenvoye(true);
      setTimeout(() => setRenvoye(false), 5000);
    } catch (err) {
      setErreur(messageErreur(err as never));
    } finally {
      setEnCours(false);
    }
  }

  if (!configure) {
    return (
      <div className="panel corners p-6 border-ember/30">
        <Etiquette ton="occupe" point>Configuration requise</Etiquette>
        <h2 className="display text-xl mt-4 text-chalk">Supabase n&apos;est pas branché</h2>
        <p className="text-sm text-mist mt-3 leading-relaxed">
          Renseignez les variables d&apos;environnement puis appliquez les migrations.
          Le <code className="font-mono text-chalk">README.md</code> détaille la marche à suivre.
        </p>
      </div>
    );
  }

  if (etape === "code") {
    return (
      <form onSubmit={verifierCode} className="panel corners p-7">
        <div className="flex items-center gap-3 mb-6">
          <Tambour size={30} spinning className="text-klein" />
          <div>
            <p className="eyebrow">Étape 2 sur 2</p>
            <h2 className="display text-xl text-chalk mt-1">Bonjour {prenom}</h2>
          </div>
        </div>

        <p className="text-sm text-mist leading-relaxed mb-6">
          Un code à six chiffres part vers <span className="text-chalk break-all">{email}</span>.
          Il expire dans dix minutes.
        </p>

        <Champ
          ref={champCode}
          name="code"
          etiquette="Code reçu"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          erreur={erreur ?? undefined}
          className="text-center text-2xl tracking-[0.5em] font-mono py-4"
        />

        <Bouton type="submit" variante="acide" taille="lg" enCours={enCours} className="w-full mt-5">
          Entrer
        </Bouton>

        <div className="flex items-center justify-between mt-5 text-xs">
          <button
            type="button"
            onClick={() => { setEtape("email"); setCode(""); setErreur(null); }}
            className="text-dim hover:text-chalk transition-colors font-mono"
          >
            ← Changer d&apos;adresse
          </button>
          <button
            type="button"
            onClick={renvoyer}
            disabled={enCours || renvoye}
            className="text-dim hover:text-chalk transition-colors font-mono disabled:opacity-50"
          >
            {renvoye ? "Code renvoyé ✓" : "Renvoyer le code"}
          </button>
        </div>

        <p className="text-[11px] text-dim mt-6 leading-relaxed border-t border-line pt-4">
          Le lien contenu dans le même e-mail fonctionne aussi, si vous préférez cliquer.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={envoyerCode} className="panel corners p-7">
      <p className="eyebrow">Étape 1 sur 2</p>
      <h2 className="display text-2xl text-chalk mt-2 mb-1">Votre adresse centralienne</h2>
      <p className="text-sm text-mist mb-6 leading-relaxed">
        Celle de l&apos;École, en <span className="text-chalk">prenom.nom</span>.
      </p>

      <Champ
        name="email"
        type="email"
        etiquette="Adresse e-mail"
        autoComplete="email"
        autoFocus
        spellCheck={false}
        placeholder={`prenom.nom@${DOMAINE_CENTRALE}`}
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (erreur) setErreur(null); }}
        erreur={erreur ?? undefined}
        aide={`Seul le domaine @${DOMAINE_CENTRALE} est accepté.`}
      />

      <Bouton type="submit" variante="primaire" taille="lg" enCours={enCours} className="w-full mt-5">
        Recevoir mon code
      </Bouton>

      <p className="text-[11px] text-dim mt-6 leading-relaxed border-t border-line pt-4">
        Pas de mot de passe : votre boîte mail de l&apos;École fait office de preuve
        d&apos;identité. Votre compte est créé au premier passage.
      </p>
    </form>
  );
}
