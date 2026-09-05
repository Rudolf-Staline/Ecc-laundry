import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { CalendrierReservations } from "@/components/calendrier-reservations";
import type { HistoryRow } from "@/lib/types";

export const metadata: Metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

export default async function PageCalendrier() {
  await exigerProfil("/calendrier");
  const supabase = await creerClientServeur();

  const { data } = await supabase
    .from("v_historique")
    .select("*")
    .order("starts_at", { ascending: true })
    .limit(750);

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Vos créneaux dans le temps" titre="Calendrier des réservations" />
      <CalendrierReservations lignes={(data as HistoryRow[]) ?? []} />
    </div>
  );
}
