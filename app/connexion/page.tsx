import Link from "next/link";
import type { Metadata } from "next";
import { Logotype } from "@/components/marque";
import { BasculeTheme } from "@/components/theme-bascule";
import { FormulaireConnexion } from "@/components/formulaire-connexion";
import { supabaseConfigure, NOM_ECOLE } from "@/lib/config";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>;
}) {
  const { suite, erreur } = await searchParams;

  return (
    <div className="relative z-10 min-h-dvh flex flex-col">
      <header className="border-b border-line/70">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Retour à l'accueil">
            <Logotype />
          </Link>
          <BasculeTheme />
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-2">
        {/* Colonne de gauche : le propos */}
        <div className="hidden lg:flex flex-col justify-center px-14 border-r border-line/70 relative overflow-hidden">
          <div className="absolute -left-24 -bottom-24 w-[420px] h-[420px] rounded-full bg-klein/10 blur-[90px]" aria-hidden />
          <div className="relative reveal-stagger">
            <p className="eyebrow">{NOM_ECOLE}</p>
            <h1 className="display text-[clamp(2.5rem,4.5vw,4rem)] mt-4 text-chalk">
              La buanderie,
              <br />
              <span className="text-klein">sans la queue.</span>
            </h1>
            <p className="text-mist leading-relaxed mt-6 max-w-md">
              Votre adresse de l&apos;École suffit. Pas de mot de passe à retenir :
              nous envoyons un code à six chiffres, valable dix minutes.
            </p>

            <ul className="mt-10 space-y-3.5">
              {[
                "Le planning de la semaine, machine par machine",
                "Un compte à rebours quand votre cycle tourne",
                "La file d'attente qui vous rattrape sur une annulation",
                "Vos créneaux exportés vers votre agenda",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-mist">
                  <span className="text-acid mt-0.5 shrink-0" aria-hidden>▸</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Colonne de droite : le formulaire */}
        <div className="flex items-center justify-center px-5 sm:px-8 py-16">
          <div className="w-full max-w-sm reveal">
            <FormulaireConnexion suite={suite} erreurInitiale={erreur} configure={supabaseConfigure} />
          </div>
        </div>
      </main>
    </div>
  );
}
