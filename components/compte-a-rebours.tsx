"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtCountdown } from "@/lib/time";

/** Compte à rebours vivant, rafraîchi à la seconde. */
export function CompteARebours({
  vers,
  depuis,
  className = "",
  suffixe,
}: {
  vers: string | Date;
  depuis?: string | Date;
  className?: string;
  suffixe?: string;
}) {
  const cible = useMemo(() => (typeof vers === "string" ? new Date(vers) : vers), [vers]);
  const [restant, setRestant] = useState(() => cible.getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(() => setRestant(cible.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [cible]);

  if (restant <= 0) {
    return <span className={`tabular ${className}`}>terminé</span>;
  }

  return (
    <span className={`tabular ${className}`}>
      {fmtCountdown(restant)}
      {suffixe && <span className="text-dim ml-1">{suffixe}</span>}
      {depuis && <ProgressionCycle debut={depuis} fin={cible} />}
    </span>
  );
}

function ProgressionCycle({ debut, fin }: { debut: string | Date; fin: Date }) {
  const d = useMemo(() => (typeof debut === "string" ? new Date(debut) : debut), [debut]);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const calc = () => {
      const total = fin.getTime() - d.getTime();
      setPct(total <= 0 ? 100 : Math.min(100, Math.max(0, ((Date.now() - d.getTime()) / total) * 100)));
    };
    calc();
    const t = setInterval(calc, 2000);
    return () => clearInterval(t);
  }, [d, fin]);

  return (
    <span className="block mt-2 h-[3px] bg-line rounded-full overflow-hidden" aria-hidden>
      <span
        className="block h-full liquid rounded-full transition-[width] duration-1000 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
