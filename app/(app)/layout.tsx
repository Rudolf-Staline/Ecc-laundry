import { exigerProfil } from "@/lib/supabase/session";
import { BarreLaterale, EnteteApp } from "@/components/nav";
import { BandeauAnnonces } from "@/components/annonces";
import { lireAnnonces } from "@/lib/data";

export default async function EnveloppeApp({ children }: { children: React.ReactNode }) {
  const profil = await exigerProfil();
  const annonces = await lireAnnonces();

  return (
    <div className="relative z-10 min-h-dvh">
      <BarreLaterale profil={profil} />

      <div className="md:pl-[256px] flex flex-col min-h-dvh">
        <EnteteApp profil={profil} />
        <BandeauAnnonces annonces={annonces} />

        <main className="flex-1 w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-line no-print">
          <div className="max-w-[1400px] px-4 sm:px-6 lg:px-8 py-5">
            <p className="text-[11px] text-dim">
              Tambour · buanderie de Centrale Casablanca
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
