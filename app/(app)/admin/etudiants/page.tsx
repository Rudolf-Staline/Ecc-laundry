import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { GestionEtudiants } from "@/components/admin/gestion-etudiants";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Étudiants" };
export const dynamic = "force-dynamic";

export default async function PageAdminEtudiants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await creerClientServeur();

  let requete = supabase.from("profiles").select("*").order("display_name").limit(200);
  if (q?.trim()) requete = requete.ilike("email", `%${q.trim()}%`);

  const { data } = await requete;

  return (
    <div className="space-y-6">
      <TitreSection surtitre="Comptes" titre="Étudiants" />
      <GestionEtudiants profils={(data as Profile[]) ?? []} rechercheInitiale={q ?? ""} />
    </div>
  );
}
