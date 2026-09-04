"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { AnneauQuota } from "@/components/anneau-quota";
import { Tambour } from "@/components/marque";
import {
  buildSlots, dayKey, daySpan, fmtDay, fmtRelative, fmtTime, isoDayOfWeek,
  JOURS_COURTS, startOfDay, type Slot,
} from "@/lib/time";
import type {
  BoardRow, Machine, Profile, Room, WaitlistEntry, WeekStatus,
} from "@/lib/types";

type Etat = "libre" | "mien" | "pris" | "passe" | "indispo";

export function Planning({
  profil,
  buanderies,
  machines,
  planningInitial,
  statutInitial,
  attenteInitiale,
  horizonJours,
}: {
  profil: Profile;
  buanderies: Room[];
  machines: Machine[];
  planningInitial: BoardRow[];
  statutInitial: WeekStatus;
  attenteInitiale: WaitlistEntry[];
  horizonJours: number;
}) {
  const toast = useToast();
  const supabase = useMemo(() => creerClientNavigateur(), []);

  const [buanderieId, setBuanderieId] = useState(buanderies[0].id);
  const [jourActif, setJourActif] = useState(() => dayKey(new Date()));
  const [planning, setPlanning] = useState(planningInitial);
  const [statut, setStatut] = useState(statutInitial);
  const [attente, setAttente] = useState(attenteInitiale);
  const [enVol, setEnVol] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const suspendu = Boolean(
    profil.suspended_until && new Date(profil.suspended_until).getTime() > maintenant,
  );

  const grille = useRef<HTMLDivElement>(null);

  const buanderie = buanderies.find((b) => b.id === buanderieId) ?? buanderies[0];
  const parc = useMemo(
    () => machines.filter((m) => m.room_id === buanderie.id).sort((a, b) => a.position - b.position),
    [machines, buanderie.id],
  );

  const jours = useMemo(() => daySpan(new Date(), horizonJours), [horizonJours]);
  const jour = jours.find((j) => dayKey(j) === jourActif) ?? jours[0];

  const creneaux = useMemo(
    () => buildSlots(jour, buanderie.opens_at, buanderie.closes_at, buanderie.slot_minutes),
    [jour, buanderie],
  );

  /* Le « maintenant » qui grise les créneaux passés — une fois par minute. */
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ── Rechargement ─────────────────────────────────────────────────────── */
  const recharger = useCallback(async () => {
    const debut = startOfDay(new Date());
    const fin = new Date(jours[jours.length - 1].getTime() + 86_400_000);

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
  }, [supabase, jours]);

  /* ── Temps réel : la grille se met à jour sous les doigts ─────────────── */
  useEffect(() => {
    const canal = supabase
      .channel("planning-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void recharger();
      })
      .subscribe();

    return () => { void supabase.removeChannel(canal); };
  }, [supabase, recharger]);

  /* ── Index des réservations : machine + créneau → ligne ───────────────── */
  const index = useMemo(() => {
    const m = new Map<string, BoardRow>();
    for (const r of planning) {
      if (r.status === "booked" || r.status === "checked_in") {
        m.set(`${r.machine_id}|${new Date(r.starts_at).toISOString()}`, r);
      }
    }
    return m;
  }, [planning]);

  const enAttente = useMemo(() => {
    const s = new Set<string>();
    for (const w of attente) s.add(`${w.room_id}|${w.kind}|${new Date(w.starts_at).toISOString()}`);
    return s;
  }, [attente]);

  function etatCellule(machine: Machine, creneau: Slot): { etat: Etat; ligne?: BoardRow } {
    if (machine.status !== "operational") return { etat: "indispo" };
    if (creneau.start.getTime() < maintenant) return { etat: "passe" };
    const ligne = index.get(`${machine.id}|${creneau.start.toISOString()}`);
    if (ligne) return { etat: ligne.is_mine ? "mien" : "pris", ligne };
    return { etat: "libre" };
  }

  /* ── Actions ──────────────────────────────────────────────────────────── */
  async function reserver(machine: Machine, creneau: Slot) {
    const cle = `${machine.id}|${creneau.key}`;
    setEnVol(cle);
    const { error } = await supabase.rpc("book_slot", {
      p_machine_id: machine.id,
      p_starts_at: creneau.start.toISOString(),
    });
    setEnVol(null);

    if (error) {
      toast({ ton: "erreur", titre: "Réservation refusée", detail: messageErreur(error) });
    } else {
      toast({
        ton: "ok",
        titre: `${machine.name} réservée`,
        detail: `${fmtDay(creneau.start)} à ${creneau.label}. Pensez à pointer sur place.`,
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
  const quotaAtteint = statut && statut.remaining <= 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 className="display text-3xl sm:text-4xl mt-2 text-chalk">Réserver une machine</h1>
          <p className="text-sm text-mist mt-2">
            {buanderie.name} · ouverte de {buanderie.opens_at.slice(0, 5)} à {buanderie.closes_at.slice(0, 5)}
            {" · "}créneaux de {buanderie.slot_minutes} min
          </p>
        </div>
        {statut && <AnneauQuota utilises={statut.used} quota={statut.quota} />}
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
            Vous pouvez encore vous inscrire en file d&apos;attente : à la première annulation,
            la machine vous revient — sous réserve d&apos;avoir un créneau disponible d&apos;ici là.
          </p>
        </div>
      )}

      {/* Sélecteur de buanderie */}
      {buanderies.length > 1 && (
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
      )}

      {/* Bandeau des jours */}
      <div className="scroll-x -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex gap-1.5 pb-1 w-max" role="tablist" aria-label="Jour">
          {jours.map((j) => {
            const k = dayKey(j);
            const actif = k === jourActif;
            const aujourdhui = k === dayKey(new Date());
            const jsem = isoDayOfWeek(j);
            const weekend = jsem >= 6;

            return (
              <button
                key={k}
                role="tab"
                aria-selected={actif}
                onClick={() => { setJourActif(k); grille.current?.scrollTo({ left: 0 }); }}
                className={`shrink-0 w-[62px] py-2.5 border rounded-[3px] transition-all text-center
                  ${actif
                    ? "border-klein bg-klein/12"
                    : "border-line hover:border-line-hi bg-surface/40"}`}
              >
                <span className={`block text-[10px] font-mono tracking-[0.1em]
                  ${actif ? "text-klein-2" : weekend ? "text-dim/60" : "text-dim"}`}>
                  {JOURS_COURTS[jsem - 1]}
                </span>
                <span className={`block display text-xl mt-0.5 tabular
                  ${actif ? "text-chalk" : "text-mist"}`}>
                  {k.slice(8, 10)}
                </span>
                {aujourdhui && (
                  <span className="block w-1 h-1 rounded-full bg-acid-vif mx-auto mt-1" aria-label="aujourd'hui" />
                )}
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
                gridTemplateColumns: `72px repeat(${parc.length}, ${largeurColonne})`,
              }}
            >
              {/* En-tête des machines */}
              <div className="sticky left-0 z-20 bg-surface border-b border-r border-line px-3 py-3">
                <span className="eyebrow">Heure</span>
              </div>
              {parc.map((m) => (
                <div
                  key={m.id}
                  className="border-b border-line px-2 py-3 text-center bg-surface/60"
                >
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

              {/* Lignes horaires */}
              {creneaux.map((c) => {
                const passe = c.start.getTime() < maintenant;
                const libresIci = parc.filter(
                  (m) => etatCellule(m, c).etat === "libre",
                ).length;

                return (
                  <div key={c.key} className="contents">
                    <div
                      className={`sticky left-0 z-10 bg-surface border-r border-line px-3 py-2.5
                        flex items-center justify-between gap-1 ${passe ? "opacity-40" : ""}`}
                    >
                      <span className="tabular text-[12px] text-mist">{c.label}</span>
                      {!passe && libresIci === 0 && parc.length > 0 && (
                        <span className="w-1 h-1 rounded-full bg-coral/70" title="complet" aria-hidden />
                      )}
                    </div>

                    {parc.map((m) => (
                      <Cellule
                        key={`${m.id}|${c.key}`}
                        machine={m}
                        creneau={c}
                        {...etatCellule(m, c)}
                        occupe={enVol === `${m.id}|${c.key}`}
                        annulationEnCours={enVol}
                        quotaAtteint={Boolean(quotaAtteint) || suspendu}
                        enFile={enAttente.has(`${buanderie.id}|${m.kind}|${c.start.toISOString()}`)}
                        onReserver={() => reserver(m, c)}
                        onAnnuler={(l) => annuler(l)}
                        onFile={() => rejoindreFile(c, m.kind)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Légende */}
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
          <span className="w-3 h-3 border border-line bg-line/40 rounded-[2px]" /> passé / indisponible
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-acid">
          <span className="w-1.5 h-1.5 rounded-full bg-acid pulse-live" /> mise à jour en direct
        </span>
      </div>
    </div>
  );
}

/* ── Une case de la grille ────────────────────────────────────────────────── */
function Cellule({
  machine, creneau, etat, ligne, occupe, annulationEnCours,
  quotaAtteint, enFile, onReserver, onAnnuler, onFile,
}: {
  machine: Machine;
  creneau: Slot;
  etat: Etat;
  ligne?: BoardRow;
  occupe: boolean;
  annulationEnCours: string | null;
  quotaAtteint: boolean;
  enFile: boolean;
  onReserver: () => void;
  onAnnuler: (l: BoardRow) => void;
  onFile: () => void;
}) {
  const base = "border-b border-l border-line px-1.5 py-2 min-h-[52px] flex items-center justify-center text-center transition-all duration-200";

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
        title={`Votre réservation — ${fmtTime(ligne.starts_at)}. Cliquer pour annuler.`}
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
          {pointe && (
            <span className="text-[9px] font-mono text-acid/70 group-hover:hidden">en cours</span>
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
          <span className="text-[11px] text-klein-2 truncate max-w-full">
            {ligne.owner_first_name}
          </span>
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

  // Libre
  return (
    <button
      onClick={onReserver}
      disabled={occupe || quotaAtteint}
      title={
        quotaAtteint
          ? "Quota hebdomadaire atteint"
          : `Réserver ${machine.name} à ${creneau.label}`
      }
      className={`${base} sweep hover:bg-acid/[0.10] hover:border-l-acid/40 group
        disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
      {occupe ? (
        <Tambour size={16} spinning className="text-acid" />
      ) : (
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-dim
          group-hover:text-acid transition-colors group-disabled:group-hover:text-dim">
          {quotaAtteint ? "—" : "libre"}
        </span>
      )}
    </button>
  );
}
