import { NextResponse, type NextRequest } from "next/server";
import { creerClientService } from "@/lib/supabase/server";
import { NOM_APP } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Flux iCal personnel : les créneaux de l'étudiant apparaissent dans son
 * agenda, avec un rappel dix minutes avant. Le jeton (`ics_token`) sert
 * d'authentification — il est régénérable depuis la page « compte ».
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new NextResponse("Jeton invalide", { status: 400 });
  }

  let supabase;
  try {
    supabase = creerClientService();
  } catch {
    return new NextResponse("Service indisponible", { status: 503 });
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("ics_token", token)
    .maybeSingle();

  if (!profil) return new NextResponse("Jeton inconnu", { status: 404 });

  const { data: reservations } = await supabase
    .from("bookings")
    .select("id, starts_at, ends_at, status, machines(name, rooms(name, building))")
    .eq("user_id", profil.id)
    .in("status", ["booked", "completed"])
    .gte("starts_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order("starts_at");

  const ics = construireCalendrier(
    (reservations ?? []) as unknown as LigneReservation[],
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="tambour.ics"`,
      "Cache-Control": "no-cache, must-revalidate",
    },
  });
}

type LigneReservation = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  machines: { name: string; rooms: { name: string; building: string | null } | null } | null;
};

function horodatage(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Échappement RFC 5545 : les virgules et points-virgules sont structurants. */
function echapper(texte: string): string {
  return texte.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Repli des lignes à 75 octets, continuation par une espace (RFC 5545 §3.1). */
function plier(ligne: string): string {
  const octets = Buffer.from(ligne, "utf8");
  if (octets.length <= 75) return ligne;

  const morceaux: string[] = [];
  let debut = 0;
  let limite = 75;

  while (debut < octets.length) {
    let fin = Math.min(debut + limite, octets.length);
    // Ne jamais couper au milieu d'un caractère UTF-8.
    while (fin > debut && fin < octets.length && (octets[fin] & 0xc0) === 0x80) fin--;
    morceaux.push(octets.subarray(debut, fin).toString("utf8"));
    debut = fin;
    limite = 74; // les lignes suivantes portent une espace de continuation
  }
  return morceaux.join("\r\n ");
}

function construireCalendrier(reservations: LigneReservation[]): string {
  const lignes: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${NOM_APP}//Buanderie Centrale Casablanca//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${NOM_APP} · buanderie`,
    "X-WR-TIMEZONE:Africa/Casablanca",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];

  const maintenant = horodatage(new Date().toISOString());

  for (const r of reservations) {
    const machine = r.machines?.name ?? "Machine";
    const salle = r.machines?.rooms?.name ?? "Buanderie";
    const batiment = r.machines?.rooms?.building;

    lignes.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@tambour`,
      `DTSTAMP:${maintenant}`,
      `DTSTART:${horodatage(r.starts_at)}`,
      `DTEND:${horodatage(r.ends_at)}`,
      `SUMMARY:${echapper(`${machine} · ${salle}`)}`,
      `LOCATION:${echapper(batiment ? `${salle} — ${batiment}` : salle)}`,
      `DESCRIPTION:${echapper("Réservation confirmée.")}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      // Rappel dix minutes avant : le temps de descendre avec son panier.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT10M",
      `DESCRIPTION:${echapper(`${machine} dans 10 minutes`)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lignes.push("END:VCALENDAR");
  return lignes.map(plier).join("\r\n") + "\r\n";
}
