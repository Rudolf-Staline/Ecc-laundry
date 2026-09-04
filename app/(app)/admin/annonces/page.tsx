import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { GestionAnnonces } from "@/components/admin/gestion-annonces";
import type { Announcement } from "@/lib/types";

export const metadata: Metadata = { title: "Annonces" };
export const dynamic = "force-dynamic";

export default async function PageAdminAnnonces() {
  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .order("starts_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6 max-w-3xl">
      <TitreSection surtitre="Communication" titre="Annonces" />
      <p className="text-sm text-mist leading-relaxed">
        Une annonce active s&apos;affiche en bandeau en haut de toutes les pages,
        pour tous les étudiants. Chacun peut la masquer une fois lue.
      </p>
      <GestionAnnonces annonces={(data as Announcement[]) ?? []} />
    </div>
  );
}
