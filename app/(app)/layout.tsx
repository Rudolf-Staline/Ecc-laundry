import { exigerProfil } from "@/lib/supabase/session";
import { BarreLaterale, EnteteApp } from "@/components/nav";
import { BandeauAnnonces } from "@/components/annonces";
import { lireAnnonces } from "@/lib/data";
import { LogoECC } from "@/components/marque";

export default async function EnveloppeApp({ children }: { children: React.ReactNode }) {
  const profil = await exigerProfil();
  const annonces = await lireAnnonces();

  return (
    <div className="app-shell relative z-10 min-h-dvh">
      <div className="app-ambient app-ambient-a" aria-hidden />
      <div className="app-ambient app-ambient-b" aria-hidden />
      <BarreLaterale profil={profil} />

      <div className="md:pl-[272px] flex flex-col min-h-dvh">
        <EnteteApp profil={profil} />
        <BandeauAnnonces annonces={annonces} />

        <main className="flex-1 w-full max-w-[1480px] px-4 sm:px-6 lg:px-8 py-7 sm:py-10">
          <div className="page-stage reveal">{children}</div>
        </main>

        <footer className="border-t border-line/70 no-print bg-surface/35 backdrop-blur-xl">
          <div className="max-w-[1480px] px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-5 flex-wrap">
            <p className="text-[11px] text-dim">
              Laundry · buanderie de Centrale Casablanca
            </p>
            <LogoECC compact className="opacity-70 max-w-[118px]" />
          </div>
        </footer>
      </div>
    </div>
  );
}
