"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Logotype, Tambour } from "@/components/marque";
import { BasculeTheme } from "@/components/theme-bascule";
import { fmtDay, fmtTime } from "@/lib/time";
import type { Profile } from "@/lib/types";

const LIENS = [
  { href: "/tableau", label: "Tableau de bord", icone: Grille },
  { href: "/reserver", label: "Réserver", icone: Calendrier },
  { href: "/calendrier", label: "Calendrier", icone: Agenda },
  { href: "/machines", label: "Machines", icone: Machine },
  { href: "/historique", label: "Historique", icone: Registre },
];

export function BarreLaterale({ profil }: { profil: Profile }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  const liens = profil.role === "admin" ? [...LIENS, { href: "/admin", label: "Admin", icone: Sceau }] : LIENS;
  const actif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  const contenu = (
    <>
      <div className="px-5 pt-6 pb-5">
        <Link href="/tableau" aria-label="Tableau de bord" onClick={() => setOuvert(false)} className="inline-flex">
          <Logotype />
        </Link>
      </div>

      <nav className="px-3 pb-4 flex flex-col gap-1 flex-1" aria-label="Principale">
        <p className="eyebrow px-3.5 pb-2">Navigation</p>
        {liens.map((l) => {
          const Icone = l.icone;
          const ici = actif(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOuvert(false)}
              aria-current={ici ? "page" : undefined}
              className={`nav-link flex items-center gap-3 px-3.5 py-2.5 rounded-[12px]
                text-[13.5px] transition-all duration-200
                ${ici
                  ? "nav-link-active bg-klein-fond text-klein font-semibold"
                  : "text-mist hover:bg-surface-hi hover:text-chalk"}`}
            >
              <span className={`nav-icon ${ici ? "nav-icon-active" : ""}`}><Icone actif={ici} /></span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-line/70">
        <div className="profile-card flex items-center gap-2.5 rounded-[14px] px-2.5 py-2.5 transition-colors">
          <Link
            href="/compte"
            title={profil.display_name}
            onClick={() => setOuvert(false)}
            className="flex items-center gap-2.5 min-w-0 flex-1 group"
          >
            <span className="avatar-chip w-9 h-9 rounded-full grid place-items-center text-[11px] font-semibold shrink-0">
              {profil.first_name[0]}{profil.last_name[0]}
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] text-chalk truncate group-hover:text-klein transition-colors">
                {profil.display_name}
              </span>
              <span className="block text-[11px] text-dim">
                {profil.role === "admin" ? "Administration" : "Étudiant·e"}
              </span>
            </span>
          </Link>
          <form action="/auth/deconnexion" method="post">
            <button
              type="submit"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="w-8 h-8 grid place-items-center rounded-[8px] text-dim hover:text-coral hover:bg-coral-fond transition-colors"
            >
              <Sortie />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside
        className="glass-sidebar hidden md:flex fixed inset-y-0 left-0 w-[272px] flex-col border-r border-line/70 z-40 no-print"
      >
        {contenu}
      </aside>

      <header className="mobile-bar md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-16 border-b border-line/70 no-print">
        <button
          onClick={() => setOuvert((o) => !o)}
          className="w-10 h-10 grid place-items-center rounded-[12px] border border-line text-mist bg-surface/70"
          aria-label="Menu" aria-expanded={ouvert}
        >
          <Tambour size={18} spinning={ouvert} />
        </button>
        <Link href="/tableau" aria-label="Tableau de bord">
          <Logotype compact />
        </Link>
        <div className="ml-auto"><BasculeTheme compact /></div>
      </header>

      {ouvert && (
        <div className="md:hidden fixed inset-0 z-50 flex no-print">
          <div
            className="absolute inset-0 bg-[#071a24]/35 backdrop-blur-[3px]"
            onClick={() => setOuvert(false)}
            aria-hidden
          />
          <aside className="glass-sidebar relative w-[286px] max-w-[84vw] flex flex-col border-r border-line-hi">
            {contenu}
          </aside>
        </div>
      )}
    </>
  );
}

export function EnteteApp({ profil }: { profil: Profile }) {
  return (
    <header className="app-topbar hidden md:flex items-center gap-4 h-[72px] px-7 border-b border-line/70 no-print">
      <div>
        <p className="text-[13.5px] text-mist">
          Bonjour <span className="text-chalk font-semibold">{profil.first_name}</span>
        </p>
        <p className="text-[11px] text-dim mt-0.5">{fmtDay(new Date())}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Horloge />
        <BasculeTheme compact />
      </div>
    </header>
  );
}

function Horloge() {
  const souscrire = useCallback((onChange: () => void) => {
    const id = setInterval(onChange, 1000);
    return () => clearInterval(id);
  }, []);
  const heure = useSyncExternalStore(
    souscrire,
    () => fmtTime(new Date()),
    () => "",
  );

  return (
    <span className="chip bg-klein text-on-bright tabular" suppressHydrationWarning>
      <Horlogette /> {heure || "--:--"} Casablanca
    </span>
  );
}

type PropsIcone = { actif?: boolean };
const traits = (actif?: boolean) => ({
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: actif ? 2 : 1.7,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

function Grille({ actif }: PropsIcone) {
  return (
    <svg {...traits(actif)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function Calendrier({ actif }: PropsIcone) {
  return (
    <svg {...traits(actif)}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function Agenda({ actif }: PropsIcone) {
  return (
    <svg {...traits(actif)}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7 14h3M14 14h3M7 18h3" />
    </svg>
  );
}

function Machine({ actif }: PropsIcone) {
  return (
    <svg {...traits(actif)}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="12" cy="14" r="4" />
      <path d="M8 6.5h.01M11 6.5h.01" />
    </svg>
  );
}

function Registre({ actif }: PropsIcone) {
  return (
    <svg {...traits(actif)}>
      <path d="M5 3h11l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  );
}

function Sceau({ actif }: PropsIcone) {
  return (
    <svg {...traits(actif)}>
      <path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.3-7.5 9.5-4.4-1.2-7.5-5.1-7.5-9.5V6z" />
    </svg>
  );
}

function Sortie() {
  return (
    <svg {...traits(false)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function Horlogette() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
