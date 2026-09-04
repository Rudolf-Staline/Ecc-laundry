import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Client lié à la session de l'utilisateur : RLS s'applique. */
export async function creerClientServeur() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : le rafraîchissement de
            // session est assuré par proxy.ts, on peut ignorer.
          }
        },
      },
    },
  );
}

/**
 * Client `service_role` — contourne RLS.
 * Réservé aux routes serveur (cron, flux iCal). Jamais importé côté client.
 */
export function creerClientService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante.");

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
