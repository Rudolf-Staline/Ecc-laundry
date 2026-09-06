/**
 * Traduction en messages lisibles des codes SQLSTATE applicatifs
 * (cf. supabase/migrations/0002) et des codes d'erreur Supabase Auth
 * (`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`).
 * La base — ou Supabase Auth — reste seule autorité : l'interface se
 * contente de rendre son verdict intelligible.
 */

type PgLike = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;

const GENERIQUES: Record<string, string> = {
  TB001: "Vous avez atteint votre quota de réservations pour cette semaine.",
  TB002: "Cette machine n'est pas disponible.",
  TB003: "La buanderie est fermée à cette heure-là.",
  TB004: "Ce créneau est déjà passé.",
  TB005: "Ce créneau n'est pas encore ouvert à la réservation.",
  TB006: "Vous avez déjà trop de réservations à venir.",
  TB007: "Votre compte ne peut pas réserver pour le moment.",
  TB008: "Ce créneau ne tombe pas sur la grille horaire.",
  TB009: "Le délai d'annulation est dépassé.",
  TB010: "Cette adresse e-mail n'est pas une adresse centralienne.",
  "23P01": "Ce créneau vient d'être pris par quelqu'un d'autre.",
  "23505": "Cet élément existe déjà.",
  "23503": "Élément lié introuvable.",
  "42501": "Vous n'avez pas les droits nécessaires.",
  P0001: "Opération refusée.",

  // Supabase Auth
  invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
  user_already_exists: "Un compte existe déjà avec cette adresse. Connectez-vous plutôt.",
  email_not_confirmed: "Confirmez votre adresse e-mail avant de vous connecter (lien envoyé à l'inscription).",
  weak_password: "Ce mot de passe est trop simple. Choisissez-en un autre.",
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  over_request_rate_limit: "Trop de tentatives. Réessayez dans quelques minutes.",
  over_email_send_rate_limit: "Trop d'e-mails envoyés récemment. Réessayez dans quelques minutes.",
  signup_disabled: "Les inscriptions sont momentanément désactivées.",
  otp_expired: "Ce code a expiré ou n'est plus valide. Demandez-en un nouveau.",
};

/**
 * Les messages levés par les triggers sont déjà rédigés en français et
 * portent le détail utile (quota exact, horaires de la buanderie…) : on les
 * préfère au libellé générique dès qu'ils sont exploitables. Les codes
 * Supabase Auth (`invalid_credentials`…) suivent la logique inverse : leur
 * `.message` n'est jamais traduit, donc le libellé générique prime toujours
 * sur lui — reconnaissables à leur forme minuscule_avec_tirets_bas, à
 * l'inverse des SQLSTATE et codes TBxxx qui sont eux en majuscules.
 */
export function messageErreur(error: PgLike, repli = "Une erreur est survenue."): string {
  if (!error) return repli;

  const code = error.code ?? "";
  if (/^[a-z][a-z_]*$/.test(code) && GENERIQUES[code]) return GENERIQUES[code];

  const brut = (error.message ?? "").trim();

  const technique =
    !brut ||
    /^(duplicate key|permission denied|new row violates|null value|invalid input|relation |function |column )/i.test(brut) ||
    brut.includes("violates row-level security") ||
    brut.includes("conflicting key value");

  if (!technique && brut.length > 0 && brut.length < 300) return brut;
  return GENERIQUES[code] ?? repli;
}

export function estQuotaAtteint(error: PgLike): boolean {
  return error?.code === "TB001";
}

export function estCreneauPris(error: PgLike): boolean {
  return error?.code === "23P01";
}
