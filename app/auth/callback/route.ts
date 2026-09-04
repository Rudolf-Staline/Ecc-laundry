import { NextResponse, type NextRequest } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";

/** Retour du lien magique : on échange le code contre une session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const suite = searchParams.get("suite") ?? "/tableau";
  const erreurFournisseur = searchParams.get("error_description");

  if (erreurFournisseur) {
    return NextResponse.redirect(
      `${origin}/connexion?erreur=${encodeURIComponent(erreurFournisseur)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?erreur=${encodeURIComponent("Lien incomplet.")}`);
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/connexion?erreur=${encodeURIComponent("Ce lien a expiré. Demandez-en un nouveau.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${suite.startsWith("/") ? suite : "/tableau"}`);
}
