"use client";

import { useEffect, useMemo, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { Vide } from "@/components/ui";
import { addDays, dayKey, fmtDay, fmtTime, localParts, startOfDay } from "@/lib/time";
import type { BoardRow, Machine, Room } from "@/lib/types";

const HAUTEUR_HEURE = 48;
const HEURES = Array.from({ length: 24 }, (_, i) => i);

const AUCUNE_LIGNE: BoardRow[] = [];

const PALETTE = ["klein", "menthe", "coral", "ember", "violet", "acid"] as const;
type Couleur = (typeof PALETTE)[number];

/** Classes littérales (pas de gabarit dynamique) pour que Tailwind les détecte. */
const STYLES: Record<Couleur, { bloc: string; legende: string; anneau: string }> = {
  klein: { bloc: "bg-klein border-klein", legende: "bg-klein text-on-bright", anneau: "ring-klein" },
  menthe: { bloc: "bg-menthe border-menthe", legende: "bg-menthe text-on-bright", anneau: "ring-menthe" },
  coral: { bloc: "bg-coral border-coral", legende: "bg-coral text-on-bright", anneau: "ring-coral" },
  ember: { bloc: "bg-ember border-ember", legende: "bg-ember text-on-bright", anneau: "ring-ember" },
  violet: { bloc: "bg-violet border-violet", legende: "bg-violet text-on-bright", anneau: "ring-violet" },
  acid: { bloc: "bg-acid border-acid", legende: "bg-acid text-on-bright", anneau: "ring-acid" },
};

export function CalendrierReservations({
  buanderies,
  machines,
}: {
  buanderies: Room[];
  machines: Machine[];
}) {
  const [buanderieId, setBuanderieId] = useState(buanderies[0].id);
  const [jour, setJour] = useState(() => startOfDay(new Date()));
  const [focus, setFocus] = useState<string | null>(null);
  // La clé du dernier chargement reçu : tant qu'elle ne correspond pas à la
  // sélection courante, on sait qu'un chargement est en cours, sans avoir à
  // le déclarer avec un setState synchrone dans l'effet.
  const [recu, setRecu] = useState<{ cle: string; lignes: BoardRow[] } | null>(null);

  const cle = `${buanderieId}|${dayKey(jour)}`;
  const chargement = recu?.cle !== cle;
  const lignes = recu?.cle === cle ? recu.lignes : AUCUNE_LIGNE;

  const parc = useMemo(
    () => machines.filter((m) => m.room_id === buanderieId).sort((a, b) => a.position - b.position),
    [machines, buanderieId],
  );

  function changerJour(prochain: Date) {
    setJour(prochain);
    setFocus(null);
  }

  useEffect(() => {
    let annule = false;
    const supabase = creerClientNavigateur();
    const cleCapturee = cle;
    const fin = addDays(jour, 1);

    supabase
      .from("v_board")
      .select("*")
      .eq("room_id", buanderieId)
      .eq("status", "booked")
      .gte("starts_at", jour.toISOString())
      .lt("starts_at", fin.toISOString())
      .order("starts_at")
      .then(({ data }) => {
        if (!annule) setRecu({ cle: cleCapturee, lignes: (data as BoardRow[]) ?? [] });
      });

    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cle` dérive déjà de buanderieId/jour
  }, [buanderieId, jour]);

  const parMachine = useMemo(() => {
    const map = new Map<string, BoardRow[]>();
    for (const l of lignes) {
      const groupe = map.get(l.machine_id) ?? [];
      groupe.push(l);
      map.set(l.machine_id, groupe);
    }
    return map;
  }, [lignes]);

  const aujourdHui = dayKey(jour) === dayKey(new Date());

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="eyebrow">Vue journalière</p>
          <h2 className="display text-2xl text-chalk mt-1 capitalize">{fmtDay(jour)}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {buanderies.length > 1 && (
            <select
              value={buanderieId}
              onChange={(e) => { setBuanderieId(e.target.value); setFocus(null); }}
              className="bg-surface-hi/85 border border-line rounded-[8px] px-3 h-9 text-[12px]
                text-chalk outline-none focus:border-klein/60 transition-all"
            >
              {buanderies.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => changerJour(addDays(jour, -1))}
              aria-label="Jour précédent"
              className="w-9 h-9 grid place-items-center rounded-[8px] border border-line text-mist hover:text-chalk hover:bg-ink-2 transition-colors"
            >
              ←
            </button>
            {!aujourdHui && (
              <button
                type="button"
                onClick={() => changerJour(startOfDay(new Date()))}
                className="px-3 h-9 rounded-[8px] border border-line text-[11px] font-medium text-dim hover:text-chalk hover:bg-ink-2 transition-colors"
              >
                Aujourd&apos;hui
              </button>
            )}
            <button
              type="button"
              onClick={() => changerJour(addDays(jour, 1))}
              aria-label="Jour suivant"
              className="w-9 h-9 grid place-items-center rounded-[8px] border border-line text-mist hover:text-chalk hover:bg-ink-2 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {parc.length === 0 ? (
        <Vide titre="Aucune machine" detail="Cette buanderie n'a pas de machine active." />
      ) : (
        <div className="scroll-x -mx-4 sm:-mx-5 px-4 sm:px-5">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `44px repeat(${parc.length}, minmax(92px, 1fr))`,
              minWidth: 80 + parc.length * 96,
            }}
          >
            <div />
            {parc.map((m, i) => {
              const couleur = PALETTE[i % PALETTE.length];
              const actif = focus === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFocus((f) => (f === m.id ? null : m.id))}
                  aria-pressed={actif}
                  title={m.name}
                  className={`mx-0.5 mb-2.5 h-9 rounded-[8px] px-2 text-[11px] font-semibold truncate
                    transition-all ${STYLES[couleur].legende}
                    ${actif ? `ring-2 ring-offset-2 ring-offset-surface ${STYLES[couleur].anneau}` : "opacity-90 hover:opacity-100"}`}
                >
                  {m.name}
                </button>
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

            {parc.map((m, i) => {
              const couleur = PALETTE[i % PALETTE.length];
              const estVisible = focus === null || focus === m.id;
              const blocs = parMachine.get(m.id) ?? [];
              return (
                <div
                  key={m.id}
                  className="relative border-l border-line"
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
                  {blocs.map((b) => {
                    const debut = localParts(new Date(b.starts_at));
                    const top = ((debut.hour * 60 + debut.minute) / 60) * HAUTEUR_HEURE;
                    const hauteur = (b.duration_minutes / 60) * HAUTEUR_HEURE;
                    const qui = b.is_mine ? "Vous" : `${b.owner_first_name} ${b.owner_last_initial}`;
                    return (
                      <div
                        key={b.id}
                        title={`${qui} · ${fmtTime(b.starts_at)} → ${fmtTime(b.ends_at)}`}
                        className={`absolute inset-x-1 rounded-[6px] border transition-opacity
                          ${STYLES[couleur].bloc} ${estVisible ? "" : "opacity-15"}`}
                        style={{ top: top + 1, height: Math.max(hauteur - 2, 10) }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {chargement && <p className="text-[11px] text-dim mt-3">Chargement…</p>}
    </div>
  );
}
