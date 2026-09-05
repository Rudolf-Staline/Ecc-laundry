import type { Metadata } from "next";
import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection, Etiquette, Vide } from "@/components/ui";
import { fmtRelative } from "@/lib/time";
import {
  CATEGORIES_RECLAMATION_COURT, LIBELLES_STATUT_RECLAMATION,
  type ClaimRow, type ReportStatus,
} from "@/lib/types";

export const metadata: Metadata = { title: "Réclamations" };
export const dynamic = "force-dynamic";

const TONS: Record<ReportStatus, "panne" | "occupe" | "libre" | "neutre"> = {
  open: "panne",
  acknowledged: "occupe",
  resolved: "libre",
  rejected: "neutre",
};

export default async function PageAdminReclamations({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  const filtre = statut ?? "encours";
  const supabase = await creerClientServeur();

  let requete = supabase.from("v_reclamations").select("*");
  if (filtre === "encours") requete = requete.in("status", ["open", "acknowledged"]);
  else if (filtre !== "tous") requete = requete.eq("status", filtre);

  const { data } = await requete.order("created_at", { ascending: false }).limit(200);
  const liste = (data as ClaimRow[]) ?? [];

  const onglets = [
    { cle: "encours", label: "En cours" },
    { cle: "open", label: "Ouvertes" },
    { cle: "acknowledged", label: "En traitement" },
    { cle: "resolved", label: "Résolues" },
    { cle: "tous", label: "Tout" },
  ];

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Vie étudiante" titre="Réclamations" />

      <div className="flex gap-1.5 flex-wrap">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={`/admin/reclamations?statut=${o.cle}`}
            className={`px-3.5 py-2 text-[11px] font-mono uppercase tracking-[0.12em] border
              rounded-[3px] transition-colors ${
                filtre === o.cle
                  ? "border-klein bg-klein/12 text-chalk"
                  : "border-line text-dim hover:text-mist hover:border-line-hi"
              }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      {liste.length === 0 ? (
        <Vide
          titre="Rien à traiter"
          detail={
            filtre === "encours"
              ? "Aucune réclamation ouverte. Le parc tourne."
              : "Aucun dossier ne correspond à ce filtre."
          }
        />
      ) : (
        <ul className="grid gap-2.5">
          {liste.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/reclamations/${c.reference}`}
                className="panel corners p-4 flex flex-wrap items-center gap-3 group
                  hover:border-line-hi transition-colors"
              >
                <code className="text-[11px] font-mono text-dim shrink-0">{c.reference}</code>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-chalk truncate">{c.subject}</p>
                  <p className="text-[11px] font-mono text-dim mt-0.5 truncate">
                    {c.auteur} · {CATEGORIES_RECLAMATION_COURT[c.category]}
                    {c.machine_name && ` · ${c.machine_name}`}
                    {` · ${fmtRelative(c.created_at)}`}
                  </p>
                </div>

                <span className="text-[11px] font-mono text-dim shrink-0">
                  {c.message_count} msg
                </span>
                <Etiquette ton={TONS[c.status]} point={c.status === "open"}>
                  {LIBELLES_STATUT_RECLAMATION[c.status]}
                </Etiquette>
                <span className="text-dim group-hover:text-chalk transition-colors" aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
