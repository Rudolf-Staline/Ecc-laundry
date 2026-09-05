import Link from "next/link";
import type { Metadata } from "next";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { AnneauQuota } from "@/components/anneau-quota";
import { CompteARebours } from "@/components/compte-a-rebours";
import { Tambour } from "@/components/marque";
import { Etiquette, Vide } from "@/components/ui";
import { BoutonAnnuler } from "@/components/bouton-annuler";
import { fmtDay, fmtRelative, fmtTime } from "@/lib/time";
import { compterParc } from "@/lib/data";
import type { BoardRow, MachineLive, WaitlistEntry, WeekStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

export default async function PageTableau() {
  const profil = await exigerProfil("/tableau");
  const supabase = await creerClientServeur();

  const [{ data: mesReservations }, { data: statut }, { data: parc }, { data: attente }] =
    await Promise.all([
      supabase
        .from("v_board")
        .select("*")
        .eq("user_id", profil.id)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at")
        .limit(10),
      supabase.rpc("my_week_status"),
      supabase.from("v_machine_live").select("*").order("room_name").order("position"),
      supabase
        .from("waitlist")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at"),
    ]);

  const reservations = (mesReservations as BoardRow[]) ?? [];
  const semaine = (Array.isArray(statut) ? statut[0] : statut) as WeekStatus | null;
  const machines = (parc as MachineLive[]) ?? [];
  const file = (attente as WaitlistEntry[]) ?? [];
  const n = compterParc(machines);

  // Server Component en rendu dynamique : lire l'heure de la requête est
  // précisément l'objet de `force-dynamic`. La règle de pureté cible les
  // composants client, où un re-rendu donnerait une valeur différente.
  // eslint-disable-next-line react-hooks/purity
  const maintenant = Date.now();
  const enCours = reservations.filter(
    (r) => new Date(r.starts_at).getTime() <= maintenant && new Date(r.ends_at).getTime() > maintenant,
  );
  const aVenir = reservations.filter((r) => new Date(r.starts_at).getTime() > maintenant);
  const suspendu = profil.suspended_until && new Date(profil.suspended_until) > new Date();

  return (
    <div className="space-y-8">
      {/* Salutation */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{fmtDay(new Date())}</p>
          <h1 className="display text-3xl sm:text-5xl mt-2 text-chalk">
            Bonjour {profil.first_name}.
          </h1>
          <p className="text-mist mt-3 max-w-lg leading-relaxed">
            {enCours.length > 0
              ? "Un cycle tourne en ce moment. Pensez à venir vider la machine à la fin."
              : aVenir.length > 0
                ? `Prochain créneau ${fmtRelative(aVenir[0].starts_at)}.`
                : n.libres > 0
                  ? `${n.libres} machine${n.libres > 1 ? "s" : ""} libre${n.libres > 1 ? "s" : ""} en ce moment.`
                  : "Toutes les machines tournent. La grille de demain est ouverte."}
          </p>
        </div>
        {semaine && <AnneauQuota utilises={semaine.used} quota={semaine.quota} taille={88} />}
      </div>

      {/* Le parc en quatre chiffres, avant tout le reste : la question qu'on se
          pose en arrivant, c'est « y a-t-il une machine ». */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tuile etiquette="Machines libres" valeur={String(n.libres)}
               legende={`sur ${n.total} au total`} ton={n.libres > 0 ? "menthe" : "coral"} />
        <Tuile etiquette="En marche" valeur={String(n.occupees)}
               legende="cycles en cours" ton="klein" />
        <Tuile etiquette="Créneaux restants" valeur={semaine ? String(semaine.remaining) : "—"}
               legende={semaine ? `sur ${semaine.quota} cette semaine` : "cette semaine"}
               ton={semaine && semaine.remaining === 0 ? "coral" : "neutre"} />
        <Tuile etiquette="Hors service" valeur={String(n.indisponibles)}
               legende={n.indisponibles === 0 ? "tout fonctionne" : "signalées ou retirées"}
               ton={n.indisponibles > 0 ? "acid" : "neutre"} />
      </section>

      {suspendu && (
        <div className="panel border-coral/35 bg-coral-fond/40 px-4 py-3.5 flex items-start gap-3" role="alert">
          <span className="point bg-coral mt-[7px] shrink-0" aria-hidden />
          <div>
            <p className="text-sm text-chalk">Compte suspendu</p>
            <p className="text-sm text-mist mt-1">
              Vous pourrez à nouveau réserver {fmtRelative(profil.suspended_until!)}. Les absences
              répétées bloquent les machines pour tout le monde.
            </p>
          </div>
        </div>
      )}

      {/* Cycle en cours */}
      {enCours.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          {enCours.map((r) => (
            <article key={r.id} className="panel p-5 flex items-center gap-5">
              <Tambour size={54} spinning="cycle" className="text-klein shrink-0" />
              <div className="min-w-0 flex-1">
                <Etiquette ton="occupe" point pulse>
                  {r.status === "checked_in" ? "cycle en cours" : "créneau ouvert"}
                </Etiquette>
                <p className="display text-lg text-chalk mt-2 truncate">{r.machine_name}</p>
                <p className="text-xs text-dim tabular mt-0.5">
                  {fmtTime(r.starts_at)} → {fmtTime(r.ends_at)}
                </p>
                <p className="display text-2xl text-klein mt-2 tabular">
                  <CompteARebours vers={r.ends_at} depuis={r.starts_at} />
                </p>
                {r.status === "booked" && (
                  <Link
                    href="/pointage"
                    className="inline-block text-[11px] font-medium
                      text-acid hover:underline mt-3"
                  >
                    → Pointer sur la machine
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Prochaines réservations */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow">À venir</p>
            <h2 className="display text-2xl mt-1.5 text-chalk">Vos créneaux</h2>
          </div>
          <Link
            href="/reserver"
            className="text-[11px] font-medium text-klein-2 hover:text-chalk transition-colors"
          >
            + Réserver
          </Link>
        </div>

        {aVenir.length === 0 ? (
          <Vide
            titre="Aucun créneau réservé"
            detail="La grille est ouverte sur les deux prochaines semaines. Les créneaux de 8 h et de 20 h partent en premier."
            action={
              <Link
                href="/reserver"
                className="inline-flex items-center gap-2 bg-encre text-ink rounded-[8px]
                  px-5 py-2.5 text-[13px] font-semibold hover:opacity-88 transition-opacity"
              >
                Ouvrir le planning →
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-2.5 reveal-stagger">
            {aVenir.map((r) => (
              <li key={r.id} className="panel p-4 flex items-center gap-4 flex-wrap">
                <Tambour
                  size={34}
                  className={r.kind === "washer" ? "text-cat-lavage" : "text-cat-sechage"}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-chalk font-medium truncate">{r.machine_name}</p>
                  <p className="text-xs text-mist mt-0.5">
                    {fmtDay(r.starts_at)} · {fmtTime(r.starts_at)} → {fmtTime(r.ends_at)}
                    {r.duration_minutes > 60 && (
                      <span className="text-dim"> · {r.duration_minutes / 60} h</span>
                    )}
                    {r.is_night && <span className="text-klein-2"> · nuit, hors quota</span>}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-dim tabular">
                  {fmtRelative(r.starts_at)}
                </span>
                <BoutonAnnuler idReservation={r.id} libelle={r.machine_name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* File d'attente */}
      {file.length > 0 && (
        <section>
          <p className="eyebrow mb-3">File d&apos;attente</p>
          <ul className="grid gap-2">
            {file.map((w) => (
              <li key={w.id} className="panel p-3.5 flex items-center gap-3 text-sm">
                <Etiquette ton="info" point pulse>en attente</Etiquette>
                <span className="text-mist">
                  {w.kind === "washer" ? "Lave-linge" : "Sèche-linge"} · {fmtDay(w.starts_at)} à{" "}
                  {fmtTime(w.starts_at)}
                </span>
                <span className="ml-auto text-[11px] font-mono text-dim">
                  {fmtRelative(w.starts_at)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-dim mt-3 leading-relaxed">
            À la première annulation sur l&apos;un de ces créneaux, la machine vous est attribuée
            automatiquement — dans l&apos;ordre d&apos;inscription.
          </p>
        </section>
      )}

      {/* Coup d'œil sur le parc */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow">En direct</p>
            <h2 className="display text-2xl mt-1.5 text-chalk">Le parc</h2>
          </div>
          <Link
            href="/machines"
            className="text-[11px] font-medium text-klein-2 hover:text-chalk transition-colors"
          >
            Tout voir →
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { v: n.libres, l: "libres", c: "text-acid" },
            { v: n.occupees, l: "en cycle", c: "text-ember" },
            { v: n.indisponibles, l: "indisponibles", c: "text-coral" },
          ].map((s) => (
            <div key={s.l} className="panel p-4 sm:p-5">
              <p className={`display text-4xl sm:text-5xl tabular ${s.c}`}>{s.v}</p>
              <p className="eyebrow mt-2">{s.l}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Tuile de tête ────────────────────────────────────────────────────────── */
function Tuile({
  etiquette, valeur, legende, ton = "neutre",
}: {
  etiquette: string;
  valeur: string;
  legende: string;
  ton?: "neutre" | "menthe" | "klein" | "acid" | "coral";
}) {
  const teinte = {
    neutre: "text-chalk",
    menthe: "text-menthe",
    klein: "text-klein",
    acid: "text-acid",
    coral: "text-coral",
  }[ton];

  return (
    <div className="panel px-4 py-3.5">
      <p className="eyebrow">{etiquette}</p>
      <p className={`tabular text-[28px] leading-none mt-2.5 ${teinte}`}>{valeur}</p>
      <p className="text-[12px] text-dim mt-1.5">{legende}</p>
    </div>
  );
}
