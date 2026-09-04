"use client";

import { ecrireLocal, useLocal } from "@/lib/hooks";
import type { Announcement } from "@/lib/types";

const CLE = "tambour-annonces-lues";
const AUCUNE: string[] = [];

const TONS = {
  info: "border-klein/40 bg-klein/[0.07] text-klein-2",
  warning: "border-ember/40 bg-ember/[0.07] text-ember",
  critical: "border-coral/50 bg-coral/[0.09] text-coral",
} as const;

export function BandeauAnnonces({ annonces }: { annonces: Announcement[] }) {
  const masquees = useLocal<string[]>(CLE, AUCUNE);
  const visibles = annonces.filter((a) => !masquees.includes(a.id));

  if (visibles.length === 0) return null;

  return (
    <div className="border-b border-line/70 no-print">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-2.5 space-y-2">
        {visibles.map((a) => (
          <div
            key={a.id}
            className={`border-l-2 pl-3 pr-2 py-2 flex items-start gap-3 ${TONS[a.level]}`}
            role={a.level === "critical" ? "alert" : "status"}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium">{a.title}</p>
              <p className="text-[12px] text-mist mt-0.5 leading-relaxed">{a.body}</p>
            </div>
            <button
              onClick={() => ecrireLocal(CLE, [...masquees, a.id].slice(-20))}
              aria-label="Masquer cette annonce"
              className="text-dim hover:text-chalk transition-colors text-sm leading-none px-1 shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
