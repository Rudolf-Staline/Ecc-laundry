-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0002 — Fonctions, règles métier, déclencheurs
--
--  Codes d'erreur applicatifs (SQLSTATE) — l'interface les traduit :
--    TB001  quota hebdomadaire atteint
--    TB002  machine indisponible
--    TB003  hors des horaires d'ouverture
--    TB004  créneau dans le passé
--    TB005  au-delà de l'horizon de réservation
--    TB006  trop de réservations à venir
--    TB007  compte suspendu
--    TB008  créneau non aligné sur la grille
--    TB009  annulation trop tardive
--    TB010  adresse e-mail non centralienne
--    23P01  créneau déjà pris (contrainte d'exclusion native)
-- ════════════════════════════════════════════════════════════════════════════

-- ── Lecture des réglages ────────────────────────────────────────────────────
create or replace function public.setting_text(p_key text, p_default text)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value #>> '{}' from public.settings where key = p_key), p_default);
$$;

create or replace function public.setting_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select nullif(value #>> '{}', '')::int from public.settings where key = p_key), p_default);
$$;

create or replace function public.app_tz()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select public.setting_text('timezone', 'Africa/Casablanca');
$$;

-- ── Bornes de la semaine ISO (lundi 00:00 → lundi 00:00), en heure locale ───
create or replace function public.week_bounds(p_ts timestamptz)
returns table (week_start timestamptz, week_end timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_tz    text := public.app_tz();
  v_local timestamp;
begin
  v_local    := date_trunc('week', (p_ts at time zone v_tz));
  week_start := v_local at time zone v_tz;
  week_end   := (v_local + interval '7 days') at time zone v_tz;
  return next;
end $$;

-- ── Le demandeur est-il administrateur ? (utilisé par les politiques RLS) ───
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Horodatage automatique ──────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  Inscription : seules les adresses prenom.nom@centrale-casablanca.ma passent
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_email    text := lower(btrim(new.email));
  v_local    text;
  v_domain   text;
  v_expected text := public.setting_text('email_domain', 'centrale-casablanca.ma');
  v_first    text;
  v_last     text;
  v_exempt   boolean;
  v_role     public.user_role := 'student';
begin
  if v_email is null or v_email = '' then
    raise exception 'Adresse e-mail manquante.' using errcode = 'TB010';
  end if;

  v_local  := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  select exists (select 1 from public.admin_allowlist a where lower(a.email) = v_email)
    into v_exempt;

  if v_exempt then
    v_role  := 'admin';
    v_first := initcap(split_part(v_local, '.', 1));
    v_last  := initcap(coalesce(nullif(split_part(v_local, '.', 2), ''), 'Gestion'));
  else
    if v_domain is distinct from v_expected then
      raise exception 'Seules les adresses @% sont acceptées.', v_expected using errcode = 'TB010';
    end if;

    -- prenom.nom — lettres et traits d'union, suffixe numérique toléré
    -- (prenom.nom2@… lorsque deux homonymes cohabitent).
    if v_local !~ '^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*[0-9]*$' then
      raise exception
        'Format attendu : prenom.nom@%  (reçu : %)', v_expected, v_local
        using errcode = 'TB010';
    end if;

    v_first := initcap(split_part(v_local, '.', 1));
    v_last  := initcap(regexp_replace(split_part(v_local, '.', 2), '[0-9]+$', ''));
  end if;

  insert into public.profiles (id, email, first_name, last_name, display_name, role)
  values (new.id, v_email, v_first, v_last, v_first || ' ' || upper(v_last), v_role)
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════════
--  Règles de réservation — appliquées avant toute écriture
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.enforce_booking_rules()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz          text := public.app_tz();
  v_machine     public.machines%rowtype;
  v_room        public.rooms%rowtype;
  v_profile     public.profiles%rowtype;
  v_max_week    int  := public.setting_int('max_bookings_per_week', 4);
  v_max_active  int  := public.setting_int('max_active_bookings', 2);
  v_horizon     int  := public.setting_int('booking_horizon_days', 14);
  v_local_start timestamp;
  v_day         date;
  v_open        timestamp;
  v_close       timestamp;
  v_offset_min  numeric;
  v_used        int;
  v_active      int;
  v_bounds      record;
begin
  select * into v_profile from public.profiles where id = new.user_id;
  if not found then
    raise exception 'Profil introuvable.' using errcode = 'TB007';
  end if;

  if v_profile.suspended_until is not null and v_profile.suspended_until > now() then
    raise exception
      'Compte suspendu jusqu''au %.',
      to_char(v_profile.suspended_until at time zone v_tz, 'DD/MM/YYYY à HH24:MI')
      using errcode = 'TB007';
  end if;

  select * into v_machine from public.machines where id = new.machine_id;
  if not found then
    raise exception 'Machine introuvable.' using errcode = 'TB002';
  end if;
  if v_machine.status <> 'operational' then
    raise exception 'La machine « % » est indisponible (%).', v_machine.name,
      case v_machine.status when 'maintenance' then 'maintenance' else 'hors service' end
      using errcode = 'TB002';
  end if;

  select * into v_room from public.rooms where id = v_machine.room_id;
  if not found or not v_room.is_active then
    raise exception 'Buanderie fermée.' using errcode = 'TB002';
  end if;

  -- Durée imposée par la buanderie : un créneau, pas plus, pas moins.
  if new.ends_at <> new.starts_at + make_interval(mins => v_room.slot_minutes) then
    new.ends_at := new.starts_at + make_interval(mins => v_room.slot_minutes);
  end if;

  if new.starts_at < now() - interval '2 minutes' then
    raise exception 'Ce créneau est déjà passé.' using errcode = 'TB004';
  end if;

  if new.starts_at > now() + make_interval(days => v_horizon) then
    raise exception 'Les réservations ouvrent % jours à l''avance.', v_horizon
      using errcode = 'TB005';
  end if;

  -- Horaires et alignement, calculés en heure locale de Casablanca.
  v_local_start := new.starts_at at time zone v_tz;
  v_day         := v_local_start::date;
  v_open        := v_day + v_room.opens_at;
  v_close       := v_day + v_room.closes_at;

  if v_local_start < v_open
     or (v_local_start + make_interval(mins => v_room.slot_minutes)) > v_close then
    raise exception
      'La buanderie « % » est ouverte de % à %.',
      v_room.name, to_char(v_room.opens_at, 'HH24:MI'), to_char(v_room.closes_at, 'HH24:MI')
      using errcode = 'TB003';
  end if;

  v_offset_min := extract(epoch from (v_local_start - v_open)) / 60;
  if (v_offset_min::int % v_room.slot_minutes) <> 0 then
    raise exception 'Créneau non aligné sur la grille de % minutes.', v_room.slot_minutes
      using errcode = 'TB008';
  end if;

  -- ── Quota hebdomadaire ────────────────────────────────────────────────────
  -- Les annulations ne consomment rien : libérer un créneau doit rester
  -- toujours préférable à le laisser mourir. Une absence, en revanche, compte.
  select * into v_bounds from public.week_bounds(new.starts_at);

  select count(*) into v_used
  from public.bookings b
  where b.user_id = new.user_id
    and b.id <> new.id
    and b.status in ('booked', 'checked_in', 'completed', 'no_show', 'cancelled_late')
    and b.starts_at >= v_bounds.week_start
    and b.starts_at <  v_bounds.week_end;

  if v_used >= v_max_week then
    raise exception
      'Quota atteint : % réservations pour la semaine du %.',
      v_max_week, to_char(v_bounds.week_start at time zone v_tz, 'DD/MM')
      using errcode = 'TB001';
  end if;

  -- ── Réservations à venir simultanées ─────────────────────────────────────
  select count(*) into v_active
  from public.bookings b
  where b.user_id = new.user_id
    and b.id <> new.id
    and b.status in ('booked', 'checked_in')
    and b.ends_at > now();

  if v_active >= v_max_active then
    raise exception
      'Vous avez déjà % réservations à venir. Terminez-en une avant d''en poser une autre.',
      v_max_active
      using errcode = 'TB006';
  end if;

  return new;
end $$;

drop trigger if exists trg_bookings_rules on public.bookings;
create trigger trg_bookings_rules
  before insert on public.bookings
  for each row execute function public.enforce_booking_rules();

-- ── Suivi des compteurs de fiabilité + promotion de la file d'attente ───────
create or replace function public.handle_booking_transition()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'no_show' then
      update public.profiles
         set no_show_count = no_show_count + 1,
             karma         = greatest(0, karma - public.setting_int('no_show_penalty', 20)),
             updated_at    = now()
       where id = new.user_id;

    elsif new.status = 'completed' then
      update public.profiles
         set completed_count = completed_count + 1,
             karma           = least(100, karma + public.setting_int('completion_bonus', 5)),
             updated_at      = now()
       where id = new.user_id;

    elsif new.status in ('cancelled', 'cancelled_late') then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      update public.profiles
         set cancelled_count = cancelled_count + 1,
             updated_at      = now()
       where id = new.user_id;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_bookings_transition on public.bookings;
create trigger trg_bookings_transition
  before update on public.bookings
  for each row execute function public.handle_booking_transition();

-- ── updated_at partout ──────────────────────────────────────────────────────
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_machines_touch on public.machines;
create trigger trg_machines_touch before update on public.machines
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_rooms_touch on public.rooms;
create trigger trg_rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();
