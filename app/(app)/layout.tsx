import { exigerProfil } from "@/lib/supabase/session";
import { Navigation } from "@/components/nav";
import { BandeauAnnonces } from "@/components/annonces";
import { lireAnnonces } from "@/lib/data";

export default async function EnveloppeApp({ children }: { children: React.ReactNode }) {
  const profil = await exigerProfil();
  const annonces = await lireAnnonces();

  return (
    <div className="relative z-10 min-h-dvh flex flex-col">
      <Navigation profil={profil} />
      <BandeauAnnonces annonces={annonces} />
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-8 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-line/70 no-print">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-dim font-mono">
            Tambour · buanderie de Centrale Casablanca
          </p>
          <form action="/auth/deconnexion" method="post">
            <button
              type="submit"
              className="text-[11px] text-dim hover:text-coral transition-colors font-mono uppercase tracking-[0.12em]"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
