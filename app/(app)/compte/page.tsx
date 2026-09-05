import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { Preferences } from "@/components/preferences";
import { TitreSection, Etiquette } from "@/components/ui";
import { urlSite } from "@/lib/config";
import { fmtRelative } from "@/lib/time";
import type { MyStats } from "@/lib/types";

export const metadata: Metadata = { title: "Mon compte" };
export const dynamic = "force-dynamic";

export default async function PageCompte() {
  const profil = await exigerProfil("/compte");
  const supabase = await creerClientServeur();
  const { data } = await supabase.rpc("my_stats");
  const stats = data as MyStats | null;

  const fiabilite = stats?.karma ?? profil.karma;
  const suspendu = profil.suspended_until && new Date(profil.suspended_until) > new Date();

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
              <Etiquette ton={fiabilite >= 80 ? "libre" : fiabilite >= 40 ? "occupe" : "panne"}>
                fiabilité {fiabilite}/100
              </Etiquette>
              {suspendu && (
                <Etiquette ton="panne" point>
                  suspendu · reprise {fmtRelative(profil.suspended_until!)}
                </Etiquette>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-dim mt-5 pt-4 border-t border-line leading-relaxed">
          La fiabilité baisse à chaque créneau réservé puis jamais pointé, et remonte
          à chaque cycle mené à terme. Elle ne sert qu&apos;à repérer les comptes qui
          bloquent des machines à vide.
        </p>
      </section>

      <Preferences profil={profil} urlBase={urlSite} />
    </div>
  );
}
