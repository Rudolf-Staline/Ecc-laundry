"use client";

import { useState } from "react";
import { JOURS, JOURS_COURTS } from "@/lib/time";
import type { AffluenceCell } from "@/lib/types";

/**
 * Affluence jour × heure. Rampe séquentielle : une seule teinte, cinq paliers
 * du vide au saturé — jamais d'arc-en-ciel, qui ferait croire à des catégories
 * là où il n'y a qu'une intensité. Les paliers du mode sombre sont choisis
 * pour leur fond, pas obtenus en inversant ceux du mode clair.
 */
const PALIERS = [
  { min: 0.00, jeton: "var(--c-aff-0)", nom: "aucune" },
  { min: 0.01, jeton: "var(--c-aff-1)", nom: "calme" },
  { min: 0.26, jeton: "var(--c-aff-2)", nom: "modérée" },
  { min: 0.51, jeton: "var(--c-aff-3)", nom: "forte" },
  { min: 0.76, jeton: "var(--c-aff-4)", nom: "saturée" },
];

function palier(intensite: number) {
  let out = PALIERS[0];
  for (const p of PALIERS) if (intensite >= p.min) out = p;
  return out;
}

export function Heatmap({
  cellules,
  heureDebut = 7,
  heureFin = 23,
}: {
  cellules: AffluenceCell[];
  heureDebut?: number;
  heureFin?: number;
}) {
  const [survol, setSurvol] = useState<{ dow: number; hour: number } | null>(null);
  const [tableau, setTableau] = useState(false);

  const heures = Array.from({ length: heureFin - heureDebut }, (_, i) => heureDebut + i);
  const index = new Map(cellules.map((c) => [`${c.dow}|${c.hour}`, c]));
  const total = cellules.reduce((a, c) => a + c.bookings, 0);

  if (total === 0) {
    return (
      <div className="panel corners px-6 py-12 text-center">
        <p className="text-mist">Pas encore assez d&apos;historique.</p>
        <p className="text-sm text-dim mt-2">
          La carte d&apos;affluence se construit sur les huit dernières semaines.
        </p>
      </div>
    );
  }

  const actif = survol ? index.get(`${survol.dow}|${survol.hour}`) : null;

  return (
    <div className="panel corners p-5 sm:p-6">
      {/* Bandeau de lecture — la valeur survolée, en texte, jamais en couleur seule */}
      <div className="h-11 mb-3 flex items-center">
        {survol ? (
          <p className="text-sm text-chalk">
            <span className="text-mist">{JOURS[survol.dow - 1]}</span>{" "}
            <span className="tabular">{String(survol.hour).padStart(2, "0")}:00</span>
            {" — "}
            <span className="tabular">{actif?.bookings ?? 0}</span> réservation
            {(actif?.bookings ?? 0) > 1 ? "s" : ""}
            <span className="text-dim">
              {" · affluence "}
              {palier(actif?.intensity ?? 0).nom}
            </span>
          </p>
        ) : (
          <p className="text-sm text-dim">
            Survolez une case — ou parcourez-la au clavier — pour le détail.
          </p>
        )}
      </div>

      <div className="scroll-x">
        <div className="min-w-max mx-auto w-max">
          {/* Axe des heures */}
          <div
            className="grid gap-[2px] mb-[2px]"
            style={{ gridTemplateColumns: `36px repeat(${heures.length}, 26px)` }}
          >
            <div />
            {heures.map((h) => (
              <div key={h} className="text-center">
                <span className="text-[9px] font-mono text-dim tabular">
                  {h % 2 === heureDebut % 2 ? String(h).padStart(2, "0") : ""}
                </span>
              </div>
            ))}
          </div>

          {/* Grille */}
          {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
            <div
              key={dow}
              className="grid gap-[2px] mb-[2px]"
              style={{ gridTemplateColumns: `36px repeat(${heures.length}, 26px)` }}
            >
              <div className="flex items-center">
                <span className="text-[9px] font-mono text-dim tracking-[0.08em]">
                  {JOURS_COURTS[dow - 1]}
                </span>
              </div>

              {heures.map((h) => {
                const c = index.get(`${dow}|${h}`);
                const intensite = c?.intensity ?? 0;
                const p = palier(intensite);
                const vise = survol?.dow === dow && survol?.hour === h;

                return (
                  <button
                    key={h}
                    type="button"
                    onMouseEnter={() => setSurvol({ dow, hour: h })}
                    onMouseLeave={() => setSurvol(null)}
                    onFocus={() => setSurvol({ dow, hour: h })}
                    onBlur={() => setSurvol(null)}
                    aria-label={`${JOURS[dow - 1]} ${h}:00 — ${c?.bookings ?? 0} réservations, affluence ${p.nom}`}
                    className="h-[26px] rounded-[6px] transition-all duration-150"
                    style={{
                      background: p.jeton,
                      border: `1px solid ${vise ? "var(--c-chalk)" : "var(--c-line)"}`,
                      transform: vise ? "scale(1.18)" : undefined,
                      zIndex: vise ? 5 : undefined,
                      position: vise ? "relative" : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Légende + repli tabulaire */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-line">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-dim uppercase tracking-[0.1em]">calme</span>
          <div className="flex gap-[2px]">
            {PALIERS.map((p) => (
              <span
                key={p.nom}
                title={p.nom}
                className="w-6 h-3.5 rounded-[6px] border border-line"
                style={{ background: p.jeton }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-dim uppercase tracking-[0.1em]">saturé</span>
        </div>

        <button
          onClick={() => setTableau((t) => !t)}
          className="text-[10px] font-medium text-dim hover:text-chalk transition-colors"
          aria-expanded={tableau}
        >
          {tableau ? "Masquer" : "Voir"} les données
        </button>
      </div>

      {/* Les mêmes chiffres, lisibles sans percevoir la couleur */}
      {tableau && (
        <div className="mt-4 scroll-x">
          <table className="text-[11px] font-mono border-collapse min-w-max">
            <caption className="sr-only">
              Réservations par jour et par heure sur les huit dernières semaines
            </caption>
            <thead>
              <tr>
                <th scope="col" className="text-left px-2 py-1 text-dim font-normal">Jour</th>
                {heures.map((h) => (
                  <th key={h} scope="col" className="px-1.5 py-1 text-dim font-normal tabular">
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                <tr key={dow} className="border-t border-line">
                  <th scope="row" className="text-left px-2 py-1 text-mist font-normal">
                    {JOURS_COURTS[dow - 1]}
                  </th>
                  {heures.map((h) => {
                    const v = index.get(`${dow}|${h}`)?.bookings ?? 0;
                    return (
                      <td
                        key={h}
                        className={`px-1.5 py-1 text-center tabular ${v ? "text-chalk" : "text-dim/40"}`}
                      >
                        {v || "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
