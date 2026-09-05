"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Etiquette } from "@/components/ui";
import { fmtDateTime, fmtRelative } from "@/lib/time";
import { CATEGORIES_PANNE, type ReportStatus } from "@/lib/types";
import type { LignePanne } from "@/app/(app)/admin/pannes/page";

const ETATS: Record<ReportStatus, { label: string; ton: "libre" | "occupe" | "panne" | "neutre" }> = {
  open: { label: "ouvert", ton: "panne" },
  acknowledged: { label: "pris en compte", ton: "occupe" },
  resolved: { label: "résolu", ton: "libre" },
  rejected: { label: "écarté", ton: "neutre" },
};

export function GestionPannes({ signalements }: { signalements: LignePanne[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filtre, setFiltre] = useState<"ouverts" | "tous">("ouverts");
  const [enCours, setEnCours] = useState<string | null>(null);

  const visibles = signalements.filter((s) => (filtre === "ouverts" ? s.status === "open" : true));

  async function traiter(s: LignePanne, statut: ReportStatus) {
    setEnCours(s.id);
    const supabase = creerClientNavigateur();
    const { error } = await supabase.rpc("admin_resolve_report", {
      p_report_id: s.id,
      p_status: statut,
      p_note: null,
    });
    setEnCours(null);

    if (error) toast({ ton: "erreur", titre: "Action refusée", detail: messageErreur(error) });
    else {
      toast({ ton: "ok", titre: `Signalement ${ETATS[statut].label}` });
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        {(["ouverts", "tous"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            aria-pressed={filtre === f}
            className={`px-3.5 py-2 text-[11px] font-medium border rounded-[8px]
              transition-colors ${
                filtre === f ? "border-klein bg-klein/12 text-chalk" : "border-line text-dim hover:text-mist"
              }`}
          >
            {f === "ouverts" ? "Ouverts" : "Tout l'historique"}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="panel corners px-6 py-12 text-center">
          <p className="text-mist">
            {filtre === "ouverts" ? "Aucun signalement ouvert. Le parc tourne." : "Aucun signalement."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {visibles.map((s) => (
            <li key={s.id} className="panel corners p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="text-sm text-chalk font-medium">
                      {s.machines?.name ?? "Machine supprimée"}
                    </p>
                    <Etiquette ton={ETATS[s.status].ton}>{ETATS[s.status].label}</Etiquette>
                    <Etiquette ton="neutre">
                      {CATEGORIES_PANNE[s.category] ?? s.category}
                    </Etiquette>
                    {s.machines?.status && s.machines.status !== "operational" && (
                      <Etiquette ton="panne">machine retirée du planning</Etiquette>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-dim mt-1.5">
                    {s.machines?.rooms?.name ?? "—"}
                    {s.profiles?.display_name ? ` · signalé par ${s.profiles.display_name}` : ""}
                    {` · ${fmtRelative(s.created_at)}`}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-dim shrink-0">
                  {fmtDateTime(s.created_at)}
                </span>
              </div>

              <p className="text-sm text-mist mt-3 leading-relaxed border-l-2 border-line pl-3">
                {s.message}
              </p>

              {s.status === "open" && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  <Bouton taille="sm" variante="secondaire" enCours={enCours === s.id}
                          onClick={() => traiter(s, "acknowledged")}>
                    Prendre en compte
                  </Bouton>
                  <Bouton taille="sm" variante="acide" enCours={enCours === s.id}
                          onClick={() => traiter(s, "resolved")}>
                    Marquer résolu
                  </Bouton>
                  <Bouton taille="sm" variante="fantome" enCours={enCours === s.id}
                          onClick={() => traiter(s, "rejected")}>
                    Écarter
                  </Bouton>
                </div>
              )}

              {s.status === "acknowledged" && (
                <div className="flex gap-2 mt-4">
                  <Bouton taille="sm" variante="acide" enCours={enCours === s.id}
                          onClick={() => traiter(s, "resolved")}>
                    Marquer résolu
                  </Bouton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-dim leading-relaxed max-w-2xl">
        Résoudre un signalement ne remet pas la machine en service : passez par
        l&apos;onglet Machines pour la basculer en « en service » une fois réparée.
      </p>
    </div>
  );
}
