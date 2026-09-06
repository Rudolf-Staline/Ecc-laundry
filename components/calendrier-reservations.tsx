"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bouton, Vide } from "@/components/ui";
import {
  addDays, dayKey, fmtDayShort, fmtTime, isoDayOfWeek, JOURS_COURTS, localParts, startOfWeek,
} from "@/lib/time";
import { LIBELLES_STATUT, type BookingStatus, type HistoryRow } from "@/lib/types";

const HAUTEUR_HEURE = 48;
const HEURES = Array.from({ length: 24 }, (_, i) => i);

const BLOC: Record<BookingStatus, string> = {
  booked: "bg-klein-fond border-klein/45 text-klein-2 hover:border-klein",
  completed: "bg-menthe-fond border-menthe/45 text-menthe hover:border-menthe",
  cancelled: "bg-ink-2 border-line-hi text-dim hover:border-dim",
  cancelled_late: "bg-ember-fond border-ember/45 text-ember hover:border-ember",
};

const POINT: Record<BookingStatus, string> = {
  booked: "bg-klein",
  completed: "bg-menthe",
  cancelled: "bg-dim",
  cancelled_late: "bg-ember",
};

type Pose = HistoryRow & { lane: number; lanes: number; top: number; hauteur: number };

/** Place les réservations d'un jour côte à côte lorsqu'elles se chevauchent. */
function disposerJour(lignes: HistoryRow[]): Pose[] {
  const triees = [...lignes].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const actives: Array<{ fin: number; lane: number }> = [];
  const posees: Array<HistoryRow & { lane: number }> = [];

  for (const r of triees) {
    const debut = new Date(r.starts_at).getTime();
    for (let i = actives.length - 1; i >= 0; i -= 1) {
      if (actives[i].fin <= debut) actives.splice(i, 1);
    }
    const prises = new Set(actives.map((a) => a.lane));
    let lane = 0;
    while (prises.has(lane)) lane += 1;
    actives.push({ fin: new Date(r.ends_at).getTime(), lane });
    posees.push({ ...r, lane });
  }

  const lanes = posees.reduce((max, p) => Math.max(max, p.lane + 1), 1);

  return posees.map((p) => {
    const debut = localParts(new Date(p.starts_at));
    const minutesDebut = debut.hour * 60 + debut.minute;
    const dureeMin = Math.max(
      24,
      (new Date(p.ends_at).getTime() - new Date(p.starts_at).getTime()) / 60_000,
    );
    return {
      ...p,
      lanes,
      top: (minutesDebut / 60) * HAUTEUR_HEURE,
      hauteur: (dureeMin / 60) * HAUTEUR_HEURE,
    };
  });
}

