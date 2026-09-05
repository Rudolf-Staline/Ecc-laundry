-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0008 — Retrait du pointage et du système de fiabilité
--
--  Le pointage (QR code sur la machine, tolérance, absence, malus/bonus de
--  fiabilité, suspension automatique) est retiré : une réservation se déroule
--  sur son horaire, sans confirmation de présence. Restent inchangés : quota,
--  annulation, file d'attente, signalements de panne.
--
--  Note : PostgreSQL ne permet pas de retirer une valeur d'un type enum une
--  fois créée. Les libellés 'checked_in' et 'no_show' de booking_status
--  restent donc déclarés dans le type, mais plus rien ne les affecte.
-- ════════════════════════════════════════════════════════════════════════════

-- ── RPC et déclencheurs retirés ──────────────────────────────────────────────
drop trigger if exists trg_bookings_transition on public.bookings;
drop function if exists public.handle_booking_transition();
drop function if exists public.check_in(text);
drop function if exists public.admin_set_suspension(uuid, int);
drop function if exists public.admin_machine_codes();

-- ── Règles de réservation : plus de vérification de suspension ──────────────
create or replace function public.enforce_booking_rules()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz          text := public.app_tz();
  v_machine     public.machines%rowtype;
  v_room        public.rooms%rowtype;
  v_profile     public.profiles%rowtype;
  v_max_week    int  := public.setting_int('max_bookings_per_week', 4);
  v_max_active  int  := public.setting_int('max_active_bookings', 2);
  v_horizon_h   int  := public.setting_int('booking_horizon_hours', 24);
  v_nuit_debut  int  := public.setting_int('night_start_hour', 0);
  v_nuit_fin    int  := public.setting_int('night_end_hour', 6);
  v_local_start timestamp;
  v_day         date;
  v_open        timestamp;
  v_close       timestamp;
  v_ouvert_24   boolean;
  v_duree_min   int;
  v_blocs       int;
  v_offset_min  numeric;
  v_est_nuit    boolean;
  v_used        int;
  v_active      int;
  v_bounds      record;
