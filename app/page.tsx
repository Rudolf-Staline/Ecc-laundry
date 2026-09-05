import Link from "next/link";
import { Tambour, Logotype } from "@/components/marque";
import { BasculeTheme } from "@/components/theme-bascule";
import { Etiquette } from "@/components/ui";
import { lireParcPublic, compterParc } from "@/lib/data";
import { supabaseConfigure, NOM_ECOLE } from "@/lib/config";
import { fmtTime } from "@/lib/time";

export const revalidate = 30;

export default async function Accueil() {
  const parc = await lireParcPublic();
  const n = compterParc(parc);
  const enCycle = parc.filter((m) => m.live_status === "busy" && m.busy_until);

  return (
    <div className="relative z-10 min-h-dvh flex flex-col">
      <header className="border-b border-line sticky top-0 z-40 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 h-16 flex items-center justify-between">
          <Logotype />
          <div className="flex items-center gap-2.5">
            <BasculeTheme />
            <Link
              href="/connexion"
              className="inline-flex items-center bg-encre text-ink
                rounded-[8px] px-4 py-2 text-[13px] font-semibold
                hover:opacity-88 transition-opacity"
            >
              Entrer
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-[1180px] px-5 sm:px-8 pt-12 pb-10">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
            <div className="reveal-stagger">
              <p className="eyebrow">{NOM_ECOLE} · Résidences</p>

              <h1 className="display text-[clamp(1.9rem,4.5vw,3rem)] mt-3 text-chalk">
                Le linge n&apos;attend pas.
              </h1>

              <p className="text-mist text-[15px] mt-4 max-w-lg">
                Le planning de la buanderie des résidences. Créneaux d&apos;une ou deux
                heures, quatre par semaine.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 mt-6">
                <Link
                  href="/connexion"
                  className="group inline-flex items-center gap-2.5 bg-encre text-ink
                    rounded-[8px] px-6 py-3 text-[14px] font-semibold
                    hover:opacity-88 transition-opacity active:scale-[0.99]"
                >
                  Réserver une machine
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
                <Link
                  href="#parc"
                  className="inline-flex items-center gap-2 border border-line-hi text-mist
                    rounded-[8px] px-5 py-3.5 text-[13px] font-medium
                    hover:text-chalk hover:border-mist transition-colors"
                >
                  Voir le parc
                </Link>
              </div>

              <p className="text-[13px] text-dim mt-6">
                Accès réservé aux adresses <span className="text-mist">prenom.nom@centrale-casablanca.ma</span>
              </p>
            </div>

            <div className="relative flex items-center justify-center lg:justify-end order-first lg:order-last">
              <div className="relative">
                <div
                  className="absolute inset-6 rounded-full bg-klein-fond"
                  aria-hidden
                />
                <Tambour
                  size={250}
                  spinning="cycle"
                  strokeWidth={1}
                  className="relative text-klein w-[min(54vw,330px)] h-auto"
                />
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="text-center rounded-full bg-ink/85 backdrop-blur-sm
                    w-[46%] aspect-square grid place-content-center px-2">
                    <p className="display text-[clamp(2.5rem,7vw,3.5rem)] text-chalk tabular leading-none">
                      {n.libres}
                    </p>
                    <p className="eyebrow mt-2 text-mist">
                      {n.libres > 1 ? "libres" : "libre"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="parc" className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
            <div>
              <h2 className="display text-2xl sm:text-3xl text-chalk">État du parc</h2>
            </div>
            {supabaseConfigure && parc.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Etiquette ton="libre" point>{n.libres} libres</Etiquette>
                <Etiquette ton="occupe" point pulse={n.occupees > 0}>{n.occupees} en cycle</Etiquette>
                {n.indisponibles > 0 && <Etiquette ton="panne" point>{n.indisponibles} hors service</Etiquette>}
              </div>
            )}
          </div>

          {!supabaseConfigure ? (
            <ConfigManquante />
          ) : parc.length === 0 ? (
            <div className="panel px-6 py-14 text-center">
              <Tambour size={48} spinning className="text-line-hi mx-auto mb-4" />
              <p className="text-mist">Aucune machine enregistrée.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 reveal-stagger">
                {parc.map((m) => (
                  <CarteApercu key={m.machine_id} m={m} />
                ))}
              </div>

              {enCycle.length > 0 && (
                <p className="text-[13px] text-dim mt-6">
                  Prochaine machine libre à{" "}
                  <span className="text-acid">
                    {fmtTime(
                      enCycle
                        .map((m) => new Date(m.busy_until!))
                        .sort((a, b) => a.getTime() - b.getTime())[0],
                    )}
                  </span>
                </p>
              )}
            </>
          )}
        </section>

        <section className="mx-auto max-w-[1180px] px-5 sm:px-8 pb-20">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { k: "4", v: "réservations par semaine" },
              { k: "1–2 h", v: "au choix, par créneau" },
              { k: "24 h", v: "d'horizon glissant" },
              { k: "0–6 h", v: "créneaux de nuit, quota inclus" },
            ].map((r) => (
              <div key={r.v} className="panel p-5">
                <dt className="display text-3xl text-klein tabular">{r.k}</dt>
                <dd className="text-[13px] text-mist mt-2">{r.v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4">
          <Logotype compact />
          <p className="text-xs text-dim font-mono">
            Buanderie de l&apos;{NOM_ECOLE}
          </p>
        </div>
      </footer>
    </div>
  );
}

function CarteApercu({ m }: { m: Awaited<ReturnType<typeof lireParcPublic>>[number] }) {
  const libre = m.live_status === "free";
  const occupee = m.live_status === "busy";

  return (
    <div
      className={`panel p-4 flex items-center gap-4 transition-colors
        ${libre ? "border-acid/25" : occupee ? "border-ember/25" : "border-coral/25"}`}
    >
      <Tambour
        size={38}
        spinning={occupee ? "cycle" : false}
        className={libre ? "text-acid" : occupee ? "text-ember" : "text-coral"}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-chalk truncate font-medium">{m.name}</p>
        <p className="text-[11px] text-dim truncate font-mono">{m.room_name}</p>
      </div>
      <div className="text-right shrink-0">
        {libre && <Etiquette ton="libre">libre</Etiquette>}
        {occupee && (
          <span className="chip text-ember border-ember/35 bg-ember/[0.06] tabular">
            {fmtTime(m.busy_until!)}
          </span>
        )}
        {m.live_status === "maintenance" && <Etiquette ton="panne">maintenance</Etiquette>}
        {m.live_status === "out_of_order" && <Etiquette ton="panne">hors service</Etiquette>}
      </div>
    </div>
  );
}

function ConfigManquante() {
  return (
    <div className="panel p-7 border-ember/30">
      <Etiquette ton="occupe" point>Configuration requise</Etiquette>
      <h3 className="display text-xl mt-4 text-chalk">Supabase n&apos;est pas encore branché</h3>
      <p className="text-sm text-mist mt-3 leading-relaxed max-w-2xl">
        Renseignez <code className="font-mono text-chalk">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
        <code className="font-mono text-chalk">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, puis appliquez
        les migrations de <code className="font-mono text-chalk">supabase/migrations/</code>.
        Le fichier <code className="font-mono text-chalk">README.md</code> détaille les cinq minutes
        que ça prend.
      </p>
    </div>
  );
}
