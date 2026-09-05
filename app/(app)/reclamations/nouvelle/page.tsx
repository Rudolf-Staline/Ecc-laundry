import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { FormulaireReclamation } from "@/components/reclamation-formulaire";
import type { HistoryRow, MachineLive } from "@/lib/types";

export const metadata: Metadata = { title: "Nouvelle réclamation" };
export const dynamic = "force-dynamic";

export default async function PageNouvelleReclamation({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string; machine?: string }>;
}) {
  await exigerProfil("/reclamations/nouvelle");
  const { reservation, machine } = await searchParams;
  const supabase = await creerClientServeur();

  // Server Component en rendu dynamique : lire l'heure de la requête est
  // l'objet même de `force-dynamic`. La règle de pureté vise les composants
  // client, où un re-rendu donnerait une autre valeur.
  // eslint-disable-next-line react-hooks/purity
  const instant = Date.now();

  // Seules les réservations récentes sont proposées : une réclamation sur un
  // créneau d'il y a six mois n'a plus de prise sur le réel.
  const [{ data: reservations }, { data: parc }] = await Promise.all([
    supabase
      .from("v_historique")
      .select("id, reference, starts_at, machine_name, room_name, status")
      .gte("starts_at", new Date(instant - 60 * 86_400_000).toISOString())
      .order("starts_at", { ascending: false })
      .limit(40),
    supabase.from("v_machine_live").select("machine_id, name, room_name").order("room_name"),
  ]);

  return (
    <div className="space-y-7 max-w-2xl">
      <TitreSection surtitre="Réclamations" titre="Déposer un dossier" />
      <FormulaireReclamation
        reservations={(reservations as Pick<HistoryRow,
          "id" | "reference" | "starts_at" | "machine_name" | "room_name" | "status">[]) ?? []}
        machines={(parc as Pick<MachineLive, "machine_id" | "name" | "room_name">[]) ?? []}
        reservationPreselectionnee={reservation}
        machinePreselectionnee={machine}
      />
    </div>
  );
}
