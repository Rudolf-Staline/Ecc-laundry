"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/machines", label: "Machines" },
  { href: "/admin/salles", label: "Buanderies" },
  { href: "/admin/etudiants", label: "Étudiants" },
  { href: "/admin/pannes", label: "Pannes" },
  { href: "/admin/annonces", label: "Annonces" },
  { href: "/admin/reglages", label: "Réglages" },
];

export function SousNavAdmin() {
  const chemin = usePathname();

  return (
    <div className="no-print">
      <p className="eyebrow mb-3">Console d&apos;administration</p>
      <nav className="scroll-x -mx-4 sm:-mx-6 px-4 sm:px-6" aria-label="Administration">
        <div className="flex gap-1.5 w-max pb-1">
          {ONGLETS.map((o) => {
            const actif = o.href === "/admin" ? chemin === "/admin" : chemin.startsWith(o.href);
            return (
              <Link
                key={o.href}
                href={o.href}
                aria-current={actif ? "page" : undefined}
                className={`px-3.5 py-2 text-[11px] font-mono uppercase tracking-[0.12em] border
                  rounded-[3px] transition-colors whitespace-nowrap ${
                    actif
                      ? "border-klein bg-klein/12 text-chalk"
                      : "border-line text-dim hover:text-mist hover:border-line-hi"
                  }`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
