"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Ton = "ok" | "erreur" | "info";
type Toast = { id: number; ton: Ton; titre: string; detail?: string };

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

const COULEURS: Record<Ton, string> = {
  ok: "text-acid border-acid/40",
  erreur: "text-coral border-coral/40",
  info: "text-klein-2 border-klein/40",
};

export function FournisseurToasts({ children }: { children: React.ReactNode }) {
  const [liste, setListe] = useState<Toast[]>([]);

  const pousser = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setListe((l) => [...l, { ...t, id }]);
    setTimeout(() => setListe((l) => l.filter((x) => x.id !== id)), 6000);
  }, []);

  const valeur = useMemo(() => pousser, [pousser]);

  return (
    <Ctx.Provider value={valeur}>
      {children}
      <div
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 items-end pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {liste.map((t) => (
          <div
            key={t.id}
            className={`panel reveal pointer-events-auto max-w-sm w-full sm:w-auto px-4 py-3 border-l-2 ${COULEURS[t.ton]}`}
          >
            <p className="text-sm font-medium text-chalk">{t.titre}</p>
            {t.detail && <p className="text-xs text-mist mt-1 leading-relaxed">{t.detail}</p>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
