import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { Preferences } from "@/components/preferences";
import { TitreSection, Etiquette } from "@/components/ui";
import { urlSite } from "@/lib/config";

export const metadata: Metadata = { title: "Mon compte" };
export const dynamic = "force-dynamic";

export default async function PageCompte() {
  const profil = await exigerProfil("/compte");

  return (
    <div className="max-w-2xl space-y-8">
      <TitreSection surtitre="Réglages" titre="Mon compte" />

      {/* Identité */}
      <section className="panel p-6">
        <div className="flex items-start gap-4">
          <span className="w-14 h-14 rounded-full bg-klein/15 border border-klein/40 grid place-items-center
            display text-lg text-klein-2 shrink-0">
            {profil.first_name[0]}{profil.last_name[0]}
          </span>
          <div className="min-w-0">
            <p className="display text-2xl text-chalk">{profil.display_name}</p>
            <p className="text-sm text-mist font-mono mt-1 break-all">{profil.email}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Etiquette ton={profil.role === "admin" ? "info" : "neutre"}>
                {profil.role === "admin" ? "administrateur" : "étudiant"}
              </Etiquette>
            </div>
          </div>
        </div>
      </section>

      <Preferences profil={profil} urlBase={urlSite} />
    </div>
  );
}
