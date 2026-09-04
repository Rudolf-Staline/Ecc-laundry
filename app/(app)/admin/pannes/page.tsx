import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { GestionPannes } from "@/components/admin/gestion-pannes";

export const metadata: Metadata = { title: "Pannes" };
export const dynamic = "force-dynamic";

export type LignePanne = {
  id: string; machine_id: string; category: string; message: string;
  status: "open" | "acknowledged" | "resolved" | "rejected";
  admin_note: string | null; created_at: string;
  machines: { name: string; status: string; rooms: { name: string } | null } | null;
  profiles: { display_name: string } | null;
};

export default async function PageAdminPannes() {
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("machine_reports")
    .select("*, machines(name, status, rooms(name)), profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(120);

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Maintenance" titre="Signalements" />
      <GestionPannes signalements={(data as unknown as LignePanne[]) ?? []} />
    </div>
  );
}
