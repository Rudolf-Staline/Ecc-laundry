"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Etiquette, Vide } from "@/components/ui";
import {
  dayKey, fmtDay, fmtTime, isoDayOfWeek, JOURS_COURTS, localParts, MOIS, zonedToUtc,
} from "@/lib/time";
import { LIBELLES_STATUT, type BookingStatus, type HistoryRow } from "@/lib/types";

const TONS: Record<BookingStatus, "libre" | "occupe" | "panne" | "neutre" | "info"> = {
  booked: "info",
  completed: "libre",
  cancelled: "neutre",
  cancelled_late: "neutre",
};

const POINTS: Record<BookingStatus, string> = {
  booked: "bg-klein",
  completed: "bg-acid",
  cancelled: "bg-dim",
  cancelled_late: "bg-ember",
};

type JourCalendrier = {
  numero: number;
  cle: string;
  reservations: HistoryRow[];
};

export function CalendrierReservations({ lignes }: { lignes: HistoryRow[] }) {
  const maintenant = localParts(new Date());
  const [annee, setAnnee] = useState(maintenant.year);
  const [mois, setMois] = useState(maintenant.month);
  const [selection, setSelection] = useState(() => dayKey(new Date()));

  const parJour = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const ligne of lignes) {
      const cle = dayKey(new Date(ligne.starts_at));
      const groupe = map.get(cle) ?? [];
      groupe.push(ligne);
      map.set(cle, groupe);
    }
    for (const groupe of map.values()) {
      groupe.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [lignes]);

  const jours = useMemo(() => {
    const premier = zonedToUtc(annee, mois, 1);
    const decalage = isoDayOfWeek(premier) - 1;
    const nombre = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
    const cellules: Array<JourCalendrier | null> = Array.from({ length: decalage }, () => null);

    for (let numero = 1; numero <= nombre; numero += 1) {
      const cle = `${annee}-${String(mois).padStart(2, "0")}-${String(numero).padStart(2, "0")}`;
      cellules.push({ numero, cle, reservations: parJour.get(cle) ?? [] });
    }

    while (cellules.length % 7 !== 0) cellules.push(null);
    return cellules;
  }, [annee, mois, parJour]);

  const reservationsSelection = parJour.get(selection) ?? [];
  const aujourdHui = dayKey(new Date());

  function changerMois(delta: number) {
    const cible = new Date(Date.UTC(annee, mois - 1 + delta, 1));
    const prochaineAnnee = cible.getUTCFullYear();
    const prochainMois = cible.getUTCMonth() + 1;
    setAnnee(prochaineAnnee);
    setMois(prochainMois);

    const prefixe = `${prochaineAnnee}-${String(prochainMois).padStart(2, "0")}-`;
    const premiereReservation = [...parJour.keys()].sort().find((cle) => cle.startsWith(prefixe));
    const aujourdhuiLocal = localParts(new Date());
    const moisActuel = aujourdhuiLocal.year === prochaineAnnee && aujourdhuiLocal.month === prochainMois;
    setSelection(
      moisActuel
        ? dayKey(new Date())
        : premiereReservation ?? `${prefixe}01`,
    );
  }

  const moisCourant = maintenant.year === annee && maintenant.month === mois;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
      <section className="panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="eyebrow">Vue mensuelle</p>
            <h2 className="display text-2xl text-chalk mt-1 capitalize">{MOIS[mois - 1]} {annee}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => changerMois(-1)}
              aria-label="Mois précédent"
              className="w-9 h-9 grid place-items-center rounded-[8px] border border-line text-mist hover:text-chalk hover:bg-ink-2 transition-colors"
            >
              ←
            </button>
            {!moisCourant && (
              <button
                type="button"
                onClick={() => {
                  setAnnee(maintenant.year);
                  setMois(maintenant.month);
                  setSelection(dayKey(new Date()));
                }}
                className="px-3 h-9 rounded-[8px] border border-line text-[11px] font-medium text-dim hover:text-chalk hover:bg-ink-2 transition-colors"
              >
                Aujourd&apos;hui
              </button>
            )}
            <button
              type="button"
              onClick={() => changerMois(1)}
              aria-label="Mois suivant"
              className="w-9 h-9 grid place-items-center rounded-[8px] border border-line text-mist hover:text-chalk hover:bg-ink-2 transition-colors"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {JOURS_COURTS.map((jour) => (
            <div key={jour} className="text-center py-1.5 text-[10px] font-mono tracking-[0.1em] text-dim">
              {jour}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {jours.map((jour, index) => {
            if (!jour) return <div key={`vide-${index}`} className="min-h-[86px] sm:min-h-[104px]" aria-hidden />;

            const actif = selection === jour.cle;
            const aujourdhui = jour.cle === aujourdHui;
            return (
              <button
                key={jour.cle}
                type="button"
                onClick={() => setSelection(jour.cle)}
                aria-pressed={actif}
                className={`min-h-[86px] sm:min-h-[104px] rounded-[9px] border p-2 text-left flex flex-col transition-colors
                  ${actif
                    ? "border-klein bg-klein/12"
                    : jour.reservations.length > 0
                      ? "border-line-hi bg-surface-hi/35 hover:border-klein/50"
                      : "border-line bg-ink-2/20 hover:border-line-hi"}`}
              >
                <span className={`w-7 h-7 grid place-items-center rounded-full text-[12px] font-mono tabular
                  ${aujourdhui ? "bg-encre text-ink font-semibold" : actif ? "text-klein-2" : "text-mist"}`}>
                  {jour.numero}
                </span>

                {jour.reservations.length > 0 && (
                  <div className="mt-auto pt-2 space-y-1">
                    {jour.reservations.slice(0, 2).map((r) => (
                      <div key={r.id} className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${POINTS[r.status]}`} />
                        <span className="text-[10px] text-mist truncate tabular">{fmtTime(r.starts_at)} {r.machine_name}</span>
                      </div>
                    ))}
                    {jour.reservations.length > 2 && (
                      <span className="text-[9px] font-mono text-dim">+{jour.reservations.length - 2}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="panel p-4 sm:p-5 h-fit xl:sticky xl:top-20">
        <p className="eyebrow">Jour sélectionné</p>
        <h2 className="display text-xl text-chalk mt-1.5">
          {fmtDay(zonedToUtc(Number(selection.slice(0, 4)), Number(selection.slice(5, 7)), Number(selection.slice(8, 10))))}
        </h2>

        {reservationsSelection.length === 0 ? (
          <div className="mt-5">
            <Vide titre="Aucune réservation" detail="Aucun créneau n'est enregistré pour cette journée." />
          </div>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {reservationsSelection.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reservation/${r.reference}`}
                  className="block rounded-[9px] border border-line bg-ink-2/35 p-3.5 hover:border-klein/45 hover:bg-klein-fond transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-chalk font-medium truncate">{r.machine_name}</p>
                      <p className="text-[11px] text-dim mt-0.5 truncate">{r.room_name}</p>
                    </div>
                    <Etiquette ton={TONS[r.status]}>{LIBELLES_STATUT[r.status]}</Etiquette>
                  </div>
                  <p className="text-[12px] text-mist font-mono tabular mt-3">
                    {fmtTime(r.starts_at)} → {fmtTime(r.ends_at)}
                    {r.is_night && <span className="text-klein-2"> · nuit</span>}
                  </p>
                  <p className="text-[10px] text-dim font-mono mt-1">{r.reference}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
