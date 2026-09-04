"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton } from "@/components/ui";
import type { Setting } from "@/lib/types";

export function EditeurReglages({ reglages }: { reglages: Setting[] }) {
  const router = useRouter();
  const toast = useToast();
  const [valeurs, setValeurs] = useState<Record<string, string>>(
    Object.fromEntries(reglages.map((r) => [r.key, r.value])),
  );
  const [enCours, setEnCours] = useState<string | null>(null);

  const modifie = (r: Setting) => valeurs[r.key] !== r.value;

  async function enregistrer(r: Setting) {
    setEnCours(r.key);
    const supabase = creerClientNavigateur();
    const { error } = await supabase.rpc("set_setting", {
      p_key: r.key,
      p_value: valeurs[r.key],
    });
    setEnCours(null);

    if (error) {
      toast({ ton: "erreur", titre: "Modification refusée", detail: messageErreur(error) });
      setValeurs((v) => ({ ...v, [r.key]: r.value })); // on remet la valeur en base
    } else {
      toast({ ton: "ok", titre: `${r.label} mis à jour`, detail: `Nouvelle valeur : ${valeurs[r.key]}` });
      router.refresh();
    }
  }

  return (
    <div className="grid gap-2.5">
      {reglages.map((r) => (
        <div key={r.key} className="panel corners p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <label htmlFor={`set-${r.key}`} className="text-sm text-chalk font-medium block">
                {r.label}
              </label>
              {r.description && (
                <p className="text-xs text-mist mt-1.5 leading-relaxed max-w-xl">{r.description}</p>
              )}
              <code className="text-[10px] font-mono text-dim mt-2 block">{r.key}</code>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                id={`set-${r.key}`}
                inputMode={r.kind === "number" ? "numeric" : "text"}
                value={valeurs[r.key] ?? ""}
                onChange={(e) => setValeurs((v) => ({ ...v, [r.key]: e.target.value }))}
                className={`bg-ink-2 border rounded-[3px] px-3 py-2 text-sm text-chalk font-mono
                  outline-none transition-colors focus:border-klein
                  ${modifie(r) ? "border-ember/60" : "border-line"}
                  ${r.kind === "number" ? "w-24 text-center tabular" : "w-56"}`}
              />
              <Bouton
                variante={modifie(r) ? "primaire" : "fantome"}
                taille="sm"
                disabled={!modifie(r)}
                enCours={enCours === r.key}
                onClick={() => enregistrer(r)}
              >
                {modifie(r) ? "Appliquer" : "à jour"}
              </Bouton>
            </div>
          </div>

          {r.kind === "number" && (r.min_value !== null || r.max_value !== null) && (
            <p className="text-[10px] font-mono text-dim mt-3 pt-3 border-t border-line">
              bornes : {r.min_value ?? "—"} … {r.max_value ?? "—"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