begin
  select * into v_profile from public.profiles where id = new.user_id;
  if not found then
    raise exception 'Profil introuvable.' using errcode = 'TB007';
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

  -- ── Durée : un ou plusieurs blocs de la grille ────────────────────────────
  v_duree_min := (extract(epoch from (new.ends_at - new.starts_at)) / 60)::int;

  if v_duree_min % v_room.slot_minutes <> 0 then
    raise exception
      'Durée de % min : elle doit être un multiple de % min.', v_duree_min, v_room.slot_minutes
      using errcode = 'TB011';
  end if;

  v_blocs := v_duree_min / v_room.slot_minutes;
  if v_blocs < 1 or v_blocs > v_room.max_blocks then
    raise exception
      'Un créneau va de % à % minutes ; % demandées.',
      v_room.slot_minutes, v_room.slot_minutes * v_room.max_blocks, v_duree_min
      using errcode = 'TB011';
  end if;

  if new.starts_at < now() - interval '2 minutes' then
    raise exception 'Ce créneau est déjà passé.' using errcode = 'TB004';
  end if;

  -- ── Horizon glissant ──────────────────────────────────────────────────────
  if new.starts_at > now() + make_interval(hours => v_horizon_h) then
    raise exception
      'Les réservations s''ouvrent % h à l''avance : ce créneau n''est pas encore disponible.',
      v_horizon_h
      using errcode = 'TB005';
  end if;

  v_local_start := new.starts_at at time zone v_tz;
  v_day         := v_local_start::date;
  v_est_nuit    := extract(hour from v_local_start)::int >= v_nuit_debut
               and extract(hour from v_local_start)::int <  v_nuit_fin;

  -- ── Horaires d'ouverture ─────────────────────────────────────────────────
  v_ouvert_24 := (v_room.closes_at - v_room.opens_at) >= interval '24 hours';
  v_open      := v_day + v_room.opens_at;

  if not v_ouvert_24 then
    v_close := v_day + v_room.closes_at;
    if v_local_start < v_open
       or (v_local_start + make_interval(mins => v_duree_min)) > v_close then
      raise exception
        'La buanderie « % » est ouverte de % à %.',
        v_room.name, to_char(v_room.opens_at, 'HH24:MI'), to_char(v_room.closes_at, 'HH24:MI')
        using errcode = 'TB003';
    end if;
  end if;

  v_offset_min := extract(epoch from (v_local_start - v_open)) / 60;
  if (v_offset_min::int % v_room.slot_minutes) <> 0 then
    raise exception 'Créneau non aligné sur la grille de % minutes.', v_room.slot_minutes
      using errcode = 'TB008';
  end if;

  -- ── Quota hebdomadaire ────────────────────────────────────────────────────
  if not v_est_nuit then
    select * into v_bounds from public.week_bounds(new.starts_at);

    select count(*) into v_used
    from public.bookings b
    where b.user_id = new.user_id
      and b.id <> new.id
      and b.status in ('booked', 'completed', 'cancelled_late')
      and b.starts_at >= v_bounds.week_start
      and b.starts_at <  v_bounds.week_end
      and not public.est_creneau_nuit(b.starts_at);

    if v_used >= v_max_week then
      raise exception
        'Quota atteint : % réservations pour la semaine du %.%',
        v_max_week,
        to_char(v_bounds.week_start at time zone v_tz, 'DD/MM'),
        case when v_nuit_fin > v_nuit_debut
             then format(' Les créneaux de %sh à %sh restent ouverts.', v_nuit_debut, v_nuit_fin)
             else '' end
        using errcode = 'TB001';
    end if;
  end if;

  -- ── Réservations à venir simultanées ─────────────────────────────────────
  select count(*) into v_active
  from public.bookings b
  where b.user_id = new.user_id
    and b.id <> new.id
    and b.status = 'booked'
    and b.ends_at > now();

  if v_active >= v_max_active then
    raise exception
      'Vous avez déjà % réservations à venir. Terminez-en une avant d''en poser une autre.',
      v_max_active
      using errcode = 'TB006';
  end if;

  return new;
end $$;

-- ── Balayage périodique : plus d'absence à détecter, juste la clôture ───────
create or replace function public.sweep_maintenance()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_completed int := 0;
  v_waitlist  int := 0;
begin
  -- Cycles arrivés à terme : le créneau se clôt sur son horaire.
  with upd as (
    update public.bookings
       set status = 'completed'
     where status = 'booked'
       and ends_at < now()
    returning 1
  )
  select count(*) into v_completed from upd;

  -- File d'attente périmée.
  delete from public.waitlist where ends_at < now();
  get diagnostics v_waitlist = row_count;

  return jsonb_build_object(
    'completed',       v_completed,
    'waitlist_purged', v_waitlist,
    'ran_at',          now()
  );
end $$;

-- ── Où en suis-je cette semaine ? ────────────────────────────────────────────
create or replace function public.my_week_status(p_ref timestamptz default now())
returns table (
  week_start timestamptz, week_end timestamptz,
  used int, quota int, remaining int, night_used int)
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_b     record;
  v_quota int := public.setting_int('max_bookings_per_week', 4);
  v_used  int;
  v_nuit  int;
begin
  select * into v_b from public.week_bounds(p_ref);

  select
    count(*) filter (where not public.est_creneau_nuit(b.starts_at)),
    count(*) filter (where     public.est_creneau_nuit(b.starts_at))
  into v_used, v_nuit
    from public.bookings b
   where b.user_id = auth.uid()
     and b.status in ('booked', 'completed', 'cancelled_late')
     and b.starts_at >= v_b.week_start
     and b.starts_at <  v_b.week_end;

  week_start := v_b.week_start;
  week_end   := v_b.week_end;
  used       := v_used;
  quota      := v_quota;
  remaining  := greatest(0, v_quota - v_used);
  night_used := v_nuit;
  return next;
