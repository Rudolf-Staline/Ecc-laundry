import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { EditeurReglages } from "@/components/admin/editeur-reglages";
import type { Setting } from "@/lib/types";

export const metadata: Metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

export default async function PageReglages() {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("settings").select("*").order("position");

  return (
    <div className="space-y-6 max-w-3xl">
      <TitreSection surtitre="Paramètres du service" titre="Réglages" />
      <p className="text-sm text-mist leading-relaxed max-w-2xl">
        Ces valeurs sont lues directement par les règles de la base : une modification
        s&apos;applique à la réservation suivante, sans redéploiement. Le quota
        hebdomadaire est vérifié côté serveur — le modifier ici le modifie partout.
      </p>
      <EditeurReglages reglages={(data as Setting[]) ?? []} />
    </div>
  );
}
