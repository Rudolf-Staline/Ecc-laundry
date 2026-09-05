import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { GestionMachines } from "@/components/admin/gestion-machines";
import type { Machine, Room } from "@/lib/types";

export const metadata: Metadata = { title: "Machines" };
export const dynamic = "force-dynamic";

export default async function PageAdminMachines() {
  const supabase = await creerClientServeur();
  const [{ data: machines }, { data: salles }] = await Promise.all([
    supabase.from("machines").select("id, room_id, name, kind, status, capacity_kg, brand, model, cycle_minutes, position, note").order("room_id").order("position"),
    supabase.from("rooms").select("*").order("position"),
  ]);

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Parc" titre="Machines" />
      <GestionMachines
        machinesInitiales={(machines as Machine[]) ?? []}
        buanderies={(salles as Room[]) ?? []}
      />
    </div>
  );
}