end $$;

-- ── Statistiques personnelles : plus de karma ni d'absences ─────────────────
create or replace function public.my_stats()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_water numeric := public.setting_int('eco_water_liters', 50);
  v_kwh   numeric := public.setting_int('eco_wh_per_cycle', 700) / 1000.0;
  v_done  int;
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = 'TB007';
  end if;

  select count(*) into v_done
    from public.bookings
   where user_id = v_uid and status = 'completed';

  select jsonb_build_object(
    'total',       (select count(*) from public.bookings where user_id = v_uid and status <> 'cancelled'),
    'completed',   v_done,
    'cancelled',   (select count(*) from public.bookings where user_id = v_uid and status in ('cancelled', 'cancelled_late')),
    'water_liters', round(v_done * v_water),
    'kwh',          round(v_done * v_kwh, 1),
    'favourite_hour', (
      select extract(hour from starts_at at time zone public.app_tz())::int
        from public.bookings where user_id = v_uid and status <> 'cancelled'
       group by 1 order by count(*) desc limit 1),
    'favourite_dow', (
      select extract(isodow from starts_at at time zone public.app_tz())::int
        from public.bookings where user_id = v_uid and status <> 'cancelled'
       group by 1 order by count(*) desc limit 1),
    'streak_weeks', (
      select count(*) from (
        select distinct date_trunc('week', starts_at at time zone public.app_tz()) as w
          from public.bookings
         where user_id = v_uid and status = 'completed'
      ) s
      where s.w > date_trunc('week', (now() at time zone public.app_tz())) - interval '12 weeks')
  ) into v_out;

  return v_out;
end $$;

-- ── Tableau de bord administrateur : plus de taux d'absence ni de suspendus ─
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'students',        (select count(*) from public.profiles where role = 'student'),
    'machines_total',  (select count(*) from public.machines),
    'machines_ok',     (select count(*) from public.machines where status = 'operational'),
    'machines_down',   (select count(*) from public.machines where status <> 'operational'),
    'bookings_today',  (select count(*) from public.bookings
                         where starts_at >= date_trunc('day', now() at time zone public.app_tz()) at time zone public.app_tz()
                           and starts_at <  (date_trunc('day', now() at time zone public.app_tz()) + interval '1 day') at time zone public.app_tz()
                           and status <> 'cancelled'),
    'bookings_week',   (select count(*) from public.bookings b, public.week_bounds(now()) w
                         where b.starts_at >= w.week_start and b.starts_at < w.week_end
                           and b.status <> 'cancelled'),
    'open_reports',    (select count(*) from public.machine_reports where status = 'open'),
    'open_claims',     (select count(*) from public.claims where status in ('open', 'acknowledged'))
  ) into v_out;

  return v_out;
end $$;

-- ── Vues : recréées d'abord, pour lâcher leur dépendance sur les colonnes et
--    statuts retirés plus bas (Postgres refuse un DROP COLUMN sinon) ────────
drop view if exists public.v_board cascade;
create view public.v_board with (security_invoker = off) as
select
  b.id,
  b.machine_id,
  b.user_id,
  b.starts_at,
  b.ends_at,
  b.status,
  m.room_id,
  m.kind,
  m.name        as machine_name,
  p.first_name  as owner_first_name,
  left(p.last_name, 1) || '.' as owner_last_initial,
  (b.user_id = auth.uid()) as is_mine,
  public.est_creneau_nuit(b.starts_at) as is_night,
  (extract(epoch from (b.ends_at - b.starts_at)) / 60)::int as duration_minutes
from public.bookings b
join public.machines m on m.id = b.machine_id
join public.profiles p on p.id = b.user_id
where b.status in ('booked', 'completed')
  and b.starts_at > now() - interval '30 days';

grant select on public.v_board to authenticated;

