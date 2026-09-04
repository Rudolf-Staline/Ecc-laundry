"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Etiquette, Selecteur, TitreSection } from "@/components/ui";
import { CompteARebours } from "@/components/compte-a-rebours";
import { Tambour } from "@/components/marque";
import { fmtTime, fmtRelative } from "@/lib/time";
import { CATEGORIES_PANNE, type MachineLive, type MachineReport } from "@/lib/types";

export function TableauParc({
  parcInitial,
  signalements,
}: {
  parcInitial: MachineLive[];
  signalements: MachineReport[];
}) {
  const toast = useToast();
  const supabase = useMemo(() => creerClientNavigateur(), []);
  const [parc, setParc] = useState(parcInitial);
  const [filtre, setFiltre] = useState<"tous" | "washer" | "dryer" | "libre">("tous");
  const [signale, setSignale] = useState<MachineLive | null>(null);

  const recharger = useCallback(async () => {
    const { data } = await supabase
      .from("v_machine_live").select("*").order("room_name").order("position");
    if (data) setParc(data as MachineLive[]);
  }, [supabase]);

  /* Le parc bouge sous les yeux : réservations et changements d'état. */
  useEffect(() => {
    const canal = supabase
      .channel("parc-direct")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void recharger())
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, () => void recharger())
      .subscribe();
    const t = setInterval(() => void recharger(), 60_000);
    return () => { void supabase.removeChannel(canal); clearInterval(t); };
  }, [supabase, recharger]);

  const visibles = parc.filter((m) =>
    filtre === "tous" ? true
    : filtre === "libre" ? m.live_status === "free"
    : m.kind === filtre,
  );

  const parBuanderie = visibles.reduce<Record<string, MachineLive[]>>((acc, m) => {
    (acc[m.room_name] ??= []).push(m);
    return acc;
  }, {});

  const signalesPar = new Set(signalements.map((s) => s.machine_id));

  return (
    <div className="space-y-7">
      <TitreSection
        surtitre="Temps réel"
        titre="Le parc"
        apres={
          <div className="flex gap-1.5 flex-wrap">
            {([
              ["tous", "Tout"],
              ["libre", "Libres"],
              ["washer", "Lavage"],
              ["dryer", "Séchage"],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFiltre(k)}
                aria-pressed={filtre === k}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.1em] border rounded-[3px]
                  transition-colors ${
                    filtre === k
                      ? "border-klein bg-klein/12 text-chalk"
                      : "border-line text-dim hover:text-mist"
                  }`}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />

      {Object.entries(parBuanderie).map(([salle, liste]) => (
        <section key={salle}>
          <p className="eyebrow mb-3">{salle}</p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 reveal-stagger">
            {liste.map((m) => (
              <CarteMachine
                key={m.machine_id}
                m={m}
                signalee={signalesPar.has(m.machine_id)}
                onSignaler={() => setSignale(m)}
              />
            ))}
          </div>
        </section>
      ))}

      {visibles.length === 0 && (
        <div className="panel corners px-6 py-14 text-center">
          <p className="text-mist">Aucune machine ne correspond à ce filtre.</p>
        </div>
      )}

      {signale && (
        <DialogueSignalement
          machine={signale}
          onFermer={() => setSignale(null)}
          onEnvoye={() => {
            setSignale(null);
            void recharger();
            toast({
              ton: "ok",
              titre: "Signalement transmis",
              detail: "L'équipe est prévenue. Merci — trois signalements retirent la machine du planning.",
            });
          }}
        />
      )}
    </div>
  );
}

/* ── Carte machine ────────────────────────────────────────────────────────── */
function CarteMachine({
  m, signalee, onSignaler,
}: {
  m: MachineLive;
  signalee: boolean;
  onSignaler: () => void;
}) {
  const libre = m.live_status === "free";
  const occupee = m.live_status === "busy";
  const hs = !libre && !occupee;

  return (
    <article
      className={`panel corners p-5 transition-colors ${
        libre ? "border-acid/25" : occupee ? "border-ember/25" : "border-coral/25"
      }`}
    >
      <div className="flex items-start gap-4">
        <Tambour
          size={44}
          spinning={occupee ? "cycle" : false}
          className={libre ? "text-acid" : occupee ? "text-ember" : "text-coral"}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-chalk font-medium truncate">{m.name}</p>
          <p className="text-[11px] font-mono text-dim mt-0.5">
            {m.kind === "washer" ? "Lave-linge" : "Sèche-linge"}
            {m.capacity_kg ? ` · ${m.capacity_kg} kg` : ""}
          </p>

          <div className="mt-3">
            {libre && <Etiquette ton="libre" point>disponible</Etiquette>}
            {occupee && <Etiquette ton="occupe" point pulse>en cycle</Etiquette>}
            {m.live_status === "maintenance" && <Etiquette ton="panne" point>maintenance</Etiquette>}
            {m.live_status === "out_of_order" && <Etiquette ton="panne" point>hors service</Etiquette>}
          </div>
        </div>
      </div>

      {/* Détail temporel */}
      <div className="mt-4 pt-4 border-t border-line min-h-[46px]">
        {occupee && m.busy_until && (
          <>
            <p className="display text-2xl text-ember">
              <CompteARebours vers={m.busy_until} depuis={m.busy_from ?? undefined} />
            </p>
            <p className="text-[11px] font-mono text-dim mt-1.5">
              libre à {fmtTime(m.busy_until)}
              {m.is_mine && <span className="text-acid ml-2">· votre machine</span>}
            </p>
          </>
        )}
        {libre && (
          <p className="text-[11px] font-mono text-dim">
            {m.next_starts_at
              ? `réservée ${fmtRelative(m.next_starts_at)} (${fmtTime(m.next_starts_at)})`
              : "aucune réservation à venir"}
          </p>
        )}
        {hs && (
          <p className="text-[11px] font-mono text-coral">
            retirée du planning · {m.open_reports} signalement{m.open_reports > 1 ? "s" : ""}
          </p>
        )}
      </div>

      <button
        onClick={onSignaler}
        disabled={signalee}
        className="mt-3 text-[10px] font-mono uppercase tracking-[0.1em] text-dim
          hover:text-coral transition-colors disabled:opacity-50 disabled:hover:text-dim"
      >
        {signalee ? "✓ déjà signalée" : "Signaler un problème"}
      </button>
    </article>
  );
}

/* ── Signalement de panne ─────────────────────────────────────────────────── */
function DialogueSignalement({
  machine, onFermer, onEnvoye,
}: {
  machine: MachineLive;
  onFermer: () => void;
  onEnvoye: () => void;
}) {
  const toast = useToast();
  const [categorie, setCategorie] = useState("not_starting");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) {
      toast({ ton: "erreur", titre: "Décrivez le problème en quelques mots." });
      return;
    }
    setEnCours(true);
    const supabase = creerClientNavigateur();
    const { error } = await supabase.rpc("report_machine", {
      p_machine_id: machine.machine_id,
      p_category: categorie,
      p_message: message.trim(),
    });
    setEnCours(false);

    if (error) toast({ ton: "erreur", titre: "Envoi impossible", detail: messageErreur(error) });
    else onEnvoye();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/85 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label={`Signaler ${machine.name}`}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <form onSubmit={envoyer} className="panel corners p-6 w-full max-w-md reveal">
        <p className="eyebrow">Signalement</p>
        <h2 className="display text-xl mt-2 text-chalk">{machine.name}</h2>
        <p className="text-xs text-dim font-mono mt-1">{machine.room_name}</p>

        <div className="mt-5 space-y-4">
          <Selecteur
            etiquette="Nature du problème"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
          >
            {Object.entries(CATEGORIES_PANNE).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </Selecteur>

          <div>
            <label htmlFor="msg" className="eyebrow block mb-2">Description</label>
            <textarea
              id="msg"
              rows={3}
              maxLength={800}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ce que vous avez constaté, et à quel moment."
              className="w-full bg-ink-2 border border-line rounded-[3px] px-3.5 py-3 text-sm
                text-chalk placeholder:text-dim outline-none focus:border-klein transition-colors resize-none"
            />
          </div>
        </div>

        <p className="text-[11px] text-dim mt-4 leading-relaxed">
          Au troisième signalement par des étudiants différents, la machine se retire
          automatiquement du planning en attendant l&apos;intervention.
        </p>

        <div className="flex gap-2 mt-5">
          <Bouton type="submit" variante="primaire" enCours={enCours} className="flex-1">
            Envoyer
          </Bouton>
          <Bouton type="button" variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
        </div>
      </form>
    </div>
  );
}
