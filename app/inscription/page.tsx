import type { Metadata } from "next";
import { Logotype, Tambour } from "@/components/marque";
import { BasculeTheme } from "@/components/theme-bascule";
import { FormulaireInscription } from "@/components/formulaire-inscription";
import { supabaseConfigure } from "@/lib/config";

export const metadata: Metadata = { title: "Inscription" };

const BULLES = Array.from({ length: 14 }, (_, i) => i + 1);

export default async function PageInscription({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;

  return (
    <div className="auth-shell relative min-h-dvh overflow-hidden">
      <div className="soap-field" aria-hidden>
        {BULLES.map((n) => <span key={n} className={`soap-bubble soap-bubble-${n}`} />)}
      </div>

      <header className="relative z-20">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 h-20 flex items-center justify-between gap-5">
          <Logotype />
          <BasculeTheme />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1280px] min-h-[calc(100dvh-5rem)] grid lg:grid-cols-[1.08fr_.92fr] px-5 sm:px-8 pb-8 lg:pb-10">
        <section className="auth-visual hidden lg:flex flex-col justify-between p-10 xl:p-14 overflow-hidden">
          <div>
            <p className="auth-kicker">École Centrale Casablanca · Résidence</p>
            <h1 className="display text-[clamp(3rem,5vw,5.6rem)] max-w-[720px] text-white mt-5 leading-[.93] tracking-[-.055em]">
              La buanderie,
              <span className="block text-white/58">sans la file d&apos;attente.</span>
            </h1>
            <p className="text-white/68 text-[15px] leading-relaxed max-w-[520px] mt-7">
              Réservez votre machine, gardez un œil sur le calendrier et retrouvez vos créneaux au même endroit.
            </p>
          </div>

          <div className="relative flex items-end justify-between gap-8">
            <div className="auth-drum-orbit" aria-hidden>
              <div className="auth-orbit-ring" />
              <Tambour size={190} spinning="slow" strokeWidth={0.9} className="text-white/80" />
            </div>
            <div className="grid gap-2 shrink-0">
              <span className="auth-pill">01 · Réserver</span>
              <span className="auth-pill">02 · Consulter</span>
              <span className="auth-pill">03 · Laver</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center py-8 lg:py-12 lg:pl-10 xl:pl-16">
          <div className="w-full max-w-[450px] reveal">
            <div className="mb-7">
              <p className="eyebrow text-klein">Accès étudiant</p>
              <h2 className="display text-3xl sm:text-4xl mt-2 text-chalk">Rejoignez Laundry.</h2>
              <p className="text-sm text-mist mt-3 leading-relaxed">
                Créez votre compte avec votre adresse Centrale.
              </p>
            </div>
            <FormulaireInscription suite={suite} configure={supabaseConfigure} />
          </div>
        </section>
      </main>
    </div>
  );
}
