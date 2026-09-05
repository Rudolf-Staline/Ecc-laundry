import type { Metadata } from "next";
import { Logotype, Tambour } from "@/components/marque";
import { BasculeTheme } from "@/components/theme-bascule";
import { FormulaireConnexion } from "@/components/formulaire-connexion";
import { supabaseConfigure } from "@/lib/config";

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
          <Logotype />
          <BasculeTheme />
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-2">
        {/* Colonne de gauche : juste le repère visuel, rien à lire */}
        <div className="hidden lg:flex items-center justify-center border-r border-line/70 relative overflow-hidden">
          <div className="absolute inset-0 m-auto w-[420px] h-[420px] rounded-full bg-klein-fond" aria-hidden />
          <Tambour
            size={220}
            spinning="slow"
            strokeWidth={1}
            className="relative text-klein w-[min(30vw,280px)] h-auto"
          />
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
