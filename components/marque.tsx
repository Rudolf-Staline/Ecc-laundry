/**
 * Le tambour : hublot, perforations, croisillon d'entraînement.
 * Sert de logo, d'indicateur de cycle et d'attente de chargement.
 */
export function Tambour({
  size = 40,
  spinning = false,
  className = "",
  strokeWidth = 1.5,
}: {
  size?: number;
  spinning?: boolean | "slow" | "cycle";
  className?: string;
  strokeWidth?: number;
}) {
  const anim =
    spinning === "slow" ? "drum-spin-slow"
    : spinning === "cycle" ? "drum-cycle"
    : spinning ? "drum-spin"
    : "";

  // Trois couronnes de perforations, décalées pour éviter l'alignement radial.
  const trous: Array<{ x: number; y: number; r: number }> = [];
  const couronnes = [
    { rayon: 25, nombre: 12, taille: 2.6, phase: 0 },
    { rayon: 17, nombre: 8, taille: 2.3, phase: Math.PI / 8 },
    { rayon: 9, nombre: 5, taille: 1.9, phase: Math.PI / 5 },
  ];
  for (const c of couronnes) {
    for (let i = 0; i < c.nombre; i++) {
      const a = c.phase + (i * 2 * Math.PI) / c.nombre;
      trous.push({ x: 40 + c.rayon * Math.cos(a), y: 40 + c.rayon * Math.sin(a), r: c.taille });
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      {/* Hublot */}
      <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.35" />
      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.65" />

      <g className={anim}>
        {trous.map((t, i) => (
          <circle key={i} cx={t.x} cy={t.y} r={t.r} fill="currentColor" opacity={0.5} />
        ))}
        {/* Croisillon d'entraînement */}
        {[0, 120, 240].map((deg) => (
          <line
            key={deg}
            x1="40" y1="40"
            x2={40 + 30 * Math.cos((deg * Math.PI) / 180)}
            y2={40 + 30 * Math.sin((deg * Math.PI) / 180)}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            opacity="0.22"
          />
        ))}
        <circle cx="40" cy="40" r="4" fill="currentColor" opacity="0.8" />
      </g>
    </svg>
  );
}

export function Logotype({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <Tambour size={compact ? 22 : 28} spinning="slow" className="text-klein shrink-0" />
      <span className="display text-chalk leading-none" style={{ fontSize: compact ? 17 : 21 }}>
        TAMBOUR
      </span>
    </span>
  );
}
