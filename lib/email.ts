/**
 * Contrôle de l'adresse centralienne, côté client.
 *
 * Le verdict qui fait foi reste celui du trigger `handle_new_user` en base
 * (0002_functions.sql) : cette fonction existe pour dire « non » tout de
 * suite, avec une explication, plutôt qu'après un aller-retour réseau.
 */

export const DOMAINE_CENTRALE = "centrale-casablanca.ma";

// prenom.nom — lettres et traits d'union, suffixe numérique toléré
// pour les homonymes (prenom.nom2@…).
const FORME = /^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*[0-9]*$/;

export type VerdictEmail =
  | { ok: true; email: string; prenom: string; nom: string }
  | { ok: false; raison: string };

export function verifierEmail(saisie: string, domaine = DOMAINE_CENTRALE): VerdictEmail {
  const email = saisie.trim().toLowerCase();

  if (!email) return { ok: false, raison: "Entrez votre adresse e-mail." };
  if ((email.match(/@/g) ?? []).length !== 1) {
    return { ok: false, raison: "Cette adresse n'est pas valide." };
  }

  const [local, hote] = email.split("@");

  if (hote !== domaine) {
    return {
      ok: false,
      raison: `Réservé aux adresses @${domaine}. Utilisez votre adresse de l'École.`,
    };
  }

  if (!FORME.test(local)) {
    return {
      ok: false,
      raison: `Format attendu : prenom.nom@${domaine}`,
    };
  }

  const [brutPrenom, brutNom] = local.split(".");
  return {
    ok: true,
    email,
    prenom: capitaliser(brutPrenom),
    nom: capitaliser(brutNom.replace(/[0-9]+$/, "")),
  };
}

/** « jean-pierre » → « Jean-Pierre » */
export function capitaliser(valeur: string): string {
  return valeur
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join("-");
}
