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
      {/* ── Barre ───────────────────────────────────────────────────────── */}
      <header className="border-b border-line/70 backdrop-blur-sm sticky top-0 z-40 bg-ink/70">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 h-16 flex items-center justify-between">
          <Logotype />
          <div className="flex items-center gap-2.5">
            <BasculeTheme />
            <Link
              href="/connexion"
              className="inline-flex items-center border border-klein bg-klein text-white
                rounded-[8px] px-4 py-2 text-[11px] font-medium
                hover:bg-klein-2 transition-colors"
            >
              Entrer
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Héro ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1180px] px-5 sm:px-8 pt-16 sm:pt-24 pb-16">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center">
            <div className="reveal-stagger">
              <p className="eyebrow">{NOM_ECOLE} · Résidences</p>

              <h1 className="display text-[clamp(3.2rem,11vw,7rem)] mt-5 text-chalk">
                Le linge
                <br />
                <span className="text-klein">n&apos;attend</span> pas.
              </h1>

              <p className="text-mist text-base sm:text-lg leading-relaxed mt-7 max-w-lg">
                Le planning de la buanderie, en direct. Vous choisissez votre créneau —
                une heure ou deux — vous pointez sur la machine, vous récupérez votre
                linge à l&apos;heure.
                <span className="text-chalk"> Quatre réservations par semaine</span>, pour
                que tout le monde en ait.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-9">
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

              <p className="text-xs text-dim mt-6 font-mono">
                Accès réservé aux adresses <span className="text-mist">prenom.nom@centrale-casablanca.ma</span>
              </p>
            </div>

            {/* Le tambour, en grand */}
            <div className="relative flex items-center justify-center lg:justify-end order-first lg:order-last">
              <div className="relative">
                <div
                  className="absolute inset-0 blur-[70px] opacity-40 rounded-full bg-klein"
                  aria-hidden
                />
                <Tambour
                  size={330}
                  spinning="cycle"
                  strokeWidth={1}
                  className="relative text-klein w-[min(54vw,330px)] h-auto"
                />
                {/* Compteur au centre du hublot. Un disque plein derrière le
                    chiffre : sans lui, les perforations passent au travers du
                    texte et le rendent illisible. */}
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

        {/* ── Bandeau défilant ──────────────────────────────────────────── */}
        <section className="border-y border-line/70 py-3 overflow-hidden bg-surface/40" aria-hidden>
          <div className="marquee gap-10">
            {[0, 1].map((k) => (
              <div key={k} className="flex gap-10 shrink-0 pr-10">
                {[
                  "RÉSERVER EN 2 CLICS",
                  "POINTAGE PAR QR CODE",
                  "FILE D'ATTENTE AUTOMATIQUE",
                  "4 RÉSERVATIONS / SEMAINE",
                  "CRÉNEAUX D'1 H OU 2 H",
                  "LA NUIT HORS QUOTA",
                  "SUIVI DES CYCLES EN DIRECT",
                  "SIGNALEMENT DE PANNE",
                  "EXPORT AGENDA",
                ].map((t) => (
                  <span key={t} className="eyebrow whitespace-nowrap flex items-center gap-10">
                    {t}
                    <span className="text-klein">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── État du parc ──────────────────────────────────────────────── */}
        <section id="parc" className="mx-auto max-w-[1180px] px-5 sm:px-8 py-20">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
            <div>
              <p className="eyebrow">Temps réel</p>
              <h2 className="display text-3xl sm:text-4xl mt-2 text-chalk">État du parc</h2>
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
            <div className="panel corners px-6 py-14 text-center">
              <Tambour size={48} spinning className="text-line-hi mx-auto mb-4" />
              <p className="text-mist">Aucune machine enregistrée pour l&apos;instant.</p>
              <p className="text-sm text-dim mt-2">
                Un administrateur doit renseigner le parc depuis la console.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 reveal-stagger">
                {parc.map((m) => (
                  <CarteApercu key={m.machine_id} m={m} />
                ))}
              </div>

              {enCycle.length > 0 && (
                <p className="text-xs text-dim mt-6 font-mono">
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

        {/* ── Fonctionnement ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1180px] px-5 sm:px-8 pb-24">
          <p className="eyebrow">Mode d&apos;emploi</p>
          <h2 className="display text-3xl sm:text-4xl mt-2 mb-10 text-chalk">Trois gestes</h2>

          <div className="grid md:grid-cols-3 gap-3 reveal-stagger">
            {[
              {
                n: "01",
                t: "Vous réservez",
                d: "La grille de la semaine, machine par machine. Un créneau libre se prend en un clic — et disparaît instantanément de l'écran des autres.",
              },
              {
                n: "02",
                t: "Vous pointez",
                d: "Un QR code est collé sur chaque machine. Scannez-le en arrivant : votre créneau est confirmé. Sans pointage, il repart au pot commun au bout d'un quart d'heure.",
              },
              {
                n: "03",
                t: "Vous récupérez",
                d: "Le compte à rebours du cycle tourne sur votre tableau de bord. À la fin, vous videz la machine — le suivant vous en sera reconnaissant.",
              },
            ].map((e) => (
              <article key={e.n} className="panel corners p-6 sweep group">
                <p className="display text-5xl text-line-hi group-hover:text-klein transition-colors duration-500">
                  {e.n}
                </p>
                <h3 className="display text-xl mt-4 text-chalk">{e.t}</h3>
                <p className="text-sm text-mist leading-relaxed mt-3">{e.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Règles ────────────────────────────────────────────────────── */}
        <section className="border-t border-line/70 bg-surface/30">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-20 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="eyebrow">La règle du jeu</p>
              <h2 className="display text-3xl sm:text-4xl mt-2 text-chalk">
                Quatre créneaux.
                <br />
                Pas cinq.
              </h2>
              <p className="text-mist leading-relaxed mt-5">
                Le quota est vérifié par la base de données, pas par le navigateur.
                Deux étudiants qui cliquent sur le même créneau à la même seconde ?
                Un seul passe — la contrainte est posée au niveau du moteur.
              </p>
              <p className="text-mist leading-relaxed mt-4">
                Annuler à l&apos;avance ne coûte rien et rend le créneau à quelqu&apos;un
                d&apos;autre. Ne pas venir, en revanche, se paie. Et si vos quatre
                réservations sont épuisées, la tranche de <span className="text-chalk">00 h
                à 06 h</span> reste ouverte — à condition de la poser la veille.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {[
                { k: "4", v: "réservations par semaine" },
                { k: "1–2 h", v: "au choix, par créneau" },
                { k: "24 h", v: "d'horizon glissant" },
                { k: "0–6 h", v: "la nuit, hors quota" },
              ].map((s) => (
                <div key={s.v} className="panel corners p-5">
                  <dt className="display text-4xl text-klein tabular">{s.k}</dt>
                  <dd className="text-xs text-mist mt-2 leading-snug">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
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

/* ── Vignette machine ─────────────────────────────────────────────────────── */
function CarteApercu({ m }: { m: Awaited<ReturnType<typeof lireParcPublic>>[number] }) {
  const libre = m.live_status === "free";
  const occupee = m.live_status === "busy";

  return (
    <div
      className={`panel corners p-4 flex items-center gap-4 transition-colors
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

/* ── Message d'amorçage ──────────────────────────────────────────────────── */
function ConfigManquante() {
  return (
    <div className="panel corners p-7 border-ember/30">
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
