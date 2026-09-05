"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Etiquette, Champ, Selecteur, Vide } from "@/components/ui";
import { fmtDay, fmtTime } from "@/lib/time";
import {
  LIBELLES_STATUT, MOTIFS,
  type BookingStatus, type HistoryRow, type Room,
} from "@/lib/types";

const TONS: Record<BookingStatus, "libre" | "occupe" | "panne" | "neutre" | "info"> = {
  booked: "info",
  checked_in: "occupe",
  completed: "libre",
  cancelled: "neutre",
  cancelled_late: "neutre",
  no_show: "panne",
};

type Tri = "date" | "machine" | "statut";
const PAR_PAGE = 15;

/**
 * L'historique du modèle d'origine était le même tableau répété sur deux pages,
 * sans autre filtre qu'une recherche plein texte. Ici : filtres par statut et
 * par buanderie, tri, et une ligne de synthèse — puisqu'un historique sert
 * surtout à répondre à « combien » et « à quelle heure d'habitude ».
 */
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
        if (l.status !== "booked" && l.status !== "checked_in") return false;
      } else if (statut !== "tous" && l.status !== statut) return false;
      if (!q) return true;
      return (
        l.reference.toLowerCase().includes(q) ||
        l.machine_name.toLowerCase().includes(q) ||
        l.room_name.toLowerCase().includes(q) ||
        (l.purpose ? MOTIFS[l.purpose].toLowerCase().includes(q) : false)
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

  // Synthèse sur l'ensemble filtré, pas seulement la page affichée.
  const synthese = useMemo(() => {
    const heures = filtrees
      .filter((l) => l.status === "completed" || l.status === "checked_in")
      .reduce((a, l) => a + l.duration_minutes, 0) / 60;
    return {
      total: filtrees.length,
      heures: Math.round(heures * 10) / 10,
      absences: filtrees.filter((l) => l.status === "no_show").length,
      nuit: filtrees.filter((l) => l.is_night).length,
    };
  }, [filtrees]);

  function changer<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(0); };
  }

  return (
    <div className="space-y-5">
      {/* Filtres — sur une seule ligne, au-dessus du tableau */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Champ
          name="q"
          etiquette="Rechercher"
          value={recherche}
          onChange={(e) => changer(setRecherche)(e.target.value)}
          placeholder="TB-1042, Lave-linge 2, draps…"
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

      {/* Synthèse */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono text-dim">
        <span><span className="text-chalk tabular">{synthese.total}</span> réservation{synthese.total > 1 ? "s" : ""}</span>
        <span><span className="text-chalk tabular">{synthese.heures}</span> h de machine</span>
        {synthese.nuit > 0 && (
          <span><span className="text-klein-2 tabular">{synthese.nuit}</span> de nuit, hors quota</span>
        )}
        {synthese.absences > 0 && (
          <span><span className="text-coral tabular">{synthese.absences}</span> absence{synthese.absences > 1 ? "s" : ""}</span>
        )}
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
          <div className="panel corners overflow-hidden">
            <div className="scroll-x">
              <table className="w-full min-w-[760px] text-sm">
                <caption className="sr-only">Historique de vos réservations</caption>
                <thead>
                  <tr className="border-b border-line">
                    {["Référence", "Machine", "Créneau", "Durée", "Motif", "Statut"].map((h) => (
                      <th key={h} scope="col"
                          className="text-left px-4 py-3 eyebrow font-normal whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((l) => (
                    <tr key={l.id} className="border-b border-line/60 last:border-0 hover:bg-surface-hi/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/reservation/${l.reference}`}
                          className="font-mono text-[12px] text-klein-2 hover:underline"
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
                        <span className="block text-[11px] font-mono text-dim tabular">
                          {fmtTime(l.starts_at)} → {fmtTime(l.ends_at)}
                          {l.is_night && <span className="text-klein-2"> · nuit</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular text-mist whitespace-nowrap">
                        {l.duration_minutes / 60} h
                      </td>
                      <td className="px-4 py-3 text-[12px] text-dim">
                        {l.purpose ? MOTIFS[l.purpose] : "—"}
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
                  className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.1em] border
                    border-line rounded-[3px] text-dim hover:text-chalk hover:border-line-hi
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
                  className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.1em] border
                    border-line rounded-[3px] text-dim hover:text-chalk hover:border-line-hi
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
