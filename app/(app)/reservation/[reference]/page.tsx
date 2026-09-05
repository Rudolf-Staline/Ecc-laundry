import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerProfil } from "@/lib/supabase/session";
import { creerClientServeur } from "@/lib/supabase/server";
import { Etiquette, Bouton } from "@/components/ui";
import { BoutonAnnuler } from "@/components/bouton-annuler";
import { CompteARebours } from "@/components/compte-a-rebours";
import { Tambour } from "@/components/marque";
import { fmtDay, fmtTime, fmtDateTime, fmtRelative } from "@/lib/time";
import { LIBELLES_STATUT, MOTIFS, type BookingStatus, type HistoryRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>;
}): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Réservation ${reference}` };
}

const TONS: Record<BookingStatus, "libre" | "occupe" | "panne" | "neutre" | "info"> = {
  booked: "info",
  checked_in: "occupe",
  completed: "libre",
  cancelled: "neutre",
  cancelled_late: "neutre",
  no_show: "panne",
};

/** Ce que le statut veut dire, en une phrase — plutôt qu'un mot isolé. */
const EXPLICATIONS: Record<BookingStatus, string> = {
  booked: "Le créneau vous est réservé. Pointez le QR code sur la machine en arrivant, sinon il repartira au pot commun.",
  checked_in: "Vous avez pointé, le cycle tourne. Pensez à vider la machine à la fin.",
  completed: "Cycle mené à terme. Il compte dans votre score de fiabilité.",
  cancelled: "Annulée à l'avance : le créneau est retourné aux autres et ne vous a rien coûté.",
  cancelled_late: "Annulée après la limite : la machine a été libérée, mais le créneau reste décompté de votre quota.",
  no_show: "Créneau jamais pointé. La machine est restée bloquée à vide — c'est ce que le score de fiabilité sanctionne.",
};

export default async function PageReservation({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  await exigerProfil("/historique");
  const { reference } = await params;
  const supabase = await creerClientServeur();

  const { data } = await supabase
    .from("v_historique")
    .select("*")
    .eq("reference", reference.toUpperCase())
    .maybeSingle();

  if (!data) notFound();
  const r = data as HistoryRow;

  const debut = new Date(r.starts_at).getTime();
  const fin = new Date(r.ends_at).getTime();
  // Même remarque : rendu dynamique assumé.
  // eslint-disable-next-line react-hooks/purity
  const maintenant = Date.now();
  const enCours = debut <= maintenant && fin > maintenant;
  const aVenir = debut > maintenant;
  const annulable = (r.status === "booked" || r.status === "checked_in") && fin > maintenant;

  const etapes: Array<{ label: string; date: string | null; fait: boolean }> = [
    { label: "Réservée", date: r.created_at, fait: true },
    { label: "Pointée sur la machine", date: r.checked_in_at, fait: Boolean(r.checked_in_at) },
    r.cancelled_at
      ? { label: "Annulée", date: r.cancelled_at, fait: true }
      : { label: "Cycle terminé", date: r.status === "completed" ? r.ends_at : null,
          fait: r.status === "completed" },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/historique"
        className="inline-flex items-center gap-2 text-[11px] font-medium
          tracking-[0.12em] text-dim hover:text-chalk transition-colors"
      >
        ← Historique
      </Link>

      <header className="panel p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <Tambour
              size={52}
              spinning={r.status === "checked_in" ? "cycle" : false}
              className={
                r.status === "checked_in" ? "text-ember"
                : r.status === "no_show" ? "text-coral"
                : r.kind === "washer" ? "text-cat-lavage" : "text-cat-sechage"
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <code className="text-[11px] font-mono text-dim">{r.reference}</code>
                <Etiquette ton={TONS[r.status]} point={r.status === "checked_in"} pulse={enCours}>
                  {LIBELLES_STATUT[r.status]}
                </Etiquette>
                {r.is_night && <Etiquette ton="info">nuit · hors quota</Etiquette>}
              </div>
              <h1 className="display text-2xl sm:text-3xl mt-2.5 text-chalk">{r.machine_name}</h1>
              <p className="text-sm text-mist mt-1.5">{r.room_name}</p>
            </div>
          </div>

          {enCours && (
            <div className="text-right">
              <p className="eyebrow">Temps restant</p>
              <p className="display text-3xl text-ember mt-1">
                <CompteARebours vers={r.ends_at} depuis={r.starts_at} />
              </p>
            </div>
          )}
        </div>

        <p className="text-sm text-mist leading-relaxed mt-6 pt-5 border-t border-line">
          {EXPLICATIONS[r.status]}
        </p>
      </header>

      <section className="panel p-6">
        <p className="eyebrow mb-4">Le créneau</p>
        <dl className="grid sm:grid-cols-2 gap-5 text-sm">
          <div>
            <dt className="eyebrow">Date</dt>
            <dd className="text-chalk mt-1.5">{fmtDay(r.starts_at)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Horaire</dt>
            <dd className="text-chalk mt-1.5 tabular">
              {fmtTime(r.starts_at)} → {fmtTime(r.ends_at)}
              <span className="text-dim"> · {r.duration_minutes / 60} h</span>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Type</dt>
            <dd className="text-mist mt-1.5">
              {r.kind === "washer" ? "Lave-linge" : "Sèche-linge"}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Motif</dt>
            <dd className="text-mist mt-1.5">{r.purpose ? MOTIFS[r.purpose] : "non précisé"}</dd>
          </div>
        </dl>

        {aVenir && (
          <p className="text-[11px] font-mono text-dim mt-5 pt-4 border-t border-line">
            Commence {fmtRelative(r.starts_at)}
          </p>
        )}
      </section>

      {/* Déroulé — ce que le modèle d'origine ne montrait pas du tout */}
      <section className="panel p-6">
        <p className="eyebrow mb-5">Déroulé</p>
        <ol className="space-y-4">
          {etapes.map((e, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span
                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  e.fait ? "bg-acid" : "bg-line-hi"
                }`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className={`text-sm ${e.fait ? "text-chalk" : "text-dim"}`}>{e.label}</p>
                {e.date && (
                  <p className="text-[11px] font-mono text-dim mt-0.5">{fmtDateTime(e.date)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-2">
        {r.status === "booked" && enCours && (
          <Link href="/pointage">
            <Bouton variante="acide">Pointer sur la machine</Bouton>
          </Link>
        )}
        {annulable && <BoutonAnnuler idReservation={r.id} libelle={r.machine_name} />}
        <Link href={`/reclamations/nouvelle?reservation=${r.reference}`}>
          <Bouton variante="secondaire">Signaler un problème</Bouton>
        </Link>
      </div>
    </div>
  );
}
