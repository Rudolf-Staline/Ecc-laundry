/**
 * Laundry doit rester lisible même avant d'être branché : sans clés Supabase,
 * les pages affichent la marche à suivre au lieu de planter.
 */
export const supabaseConfigure = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Une variable d'environnement vide n'est pas une valeur, mais `??` la laisse
 * passer : `new URL("")` abattait alors le build entier depuis `metadataBase`.
 * Vercel livre justement une variable vide au build quand elle est marquée
 * « sensible ». On écarte donc le vide comme l'invalide, candidat par candidat.
 */
function premiereUrlValide(candidats: (string | undefined)[], repli: string): string {
  for (const brut of candidats) {
    const propre = brut?.trim().replace(/\/+$/, "");
    if (!propre) continue;
    try {
      const { protocol } = new URL(propre);
      if (protocol === "http:" || protocol === "https:") return propre;
    } catch {
      // Renseignée mais inexploitable : au suivant, sans faire échouer le build.
    }
  }
  return repli;
}

export const urlSite = premiereUrlValide(
  [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ],
  "http://localhost:3000",
);

export const NOM_APP = "Laundry";
export const NOM_ECOLE = "École Centrale Casablanca";
