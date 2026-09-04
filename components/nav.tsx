"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logotype, Tambour } from "@/components/marque";
import { BasculeTheme } from "@/components/theme-bascule";
import type { Profile } from "@/lib/types";

const LIENS = [
  { href: "/tableau", label: "Tableau" },
  { href: "/reserver", label: "Réserver" },
  { href: "/machines", label: "Machines" },
  { href: "/statistiques", label: "Stats" },
];

export function Navigation({ profil }: { profil: Profile }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  const liens = profil.role === "admin" ? [...LIENS, { href: "/admin", label: "Admin" }] : LIENS;
  const actif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  return (
    <header className="border-b border-line/70 sticky top-0 z-40 bg-ink/85 backdrop-blur-md no-print">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/tableau" aria-label="Tableau de bord" className="shrink-0">
          <Logotype compact />
        </Link>

        {/* Navigation large */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1" aria-label="Principale">
          {liens.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={actif(l.href) ? "page" : undefined}
              className={`relative px-3.5 py-2 text-[12px] font-mono uppercase tracking-[0.12em]
                rounded-[3px] transition-colors
                ${actif(l.href) ? "text-chalk" : "text-dim hover:text-mist"}`}
            >
              {l.label}
              {actif(l.href) && (
                <span className="absolute left-3 right-3 -bottom-[9px] h-px bg-klein" aria-hidden />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/pointage"
            className="hidden sm:inline-flex items-center gap-2 border border-acid/40 text-acid
              rounded-[3px] px-3 py-2 text-[11px] font-mono uppercase tracking-[0.12em]
              hover:bg-acid-vif hover:text-on-bright transition-colors"
          >
            <QrIcone /> Pointer
          </Link>
          <BasculeTheme compact />

          <Link
            href="/compte"
            title={profil.display_name}
            className="hidden sm:flex items-center gap-2 border border-line rounded-[3px] px-2.5 py-1.5
              hover:border-line-hi transition-colors group"
          >
            <span className="w-6 h-6 rounded-full bg-klein/20 border border-klein/40 grid place-items-center
              text-[10px] font-mono text-klein-2 shrink-0">
              {profil.first_name[0]}{profil.last_name[0]}
            </span>
            <span className="text-[11px] text-mist group-hover:text-chalk transition-colors max-w-[90px] truncate">
              {profil.first_name}
            </span>
          </Link>

          <button
            onClick={() => setOuvert((o) => !o)}
            className="md:hidden w-9 h-9 grid place-items-center border border-line rounded-[3px] text-mist"
            aria-label="Menu" aria-expanded={ouvert}
          >
            <Tambour size={17} spinning={ouvert} />
          </button>
        </div>
      </div>

      {/* Navigation étroite */}
      {ouvert && (
        <nav className="md:hidden border-t border-line px-4 py-3 grid gap-1 bg-ink" aria-label="Principale">
          {[...liens, { href: "/pointage", label: "Pointer" }, { href: "/compte", label: "Mon compte" }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOuvert(false)}
              className={`px-3 py-2.5 text-[12px] font-mono uppercase tracking-[0.12em] rounded-[3px]
                ${actif(l.href) ? "text-chalk bg-surface-hi" : "text-dim"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function QrIcone() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3z" fill="currentColor" />
    </svg>
  );
}