export function CalendrierReservations({ lignes }: { lignes: HistoryRow[] }) {
  const [debutSemaine, setDebutSemaine] = useState(() => startOfWeek(new Date()));

  const parJour = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const ligne of lignes) {
      const cle = dayKey(new Date(ligne.starts_at));
      const groupe = map.get(cle) ?? [];
      groupe.push(ligne);
      map.set(cle, groupe);
    }
    return map;
  }, [lignes]);

  const jours = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(debutSemaine, i)),
    [debutSemaine],
  );

  const aujourdHui = dayKey(new Date());
  const semaineCourante = dayKey(debutSemaine) === dayKey(startOfWeek(new Date()));

  if (lignes.length === 0) {
    return (
      <Vide
        titre="Aucune réservation"
        detail="Vos créneaux apparaîtront ici, positionnés sur leur horaire, une fois réservés."
        action={
          <Link href="/reserver">
            <Bouton variante="secondaire" taille="sm">Réserver un créneau</Bouton>
          </Link>
        }
      />
    );
  }

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="eyebrow">Vue hebdomadaire</p>
          <h2 className="display text-2xl text-chalk mt-1 tabular">
            {fmtDayShort(jours[0])} → {fmtDayShort(jours[6])}{" "}
            <span className="text-dim text-base font-normal">{localParts(jours[6]).year}</span>
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDebutSemaine((d) => addDays(d, -7))}
            className="px-3 h-9 rounded-[8px] border border-line text-[11px] font-medium text-dim hover:text-chalk hover:bg-ink-2 transition-colors"
          >
            ← Précédent
          </button>
          {!semaineCourante && (
            <button
              type="button"
              onClick={() => setDebutSemaine(startOfWeek(new Date()))}
              className="px-3 h-9 rounded-[8px] border border-line text-[11px] font-medium text-dim hover:text-chalk hover:bg-ink-2 transition-colors"
            >
              Aujourd&apos;hui
            </button>
          )}
          <button
            type="button"
            onClick={() => setDebutSemaine((d) => addDays(d, 7))}
            className="px-3 h-9 rounded-[8px] border border-line text-[11px] font-medium text-dim hover:text-chalk hover:bg-ink-2 transition-colors"
          >
            Suivant →
          </button>
        </div>
      </div>

      <div className="scroll-x -mx-4 sm:-mx-5 px-4 sm:px-5">
        <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, minmax(112px, 1fr))", minWidth: 820 }}>
          <div />
          {jours.map((j) => {
            const cle = dayKey(j);
            const estAujourdhui = cle === aujourdHui;
            return (
              <div key={cle} className="text-center pb-2.5">
                <p className="text-[10px] font-mono tracking-[0.1em] text-dim">
                  {JOURS_COURTS[isoDayOfWeek(j) - 1]}
                </p>
                <p className={`display text-lg mt-0.5 tabular ${estAujourdhui ? "text-klein" : "text-chalk"}`}>
                  {localParts(j).day}
                </p>
              </div>
            );
          })}

          <div className="relative" style={{ height: HEURES.length * HAUTEUR_HEURE }}>
            {HEURES.map((h) => (
              <div
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[9px] font-mono text-dim tabular"
                style={{ top: h * HAUTEUR_HEURE }}
              >
                {String(h).padStart(2, "0")}h
              </div>
            ))}
          </div>

          {jours.map((j) => {
            const cle = dayKey(j);
            const poses = disposerJour(parJour.get(cle) ?? []);
            const estAujourdhui = cle === aujourdHui;
            return (
              <div
                key={cle}
                className={`relative border-l border-line ${estAujourdhui ? "bg-klein-fond/40" : ""}`}
                style={{ height: HEURES.length * HAUTEUR_HEURE }}
              >
                {HEURES.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-line/70"
                    style={{ top: h * HAUTEUR_HEURE }}
                    aria-hidden
                  />
                ))}
                {poses.map((p) => (
                  <Link
                    key={p.id}
                    href={`/reservation/${p.reference}`}
                    title={`${p.machine_name} · ${fmtTime(p.starts_at)} → ${fmtTime(p.ends_at)}`}
                    className={`absolute rounded-[6px] border px-1.5 py-1 overflow-hidden transition-colors ${BLOC[p.status]}`}
                    style={{
                      top: p.top + 1,
                      height: Math.max(p.hauteur - 2, 20),
                      left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / p.lanes}% - 4px)`,
                    }}
                  >
                    <p className="text-[9.5px] font-mono tabular leading-tight">{fmtTime(p.starts_at)}</p>
                    <p className="text-[10.5px] font-medium truncate leading-tight">{p.machine_name}</p>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-5 pt-4 border-t border-line">
        {(Object.keys(LIBELLES_STATUT) as BookingStatus[]).map((statut) => (
          <span key={statut} className="inline-flex items-center gap-1.5 text-[11px] text-dim">
            <span className={`w-2 h-2 rounded-full ${POINT[statut]}`} aria-hidden />
            {LIBELLES_STATUT[statut]}
          </span>
        ))}
      </div>
    </div>
  );
}
