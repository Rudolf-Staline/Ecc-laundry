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
import type {
  BoardRow, Machine, Profile, Room, WaitlistEntry, WeekStatus,
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
  const [planning, setPlanning] = useState(planningInitial);
  const [statut, setStatut] = useState(statutInitial);
  const [attente, setAttente] = useState(attenteInitiale);
  const [enVol, setEnVol] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const grille = useRef<HTMLDivElement>(null);

  const buanderie = buanderies.find((b) => b.id === buanderieId) ?? buanderies[0];
  const parc = useMemo(
    () => machines.filter((m) => m.room_id === buanderie.id).sort((a, b) => a.position - b.position),
    [machines, buanderie.id],
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
  async function reserver(machine: Machine, creneau: Slot) {
    const cle = `${machine.id}|${creneau.key}`;
    setEnVol(cle);
    const { error } = await supabase.rpc("book_slot", {
      p_machine_id: machine.id,
      p_starts_at: creneau.start.toISOString(),
      p_blocs: dureeEffective,
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
  const largeurColonne = parc.length <= 4 ? "minmax(112px,1fr)" : "minmax(96px,1fr)";
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
                className={`px-3.5 py-2 text-[11px] font-mono uppercase tracking-[0.12em] border rounded-[3px]
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

        {dureesPossibles.length > 1 && (
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Durée du créneau</legend>
            <span className="eyebrow">Durée</span>
            <div className="flex border border-line rounded-[3px] overflow-hidden">
              {dureesPossibles.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuree(d)}
                  aria-pressed={dureeEffective === d}
                  className={`px-4 py-2 text-[12px] font-mono tabular transition-colors
                    ${d > 1 ? "border-l border-line" : ""}
                    ${dureeEffective === d
                      ? "bg-acid-vif text-on-bright font-semibold"
                      : "text-dim hover:text-chalk hover:bg-surface-hi"}`}
                >
                  {(d * buanderie.slot_minutes) / 60} h
                </button>
              ))}
            </div>
          </fieldset>
        )}
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
                className={`shrink-0 w-[76px] py-2.5 border rounded-[3px] transition-all text-center
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

      {/* La grille */}
      {parc.length === 0 ? (
        <div className="panel corners px-6 py-14 text-center">
          <Tambour size={44} className="text-line-hi mx-auto mb-4" />
          <p className="text-mist">Aucune machine dans cette buanderie.</p>
        </div>
      ) : (
        <div className="panel corners overflow-hidden">
          <div ref={grille} className="scroll-x">
            <div
              className="min-w-max"
              style={{
                display: "grid",
                gridTemplateColumns: `78px repeat(${parc.length}, ${largeurColonne})`,
              }}
            >
              <div className="sticky left-0 z-20 bg-surface border-b border-r border-line px-3 py-3">
                <span className="eyebrow">Heure</span>
              </div>
              {parc.map((m) => (
                <div key={m.id} className="border-b border-line px-2 py-3 text-center bg-surface/60">
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        m.status === "operational"
                          ? m.kind === "washer" ? "bg-cat-lavage" : "bg-cat-sechage"
                          : "bg-coral"
                      }`}
                      aria-hidden
                    />
                    <span className="text-[11px] text-chalk truncate font-medium">{m.name}</span>
                  </div>
                  <span className="block text-[9px] font-mono text-dim uppercase tracking-[0.1em] mt-1">
                    {m.status !== "operational"
                      ? m.status === "maintenance" ? "maintenance" : "hors service"
                      : m.kind === "washer" ? "lavage" : "séchage"}
                  </span>
                </div>
              ))}

              {creneaux.map((c) => {
                const nuit = estCreneauNuit(c.start, nuitDebut, nuitFin);
                const passe = c.start.getTime() < maintenant;

                return (
                  <div key={c.key} className="contents">
                    <div
                      className={`sticky left-0 z-10 border-r border-line px-3 py-2.5
                        flex items-center gap-1.5 ${nuit ? "bg-klein/[0.07]" : "bg-surface"}
                        ${passe ? "opacity-40" : ""}`}
                    >
                      <span className="tabular text-[12px] text-mist">{c.label}</span>
                      {nuit && <IconeNuit />}
                    </div>

                    {parc.map((m) => {
                      const { etat, ligne } = etatCellule(m, c.start);
                      const cle = `${m.id}|${c.key}`;
                      const bloqueParDuree =
                        etat === "libre" && dureeEffective > 1 && !secondeHeureLibre(m, c.start);
                      const apercu =
                        survol !== null &&
                        dureeEffective > 1 &&
                        survol === `${m.id}|${new Date(c.start.getTime() - buanderie.slot_minutes * 60_000).toISOString()}`;

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
                          occupe={enVol === cle}
                          annulationEnCours={enVol}
                          verrouille={quotaAtteint && !nuit ? true : suspendu}
                          enFile={enAttente.has(`${buanderie.id}|${m.kind}|${c.start.toISOString()}`)}
                          onSurvol={(actif) => setSurvol(actif ? cle : null)}
                          onReserver={() => reserver(m, c)}
                          onAnnuler={(l) => annuler(l)}
                          onFile={() => rejoindreFile(c, m.kind)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2.5 items-center text-[11px] font-mono text-dim">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-line-hi rounded-[2px]" /> libre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-acid/50 bg-acid/15 rounded-[2px]" /> à vous
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-klein/40 bg-klein/12 rounded-[2px]" /> pris
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-line bg-line/40 rounded-[2px]" /> indisponible
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-acid">
            <span className="w-1.5 h-1.5 rounded-full bg-acid pulse-live" /> mise à jour en direct
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

/* ── Une case de la grille ────────────────────────────────────────────────── */
function Cellule({
  machine, creneau, etat, ligne, nuit, duree, pasMinutes, bloqueParDuree, apercu,
  occupe, annulationEnCours, verrouille, enFile, onSurvol, onReserver, onAnnuler, onFile,
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
  occupe: boolean;
  annulationEnCours: string | null;
  verrouille: boolean;
  enFile: boolean;
  onSurvol: (actif: boolean) => void;
  onReserver: () => void;
  onAnnuler: (l: BoardRow) => void;
  onFile: () => void;
}) {
  const base =
    "border-b border-l border-line px-1.5 py-2 min-h-[52px] flex items-center justify-center text-center transition-all duration-200";
  const fondNuit = nuit ? "bg-klein/[0.05]" : "";

  if (etat === "indispo") {
    return (
      <div className={`${base} bg-line/[0.18]`} aria-label={`${machine.name} indisponible`}>
        <span className="text-[10px] font-mono text-dim/70">—</span>
      </div>
    );
  }

  if (etat === "passe") {
    return <div className={`${base} bg-line/[0.10] opacity-50`} aria-hidden />;
  }

  if (etat === "mien" && ligne) {
    const pointe = ligne.status === "checked_in";
    return (
      <button
        onClick={() => onAnnuler(ligne)}
        disabled={annulationEnCours === ligne.id}
        title={`Votre réservation ${fmtTime(ligne.starts_at)} → ${fmtTime(ligne.ends_at)}. Cliquer pour annuler.`}
        className={`${base} bg-acid/[0.13] border-l-acid/40 hover:bg-coral/15 hover:border-l-coral/50 group
          disabled:opacity-50`}
      >
        <span className="flex flex-col items-center gap-0.5">
          {pointe ? (
            <Tambour size={16} spinning="cycle" className="text-acid" />
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-acid group-hover:hidden">
              à vous
            </span>
          )}
          <span className="hidden group-hover:inline text-[10px] font-mono uppercase tracking-[0.08em] text-coral">
            annuler
          </span>
          {ligne.duration_minutes > pasMinutes && (
            <span className="text-[9px] font-mono text-acid/70 group-hover:hidden tabular">
              {ligne.duration_minutes / 60} h
            </span>
          )}
        </span>
      </button>
    );
  }

  if (etat === "pris" && ligne) {
    return (
      <button
        onClick={onFile}
        disabled={enFile}
        title={
          enFile
            ? "Vous êtes déjà en file d'attente sur ce créneau"
            : `Pris par ${ligne.owner_first_name}. Cliquer pour rejoindre la file d'attente.`
        }
        className={`${base} bg-klein/[0.10] hover:bg-klein/[0.18] group cursor-pointer`}
      >
        <span className="flex flex-col items-center gap-0.5 min-w-0">
          <span className="text-[11px] text-klein-2 truncate max-w-full">{ligne.owner_first_name}</span>
          {enFile ? (
            <span className="text-[9px] font-mono text-ember uppercase tracking-[0.08em]">en file</span>
          ) : (
            <span className="text-[9px] font-mono text-dim uppercase tracking-[0.08em]
              opacity-0 group-hover:opacity-100 transition-opacity">
              + attendre
            </span>
          )}
        </span>
      </button>
    );
  }

  if (etat === "horizon") {
    return (
      <div
        className={`${base} ${fondNuit} opacity-45`}
        title={`Ce créneau s'ouvrira ${fmtRelative(new Date(creneau.start.getTime() - 24 * 3_600_000))}`}
      >
        <span className="text-[10px] font-mono text-dim">pas encore</span>
      </div>
    );
  }

  // Libre
  const indisponible = verrouille || bloqueParDuree;
  const finPrevue = new Date(creneau.start.getTime() + duree * pasMinutes * 60_000);

  return (
    <button
      onClick={onReserver}
      onMouseEnter={() => onSurvol(true)}
      onMouseLeave={() => onSurvol(false)}
      onFocus={() => onSurvol(true)}
      onBlur={() => onSurvol(false)}
      disabled={occupe || indisponible}
      title={
        verrouille
          ? "Quota hebdomadaire atteint — les créneaux de nuit restent ouverts"
          : bloqueParDuree
            ? "L'heure suivante est déjà prise : ce créneau de 2 h ne tient pas"
            : `Réserver ${machine.name} de ${creneau.label} à ${fmtTime(finPrevue)}`
      }
      className={`${base} ${fondNuit} sweep group
        ${apercu ? "bg-acid/[0.10] border-l-acid/40" : ""}
        ${indisponible ? "cursor-not-allowed opacity-45" : "hover:bg-acid/[0.10] hover:border-l-acid/40"}`}
    >
      {occupe ? (
        <Tambour size={16} spinning className="text-acid" />
      ) : (
        <span
          className={`text-[10px] font-mono uppercase tracking-[0.1em] transition-colors
            ${indisponible ? "text-dim" : "text-dim group-hover:text-acid"}`}
        >
          {indisponible ? "—" : "libre"}
        </span>
      )}
    </button>
  );
}
