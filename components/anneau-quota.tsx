"use client";

/**
 * Le quota hebdomadaire, dessiné comme un tambour : autant de segments que de
 * créneaux autorisés, remplis au fur et à mesure. On lit sa semaine d'un
 * coup d'œil, sans compter.
 */
export function AnneauQuota({
  utilises,
  quota,
  taille = 76,
  epaisseur = 7,
  compact = false,
}: {
  utilises: number;
  quota: number;
  taille?: number;
  epaisseur?: number;
  compact?: boolean;
}) {
  const restants = Math.max(0, quota - utilises);
  const r = (taille - epaisseur) / 2;
  const c = taille / 2;
  const ecart = quota > 1 ? 7 : 0; // degrés entre deux segments
  const pas = 360 / Math.max(1, quota);

  const teinte =
    restants === 0 ? "var(--c-coral)" : restants === 1 ? "var(--c-ember)" : "var(--c-acid)";

  function arc(index: number) {
    const debut = -90 + index * pas + ecart / 2;
    const fin = -90 + (index + 1) * pas - ecart / 2;
    const rad = (d: number) => (d * Math.PI) / 180;
    const x1 = c + r * Math.cos(rad(debut));
    const y1 = c + r * Math.sin(rad(debut));
    const x2 = c + r * Math.cos(rad(fin));
    const y2 = c + r * Math.sin(rad(fin));
    const grand = fin - debut > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${grand} 1 ${x2} ${y2}`;
  }

  return (
    <div className="inline-flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: taille, height: taille }}>
        <svg width={taille} height={taille} role="img"
             aria-label={`${utilises} réservations utilisées sur ${quota} cette semaine`}>
          {Array.from({ length: quota }, (_, i) => (
            <path
              key={i}
              d={arc(i)}
              fill="none"
              strokeWidth={epaisseur}
              strokeLinecap="butt"
              stroke={i < utilises ? teinte : "var(--c-line)"}
              style={{
                transition: "stroke 420ms var(--ease-snap)",
                transitionDelay: `${i * 55}ms`,
              }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="display tabular text-chalk" style={{ fontSize: taille * 0.3 }}>
            {restants}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="leading-tight">
          <p className="eyebrow">Cette semaine</p>
          <p className="text-sm text-chalk mt-1">
            {restants === 0
              ? "Quota atteint"
              : `${restants} créneau${restants > 1 ? "x" : ""} restant${restants > 1 ? "s" : ""}`}
          </p>
          <p className="text-[11px] text-dim font-mono mt-0.5 tabular">
            {utilises} / {quota} utilisés
          </p>
        </div>
      )}
    </div>
  );
}
