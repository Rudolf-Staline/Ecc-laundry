"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/errors";
import { useToast } from "@/components/toast";
import { Bouton, Etiquette } from "@/components/ui";
import { fmtDateTime, fmtRelative } from "@/lib/time";
import {
  CATEGORIES_RECLAMATION, LIBELLES_STATUT_RECLAMATION,
  type ClaimMessage, type ClaimRow, type Profile, type ReportStatus,
} from "@/lib/types";

const TONS: Record<ReportStatus, "panne" | "occupe" | "libre" | "neutre"> = {
  open: "panne",
  acknowledged: "occupe",
  resolved: "libre",
  rejected: "neutre",
};

export function FilReclamation({
  dossier, messagesInitiaux, moi, vueAdmin = false,
}: {
  dossier: ClaimRow;
  messagesInitiaux: ClaimMessage[];
  moi: Profile;
  vueAdmin?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => creerClientNavigateur(), []);

  const [messages, setMessages] = useState(messagesInitiaux);
  const [statut, setStatut] = useState<ReportStatus>(dossier.status);
  const [brouillon, setBrouillon] = useState("");
  const [enCours, setEnCours] = useState(false);
  const bas = useRef<HTMLDivElement>(null);

  const clos = statut === "resolved" || statut === "rejected";
  const estAdmin = moi.role === "admin";

  const recharger = useCallback(async () => {
    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.from("claim_messages").select("*").eq("claim_id", dossier.id).order("created_at"),
      supabase.from("v_reclamations").select("status").eq("id", dossier.id).maybeSingle(),
    ]);
    if (m) setMessages(m as ClaimMessage[]);
    if (d) setStatut((d as { status: ReportStatus }).status);
  }, [supabase, dossier.id]);

  /* Le fil se met à jour quand l'équipe répond, sans rechargement. */
  useEffect(() => {
    const canal = supabase
      .channel(`reclamation-${dossier.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "claim_messages", filter: `claim_id=eq.${dossier.id}` },
        () => void recharger())
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [supabase, dossier.id, recharger]);

  async function repondre(e: React.FormEvent) {
    e.preventDefault();
    if (brouillon.trim().length < 1) return;

    setEnCours(true);
    const { error } = await supabase.rpc("reply_claim", {
      p_claim_id: dossier.id,
      p_body: brouillon.trim(),
    });
    setEnCours(false);

    if (error) {
      toast({ ton: "erreur", titre: "Envoi impossible", detail: messageErreur(error) });
      return;
    }
    setBrouillon("");
    await recharger();
    bas.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function changerStatut(nouveau: ReportStatus) {
    setEnCours(true);
    const { error } = await supabase.rpc("admin_set_claim_status", {
      p_claim_id: dossier.id,
      p_status: nouveau,
    });
    setEnCours(false);

    if (error) {
      toast({ ton: "erreur", titre: "Action refusée", detail: messageErreur(error) });
      return;
    }
    setStatut(nouveau);
    toast({ ton: "ok", titre: `Dossier ${LIBELLES_STATUT_RECLAMATION[nouveau]}` });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* En-tête du dossier */}
      <header className="panel corners p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <code className="text-[11px] font-mono text-dim">{dossier.reference}</code>
              <Etiquette ton={TONS[statut]} point={statut === "open"}>
                {LIBELLES_STATUT_RECLAMATION[statut]}
              </Etiquette>
            </div>
            <h1 className="display text-2xl mt-2.5 text-chalk">{dossier.subject}</h1>
            <p className="text-sm text-mist mt-2">{CATEGORIES_RECLAMATION[dossier.category]}</p>
          </div>
        </div>

        <dl className="grid sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-line text-[12px]">
          <div>
            <dt className="eyebrow">Ouverte</dt>
            <dd className="text-mist mt-1.5">{fmtDateTime(dossier.created_at)}</dd>
          </div>
          {vueAdmin && (
            <div>
              <dt className="eyebrow">Par</dt>
              <dd className="text-mist mt-1.5 truncate">{dossier.auteur}</dd>
            </div>
          )}
          {dossier.machine_name && (
            <div>
              <dt className="eyebrow">Machine</dt>
              <dd className="text-mist mt-1.5">
                {dossier.machine_name}
                {dossier.room_name && <span className="text-dim"> · {dossier.room_name}</span>}
              </dd>
            </div>
          )}
          {dossier.booking_reference && (
            <div>
              <dt className="eyebrow">Réservation</dt>
              <dd className="mt-1.5">
                <Link
                  href={`/reservation/${dossier.booking_reference}`}
                  className="text-klein-2 hover:underline font-mono"
                >
                  {dossier.booking_reference}
                </Link>
                {dossier.booking_starts_at && (
                  <span className="text-dim block text-[11px] mt-0.5">
                    {fmtDateTime(dossier.booking_starts_at)}
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {estAdmin && (
          <div className="flex gap-2 mt-5 pt-5 border-t border-line flex-wrap">
            <span className="eyebrow self-center mr-1">Traitement</span>
            {(["acknowledged", "resolved", "rejected"] as const).map((s) => (
              <Bouton
                key={s}
                taille="sm"
                variante={statut === s ? "primaire" : "secondaire"}
                enCours={enCours}
                onClick={() => changerStatut(s)}
              >
                {LIBELLES_STATUT_RECLAMATION[s]}
              </Bouton>
            ))}
          </div>
        )}
      </header>

      {/* Le fil */}
      <section className="space-y-3" aria-label="Fil de discussion">
        {messages.map((m) => {
          const deMoi = m.author_id === moi.id;
          return (
            <article
              key={m.id}
              className={`panel p-4 ${
                m.from_staff
                  ? "border-l-2 border-l-klein bg-klein/[0.04]"
                  : deMoi
                    ? "border-l-2 border-l-acid/50"
                    : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span
                  className={`text-[11px] font-mono uppercase tracking-[0.1em] ${
                    m.from_staff ? "text-klein-2" : "text-dim"
                  }`}
                >
                  {m.from_staff ? "Équipe buanderie" : deMoi ? "Vous" : dossier.auteur}
                </span>
                <time className="text-[11px] font-mono text-dim" dateTime={m.created_at}>
                  {fmtRelative(m.created_at)}
                </time>
              </div>
              <p className="text-sm text-mist leading-relaxed whitespace-pre-wrap">{m.body}</p>
            </article>
          );
        })}
        <div ref={bas} />
      </section>

      {/* Réponse */}
      {clos && !estAdmin ? (
        <div className="panel corners p-5">
          <p className="text-sm text-mist">
            Ce dossier est {LIBELLES_STATUT_RECLAMATION[statut]}. Si le problème persiste,{" "}
            <Link href="/reclamations/nouvelle" className="text-klein-2 hover:underline">
              ouvrez-en un nouveau
            </Link>{" "}
            — l&apos;historique de celui-ci reste consultable.
          </p>
        </div>
      ) : (
        <form onSubmit={repondre} className="panel corners p-5">
          <label htmlFor="reponse" className="eyebrow block mb-2">
            {estAdmin ? "Répondre à l'étudiant" : "Ajouter au dossier"}
          </label>
          <textarea
            id="reponse"
            rows={3}
            maxLength={4000}
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            placeholder={
              estAdmin
                ? "Ce que vous avez constaté, ce qui va être fait."
                : "Un élément nouveau, une précision…"
            }
            className="w-full bg-ink-2 border border-line rounded-[3px] px-3.5 py-3 text-sm
              text-chalk placeholder:text-dim outline-none focus:border-klein transition-colors resize-y"
          />
          <Bouton
            type="submit"
            variante="primaire"
            enCours={enCours}
            disabled={!brouillon.trim()}
            className="mt-3"
          >
            Envoyer
          </Bouton>
        </form>
      )}
    </div>
  );
}
