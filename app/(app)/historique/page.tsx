import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { TableauHistorique } from "@/components/historique";
import type { HistoryRow, Room } from "@/lib/types";

export const metadata: Metadata = { title: "Historique" };
export const dynamic = "force-dynamic";

export default async function PageHistorique() {
  await exigerProfil("/historique");
  const supabase = await creerClientServeur();

  const [{ data: lignes }, { data: salles }] = await Promise.all([
    supabase.from("v_historique").select("*").order("starts_at", { ascending: false }).limit(500),
    supabase.from("rooms").select("*").order("position"),
  ]);

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Toutes vos réservations" titre="Historique" />
      <TableauHistorique
        lignes={(lignes as HistoryRow[]) ?? []}
        buanderies={(salles as Room[]) ?? []}
      />
    </div>
  );
}
