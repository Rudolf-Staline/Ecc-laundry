import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Rafraîchit le jeton Supabase à chaque navigation et garde les routes
 * privées. Sous Next 16, ce fichier remplace `middleware.ts`.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return response;

  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const chemin = request.nextUrl.pathname;
  const privee = ["/tableau", "/reserver", "/calendrier", "/machines",
                  "/historique", "/reclamations", "/reservation", "/compte", "/admin"]
    .some((p) => chemin === p || chemin.startsWith(`${p}/`));

  if (!user && privee) {
    const vers = request.nextUrl.clone();
    vers.pathname = "/connexion";
    vers.search = `?suite=${encodeURIComponent(chemin + request.nextUrl.search)}`;
    return NextResponse.redirect(vers);
  }

  if (user && (chemin === "/connexion" || chemin === "/")) {
    if (chemin === "/connexion") {
      const { data: profil } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profil) {
        const vers = request.nextUrl.clone();
        vers.pathname = "/tableau";
        vers.search = "";
        return NextResponse.redirect(vers);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icone|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
