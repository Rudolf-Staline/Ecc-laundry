export type UserRole = "student" | "admin";
export type MachineKind = "washer" | "dryer";
export type MachineStatus = "operational" | "maintenance" | "out_of_order";
export type BookingStatus =
  | "booked" | "checked_in" | "completed" | "cancelled" | "cancelled_late" | "no_show";
export type ReportStatus = "open" | "acknowledged" | "resolved" | "rejected";
export type LiveStatus = "free" | "busy" | "maintenance" | "out_of_order";

export type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  promo: number | null;
  role: UserRole;
  karma: number;
  no_show_count: number;
  completed_count: number;
  cancelled_count: number;
  suspended_until: string | null;
  ics_token: string;
  locale: "fr" | "en";
  theme: "dark" | "light";
  notify_reminders: boolean;
  created_at: string;
};

export type Room = {
  id: string;
  name: string;
  building: string | null;
  description: string | null;
  opens_at: string;
  closes_at: string;
  slot_minutes: number;
  /** Nombre maximum de blocs consécutifs : 2 = créneaux d'une ou deux heures. */
  max_blocks: number;
  is_active: boolean;
  position: number;
};

export type Machine = {
  id: string;
  room_id: string;
  name: string;
  kind: MachineKind;
  status: MachineStatus;
  capacity_kg: number | null;
  brand: string | null;
  model: string | null;
  cycle_minutes: number;
  position: number;
  note: string | null;
};

export type Booking = {
  id: string;
  machine_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  checked_in_at: string | null;
  created_at: string;
};

export type BoardRow = {
  id: string;
  machine_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  checked_in_at: string | null;
  room_id: string;
  kind: MachineKind;
  machine_name: string;
  owner_first_name: string;
  owner_last_initial: string;
  is_mine: boolean;
  is_night: boolean;
  duration_minutes: number;
};

export type MachineLive = {
  machine_id: string;
  room_id: string;
  name: string;
  kind: MachineKind;
  status: MachineStatus;
  cycle_minutes: number;
  capacity_kg: number | null;
  position: number;
  room_name: string;
  slot_minutes: number;
  current_booking_id: string | null;
  busy_from: string | null;
  busy_until: string | null;
  booking_status: BookingStatus | null;
  is_mine: boolean | null;
  live_status: LiveStatus;
  next_starts_at: string | null;
  open_reports: number;
};

export type WeekStatus = {
  week_start: string;
  week_end: string;
  used: number;
  quota: number;
  remaining: number;
  /** Créneaux de nuit posés cette semaine — hors quota. */
  night_used: number;
};

export type Setting = {
  key: string;
  value: string;
  label: string;
  description: string | null;
  kind: "number" | "text" | "boolean";
  min_value: number | null;
  max_value: number | null;
  position: number;
  updated_at: string;
};

export type MachineReport = {
  id: string;
  machine_id: string;
  user_id: string | null;
  category: string;
  message: string;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
};

export type WaitlistEntry = {
  id: string;
  room_id: string;
  user_id: string;
  kind: MachineKind;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

export type MyStats = {
  total: number;
  completed: number;
  no_show: number;
  cancelled: number;
  karma: number;
  water_liters: number;
  kwh: number;
  favourite_hour: number | null;
  favourite_dow: number | null;
  streak_weeks: number;
};

export type AdminOverview = {
  students: number;
  machines_total: number;
  machines_ok: number;
  machines_down: number;
  bookings_today: number;
  bookings_week: number;
  no_show_rate: number;
  open_reports: number;
  suspended: number;
};

/** Étiquette QR d'une machine — lisible des seuls administrateurs. */
export type MachineCode = {
  machine_id: string;
  machine_name: string;
  room_name: string;
  room_position: number;
  machine_position: number;
  qr_code: string;
};

export type AffluenceCell = { dow: number; hour: number; bookings: number; intensity: number };

export const CATEGORIES_PANNE: Record<string, string> = {
  not_starting: "Ne démarre pas",
  leaking: "Fuite d'eau",
  noise: "Bruit anormal",
  door: "Hublot bloqué",
  drainage: "Vidange",
  heating: "Chauffe mal",
  other: "Autre",
};
