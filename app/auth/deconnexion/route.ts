import { NextResponse, type NextRequest } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
