import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAdmin } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { FilReclamation } from "@/components/reclamation-fil";
import type { ClaimMessage, ClaimRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>;
}): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Réclamation ${reference}` };
}

export default async function PageAdminReclamation({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const profil = await exigerAdmin();
  const { reference } = await params;
  const supabase = await creerClientServeur();

  const { data: dossier } = await supabase
    .from("v_reclamations")
    .select("*")
    .eq("reference", reference.toUpperCase())
    .maybeSingle();

  if (!dossier) notFound();

  const { data: messages } = await supabase
    .from("claim_messages")
    .select("*")
    .eq("claim_id", (dossier as ClaimRow).id)
    .order("created_at");

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/reclamations"
        className="inline-flex items-center gap-2 text-[11px] font-mono uppercase
          tracking-[0.12em] text-dim hover:text-chalk transition-colors"
      >
        ← File des réclamations
      </Link>

      <FilReclamation
        dossier={dossier as ClaimRow}
        messagesInitiaux={(messages as ClaimMessage[]) ?? []}
        moi={profil}
        vueAdmin
      />
    </div>
  );
}
