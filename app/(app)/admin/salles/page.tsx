import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { GestionSalles } from "@/components/admin/gestion-salles";
import type { Machine, Room } from "@/lib/types";

export const metadata: Metadata = { title: "Buanderies" };
export const dynamic = "force-dynamic";

export default async function PageAdminSalles() {
  const supabase = await creerClientServeur();
  const [{ data: salles }, { data: machines }] = await Promise.all([
    supabase.from("rooms").select("*").order("position"),
    supabase.from("machines").select("id, room_id"),
  ]);

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Lieux" titre="Buanderies" />
      <p className="text-sm text-mist max-w-2xl leading-relaxed">
        La buanderie porte les horaires et la durée des créneaux : ce sont eux qui
        dessinent la grille de réservation et que la base vérifie à chaque demande.
      </p>
      <GestionSalles
        sallesInitiales={(salles as Room[]) ?? []}
        machines={(machines as Pick<Machine, "id" | "room_id">[]) ?? []}
      />
    </div>
  );
}
