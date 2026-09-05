"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Etiquette, Champ, Selecteur, Vide } from "@/components/ui";
import { fmtDay, fmtTime } from "@/lib/time";
import {
  LIBELLES_STATUT,
  type BookingStatus, type HistoryRow, type Room,
} from "@/lib/types";

const TONS: Record<BookingStatus, "libre" | "occupe" | "panne" | "neutre" | "info"> = {
  booked: "info",
  completed: "libre",
  cancelled: "neutre",
  cancelled_late: "neutre",
};

type Tri = "date" | "machine" | "statut";
const PAR_PAGE = 15;

export function TableauHistorique({
  lignes, buanderies,
}: {
  lignes: HistoryRow[];
  buanderies: Room[];
}) {
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<BookingStatus | "tous" | "actives">("tous");
  const [salle, setSalle] = useState("toutes");
  const [tri, setTri] = useState<Tri>("date");
  const [page, setPage] = useState(0);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const out = lignes.filter((l) => {
      if (salle !== "toutes" && l.room_id !== salle) return false;
      if (statut === "actives") {
        if (l.status !== "booked") return false;
      } else if (statut !== "tous" && l.status !== statut) return false;
      if (!q) return true;
      return (
        l.reference.toLowerCase().includes(q) ||
        l.machine_name.toLowerCase().includes(q) ||
        l.room_name.toLowerCase().includes(q)
      );
    });

    out.sort((a, b) => {
      if (tri === "machine") return a.machine_name.localeCompare(b.machine_name, "fr");
      if (tri === "statut") return a.status.localeCompare(b.status);
      return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    });
    return out;
  }, [lignes, recherche, statut, salle, tri]);

  const pages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
  const pageSure = Math.min(page, pages - 1);
  const visibles = filtrees.slice(pageSure * PAR_PAGE, (pageSure + 1) * PAR_PAGE);

  const synthese = useMemo(() => {
    const heures = filtrees
      .filter((l) => l.status === "completed")
      .reduce((a, l) => a + l.duration_minutes, 0) / 60;
    return {
      total: filtrees.length,
      heures: Math.round(heures * 10) / 10,
      nuit: filtrees.filter((l) => l.is_night).length,
    };
  }, [filtrees]);

  function changer<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(0); };
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Champ
          name="q"
          etiquette="Rechercher"
          value={recherche}
          onChange={(e) => changer(setRecherche)(e.target.value)}
          placeholder="TB-1042, Lave-linge 2…"
        />
        <Selecteur
          etiquette="Statut"
          value={statut}
          onChange={(e) => changer(setStatut)(e.target.value as typeof statut)}
        >
          <option value="tous">Tous</option>
          <option value="actives">À venir et en cours</option>
          {(Object.keys(LIBELLES_STATUT) as BookingStatus[]).map((s) => (
            <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
          ))}
        </Selecteur>
        <Selecteur
          etiquette="Buanderie"
          value={salle}
          onChange={(e) => changer(setSalle)(e.target.value)}
        >
          <option value="toutes">Toutes</option>
          {buanderies.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Selecteur>
        <Selecteur etiquette="Trier par" value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
          <option value="date">Date, la plus récente d&apos;abord</option>
          <option value="machine">Machine</option>
          <option value="statut">Statut</option>
        </Selecteur>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Tuile
          icone={<IconeRegistre />}
          etiquette="Réservations"
          valeur={String(synthese.total)}
          legende={`sur ${lignes.length} au total`}
        />
        <Tuile
          icone={<IconeHorloge />}
          etiquette="Temps de machine"
          valeur={String(synthese.heures)}
          unite="h"
          legende={synthese.nuit > 0 ? `dont ${synthese.nuit} de nuit` : "créneaux de jour"}
        />
      </div>

      {filtrees.length === 0 ? (
        <Vide
          titre="Rien à cet endroit"
          detail={
            lignes.length === 0
              ? "Vous n'avez pas encore réservé de machine."
              : "Aucune réservation ne correspond à ces filtres."
          }
        />
      ) : (
        <>
          <div className="panel overflow-hidden">
            <div className="scroll-x">
              <table className="w-full min-w-[680px] text-sm">
                <caption className="sr-only">Historique de vos réservations</caption>
                <thead>
                  <tr className="border-b border-line bg-surface-hi/60">
                    {["Référence", "Machine", "Créneau", "Durée", "Statut"].map((h) => (
                      <th key={h} scope="col"
                          className="text-left px-4 py-3 eyebrow font-normal whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((l) => (
                    <tr key={l.id} className="border-b border-line last:border-0 hover:bg-ink-2/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/reservation/${l.reference}`}
                          className="tabular text-[12px] text-klein hover:underline"
                        >
                          {l.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-chalk">{l.machine_name}</span>
                        <span className="block text-[11px] text-dim">{l.room_name}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-mist">{fmtDay(l.starts_at)}</span>
                        <span className="block text-[11px] text-dim tabular">
                          {fmtTime(l.starts_at)} → {fmtTime(l.ends_at)}
                          {l.is_night && <span className="text-klein"> · nuit</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-mist whitespace-nowrap">
                        <span className="tabular">{l.duration_minutes / 60}</span>
                        <span className="text-dim ml-1">h</span>
                      </td>
                      <td className="px-4 py-3">
                        <Etiquette ton={TONS[l.status]}>{LIBELLES_STATUT[l.status]}</Etiquette>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[11px] font-mono text-dim">
                {pageSure * PAR_PAGE + 1}–{Math.min((pageSure + 1) * PAR_PAGE, filtrees.length)} sur {filtrees.length}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage(Math.max(0, pageSure - 1))}
                  disabled={pageSure === 0}
                  className="px-3 py-1.5 text-[11px] font-medium border
                    border-line rounded-[8px] text-dim hover:text-chalk hover:bg-ink-2
                    disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Précédent
                </button>
                <span className="px-3 py-1.5 text-[11px] font-mono text-mist tabular">
                  {pageSure + 1} / {pages}
                </span>
                <button
                  onClick={() => setPage(Math.min(pages - 1, pageSure + 1))}
                  disabled={pageSure >= pages - 1}
                  className="px-3 py-1.5 text-[11px] font-medium border
                    border-line rounded-[8px] text-dim hover:text-chalk hover:bg-ink-2
                    disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tuile({
  icone, etiquette, valeur, unite, legende, alerte = false,
}: {
  icone: React.ReactNode;
  etiquette: string;
  valeur: string;
  unite?: string;
  legende: string;
  alerte?: boolean;
}) {
  return (
    <div className="panel px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`w-7 h-7 rounded-[7px] grid place-items-center shrink-0
          ${alerte ? "bg-coral-fond text-coral" : "bg-ink-2 text-dim"}`}>
          {icone}
        </span>
        <span className="eyebrow">{etiquette}</span>
      </div>
      <p className={`text-[26px] leading-none mt-3 ${alerte ? "text-coral" : "text-chalk"}`}>
        <span className="tabular">{valeur}</span>
        {unite && <span className="text-[16px] text-dim ml-1">{unite}</span>}
      </p>
      <p className="text-[12px] text-dim mt-1.5">{legende}</p>
    </div>
  );
}

const traitsTuile = {
  width: 15, height: 15, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconeRegistre() {
  return (
    <svg {...traitsTuile}>
      <path d="M5 3h11l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  );
}

function IconeHorloge() {
  return (
    <svg {...traitsTuile}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
