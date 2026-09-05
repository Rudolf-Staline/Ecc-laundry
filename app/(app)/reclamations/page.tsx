import type { Metadata } from "next";
import Link from "next/link";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection, Etiquette, Vide, Bouton } from "@/components/ui";
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

export default async function PageReclamations() {
  await exigerProfil("/reclamations");
  const supabase = await creerClientServeur();

  const { data } = await supabase
    .from("v_reclamations")
    .select("*")
    .order("created_at", { ascending: false });

  const liste = (data as ClaimRow[]) ?? [];
  const ouvertes = liste.filter((c) => c.status === "open" || c.status === "acknowledged");

  return (
    <div className="space-y-7 max-w-4xl">
      <TitreSection
        surtitre="Un souci ?"
        titre="Réclamations"
        apres={
          <Link href="/reclamations/nouvelle">
            <Bouton variante="primaire">+ Déposer une réclamation</Bouton>
          </Link>
        }
      />

      <p className="text-sm text-mist leading-relaxed max-w-2xl">
        Linge sorti d&apos;une machine, créneau occupé par quelqu&apos;un d&apos;autre :
        ouvrez un dossier. Vous verrez les réponses de
        l&apos;équipe directement dans le fil — ce n&apos;est pas une boîte aux lettres.
        Pour une machine en panne, passez plutôt par{" "}
        <Link href="/machines" className="text-klein-2 hover:underline">le parc</Link>,
        le signalement y est immédiat.
      </p>

      {liste.length === 0 ? (
        <Vide
          titre="Aucune réclamation"
          detail="Tant mieux. Si un jour votre linge disparaît d'une machine ou qu'un créneau réservé est occupé, c'est ici que ça se règle."
          action={
            <Link href="/reclamations/nouvelle">
              <Bouton variante="primaire">Déposer une réclamation</Bouton>
            </Link>
          }
        />
      ) : (
        <>
          {ouvertes.length > 0 && (
            <p className="text-[11px] font-mono text-dim">
              {ouvertes.length} dossier{ouvertes.length > 1 ? "s" : ""} en cours
              {" · "}{liste.length - ouvertes.length} clos
            </p>
          )}

          <ul className="grid gap-2.5 reveal-stagger">
            {liste.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/reclamations/${c.reference}`}
                  className="panel corners p-4 flex flex-wrap items-center gap-3 group
                    hover:border-line-hi transition-colors"
                >
                  <code className="text-[11px] font-mono text-dim shrink-0">{c.reference}</code>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-chalk truncate group-hover:text-white transition-colors">
                      {c.subject}
                    </p>
                    <p className="text-[11px] font-mono text-dim mt-0.5 truncate">
                      {CATEGORIES_RECLAMATION_COURT[c.category]}
                      {c.machine_name && ` · ${c.machine_name}`}
                      {c.booking_reference && ` · ${c.booking_reference}`}
                      {` · ouverte ${fmtRelative(c.created_at)}`}
                    </p>
                  </div>

                  <span className="text-[11px] font-mono text-dim shrink-0">
                    {c.message_count} message{c.message_count > 1 ? "s" : ""}
                  </span>
                  <Etiquette ton={TONS[c.status]} point={c.status === "open"}>
                    {LIBELLES_STATUT_RECLAMATION[c.status]}
                  </Etiquette>
                  <span className="text-dim group-hover:text-chalk transition-colors" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