drop view if exists public.v_machine_live cascade;
create view public.v_machine_live with (security_invoker = off) as
select
  m.id            as machine_id,
  m.room_id,
  m.name,
  m.kind,
  m.status,
  m.cycle_minutes,
  m.capacity_kg,
  m.position,
  r.name          as room_name,
  r.slot_minutes,
  cur.id          as current_booking_id,
  cur.starts_at   as busy_from,
  cur.ends_at     as busy_until,
  cur.status      as booking_status,
  (cur.user_id = auth.uid()) as is_mine,
  case
    when m.status <> 'operational' then m.status::text
    when cur.id is not null        then 'busy'
    else 'free'
  end             as live_status,
  nxt.starts_at   as next_starts_at,
  (select count(*) from public.machine_reports mr
    where mr.machine_id = m.id and mr.status = 'open') as open_reports
from public.machines m
join public.rooms r on r.id = m.room_id
left join lateral (
  select x.id, x.starts_at, x.ends_at, x.status, x.user_id
    from public.bookings x
   where x.machine_id = m.id
     and x.status = 'booked'
     and now() >= x.starts_at and now() < x.ends_at
   limit 1
) cur on true
left join lateral (
  select x.starts_at
    from public.bookings x
   where x.machine_id = m.id
     and x.status = 'booked'
     and x.starts_at > now()
   order by x.starts_at
   limit 1
) nxt on true;

grant select on public.v_machine_live to anon, authenticated;

drop view if exists public.v_historique cascade;
create view public.v_historique with (security_invoker = on) as
select
  b.id, b.reference, b.machine_id, b.user_id, b.starts_at, b.ends_at, b.status,
  b.purpose, b.cancelled_at, b.created_at,
  (extract(epoch from (b.ends_at - b.starts_at)) / 60)::int as duration_minutes,
  public.est_creneau_nuit(b.starts_at) as is_night,
  m.name as machine_name, m.kind,
  r.id   as room_id, r.name as room_name
from public.bookings b
join public.machines m on m.id = b.machine_id
join public.rooms    r on r.id = m.room_id
where b.user_id = auth.uid();

grant select on public.v_historique to authenticated;

-- ── Colonnes retirées ───────────────────────────────────────────────────────
alter table public.profiles drop column if exists karma;
alter table public.profiles drop column if exists no_show_count;
alter table public.profiles drop column if exists completed_count;
alter table public.profiles drop column if exists cancelled_count;
alter table public.profiles drop column if exists suspended_until;

alter table public.bookings drop column if exists checked_in_at;

drop index if exists public.machines_qr_code_key;
alter table public.machines drop column if exists qr_code;

-- ── Contrainte d'exclusion et index : 'checked_in' disparaît des filtres ────
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (machine_id with =, during with &&)
  where (status in ('booked', 'completed'));

drop index if exists public.bookings_window_idx;
create index if not exists bookings_window_idx on public.bookings (starts_at) where status = 'booked';

-- ── Réglages devenus sans effet ──────────────────────────────────────────────
delete from public.settings
 where key in ('checkin_grace_minutes', 'no_show_penalty', 'completion_bonus', 'suspension_days');

-- ── L'annonce d'accueil mentionnait le pointage par QR ──────────────────────
update public.announcements
   set body = 'Réservez votre machine pour une heure ou deux, et récupérez votre linge à l''heure. Quatre réservations par semaine et par étudiant, ouvertes 24 h à l''avance. Les créneaux de 00 h à 06 h ne comptent pas dans le quota. Annulez si vous ne venez pas : quelqu''un en profitera.'
 where title = 'Bienvenue sur Tambour';

-- ── Réclamations : la catégorie « pointage » n'a plus lieu d'être ───────────
alter table public.claims drop constraint if exists claims_category_check;
alter table public.claims add constraint claims_category_check
  check (category in ('linge_sorti', 'linge_abime', 'creneau_occupe', 'quota', 'proprete', 'autre'));
