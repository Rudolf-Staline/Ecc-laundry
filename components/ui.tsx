"use client";

import { forwardRef } from "react";

/* ── Bouton ──────────────────────────────────────────────────────────────── */
type VarianteBouton = "primaire" | "secondaire" | "fantome" | "danger" | "acide";

const VARIANTES: Record<VarianteBouton, string> = {
  primaire:
    "bg-klein text-white border-klein hover:bg-klein-2 hover:border-klein-2 shadow-[0_0_28px_-8px] shadow-klein/60",
  acide:
    "bg-acid-vif text-on-bright border-acid-vif hover:brightness-110 font-semibold",
  secondaire:
    "bg-surface-hi text-chalk border-line-hi hover:border-mist hover:bg-surface",
  fantome:
    "bg-transparent text-mist border-transparent hover:text-chalk hover:bg-surface-hi",
  danger:
    "bg-transparent text-coral border-coral/40 hover:bg-coral hover:text-white hover:border-coral",
};

export const Bouton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variante?: VarianteBouton;
    taille?: "sm" | "md" | "lg";
    enCours?: boolean;
  }
>(function Bouton(
  { variante = "secondaire", taille = "md", enCours, className = "", children, disabled, ...rest },
  ref,
) {
  const tailles = {
    sm: "text-[11px] px-2.5 py-1.5 gap-1.5",
    md: "text-[13px] px-4 py-2.5 gap-2",
    lg: "text-sm px-6 py-3.5 gap-2.5",
  }[taille];

  return (
    <button
      ref={ref}
      disabled={disabled || enCours}
      className={`inline-flex items-center justify-center border rounded-[3px] font-mono uppercase
        tracking-[0.12em] transition-all duration-200 active:scale-[0.98]
        disabled:opacity-40 disabled:pointer-events-none ${tailles} ${VARIANTES[variante]} ${className}`}
      {...rest}
    >
      {enCours && (
        <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full drum-spin" />
      )}
      {children}
    </button>
  );
});

/* ── Étiquette de statut ─────────────────────────────────────────────────── */
export function Etiquette({
  ton = "neutre",
  children,
  className = "",
  point = false,
  pulse = false,
}: {
  ton?: "neutre" | "libre" | "occupe" | "panne" | "info" | "mien";
  children: React.ReactNode;
  className?: string;
  point?: boolean;
  pulse?: boolean;
}) {
  const tons = {
    neutre: "text-mist border-line-hi",
    libre: "text-acid border-acid/35 bg-acid/[0.06]",
    occupe: "text-ember border-ember/35 bg-ember/[0.06]",
    panne: "text-coral border-coral/35 bg-coral/[0.06]",
    info: "text-klein-2 border-klein/35 bg-klein/[0.07]",
    mien: "text-chalk border-chalk/30 bg-chalk/[0.06]",
  }[ton];

  return (
    <span className={`chip ${tons} ${className}`}>
      {point && (
        <span className={`w-1.5 h-1.5 rounded-full bg-current shrink-0 ${pulse ? "pulse-live" : ""}`} />
      )}
      {children}
    </span>
  );
}

/* ── Champ de saisie ─────────────────────────────────────────────────────── */
export const Champ = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { etiquette?: string; erreur?: string; aide?: string }
>(function Champ({ etiquette, erreur, aide, className = "", id, ...rest }, ref) {
  const uid = id ?? rest.name;
  return (
    <div className="w-full">
      {etiquette && (
        <label htmlFor={uid} className="eyebrow block mb-2">
          {etiquette}
        </label>
      )}
      <input
        ref={ref}
        id={uid}
        aria-invalid={Boolean(erreur)}
        aria-describedby={erreur ? `${uid}-err` : aide ? `${uid}-aide` : undefined}
        className={`w-full bg-ink-2 border rounded-[3px] px-3.5 py-3 text-sm text-chalk
          placeholder:text-dim transition-colors outline-none
          ${erreur ? "border-coral/60" : "border-line focus:border-klein"} ${className}`}
        {...rest}
      />
      {erreur && (
        <p id={`${uid}-err`} className="text-xs text-coral mt-2 flex items-start gap-1.5">
          <span aria-hidden>▸</span>
          {erreur}
        </p>
      )}
      {!erreur && aide && (
        <p id={`${uid}-aide`} className="text-xs text-dim mt-2">
          {aide}
        </p>
      )}
    </div>
  );
});

/* ── Sélecteur ───────────────────────────────────────────────────────────── */
export function Selecteur({
  etiquette,
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { etiquette?: string }) {
  return (
    <div className="w-full">
      {etiquette && <label className="eyebrow block mb-2">{etiquette}</label>}
      <select
        className={`w-full bg-ink-2 border border-line rounded-[3px] px-3 py-2.5 text-sm
          text-chalk outline-none focus:border-klein transition-colors ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

/* ── En-tête de section ──────────────────────────────────────────────────── */
export function TitreSection({
  surtitre,
  titre,
  apres,
  className = "",
}: {
  surtitre?: string;
  titre: string;
  apres?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 flex-wrap ${className}`}>
      <div>
        {surtitre && <p className="eyebrow mb-2">{surtitre}</p>}
        <h2 className="display text-2xl sm:text-3xl text-chalk">{titre}</h2>
      </div>
      {apres}
    </div>
  );
}

/* ── État vide ───────────────────────────────────────────────────────────── */
export function Vide({ titre, detail, action }: { titre: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="panel corners px-6 py-14 text-center">
      <p className="display text-lg text-mist">{titre}</p>
      {detail && <p className="text-sm text-dim mt-2 max-w-sm mx-auto leading-relaxed">{detail}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
