import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { Pointage } from "@/components/pointage";
import type { BoardRow } from "@/lib/types";

export const metadata: Metadata = { title: "Pointer" };
export const dynamic = "force-dynamic";

export default async function PagePointage() {
  const profil = await exigerProfil("/pointage");
  const supabase = await creerClientServeur();

  // Les créneaux « pointables » : ouverts, à moi, et en cours ou imminents.
  // Même remarque que sur le tableau de bord : rendu dynamique assumé.
  // eslint-disable-next-line react-hooks/purity
  const instant = Date.now();

  const { data } = await supabase
    .from("v_board")
    .select("*")
    .eq("user_id", profil.id)
    .eq("status", "booked")
    .gte("ends_at", new Date(instant).toISOString())
    .lte("starts_at", new Date(instant + 60 * 60_000).toISOString())
    .order("starts_at");

  return <Pointage aPointer={(data as BoardRow[]) ?? []} />;
}
