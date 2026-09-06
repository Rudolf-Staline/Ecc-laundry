import Link from "next/link";
import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { TitreSection, Etiquette } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";
import type { AdminOverview, MachineLive } from "@/lib/types";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

type LigneAudit = {
  id: number; action: string; entity: string; entity_id: string | null;
  created_at: string; details: Record<string, unknown> | null; actor_email: string | null;
};

export default async function PageAdmin() {
  const supabase = await creerClientServeur();

  const [{ data: apercu }, { data: parc }, { data: journal }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.from("v_machine_live").select("*").neq("live_status", "free"),
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  const o = apercu as AdminOverview | null;
  const attention = (parc as MachineLive[])?.filter(
    (m) => m.live_status === "maintenance" || m.live_status === "out_of_order",
  ) ?? [];
  const lignes = (journal as LigneAudit[]) ?? [];

  return (
    <div className="space-y-8">
      <TitreSection surtitre="Pilotage" titre="Vue d'ensemble" />

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 reveal-stagger">
        <Indicateur v={o?.students ?? 0} l="étudiants inscrits" />
        <Indicateur v={o?.bookings_week ?? 0} l="réservations cette semaine" />
        <Indicateur
          v={`${o?.machines_ok ?? 0}/${o?.machines_total ?? 0}`}
          l="machines en service"
          ton={(o?.machines_down ?? 0) > 0 ? "coral" : "acid"}
        />
      </section>

      <section>
        <Raccourci
          href="/admin/pannes"
          titre="Signalements ouverts"
          valeur={o?.open_reports ?? 0}
          urgent={(o?.open_reports ?? 0) > 0}
        />
      </section>

      {attention.length > 0 && (
        <section>
          <p className="eyebrow mb-3">Machines retirées du planning</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {attention.map((m) => (
              <li key={m.machine_id} className="panel p-3.5 flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-coral shrink-0" aria-hidden />
                <span className="text-sm text-chalk truncate">{m.name}</span>
                <span className="text-xs text-dim truncate">{m.room_name}</span>
                <Etiquette ton="panne" className="ml-auto shrink-0">
                  {m.live_status === "maintenance" ? "maintenance" : "hors service"}
                </Etiquette>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="eyebrow mb-3">Journal</p>
        {lignes.length === 0 ? (
          <div className="panel p-5 text-sm text-dim">Aucune action enregistrée.</div>
        ) : (
          <ul className="panel divide-y divide-line">
            {lignes.map((l) => (
              <li key={l.id} className="px-4 py-3 flex items-center gap-3 flex-wrap text-sm">
                <code className="text-[11px] font-mono text-klein-2">{l.action}</code>
                <span className="text-mist truncate">{l.entity}</span>
                <span className="ml-auto text-[11px] font-mono text-dim">
                  {fmtDateTime(l.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Indicateur({
  v, l, ton,
}: { v: number | string; l: string; ton?: "acid" | "coral" | "ember" }) {
  const c = ton === "acid" ? "text-acid" : ton === "coral" ? "text-coral" : ton === "ember" ? "text-ember" : "text-chalk";
  return (
    <div className="panel p-5">
      <p className={`display text-4xl sm:text-5xl tabular ${c}`}>{v}</p>
      <p className="eyebrow mt-2.5">{l}</p>
    </div>
  );
}

function Raccourci({
  href, titre, valeur, urgent,
}: { href: string; titre: string; valeur: number; urgent?: boolean }) {
  return (
    <Link
      href={href}
      className={`panel p-5 flex items-center justify-between gap-3 group transition-colors
        ${urgent ? "border-coral/35 hover:border-coral/60" : "hover:border-line-hi"}`}
    >
      <div>
        <p className="text-sm text-mist">{titre}</p>
        <p className={`display text-3xl mt-1.5 tabular ${urgent ? "text-coral" : "text-chalk"}`}>
          {valeur}
        </p>
      </div>
      <span className="text-dim group-hover:text-chalk transition-colors" aria-hidden>→</span>
    </Link>
  );
}
