import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { TableauParc } from "@/components/tableau-parc";
import type { MachineLive, MachineReport } from "@/lib/types";

export const metadata: Metadata = { title: "Machines" };
export const dynamic = "force-dynamic";

export default async function PageMachines() {
  await exigerProfil("/machines");
  const supabase = await creerClientServeur();

  const [{ data: parc }, { data: signalements }] = await Promise.all([
    supabase.from("v_machine_live").select("*").order("room_name").order("position"),
    supabase.from("machine_reports").select("*").eq("status", "open"),
  ]);

  return (
    <TableauParc
      parcInitial={(parc as MachineLive[]) ?? []}
      signalements={(signalements as MachineReport[]) ?? []}
    />
  );
}
