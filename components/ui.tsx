"use client";

import { forwardRef } from "react";

/* ── Bouton ──────────────────────────────────────────────────────────────── */
type VarianteBouton = "primaire" | "secondaire" | "fantome" | "danger" | "acide";

const VARIANTES: Record<VarianteBouton, string> = {
  // L'action principale est une pastille encre, jamais une couleur de marque :
  // l'indigo sert à situer, pas à pousser au clic.
  primaire:
    "bg-encre text-ink border-encre hover:opacity-88",
  acide:
    "bg-klein text-white border-klein hover:bg-klein-2 hover:border-klein-2",
  secondaire:
    "bg-surface text-chalk border-line hover:bg-ink-2 hover:border-line-hi",
  fantome:
    "bg-transparent text-mist border-transparent hover:text-chalk hover:bg-ink-2",
  danger:
    "bg-transparent text-coral border-coral/35 hover:bg-coral hover:text-white hover:border-coral",
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
    sm: "text-[12px] px-3 py-1.5 gap-1.5",
    md: "text-[13px] px-4 py-2.5 gap-2",
    lg: "text-[14px] px-6 py-3 gap-2.5",
  }[taille];

  return (
    <button
      ref={ref}
      disabled={disabled || enCours}
      className={`inline-flex items-center justify-center border rounded-[8px] font-semibold
        transition-all duration-150 active:scale-[0.99]
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
  point = true,
  pulse = false,
}: {
  ton?: "neutre" | "libre" | "occupe" | "panne" | "info" | "mien";
  children: React.ReactNode;
  className?: string;
  point?: boolean;
  pulse?: boolean;
}) {
  const tons = {
    neutre: "text-dim bg-ink-2",
    libre: "text-menthe bg-menthe-fond",
    occupe: "text-acid bg-acid-fond",
    panne: "text-coral bg-coral-fond",
    info: "text-klein bg-klein-fond",
    mien: "text-violet bg-violet-fond",
  }[ton];

  return (
    <span className={`chip ${tons} ${className}`}>
      {point && (
        <span className={`point ${pulse ? "pulse-live" : ""}`} />
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
        className={`w-full bg-ink-2 border rounded-[8px] px-3.5 py-3 text-sm text-chalk
          placeholder:text-dim transition-colors outline-none
          ${erreur ? "border-coral/60" : "border-line focus:border-klein"} ${className}`}
        {...rest}
      />
      {erreur && (
        <p id={`${uid}-err`} className="text-xs text-coral mt-2 flex items-start gap-1.5">
          <span className="point bg-current shrink-0" aria-hidden />
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
        className={`w-full bg-ink-2 border border-line rounded-[8px] px-3 py-2.5 text-sm
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
    <div className="panel px-6 py-14 text-center">
      <p className="display text-lg text-mist">{titre}</p>
      {detail && <p className="text-sm text-dim mt-2 max-w-sm mx-auto leading-relaxed">{detail}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
