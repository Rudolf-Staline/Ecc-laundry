"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lectures de sources extérieures à React (attribut du DOM, localStorage,
 * capacités du navigateur). `useSyncExternalStore` est fait pour ça : il évite
 * la cascade de rendus qu'entraîne un setState dans un effet, et fournit un
 * instantané serveur explicite — donc pas de désynchronisation à l'hydratation.
 */

const RIEN = () => () => {};

/** Capacité du navigateur : constante sur la durée de vie de la page. */
export function useCapacite(test: () => boolean): boolean {
  const snapshot = useCallback(() => test(), [test]);
  return useSyncExternalStore(RIEN, snapshot, () => false);
}

/* ── Thème ────────────────────────────────────────────────────────────────── */

const abonnesTheme = new Set<() => void>();

function souscrireTheme(cb: () => void) {
  abonnesTheme.add(cb);
  return () => abonnesTheme.delete(cb);
}

function lireTheme(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function appliquerTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("tambour-theme", theme);
  } catch {
    // Navigation privée : le choix ne survivra pas au rechargement, tant pis.
  }
  abonnesTheme.forEach((cb) => cb());
}

export function useTheme(): "dark" | "light" {
  return useSyncExternalStore(souscrireTheme, lireTheme, () => "dark" as const);
}

/* ── localStorage ─────────────────────────────────────────────────────────── */

const abonnesLocaux = new Set<() => void>();
// L'instantané doit rester référentiellement stable, sinon React boucle :
// on ne reparse que lorsque la chaîne brute a changé.
const cache = new Map<string, { brut: string | null; valeur: unknown }>();

function souscrireLocal(cb: () => void) {
  abonnesLocaux.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    abonnesLocaux.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function ecrireLocal(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible ou plein : l'état reste en mémoire pour cette session.
  }
  cache.delete(cle);
  abonnesLocaux.forEach((cb) => cb());
}

/** Valeur JSON persistée localement, avec repli si le stockage est fermé. */
export function useLocal<T>(cle: string, defaut: T): T {
  const snapshot = useCallback((): T => {
    let brut: string | null = null;
    try {
      brut = localStorage.getItem(cle);
    } catch {
      return defaut;
    }

    const memo = cache.get(cle);
    if (memo && memo.brut === brut) return memo.valeur as T;

    let valeur: T = defaut;
    if (brut !== null) {
      try {
        valeur = JSON.parse(brut) as T;
      } catch {
        valeur = defaut;
      }
    }
    cache.set(cle, { brut, valeur });
    return valeur;
  }, [cle, defaut]);

  return useSyncExternalStore(souscrireLocal, snapshot, () => defaut);
}
