-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0001 — Schéma
--  Buanderie de l'École Centrale Casablanca
--
--  Principe directeur : toutes les règles métier (domaine e-mail, quota
--  hebdomadaire, non-chevauchement, horaires) sont appliquées PAR LA BASE.
--  Le client ne fait qu'afficher — il ne peut pas tricher.
-- ════════════════════════════════════════════════════════════════════════════

-- L'opérateur GiST sur uuid (contrainte d'exclusion plus bas) vient de
-- btree_gist, que Supabase installe dans le schéma « extensions ». On rend
-- donc la résolution explicite le temps de la migration.
create extension if not exists "btree_gist";
set search_path = public, extensions;

-- ── Types ───────────────────────────────────────────────────────────────────
do $$ begin create type public.user_role      as enum ('student', 'admin');                          exception when duplicate_object then null; end $$;
do $$ begin create type public.machine_kind   as enum ('washer', 'dryer');                           exception when duplicate_object then null; end $$;
do $$ begin create type public.machine_status as enum ('operational', 'maintenance', 'out_of_order');exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status as enum ('booked', 'checked_in', 'completed', 'cancelled', 'cancelled_late', 'no_show'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_status  as enum ('open', 'acknowledged', 'resolved', 'rejected'); exception when duplicate_object then null; end $$;

-- ── Réglages globaux (modifiables par l'admin depuis l'interface) ───────────
create table if not exists public.settings (
  key         text primary key,
  value       jsonb       not null,
  label       text        not null,
  description text,
  kind        text        not null default 'number' check (kind in ('number', 'text', 'boolean')),
  min_value   numeric,
  max_value   numeric,
  position    int         not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table public.settings is 'Paramètres du service. Lus par les triggers : la modification s''applique immédiatement.';

-- ── Profils étudiants ───────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text        not null,
  first_name        text        not null,
  last_name         text        not null,
  display_name      text        not null,
  promo             smallint,
  role              public.user_role not null default 'student',

  -- Fiabilité : chaque absence non annulée coûte des points.
  karma             smallint    not null default 100 check (karma between 0 and 100),
  no_show_count     int         not null default 0,
  completed_count   int         not null default 0,
  cancelled_count   int         not null default 0,
  suspended_until   timestamptz,

  ics_token         uuid        not null default gen_random_uuid(),
  locale            text        not null default 'fr' check (locale in ('fr', 'en')),
  theme             text        not null default 'dark' check (theme in ('dark', 'light')),
  notify_reminders  boolean     not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists profiles_email_key     on public.profiles (lower(email));
create unique index if not exists profiles_ics_token_key on public.profiles (ics_token);
create index        if not exists profiles_role_idx      on public.profiles (role);

-- ── Liste blanche : adresses autorisées hors domaine centralien ─────────────
create table if not exists public.admin_allowlist (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);
comment on table public.admin_allowlist is
  'Adresses dispensées du contrôle de domaine (gestionnaires, vie étudiante). À renseigner à la main.';

-- ── Buanderies ──────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  building      text,
  description   text,
  opens_at      time        not null default '07:00',
  closes_at     time        not null default '23:00',
  slot_minutes  int         not null default 60 check (slot_minutes in (30, 45, 60, 90, 120)),
  is_active     boolean     not null default true,
  position      int         not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint rooms_hours_valid check (closes_at > opens_at)
);
create unique index if not exists rooms_name_key on public.rooms (lower(name));

-- ── Machines ────────────────────────────────────────────────────────────────
create table if not exists public.machines (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid        not null references public.rooms (id) on delete cascade,
  name           text        not null,
  kind           public.machine_kind   not null default 'washer',
  status         public.machine_status not null default 'operational',
  capacity_kg    numeric(4, 1) check (capacity_kg is null or capacity_kg > 0),
  brand          text,
  model          text,
  cycle_minutes  int         not null default 60 check (cycle_minutes between 15 and 240),
  position       int         not null default 0,
  qr_code        text        not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 18),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists machines_qr_code_key    on public.machines (qr_code);
create unique index if not exists machines_room_name_key  on public.machines (room_id, lower(name));
create index        if not exists machines_room_idx       on public.machines (room_id, position);

-- ── Réservations ────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  machine_id    uuid        not null references public.machines (id) on delete cascade,
  user_id       uuid        not null references public.profiles (id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        public.booking_status not null default 'booked',
  checked_in_at timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Intervalle matérialisé : sert à la contrainte d'exclusion ci-dessous.
  during        tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  constraint bookings_interval_valid check (ends_at > starts_at)
);

-- ⚠️  LA contrainte : deux réservations vivantes ne peuvent jamais se
--     chevaucher sur une même machine. Garantie par l'index GiST, donc
--     insensible aux conditions de course (deux étudiants qui cliquent
--     au même instant : un seul passe).
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (machine_id with =, during with &&)
  where (status in ('booked', 'checked_in', 'completed'));

create index if not exists bookings_user_start_idx    on public.bookings (user_id, starts_at desc);
create index if not exists bookings_machine_start_idx on public.bookings (machine_id, starts_at);
create index if not exists bookings_window_idx        on public.bookings (starts_at) where status in ('booked', 'checked_in');
create index if not exists bookings_status_idx        on public.bookings (status);

-- ── File d'attente ──────────────────────────────────────────────────────────
--  Un étudiant peut se placer en attente sur un créneau complet ; à la
--  première annulation, le premier de la file est promu automatiquement.
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid        not null references public.rooms (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  kind       public.machine_kind not null default 'washer',
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  constraint waitlist_interval_valid check (ends_at > starts_at),
  unique (room_id, user_id, kind, starts_at)
);
create index if not exists waitlist_lookup_idx on public.waitlist (room_id, kind, starts_at, created_at);

-- ── Signalements de panne ───────────────────────────────────────────────────
create table if not exists public.machine_reports (
  id           uuid primary key default gen_random_uuid(),
  machine_id   uuid        not null references public.machines (id) on delete cascade,
  user_id      uuid        references public.profiles (id) on delete set null,
  category     text        not null default 'other'
                 check (category in ('not_starting', 'leaking', 'noise', 'door', 'drainage', 'heating', 'other')),
  message      text        not null check (length(btrim(message)) between 3 and 800),
  status       public.report_status not null default 'open',
  resolved_by  uuid        references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  admin_note   text,
  created_at   timestamptz not null default now()
);
create index if not exists machine_reports_open_idx on public.machine_reports (status, created_at desc);

-- ── Annonces ────────────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null check (length(btrim(title)) between 2 and 120),
  body       text        not null check (length(btrim(body)) between 2 and 2000),
  level      text        not null default 'info' check (level in ('info', 'warning', 'critical')),
  is_active  boolean     not null default true,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  author_id  uuid        references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_active_idx on public.announcements (is_active, starts_at desc);

-- ── Journal d'audit ─────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.bookings;      exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.machines;      exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end;
  end if;
end $$;
