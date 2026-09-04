import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { Planning } from "@/components/planning";
import { Vide } from "@/components/ui";
import { startOfDay, daySpan } from "@/lib/time";
import type { BoardRow, Machine, Room, WaitlistEntry, WeekStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Réserver" };
export const dynamic = "force-dynamic";

export default async function PageReserver() {
  const profil = await exigerProfil("/reserver");
  const supabase = await creerClientServeur();

  const [{ data: rooms }, { data: machines }, { data: reglages }] = await Promise.all([
    supabase.from("rooms").select("*").eq("is_active", true).order("position"),
    supabase.from("machines").select("*").order("position"),
    supabase.from("settings").select("key, value").in("key", ["booking_horizon_days"]),
  ]);

  const horizon = Number(
    (reglages ?? []).find((r: { key: string; value: string }) => r.key === "booking_horizon_days")?.value ?? 14,
  );

  const debut = startOfDay(new Date());
  const jours = daySpan(debut, horizon);
  const fin = new Date(jours[jours.length - 1].getTime() + 86_400_000);

  const [{ data: board }, { data: statut }, { data: attente }] = await Promise.all([
    supabase
      .from("v_board")
      .select("*")
      .gte("starts_at", debut.toISOString())
      .lt("starts_at", fin.toISOString())
      .order("starts_at"),
    supabase.rpc("my_week_status"),
    supabase.from("waitlist").select("*").gte("starts_at", debut.toISOString()),
  ]);

  if (!rooms || rooms.length === 0) {
    return (
      <Vide
        titre="Aucune buanderie ouverte"
        detail="Le parc n'a pas encore été renseigné, ou toutes les buanderies sont fermées. Un administrateur peut y remédier depuis la console."
      />
    );
  }

  return (
    <Planning
      profil={profil}
      buanderies={rooms as Room[]}
      machines={(machines as Machine[]) ?? []}
      planningInitial={(board as BoardRow[]) ?? []}
      statutInitial={(Array.isArray(statut) ? statut[0] : statut) as WeekStatus}
      attenteInitiale={(attente as WaitlistEntry[]) ?? []}
      horizonJours={horizon}
    />
  );
}
