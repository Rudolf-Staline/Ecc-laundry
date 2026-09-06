import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection, Vide } from "@/components/ui";
import { CalendrierReservations } from "@/components/calendrier-reservations";
import type { Machine, Room } from "@/lib/types";

export const metadata: Metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

export default async function PageCalendrier() {
  await exigerProfil("/calendrier");
  const supabase = await creerClientServeur();

  const [{ data: rooms }, { data: machines }] = await Promise.all([
    supabase.from("rooms").select("*").eq("is_active", true).order("position"),
    supabase
      .from("machines")
      .select("id, room_id, name, kind, status, capacity_kg, brand, model, cycle_minutes, position, note")
      .order("position"),
  ]);

  if (!rooms || rooms.length === 0) {
    return <Vide titre="Aucune buanderie ouverte" detail="Aucune buanderie ouverte." />;
  }

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Qui a réservé quoi, aujourd'hui" titre="Calendrier des réservations" />
      <CalendrierReservations buanderies={rooms as Room[]} machines={(machines as Machine[]) ?? []} />
    </div>
  );
}
