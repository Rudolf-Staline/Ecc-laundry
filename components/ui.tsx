"use client";

import { forwardRef, useState } from "react";

type VarianteBouton = "primaire" | "secondaire" | "fantome" | "danger" | "acide";

const VARIANTES: Record<VarianteBouton, string> = {
  primaire:
    "bg-encre text-ink border-encre hover:-translate-y-0.5 hover:shadow-[var(--ombre-levee)]",
  acide:
    "bg-klein text-white border-klein hover:bg-klein-2 hover:border-klein-2 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(22,156,167,.8)]",
  secondaire:
    "bg-surface/90 text-chalk border-line hover:bg-surface-hi hover:border-line-hi hover:-translate-y-0.5",
  fantome:
    "bg-transparent text-mist border-transparent hover:text-chalk hover:bg-surface-hi/80",
  danger:
    "bg-transparent text-coral border-coral/30 hover:bg-coral-fond hover:border-coral/45",
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
    sm: "text-[12px] px-3.5 py-1.5 gap-1.5",
    md: "text-[13px] px-4 py-2.5 gap-2",
    lg: "text-[14px] px-6 py-3.5 gap-2.5",
  }[taille];

  return (
    <button
      ref={ref}
      disabled={disabled || enCours}
      className={`inline-flex items-center justify-center border rounded-[12px] font-semibold
        transition-all duration-200 active:translate-y-0 active:scale-[0.99]
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
      {point && <span className={`point ${pulse ? "pulse-live" : ""}`} />}
      {children}
    </span>
  );
}

export const Champ = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { etiquette?: string; erreur?: string; aide?: string }
>(function Champ({ etiquette, erreur, aide, className = "", id, ...rest }, ref) {
  const uid = id ?? rest.name;
  return (
    <div className="w-full">
      {etiquette && (
        <label htmlFor={uid} className="eyebrow block mb-2.5">
          {etiquette}
        </label>
      )}
      <input
        ref={ref}
        id={uid}
        aria-invalid={Boolean(erreur)}
        aria-describedby={erreur ? `${uid}-err` : aide ? `${uid}-aide` : undefined}
        className={`w-full bg-surface-hi/85 border rounded-[12px] px-4 py-3.5 text-sm text-chalk
          placeholder:text-dim transition-all duration-200 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,.45)]
          ${erreur ? "border-coral/60 ring-2 ring-coral/5" : "border-line focus:border-klein/60 focus:ring-4 focus:ring-klein/8 focus:bg-surface"} ${className}`}
        {...rest}
      />
      {erreur && (
        <p id={`${uid}-err`} className="text-xs text-coral mt-2 flex items-start gap-1.5">
          <span className="point bg-current shrink-0 mt-1" aria-hidden />
          {erreur}
        </p>
      )}
      {!erreur && aide && (
        <p id={`${uid}-aide`} className="text-xs text-dim mt-2.5 leading-relaxed">
          {aide}
        </p>
      )}
    </div>
  );
});

export const ChampMotDePasse = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { etiquette?: string; erreur?: string; aide?: string }
>(function ChampMotDePasse({ etiquette, erreur, aide, className = "", id, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  const uid = id ?? rest.name;

  return (
    <div className="w-full">
      {etiquette && (
        <label htmlFor={uid} className="eyebrow block mb-2.5">
          {etiquette}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={uid}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(erreur)}
          aria-describedby={erreur ? `${uid}-err` : aide ? `${uid}-aide` : undefined}
          className={`w-full bg-surface-hi/85 border rounded-[12px] pl-4 pr-11 py-3.5 text-sm text-chalk
            placeholder:text-dim transition-all duration-200 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,.45)]
            ${erreur ? "border-coral/60 ring-2 ring-coral/5" : "border-line focus:border-klein/60 focus:ring-4 focus:ring-klein/8 focus:bg-surface"} ${className}`}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute inset-y-0 right-0 px-3.5 grid place-items-center text-dim hover:text-chalk transition-colors"
        >
          {visible ? <OeilBarre /> : <Oeil />}
        </button>
      </div>
      {erreur && (
        <p id={`${uid}-err`} className="text-xs text-coral mt-2 flex items-start gap-1.5">
          <span className="point bg-current shrink-0 mt-1" aria-hidden />
          {erreur}
        </p>
      )}
      {!erreur && aide && (
        <p id={`${uid}-aide`} className="text-xs text-dim mt-2.5 leading-relaxed">
          {aide}
        </p>
      )}
    </div>
  );
});

function Oeil() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OeilBarre() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7c1.6 0 3 .3 4.2.8M22 12s-3.5 7-10 7c-1.6 0-3-.3-4.2-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function Selecteur({
  etiquette,
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { etiquette?: string }) {
  return (
    <div className="w-full">
      {etiquette && <label className="eyebrow block mb-2.5">{etiquette}</label>}
      <select
        className={`w-full bg-surface-hi/85 border border-line rounded-[12px] px-3.5 py-3 text-sm
          text-chalk outline-none focus:border-klein/60 focus:ring-4 focus:ring-klein/8 transition-all ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

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
    <div className={`section-heading flex items-end justify-between gap-4 flex-wrap ${className}`}>
      <div>
        {surtitre && <p className="eyebrow mb-2">{surtitre}</p>}
        <h2 className="display text-2xl sm:text-3xl text-chalk">{titre}</h2>
      </div>
      {apres}
    </div>
  );
}

export function Vide({ titre, detail, action }: { titre: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="panel px-6 py-14 text-center overflow-hidden">
      <div className="empty-orb mx-auto mb-5" aria-hidden />
      <p className="display text-lg text-mist">{titre}</p>
      {detail && <p className="text-sm text-dim mt-2 max-w-sm mx-auto leading-relaxed">{detail}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
