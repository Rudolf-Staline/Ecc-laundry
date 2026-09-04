-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0006 — Mise à jour des règles de réservation
--
--  Retrait de la condition qui obligeait à réserver les créneaux de nuit
--  avant minuit la veille.
-- ════════════════════════════════════════════════════════════════════════════

-- Replace the whole enforce_booking_rules function with one where night checks are completely dropped for booking in advance

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

  -- ── Durée : un ou plusieurs blocs de la grille ────────────────────────────
  --  L'étudiant choisit la longueur de son créneau (1 h ou 2 h par défaut) ;
  --  la durée doit tomber juste sur un multiple du pas.
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
  --  Une buanderie ouverte en continu n'a pas de fenêtre à vérifier — et son
  --  dernier créneau de la journée a le droit de franchir minuit.
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
  --  Une réservation compte pour une, qu'elle dure une heure ou deux.
  --  Les créneaux de nuit en sont exemptés, des deux côtés : ils ne se
  --  décomptent pas, et ils restent réservables quota épuisé.
  --  Les annulations ne consomment rien : libérer un créneau doit rester
  --  toujours préférable à le laisser mourir. Une absence, en revanche, compte.
  if not v_est_nuit then
    select * into v_bounds from public.week_bounds(new.starts_at);

    select count(*) into v_used
    from public.bookings b
    where b.user_id = new.user_id
      and b.id <> new.id
      and b.status in ('booked', 'checked_in', 'completed', 'no_show', 'cancelled_late')
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
  --  Cette limite-ci s'applique aussi la nuit : la soupape ne doit pas
  --  permettre de bloquer six machines d'un coup.
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

-- Override the testing function for est_creneau_nuit to always return false for night reservations checks in db:test
create or replace function public.nuit_reservable(
  p_starts_at timestamptz, p_now timestamptz default now())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select true;
$$;
