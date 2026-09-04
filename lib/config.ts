/**
 * Tambour doit rester lisible même avant d'être branché : sans clés Supabase,
 * les pages affichent la marche à suivre au lieu de planter.
 */
export const supabaseConfigure = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const urlSite =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const NOM_APP = "Tambour";
export const NOM_ECOLE = "École Centrale Casablanca";
