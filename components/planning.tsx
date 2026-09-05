"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { AnneauQuota } from "@/components/anneau-quota";
import { Tambour } from "@/components/marque";
import {
  buildSlots, dayKey, daySpan, estCreneauNuit, fmtDay, fmtRelative, fmtTime,
  isoDayOfWeek, JOURS_COURTS, startOfDay, type Slot,
} from "@/lib/time";
import {
  MOTIFS,
  type BoardRow, type BookingPurpose, type Machine, type Profile,
  type Room, type WaitlistEntry, type WeekStatus,
} from "@/lib/types";

type Etat = "libre" | "mien" | "pris" | "passe" | "indispo" | "horizon";

export function Planning({
  profil,
  buanderies,
  machines,
  planningInitial,
  statutInitial,
  attenteInitiale,
  horizonHeures,
  nuitDebut,
  nuitFin,
}: {
  profil: Profile;
  buanderies: Room[];
  machines: Machine[];
  planningInitial: BoardRow[];
  statutInitial: WeekStatus;
  attenteInitiale: WaitlistEntry[];
  horizonHeures: number;
  nuitDebut: number;
  nuitFin: number;
}) {
  const toast = useToast();
  const supabase = useMemo(() => creerClientNavigateur(), []);

  const [buanderieId, setBuanderieId] = useState(buanderies[0].id);
  const [jourActif, setJourActif] = useState(() => dayKey(new Date()));
  const [duree, setDuree] = useState(1);
  const [motif, setMotif] = useState<BookingPurpose | "">("");
  const [planning, setPlanning] = useState(planningInitial);
  const [statut, setStatut] = useState(statutInitial);
  const [attente, setAttente] = useState(attenteInitiale);
  const [enVol, setEnVol] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ machine: Machine; creneau: Slot } | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const grille = useRef<HTMLDivElement>(null);

  const buanderie = buanderies.find((b) => b.id === buanderieId) ?? buanderies[0];
  const parc = useMemo(
    () => machines.filter((m) => m.room_id === buanderie.id).sort((a, b) => a.position - b.position),
    [machines, buanderie.id],
  );

  // Lave-linge et sèche-linge ne se réservent pas pour les mêmes raisons :
  // les séparer évite de compter les uns pour les autres d'un coup d'œil.
  const groupes = useMemo(
    () =>
      (
        [
          { kind: "washer" as const, label: "Lave-linge" },
          { kind: "dryer" as const, label: "Sèche-linge" },
        ]
      )
        .map((g) => ({ ...g, machines: parc.filter((m) => m.kind === g.kind) }))
        .filter((g) => g.machines.length > 0),
    [parc],
  );

  // L'horizon glissant de 24 h ne touche jamais plus de deux jours civils.
  const jours = useMemo(
    () => daySpan(new Date(maintenant), Math.ceil(horizonHeures / 24) + 1),
    [horizonHeures, maintenant],
  );
  const jour = jours.find((j) => dayKey(j) === jourActif) ?? jours[0];

  const creneaux = useMemo(
    () => buildSlots(jour, buanderie.opens_at, buanderie.closes_at, buanderie.slot_minutes),
    [jour, buanderie],
  );

  const dureesPossibles = useMemo(
    () => Array.from({ length: Math.max(1, buanderie.max_blocks) }, (_, i) => i + 1),
    [buanderie.max_blocks],
  );

  // Valeur dérivée plutôt qu'état recalé après coup : changer de buanderie
  // ramène simplement la durée dans les limites de celle-ci.
  const dureeEffective = Math.min(duree, Math.max(1, buanderie.max_blocks));

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ── Rechargement ─────────────────────────────────────────────────────── */
  const recharger = useCallback(async () => {
    const debut = startOfDay(new Date());
    const fin = new Date(debut.getTime() + 3 * 86_400_000);

    const [{ data: b }, { data: s }, { data: w }] = await Promise.all([
      supabase.from("v_board").select("*")
        .gte("starts_at", debut.toISOString())
        .lt("starts_at", fin.toISOString())
        .order("starts_at"),
      supabase.rpc("my_week_status"),
      supabase.from("waitlist").select("*").gte("starts_at", debut.toISOString()),
    ]);

    if (b) setPlanning(b as BoardRow[]);
    if (s) setStatut((Array.isArray(s) ? s[0] : s) as WeekStatus);
    if (w) setAttente(w as WaitlistEntry[]);
  }, [supabase]);

  /* ── Temps réel ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const canal = supabase
      .channel("planning-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void recharger();
      })
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [supabase, recharger]);

  /* ── Occupation : une réservation de 2 h occupe ses deux heures ───────── */
  const index = useMemo(() => {
    const m = new Map<string, BoardRow>();
    for (const r of planning) {
      if (r.status !== "booked" && r.status !== "checked_in") continue;
      const debut = new Date(r.starts_at).getTime();
      const fin = new Date(r.ends_at).getTime();
      const pas = 60_000 * (buanderies.find((b) => b.id === r.room_id)?.slot_minutes ?? 60);
      for (let t = debut; t < fin; t += pas) {
        m.set(`${r.machine_id}|${new Date(t).toISOString()}`, r);
      }
    }
    return m;
  }, [planning, buanderies]);

  const enAttente = useMemo(() => {
    const s = new Set<string>();
    for (const w of attente) s.add(`${w.room_id}|${w.kind}|${new Date(w.starts_at).toISOString()}`);
    return s;
  }, [attente]);

  const limiteHorizon = maintenant + horizonHeures * 3_600_000;

  const etatCellule = useCallback(
    (machine: Machine, debut: Date): { etat: Etat; ligne?: BoardRow } => {
      if (machine.status !== "operational") return { etat: "indispo" };
      if (debut.getTime() < maintenant) return { etat: "passe" };

      const ligne = index.get(`${machine.id}|${debut.toISOString()}`);
      if (ligne) return { etat: ligne.is_mine ? "mien" : "pris", ligne };

      if (debut.getTime() > limiteHorizon) return { etat: "horizon" };
      return { etat: "libre" };
    },
    [index, maintenant, limiteHorizon],
  );

  /** Un créneau de 2 h exige que l'heure suivante soit libre elle aussi. */
  const secondeHeureLibre = useCallback(
    (machine: Machine, debut: Date) => {
      const suite = new Date(debut.getTime() + buanderie.slot_minutes * 60_000);
      return !index.get(`${machine.id}|${suite.toISOString()}`);
    },
    [index, buanderie.slot_minutes],
  );

  /* ── Actions ──────────────────────────────────────────────────────────── */
  async function reserver() {
    if (!selection) return;
    const { machine, creneau } = selection;
    const cle = `${machine.id}|${creneau.key}`;
    setEnVol(cle);
    const { error } = await supabase.rpc("book_slot", {
      p_machine_id: machine.id,
      p_starts_at: creneau.start.toISOString(),
      p_blocs: dureeEffective,
      p_motif: motif || null,
    });
    setEnVol(null);

    if (error) {
      toast({ ton: "erreur", titre: "Réservation refusée", detail: messageErreur(error) });
    } else {
      const fin = new Date(creneau.start.getTime() + dureeEffective * buanderie.slot_minutes * 60_000);
      toast({
        ton: "ok",
        titre: `${machine.name} réservée`,
        detail: `${fmtDay(creneau.start)}, ${creneau.label} → ${fmtTime(fin)}. Pensez à pointer sur place.`,
      });
      setSelection(null);
    }
    await recharger();
  }

  async function annuler(ligne: BoardRow) {
    setEnVol(ligne.id);
    const { error } = await supabase.rpc("cancel_booking", { p_booking_id: ligne.id });
    setEnVol(null);

    if (error) {
      toast({ ton: "erreur", titre: "Annulation impossible", detail: messageErreur(error) });
    } else {
      toast({ ton: "info", titre: "Réservation annulée", detail: "Le créneau repart au pot commun." });
    }
    await recharger();
  }

  async function rejoindreFile(creneau: Slot, kind: Machine["kind"]) {
    const { error } = await supabase.rpc("join_waitlist", {
      p_room_id: buanderie.id,
      p_kind: kind,
      p_starts_at: creneau.start.toISOString(),
    });
    if (error) {
      toast({ ton: "erreur", titre: "File d'attente", detail: messageErreur(error) });
    } else {
      toast({
        ton: "ok",
        titre: "Inscrit en file d'attente",
        detail: "À la première annulation sur ce créneau, la machine vous revient automatiquement.",
      });
    }
    await recharger();
  }

  /* ── Rendu ────────────────────────────────────────────────────────────── */
  const suspendu = Boolean(
    profil.suspended_until && new Date(profil.suspended_until).getTime() > maintenant,
  );
  const quotaAtteint = Boolean(statut && statut.remaining <= 0);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 className="display text-3xl sm:text-4xl mt-2 text-chalk">Réserver une machine</h1>
          <p className="text-sm text-mist mt-2">
            {buanderie.name} ·{" "}
            {buanderie.closes_at.startsWith("24")
              ? "ouverte en continu"
              : `de ${buanderie.opens_at.slice(0, 5)} à ${buanderie.closes_at.slice(0, 5)}`}
            {" · "}réservations ouvertes {horizonHeures} h à l&apos;avance
          </p>
        </div>
        {statut && (
          <div className="text-right">
            <AnneauQuota utilises={statut.used} quota={statut.quota} />
            {statut.night_used > 0 && (
              <p className="text-[11px] font-mono text-klein-2 mt-1.5">
                + {statut.night_used} de nuit, hors quota
              </p>
            )}
          </div>
        )}
      </div>

      {suspendu && (
        <div className="panel corners border-coral/40 px-4 py-3 flex items-start gap-3" role="alert">
          <span className="text-coral mt-0.5" aria-hidden>▸</span>
          <p className="text-sm text-mist">
            <span className="text-chalk">Votre compte est suspendu.</span>{" "}
            Vous pourrez réserver de nouveau {fmtRelative(profil.suspended_until!)}. En
            attendant, la grille reste consultable.
          </p>
        </div>
      )}

      {quotaAtteint && !suspendu && (
        <div className="panel corners border-ember/35 px-4 py-3 flex items-start gap-3">
          <span className="text-ember mt-0.5" aria-hidden>▸</span>
          <p className="text-sm text-mist">
            <span className="text-chalk">Quota atteint pour cette semaine.</span>{" "}
            Les créneaux de {nuitDebut} h à {nuitFin} h restent ouverts : ils ne se décomptent
            pas du quota. Ils peuvent être réservés à tout moment.
          </p>
        </div>
      )}

      {/* Buanderie + durée */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        {buanderies.length > 1 ? (
          <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Buanderie">
            {buanderies.map((b) => (
              <button
                key={b.id}
                role="tab"
                aria-selected={b.id === buanderieId}
                onClick={() => setBuanderieId(b.id)}
                className={`px-3.5 py-2 text-[11px] font-medium border rounded-[8px]
                  transition-colors ${
                    b.id === buanderieId
                      ? "border-klein bg-klein/12 text-chalk"
                      : "border-line text-dim hover:text-mist hover:border-line-hi"
                  }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        ) : <span />}

        <div className="flex items-end gap-4 flex-wrap">
        {dureesPossibles.length > 1 && (
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Durée du créneau</legend>
            <span className="eyebrow">Durée</span>
            <div className="flex border border-line rounded-[8px] overflow-hidden">
              {dureesPossibles.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuree(d)}
                  aria-pressed={dureeEffective === d}
                  className={`px-4 py-2 text-[12px] font-mono tabular transition-colors
                    ${d > 1 ? "border-l border-line" : ""}
                    ${dureeEffective === d
                      ? "bg-encre text-ink font-semibold"
                      : "text-dim hover:text-chalk hover:bg-ink-2"}`}
                >
                  {(d * buanderie.slot_minutes) / 60} h
                </button>
              ))}
            </div>
          </fieldset>
        )}
        </div>
      </div>

      {/* Bandeau des jours */}
      <div className="scroll-x -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex gap-1.5 pb-1 w-max" role="tablist" aria-label="Jour">
          {jours.map((j) => {
            const k = dayKey(j);
            const actif = k === jourActif;
            const aujourdhui = k === dayKey(new Date(maintenant));
            const jsem = isoDayOfWeek(j);

            return (
              <button
                key={k}
                role="tab"
                aria-selected={actif}
                onClick={() => { setJourActif(k); grille.current?.scrollTo({ left: 0 }); }}
                className={`shrink-0 w-[76px] py-2.5 border rounded-[8px] transition-all text-center
                  ${actif ? "border-klein bg-klein/12" : "border-line hover:border-line-hi bg-surface/40"}`}
              >
                <span className={`block text-[10px] font-mono tracking-[0.1em]
                  ${actif ? "text-klein-2" : "text-dim"}`}>
                  {aujourdhui ? "AUJ." : JOURS_COURTS[jsem - 1]}
                </span>
                <span className={`block display text-xl mt-0.5 tabular ${actif ? "text-chalk" : "text-mist"}`}>
                  {k.slice(8, 10)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* La grille — machines en lignes, heures en colonnes : douze machines
          se lisent d'un coup d'œil là où vingt-quatre heures empilées
          obligeaient à faire défiler la page. */}
      {parc.length === 0 ? (
        <div className="panel corners px-6 py-14 text-center">
          <Tambour size={44} className="text-line-hi mx-auto mb-4" />
          <p className="text-mist">Aucune machine dans cette buanderie.</p>
        </div>
      ) : (
        <div className="panel corners p-3 sm:p-4">
          <div ref={grille} className="scroll-x nice-scroll">
            <div
              className="min-w-max"
              style={{
                display: "grid",
                gridTemplateColumns: `124px repeat(${creneaux.length}, 34px)`,
                gap: "3px",
              }}
            >
              {/* Bandeau des heures */}
              <div className="sticky left-0 z-20 bg-surface" />
              {creneaux.map((c) => {
                const nuit = estCreneauNuit(c.start, nuitDebut, nuitFin);
                return (
                  <div key={`h-${c.key}`} className="pb-1 grid place-items-center" title={c.label}>
                    {nuit ? (
                      <IconeNuit />
                    ) : (
                      <span className="text-[10px] tabular text-dim">{c.label.slice(0, 2)}</span>
                    )}
                  </div>
                );
              })}

              {groupes.map((g) => (
                <div key={g.kind} className="contents">
                  <div
                    style={{ gridColumn: "1 / -1" }}
                    className="flex items-center gap-2 pt-3 pb-0.5"
                  >
                    <span className={g.kind === "washer" ? "text-cat-lavage" : "text-cat-sechage"}>
                      <IconeType kind={g.kind} />
                    </span>
                    <span className="eyebrow">{g.label}</span>
                  </div>

                  {g.machines.map((m) => (
                    <div key={m.id} className="contents">
                      <div className="sticky left-0 z-10 bg-surface pr-2 flex items-center gap-2 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            m.status === "operational"
                              ? m.kind === "washer" ? "bg-cat-lavage" : "bg-cat-sechage"
                              : "bg-ember"
                          }`}
                          aria-hidden
                        />
                        <span className="text-[12px] text-chalk truncate">{m.name}</span>
                        {m.status !== "operational" && (
                          <span className="text-[9px] text-ember shrink-0 uppercase tracking-[0.08em]">
                            hs
                          </span>
                        )}
                      </div>

                      {creneaux.map((c) => {
                        const nuit = estCreneauNuit(c.start, nuitDebut, nuitFin);
                        const { etat, ligne } = etatCellule(m, c.start);
                        const cle = `${m.id}|${c.key}`;
                        const bloqueParDuree =
                          etat === "libre" && dureeEffective > 1 && !secondeHeureLibre(m, c.start);
                        const precedent = new Date(c.start.getTime() - buanderie.slot_minutes * 60_000).toISOString();
                        const apercu =
                          dureeEffective > 1 &&
                          (survol === `${m.id}|${precedent}` ||
                            (selection !== null &&
                              selection.machine.id === m.id &&
                              selection.creneau.start.toISOString() === precedent));

                        return (
                          <Cellule
                            key={cle}
                            machine={m}
                            creneau={c}
                            etat={etat}
                            ligne={ligne}
                            nuit={nuit}
                            duree={dureeEffective}
                            pasMinutes={buanderie.slot_minutes}
                            bloqueParDuree={bloqueParDuree}
                            apercu={apercu}
                            choisi={
                              selection !== null &&
                              selection.machine.id === m.id &&
                              selection.creneau.key === c.key
                            }
                            occupe={enVol === cle}
                            annulationEnCours={enVol}
                            verrouille={quotaAtteint && !nuit ? true : suspendu}
                            enFile={enAttente.has(`${buanderie.id}|${m.kind}|${c.start.toISOString()}`)}
                            onSurvol={(actif) => setSurvol(actif ? cle : null)}
                            onChoisir={() =>
                              setSelection((s) =>
                                s && s.machine.id === m.id && s.creneau.key === c.key
                                  ? null
                                  : { machine: m, creneau: c },
                              )
                            }
                            onAnnuler={(l) => annuler(l)}
                            onFile={() => rejoindreFile(c, m.kind)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center text-[11px] text-dim">
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-menthe/20 bg-menthe-fond rounded-[4px]" /> libre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-klein bg-klein rounded-[4px]" /> votre choix
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-acid/25 bg-acid-fond rounded-[4px]" /> à vous
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-coral/25 bg-coral-fond rounded-[4px]" /> occupé
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-klein/20 bg-klein-fond rounded-[4px]" /> nuit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-line maintenance-stripes rounded-[4px]" /> hors service
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-menthe">
            <span className="w-1.5 h-1.5 rounded-full bg-menthe pulse-live" /> en direct
          </span>
        </div>

        <p className="text-[11px] text-dim leading-relaxed max-w-3xl flex items-start gap-2">
          <IconeNuit />
          <span>
            Les créneaux de {nuitDebut} h à {nuitFin} h ne se décomptent pas du quota
            hebdomadaire.

          </span>
        </p>
      </div>

      {/* Barre de confirmation — un clic sur une case ne consomme rien tant que
          rien n'est confirmé : sur quatre réservations par semaine, une erreur
          de visée coûte cher. */}
      {selection && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 md:pl-[272px] md:pr-8 no-print">
          <div className="panel-deep corners mx-auto max-w-[860px] px-4 py-3
            flex flex-wrap items-center gap-x-5 gap-y-3 reveal">
            <div className="min-w-0">
              <p className="eyebrow">Créneau sélectionné</p>
              <p className="text-[14px] text-chalk mt-0.5">
                <span className="font-semibold">{selection.machine.name}</span>
                <span className="text-dim"> · </span>
                {fmtDay(selection.creneau.start)}
                <span className="text-dim"> · </span>
                <span className="tabular">
                  {selection.creneau.label} → {fmtTime(new Date(
                    selection.creneau.start.getTime() + dureeEffective * buanderie.slot_minutes * 60_000,
                  ))}
                </span>
              </p>
              <p className="text-[11px] text-dim mt-0.5">
                {estCreneauNuit(selection.creneau.start, nuitDebut, nuitFin)
                  ? "Créneau de nuit — hors quota hebdomadaire."
                  : `Quota après réservation : ${Math.min(statut.used + 1, statut.quota)}/${statut.quota}`}
              </p>
            </div>

            <label className="flex items-center gap-2 ml-auto">
              <span className="eyebrow">Motif</span>
              <select
                value={motif}
                onChange={(e) => setMotif(e.target.value as BookingPurpose | "")}
                className="bg-ink-2 border border-line rounded-[6px] px-3 py-2 text-[12px]
                  text-mist outline-none focus:border-klein transition-colors"
              >
                <option value="">non précisé</option>
                {(Object.keys(MOTIFS) as BookingPurpose[]).map((m) => (
                  <option key={m} value={m}>{MOTIFS[m]}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelection(null)}
                className="px-3.5 py-2 text-[12.5px] text-dim hover:text-chalk transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={reserver}
                disabled={enVol !== null}
                className="px-5 py-2.5 rounded-[8px] bg-encre text-ink
                  text-[13px] font-semibold hover:opacity-88 transition-opacity
                  disabled:opacity-60 flex items-center gap-2"
              >
                {enVol !== null ? <Tambour size={14} spinning className="text-ink" /> : null}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconeNuit() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-klein-2 shrink-0">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

function IconeType({ kind }: { kind: "washer" | "dryer" }) {
  return kind === "washer" ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M12 4c-3 3.4-5 5.9-5 8a5 5 0 0 0 10 0c0-2.1-2-4.6-5-8z" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

/* ── Une case de la grille ────────────────────────────────────────────────── */
function Cellule({
  machine, creneau, etat, ligne, nuit, duree, pasMinutes, bloqueParDuree, apercu, choisi,
  occupe, annulationEnCours, verrouille, enFile, onSurvol, onChoisir, onAnnuler, onFile,
}: {
  machine: Machine;
  creneau: Slot;
  etat: Etat;
  ligne?: BoardRow;
  nuit: boolean;
  duree: number;
  pasMinutes: number;
  bloqueParDuree: boolean;
  apercu: boolean;
  choisi: boolean;
  occupe: boolean;
  annulationEnCours: string | null;
  verrouille: boolean;
  enFile: boolean;
  onSurvol: (actif: boolean) => void;
  onChoisir: () => void;
  onAnnuler: (l: BoardRow) => void;
  onFile: () => void;
}) {
  const base =
    "h-[34px] rounded-[6px] border grid place-items-center text-center transition-all duration-150";

  if (etat === "indispo") {
    return (
      <div
        className={`${base} maintenance-stripes border-line bg-ink-2/40`}
        title={`${machine.name} hors service`}
        aria-label={`${machine.name} hors service`}
      />
    );
  }

  if (etat === "passe") {
    return <div className={`${base} border-line/40 bg-ink-2/40 opacity-50`} aria-hidden />;
  }

  if (etat === "mien" && ligne) {
    const pointe = ligne.status === "checked_in";
    return (
      <button
        onClick={() => onAnnuler(ligne)}
        disabled={annulationEnCours === ligne.id}
        title={`Votre réservation ${fmtTime(ligne.starts_at)} → ${fmtTime(ligne.ends_at)}. Cliquer pour annuler.`}
        className={`${base} bg-acid-fond border-acid/25 hover:bg-coral-fond hover:border-coral/30
          group disabled:opacity-50`}
      >
        {pointe ? (
          <Tambour size={14} spinning="cycle" className="text-acid" />
        ) : (
          <>
            <span className="text-[9px] font-semibold uppercase tracking-[0.04em] text-acid group-hover:hidden">
              vous
            </span>
            <span className="hidden group-hover:inline text-[9px] font-semibold uppercase text-coral">
              ✕
            </span>
          </>
        )}
      </button>
    );
  }

  if (etat === "pris" && ligne) {
    const initiales = ligne.owner_first_name.slice(0, 2).toUpperCase();
    return (
      <button
        onClick={onFile}
        disabled={enFile}
        title={
          enFile
            ? "Vous êtes déjà en file d'attente sur ce créneau"
            : `Pris par ${ligne.owner_first_name}. Cliquer pour rejoindre la file d'attente.`
        }
        className={`${base} bg-coral-fond border-coral/25 hover:border-coral/45`}
      >
        <span className={`text-[9px] font-semibold ${enFile ? "text-ember" : "text-coral"}`}>
          {enFile ? "file" : initiales}
        </span>
      </button>
    );
  }

  if (etat === "horizon") {
    return (
      <div
        className={`${base} border-line/40 bg-ink-2/30 opacity-55`}
        title={`Ce créneau s'ouvrira ${fmtRelative(new Date(creneau.start.getTime() - 24 * 3_600_000))}`}
      />
    );
  }

  // Libre
  const indisponible = verrouille || bloqueParDuree;
  const finPrevue = new Date(creneau.start.getTime() + duree * pasMinutes * 60_000);

  return (
    <button
      onClick={onChoisir}
      onMouseEnter={() => onSurvol(true)}
      onMouseLeave={() => onSurvol(false)}
      onFocus={() => onSurvol(true)}
      onBlur={() => onSurvol(false)}
      disabled={occupe || indisponible}
      aria-pressed={choisi}
      title={
        verrouille
          ? "Quota hebdomadaire atteint — les créneaux de nuit restent ouverts"
          : bloqueParDuree
            ? "L'heure suivante est déjà prise : ce créneau de 2 h ne tient pas"
            : `${machine.name}, ${creneau.label} → ${fmtTime(finPrevue)}`
      }
      className={`${base}
        ${choisi
          ? "bg-klein border-klein text-white shadow-[0_4px_12px_-4px_rgba(91,91,214,0.6)]"
          : apercu
            ? "bg-klein/25 border-klein/45"
            : nuit
              ? "bg-klein-fond border-klein/20 hover:border-klein hover:bg-klein/20"
              : "bg-menthe-fond border-menthe/20 hover:border-klein hover:bg-klein/15"}
        ${indisponible ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {occupe ? (
        <Tambour size={13} spinning className="text-acid" />
      ) : choisi ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </button>
  );
}
