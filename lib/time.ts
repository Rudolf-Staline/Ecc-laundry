/**
 * Arithmétique horaire ancrée sur Casablanca.
 *
 * Le serveur tourne en UTC, la base stocke en UTC, mais un étudiant raisonne
 * en heure locale — et le Maroc décale son horloge pendant le Ramadan. Toute
 * conversion passe donc par Intl, jamais par un décalage constant.
 */

export const TZ = "Africa/Casablanca";

export const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
export const JOURS_COURTS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"] as const;
export const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsIn(date: Date, tz: string = TZ): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  if (out.hour === 24) out.hour = 0;
  return out as unknown as Parts;
}

function offsetMs(date: Date, tz: string = TZ): number {
  const p = partsIn(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

export function zonedToUtc(
  year: number, month: number, day: number,
  hour = 0, minute = 0, tz: string = TZ,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(naive), tz);
  let out = new Date(naive - first);
  const second = offsetMs(out, tz);
  if (second !== first) out = new Date(naive - second);
  return out;
}

export function localParts(date: Date, tz: string = TZ): Parts {
  return partsIn(date, tz);
}

export function startOfWeek(date: Date, tz: string = TZ): Date {
  const p = partsIn(date, tz);
  const midday = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  const dow = (midday.getUTCDay() + 6) % 7;
  const monday = new Date(midday.getTime() - dow * 86_400_000);
  return zonedToUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 0, 0, tz);
}

export function startOfDay(date: Date, tz: string = TZ): Date {
  const p = partsIn(date, tz);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, tz);
}

export function addDays(date: Date, n: number): Date {
  const p = partsIn(date);
  return zonedToUtc(p.year, p.month, p.day + n, p.hour, p.minute);
}

export function dayKey(date: Date, tz: string = TZ): string {
  const p = partsIn(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function isoDayOfWeek(date: Date, tz: string = TZ): number {
  const p = partsIn(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  return ((d.getUTCDay() + 6) % 7) + 1;
}

export function isSameDay(a: Date, b: Date, tz: string = TZ): boolean {
  return dayKey(a, tz) === dayKey(b, tz);
}

/* ── Formatage ───────────────────────────────────────────────────────────── */

export function fmtTime(date: Date | string, tz: string = TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const p = partsIn(d, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function fmtDay(date: Date | string, tz: string = TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const p = partsIn(d, tz);
  return `${JOURS[isoDayOfWeek(d, tz) - 1]} ${p.day} ${MOIS[p.month - 1]}`;
}

export function fmtDayShort(date: Date | string, tz: string = TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const p = partsIn(d, tz);
  return `${p.day}/${String(p.month).padStart(2, "0")}`;
}

export function fmtDateTime(date: Date | string, tz: string = TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${fmtDay(d, tz)} à ${fmtTime(d, tz)}`;
}

export function fmtRelative(target: Date | string, from: Date = new Date()): string {
  const d = typeof target === "string" ? new Date(target) : target;
  const diff = d.getTime() - from.getTime();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);

  if (min < 1) return "maintenant";

  let quantity: string;
  if (min < 60) {
    quantity = `${min} min`;
  } else if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    quantity = m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  } else {
    const j = Math.round(min / 1440);
    quantity = `${j} jour${j > 1 ? "s" : ""}`;
  }
  return diff > 0 ? `dans ${quantity}` : `il y a ${quantity}`;
}

export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/* ── Grille de créneaux ──────────────────────────────────────────────────── */

export type Slot = { start: Date; end: Date; label: string; key: string };

export function parseClock(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function buildSlots(
  day: Date,
  opensAt: string,
  closesAt: string,
  slotMinutes: number,
  tz: string = TZ,
): Slot[] {
  const p = partsIn(day, tz);
  const open = parseClock(opensAt);
  const close = parseClock(closesAt);
  const slots: Slot[] = [];

  for (let m = open; m + slotMinutes <= close; m += slotMinutes) {
    const start = zonedToUtc(p.year, p.month, p.day, 0, m, tz);
    const end = new Date(start.getTime() + slotMinutes * 60_000);
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push({ start, end, label: `${hh}:${mm}`, key: start.toISOString() });
  }
  return slots;
}

export function daySpan(from: Date, count: number, tz: string = TZ): Date[] {
  const base = startOfDay(from, tz);
  return Array.from({ length: count }, (_, i) => {
    const p = partsIn(base, tz);
    return zonedToUtc(p.year, p.month, p.day + i, 0, 0, tz);
  });
}

/* ── Tranche de nuit ─────────────────────────────────────────────────────── */

/**
 * Les créneaux de nuit se décomptent du quota comme les autres. Ils doivent
 * néanmoins être posés avant le minuit qui les ouvre. Ces deux fonctions
 * reproduisent `est_creneau_nuit` et `nuit_reservable` côté base : la base
 * reste l'autorité, l'interface se contente de ne pas proposer l'impossible.
 */
export function estCreneauNuit(
  date: Date | string,
  debut = 0,
  fin = 6,
  tz: string = TZ,
): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const h = partsIn(d, tz).hour;
  return h >= debut && h < fin;
}

export function nuitReservable(
  debutCreneau: Date | string,
  maintenant: Date = new Date(),
  debut = 0,
  fin = 6,
  tz: string = TZ,
): boolean {
  const d = typeof debutCreneau === "string" ? new Date(debutCreneau) : debutCreneau;
  if (!estCreneauNuit(d, debut, fin, tz)) return true;
  return maintenant.getTime() < startOfDay(d, tz).getTime();
}
