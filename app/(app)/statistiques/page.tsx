import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection } from "@/components/ui";
import { Heatmap } from "@/components/heatmap";
import { AnneauQuota } from "@/components/anneau-quota";
import { JOURS } from "@/lib/time";
import type { AffluenceCell, MyStats, Room, WeekStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

export default async function PageStatistiques() {
  await exigerProfil("/statistiques");
  const supabase = await creerClientServeur();

  const [{ data: stats }, { data: affluence }, { data: semaine }, { data: salles }] =
    await Promise.all([
      supabase.rpc("my_stats"),
      supabase.rpc("affluence", { p_room_id: null, p_weeks: 8 }),
      supabase.rpc("my_week_status"),
      supabase.from("rooms").select("*").eq("is_active", true).order("position"),
    ]);

  const s = stats as MyStats | null;
  const grille = (affluence as AffluenceCell[]) ?? [];
  const sem = (Array.isArray(semaine) ? semaine[0] : semaine) as WeekStatus | null;
  const buanderies = (salles as Room[]) ?? [];

  const heures = buanderies[0]
    ? { debut: Number(buanderies[0].opens_at.slice(0, 2)), fin: Number(buanderies[0].closes_at.slice(0, 2)) }
    : { debut: 7, fin: 23 };

  return (
    <div className="space-y-10">
      <TitreSection
        surtitre="Vos chiffres"
        titre="Statistiques"
        apres={sem ? <AnneauQuota utilises={sem.used} quota={sem.quota} /> : undefined}
      />

      {/* Chiffres personnels — des tuiles, pas des graphiques :
          quatre valeurs isolées se lisent mieux nues. */}
      <section className="grid grid-cols-2 gap-2.5 reveal-stagger">
        <Tuile valeur={s?.total ?? 0} libelle="réservations" detail="depuis l'inscription" />
        <Tuile valeur={s?.completed ?? 0} libelle="cycles menés à terme" ton="acid" />
      </section>

      {/* Empreinte */}
      <section className="panel p-6 sm:p-7">
        <p className="eyebrow">Empreinte</p>
        <h2 className="display text-2xl mt-2 text-chalk">Ce que vos cycles ont consommé</h2>
        <div className="grid sm:grid-cols-2 gap-6 mt-6">
          <div>
            <p className="display text-5xl text-klein tabular">
              {(s?.water_liters ?? 0).toLocaleString("fr-FR")}
              <span className="text-xl text-mist ml-2">L</span>
            </p>
            <p className="text-sm text-mist mt-2 leading-relaxed">
              d&apos;eau, soit environ{" "}
              <span className="text-chalk">
                {Math.round((s?.water_liters ?? 0) / 150)} baignoire
                {Math.round((s?.water_liters ?? 0) / 150) > 1 ? "s" : ""}
              </span>.
            </p>
          </div>
          <div>
            <p className="display text-5xl text-ember tabular">
              {(s?.kwh ?? 0).toLocaleString("fr-FR")}
              <span className="text-xl text-mist ml-2">kWh</span>
            </p>
            <p className="text-sm text-mist mt-2 leading-relaxed">
              d&apos;électricité. Laver à 30 °C plutôt qu&apos;à 60 °C en économise environ
              deux tiers.
            </p>
          </div>
        </div>
      </section>

      {/* Affluence */}
      <section>
        <div className="mb-5">
          <p className="eyebrow">Huit dernières semaines</p>
          <h2 className="display text-2xl mt-1.5 text-chalk">Quand la buanderie est prise</h2>
          <p className="text-sm text-mist mt-2 max-w-xl leading-relaxed">
            Plus la case est dense, plus le créneau part vite. Les cases claires sont
            vos meilleures chances de trouver une machine libre.
          </p>
        </div>
        <Heatmap cellules={grille} heureDebut={heures.debut} heureFin={heures.fin} />
      </section>

      {/* Habitudes */}
      {(s?.favourite_hour != null || s?.favourite_dow != null) && (
        <section className="panel p-6">
          <p className="eyebrow">Vos habitudes</p>
          <p className="text-lg text-chalk mt-3 leading-relaxed">
            Vous lavez surtout{" "}
            {s.favourite_dow != null && (
              <span className="text-klein">le {JOURS[s.favourite_dow - 1]}</span>
            )}
            {s.favourite_hour != null && (
              <>
                {" "}vers{" "}
                <span className="text-klein tabular">
                  {String(s.favourite_hour).padStart(2, "0")}:00
                </span>
              </>
            )}
            .
          </p>
        </section>
      )}
    </div>
  );
}

function Tuile({
  valeur, libelle, detail, suffixe, ton,
}: {
  valeur: number;
  libelle: string;
  detail?: string;
  suffixe?: string;
  ton?: "acid" | "coral" | "ember";
}) {
  const couleur =
    ton === "acid" ? "text-acid" : ton === "coral" ? "text-coral" : ton === "ember" ? "text-ember" : "text-chalk";
  return (
    <div className="panel p-5">
      <p className={`display text-4xl sm:text-5xl tabular ${couleur}`}>
        {valeur.toLocaleString("fr-FR")}
        {suffixe && <span className="text-lg text-dim ml-1">{suffixe}</span>}
      </p>
      <p className="eyebrow mt-2.5">{libelle}</p>
      {detail && <p className="text-[11px] text-dim mt-1.5">{detail}</p>}
    </div>
  );
}
