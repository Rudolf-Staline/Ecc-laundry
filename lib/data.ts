import { creerClientServeur } from "@/lib/supabase/server";
import { supabaseConfigure } from "@/lib/config";
import type { Announcement, MachineLive, Room, Setting } from "@/lib/types";

/**
 * Lectures serveur tolérantes : tant que Supabase n'est pas branché (ou si la
 * requête échoue), on renvoie du vide plutôt que de casser la page.
 */

export async function lireParcPublic(): Promise<MachineLive[]> {
  if (!supabaseConfigure) return [];
  try {
    const supabase = await creerClientServeur();
    const { data } = await supabase
      .from("v_machine_live")
      .select("*")
      .order("room_name")
      .order("position");
    return (data as MachineLive[]) ?? [];
  } catch {
    return [];
  }
}

export async function lireBuanderies(): Promise<Room[]> {
  if (!supabaseConfigure) return [];
  try {
    const supabase = await creerClientServeur();
    const { data } = await supabase.from("rooms").select("*").order("position");
    return (data as Room[]) ?? [];
  } catch {
    return [];
  }
}

export async function lireAnnonces(): Promise<Announcement[]> {
  if (!supabaseConfigure) return [];
  try {
    const supabase = await creerClientServeur();
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("starts_at", { ascending: false })
      .limit(3);
    return (data as Announcement[]) ?? [];
  } catch {
    return [];
  }
}

export async function lireReglages(): Promise<Record<string, Setting>> {
  if (!supabaseConfigure) return {};
  try {
    const supabase = await creerClientServeur();
    const { data } = await supabase.from("settings").select("*").order("position");
    const out: Record<string, Setting> = {};
    for (const s of (data as Setting[]) ?? []) out[s.key] = s;
    return out;
  } catch {
    return {};
  }
}

/** Répartition libre / en cycle / indisponible du parc. */
export function compterParc(parc: MachineLive[]) {
  return {
    total: parc.length,
    libres: parc.filter((m) => m.live_status === "free").length,
    occupees: parc.filter((m) => m.live_status === "busy").length,
    indisponibles: parc.filter((m) => m.live_status === "maintenance" || m.live_status === "out_of_order").length,
    laveuses: parc.filter((m) => m.kind === "washer").length,
    secheuses: parc.filter((m) => m.kind === "dryer").length,
  };
}
