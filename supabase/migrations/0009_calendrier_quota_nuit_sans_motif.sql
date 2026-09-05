-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0009 — Calendrier, quota nocturne et réservations sans motif
--
--  • toutes les réservations consomment le quota hebdomadaire, y compris la nuit ;
--  • le motif disparaît de l'API, des vues et du stockage ;
--  • `night_used` reste exposé à titre informatif, mais est inclus dans `used`.
-- ════════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── Le quota s'applique à tous les créneaux ─────────────────────────────────
create or replace function public.enforce_booking_rules()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz          text := public.app_tz();
  v_machine     public.machines%rowtype;
  v_room        public.rooms%rowtype;
  v_profile     public.profiles%rowtype;
  v_max_week    int := public.setting_int('max_bookings_per_week', 4);
  v_max_active  int := public.setting_int('max_active_bookings', 2);
  v_horizon_h   int := public.setting_int('booking_horizon_hours', 24);
  v_local_start timestamp;
  v_day         date;
  v_open        timestamp;
  v_close       timestamp;
  v_ouvert_24   boolean;
  v_duree_min   int;
  v_blocs       int;
  v_offset_min  numeric;
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

  if new.starts_at > now() + make_interval(hours => v_horizon_h) then
    raise exception
      'Les réservations s''ouvrent % h à l''avance : ce créneau n''est pas encore disponible.',
      v_horizon_h
      using errcode = 'TB005';
  end if;

  v_local_start := new.starts_at at time zone v_tz;
  v_day         := v_local_start::date;

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

  -- Une réservation compte pour une, quelle que soit sa durée et son heure.
  select * into v_bounds from public.week_bounds(new.starts_at);

  select count(*) into v_used
  from public.bookings b
  where b.user_id = new.user_id
    and b.id <> new.id
    and b.status in ('booked', 'completed', 'cancelled_late')
    and b.starts_at >= v_bounds.week_start
    and b.starts_at <  v_bounds.week_end;

  if v_used >= v_max_week then
    raise exception
      'Quota atteint : % réservations pour la semaine du %.',
      v_max_week,
      to_char(v_bounds.week_start at time zone v_tz, 'DD/MM')
      using errcode = 'TB001';
  end if;

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

-- ── Compteur hebdomadaire : la nuit est incluse dans `used` ─────────────────
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
    count(*),
    count(*) filter (where public.est_creneau_nuit(b.starts_at))
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

-- ── Le motif disparaît réellement du stockage et de l'API ──────────────────
drop view if exists public.v_historique cascade;
drop function if exists public.book_slot(uuid, timestamptz, int, text);

alter table public.bookings drop constraint if exists bookings_purpose_valid;
alter table public.bookings drop column if exists purpose;

create view public.v_historique with (security_invoker = on) as
select
  b.id, b.reference, b.machine_id, b.user_id, b.starts_at, b.ends_at, b.status,
  b.cancelled_at, b.created_at,
  (extract(epoch from (b.ends_at - b.starts_at)) / 60)::int as duration_minutes,
  public.est_creneau_nuit(b.starts_at) as is_night,
  m.name as machine_name, m.kind,
  r.id   as room_id, r.name as room_name
from public.bookings b
join public.machines m on m.id = b.machine_id
join public.rooms    r on r.id = m.room_id
where b.user_id = auth.uid();

grant select on public.v_historique to authenticated;

create or replace function public.book_slot(
  p_machine_id uuid,
  p_starts_at  timestamptz,
  p_blocs      int default 1)
returns public.bookings
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_uid  uuid := auth.uid();
  v_slot int;
  v_max  int;
  v_row  public.bookings;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = 'TB007';
  end if;

  select r.slot_minutes, r.max_blocks into v_slot, v_max
    from public.machines m
    join public.rooms r on r.id = m.room_id
   where m.id = p_machine_id;

  if v_slot is null then
    raise exception 'Machine introuvable.' using errcode = 'TB002';
  end if;

  if p_blocs is null or p_blocs < 1 or p_blocs > v_max then
    raise exception
      'Longueur de créneau invalide : entre 1 et % bloc(s) de % min.', v_max, v_slot
      using errcode = 'TB011';
  end if;

  begin
    insert into public.bookings (machine_id, user_id, starts_at, ends_at)
    values (
      p_machine_id,
      v_uid,
      p_starts_at,
      p_starts_at + make_interval(mins => v_slot * p_blocs)
    )
    returning * into v_row;
  exception when exclusion_violation then
    raise exception
      'Ce créneau vient d''être pris%.',
      case when p_blocs > 1 then ' — en tout ou en partie' else '' end
      using errcode = '23P01';
  end;

  delete from public.waitlist w
   where w.user_id = v_uid and w.starts_at = p_starts_at;

  return v_row;
end $$;

revoke execute on function public.book_slot(uuid, timestamptz, int) from public, anon;
grant execute on function public.book_slot(uuid, timestamptz, int) to authenticated;

-- ── Texte d'accueil cohérent avec la nouvelle règle ─────────────────────────
update public.announcements
   set body = 'Réservez votre machine pour une heure ou deux, et récupérez votre linge à l''heure. Quatre réservations par semaine et par étudiant, ouvertes 24 h à l''avance. Les créneaux de nuit comptent dans le même quota. Annulez si vous ne venez pas : quelqu''un en profitera.'
 where title = 'Bienvenue sur Tambour';
