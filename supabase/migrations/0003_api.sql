-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0003 — API applicative (RPC)
--  Tout ce que l'interface appelle passe par ici. Les règles restent en 0002.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Réserver ────────────────────────────────────────────────────────────────
--  `p_blocs` est la longueur du créneau, exprimée en pas de grille :
--  1 = une heure, 2 = deux heures (dans la limite de `rooms.max_blocks`).
drop function if exists public.book_slot(uuid, timestamptz);

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
    values (p_machine_id, v_uid, p_starts_at,
            p_starts_at + make_interval(mins => v_slot * p_blocs))
    returning * into v_row;
  exception when exclusion_violation then
    -- Sur un créneau de deux heures, le chevauchement peut porter sur la
    -- seconde heure seulement : le message doit rester compréhensible.
    raise exception
      'Ce créneau vient d''être pris%.',
      case when p_blocs > 1 then ' — en tout ou en partie' else '' end
      using errcode = '23P01';
  end;

  -- Plus besoin d'attendre : on quitte la file pour ce créneau.
  delete from public.waitlist w
   where w.user_id = v_uid and w.starts_at = p_starts_at;

  return v_row;
end $$;

-- ── Annuler ─────────────────────────────────────────────────────────────────
--  Avant la limite : gratuit, le créneau retourne au pot commun.
--  Après : la machine est libérée quand même, mais le quota reste débité.
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid      uuid := auth.uid();
  v_row      public.bookings;
  v_deadline int  := public.setting_int('cancel_deadline_minutes', 60);
  v_late     boolean;
  v_admin    boolean := public.is_admin();
begin
  select * into v_row from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'Réservation introuvable.' using errcode = 'TB002';
  end if;

  if v_row.user_id <> v_uid and not v_admin then
    raise exception 'Vous ne pouvez annuler que vos propres réservations.'
      using errcode = '42501';
  end if;

  if v_row.status not in ('booked', 'checked_in') then
    raise exception 'Cette réservation n''est plus active.' using errcode = 'TB002';
  end if;

  v_late := (not v_admin) and (v_row.starts_at - now() < make_interval(mins => v_deadline));

  update public.bookings
     set status       = case when v_late then 'cancelled_late' else 'cancelled' end::public.booking_status,
         cancelled_at = now()
   where id = p_booking_id
  returning * into v_row;

  perform public.promote_waitlist(v_row.machine_id, v_row.starts_at);
  return v_row;
end $$;

-- ── Pointage par QR code, sur la machine ────────────────────────────────────
create or replace function public.check_in(p_qr text)
returns public.bookings
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid     uuid := auth.uid();
  v_machine public.machines%rowtype;
  v_row     public.bookings;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = 'TB007';
  end if;

  select * into v_machine from public.machines where qr_code = btrim(lower(p_qr));
  if not found then
    raise exception 'QR code inconnu.' using errcode = 'TB002';
  end if;

  select * into v_row
    from public.bookings b
   where b.machine_id = v_machine.id
     and b.user_id    = v_uid
     and b.status     = 'booked'
     and now() between b.starts_at - interval '10 minutes' and b.ends_at
   order by b.starts_at
   limit 1;

  if not found then
    raise exception 'Aucune réservation à votre nom sur « % » en ce moment.', v_machine.name
      using errcode = 'TB002';
  end if;

  update public.bookings
     set status = 'checked_in', checked_in_at = now()
   where id = v_row.id
  returning * into v_row;

  return v_row;
end $$;

-- ── File d'attente ──────────────────────────────────────────────────────────
create or replace function public.join_waitlist(
  p_room_id uuid, p_kind public.machine_kind, p_starts_at timestamptz)
returns public.waitlist
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_uid  uuid := auth.uid();
  v_slot int;
  v_row  public.waitlist;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = 'TB007';
  end if;

  select slot_minutes into v_slot from public.rooms where id = p_room_id and is_active;
  if v_slot is null then
    raise exception 'Buanderie introuvable.' using errcode = 'TB002';
  end if;

  if p_starts_at < now() then
    raise exception 'Ce créneau est déjà passé.' using errcode = 'TB004';
  end if;

  -- « do nothing » plutôt que « do update » : l'ordre d'arrivée dans la file
  -- ne doit jamais être réinitialisé par un second clic, et DO UPDATE
  -- exigerait un privilège UPDATE qu'on ne veut pas accorder au client.
  insert into public.waitlist (room_id, user_id, kind, starts_at, ends_at)
  values (p_room_id, v_uid, p_kind, p_starts_at, p_starts_at + make_interval(mins => v_slot))
  on conflict (room_id, user_id, kind, starts_at) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.waitlist
     where room_id = p_room_id and user_id = v_uid
       and kind = p_kind and starts_at = p_starts_at;
  end if;

  return v_row;
end $$;

create or replace function public.leave_waitlist(p_id uuid)
returns void language sql security invoker set search_path = public, pg_temp as $$
  delete from public.waitlist where id = p_id and user_id = auth.uid();
$$;

-- ── Promotion automatique : le premier de la file récupère le créneau ───────
create or replace function public.promote_waitlist(p_machine_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_machine public.machines%rowtype;
  v_cand    public.waitlist%rowtype;
  v_new_id  uuid;
begin
  select * into v_machine from public.machines where id = p_machine_id;
  if not found or v_machine.status <> 'operational' then
    return null;
  end if;

  for v_cand in
    select w.* from public.waitlist w
     where w.room_id   = v_machine.room_id
       and w.kind      = v_machine.kind
       and w.starts_at = p_starts_at
     order by w.created_at asc
  loop
    begin
      insert into public.bookings (machine_id, user_id, starts_at, ends_at)
      values (p_machine_id, v_cand.user_id, p_starts_at, v_cand.ends_at)
      returning id into v_new_id;

      delete from public.waitlist where id = v_cand.id;

      insert into public.audit_log (actor_id, action, entity, entity_id, details)
      values (v_cand.user_id, 'waitlist.promoted', 'booking', v_new_id::text,
              jsonb_build_object('machine', v_machine.name, 'starts_at', p_starts_at));

      return v_new_id;
    exception when others then
      -- Quota plein, compte suspendu, créneau repris… : au suivant.
      continue;
    end;
  end loop;

  return null;
end $$;

-- ── Où en suis-je cette semaine ? ───────────────────────────────────────────
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

  -- Une réservation compte pour une, qu'elle dure une heure ou deux.
  select
    count(*) filter (where not public.est_creneau_nuit(b.starts_at)),
    count(*) filter (where     public.est_creneau_nuit(b.starts_at))
  into v_used, v_nuit
    from public.bookings b
   where b.user_id = auth.uid()
     and b.status in ('booked', 'checked_in', 'completed', 'no_show', 'cancelled_late')
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

-- ── Signaler une panne ──────────────────────────────────────────────────────
create or replace function public.report_machine(
  p_machine_id uuid, p_category text, p_message text)
returns public.machine_reports
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_row       public.machine_reports;
  v_threshold int := public.setting_int('auto_maintenance_reports', 3);
  v_open      int;
begin
  insert into public.machine_reports (machine_id, user_id, category, message)
  values (p_machine_id, auth.uid(), p_category, p_message)
  returning * into v_row;

  -- Trois signalements ouverts et distincts : la machine se met d'elle-même
  -- en maintenance. Personne n'a envie de découvrir la panne avec son linge.
  select count(distinct user_id) into v_open
    from public.machine_reports
   where machine_id = p_machine_id and status = 'open';

  if v_open >= v_threshold then
    update public.machines
       set status = 'maintenance'
     where id = p_machine_id and status = 'operational';
  end if;

  return v_row;
end $$;

-- ── Balayage périodique (appelé par le cron Vercel) ─────────────────────────
create or replace function public.sweep_maintenance()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_grace     int := public.setting_int('checkin_grace_minutes', 15);
  v_no_show   int := 0;
  v_completed int := 0;
  v_waitlist  int := 0;
  v_freed     record;
begin
  -- Absences : réservé, jamais pointé, début dépassé depuis plus que la tolérance.
  with upd as (
    update public.bookings
       set status = 'no_show'
     where status = 'booked'
       and starts_at < now() - make_interval(mins => v_grace)
    returning machine_id, starts_at
  )
  select count(*) into v_no_show from upd;

  -- Cycles arrivés à terme.
  with upd as (
    update public.bookings
       set status = 'completed'
     where status = 'checked_in'
       and ends_at < now()
    returning 1
  )
  select count(*) into v_completed from upd;

  -- File d'attente périmée.
  delete from public.waitlist where ends_at < now();
  get diagnostics v_waitlist = row_count;

  -- Suspensions échues.
  update public.profiles
     set suspended_until = null
   where suspended_until is not null and suspended_until < now();

  -- Suspension automatique au-delà du seuil d'absences.
  update public.profiles p
     set suspended_until = now() + make_interval(days => public.setting_int('suspension_days', 7))
   where p.karma = 0
     and (p.suspended_until is null or p.suspended_until < now());

  return jsonb_build_object(
    'no_show',        v_no_show,
    'completed',      v_completed,
    'waitlist_purged', v_waitlist,
    'ran_at',         now()
  );
end $$;

-- ── Affluence : moyenne des réservations par jour × heure ───────────────────
create or replace function public.affluence(p_room_id uuid default null, p_weeks int default 8)
returns table (dow int, hour int, bookings int, intensity numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_tz  text := public.app_tz();
  v_max int;
begin
  create temp table if not exists _aff (dow int, hour int, n int) on commit drop;
  delete from _aff;

  insert into _aff (dow, hour, n)
  select extract(isodow from b.starts_at at time zone v_tz)::int,
         extract(hour   from b.starts_at at time zone v_tz)::int,
         count(*)::int
    from public.bookings b
    join public.machines m on m.id = b.machine_id
   where b.starts_at > now() - make_interval(weeks => p_weeks)
     and b.starts_at < now()
     and b.status in ('booked', 'checked_in', 'completed', 'no_show')
     and (p_room_id is null or m.room_id = p_room_id)
   group by 1, 2;

  select coalesce(max(n), 0) into v_max from _aff;

  return query
    select a.dow, a.hour, a.n,
           case when v_max = 0 then 0::numeric
                else round(a.n::numeric / v_max, 3) end
      from _aff a
     order by a.dow, a.hour;
end $$;

-- ── Tableau de bord administrateur ──────────────────────────────────────────
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
    'no_show_rate',    (select case when count(*) = 0 then 0
                          else round(100.0 * count(*) filter (where status = 'no_show') / count(*), 1) end
                         from public.bookings
                        where starts_at > now() - interval '30 days' and starts_at < now()),
    'open_reports',    (select count(*) from public.machine_reports where status = 'open'),
    'suspended',       (select count(*) from public.profiles where suspended_until > now())
  ) into v_out;

  return v_out;
end $$;

-- ── Réglages : écriture réservée aux administrateurs ────────────────────────
create or replace function public.set_setting(p_key text, p_value text)
returns public.settings
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.settings;
  v_num numeric;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  select * into v_row from public.settings where key = p_key;
  if not found then
    raise exception 'Réglage « % » inconnu.', p_key using errcode = 'TB002';
  end if;

  if v_row.kind = 'number' then
    begin v_num := p_value::numeric; exception when others then
      raise exception 'Valeur numérique attendue pour « % ».', v_row.label using errcode = 'TB002';
    end;
    if v_row.min_value is not null and v_num < v_row.min_value then
      raise exception '% : minimum %.', v_row.label, v_row.min_value using errcode = 'TB002';
    end if;
    if v_row.max_value is not null and v_num > v_row.max_value then
      raise exception '% : maximum %.', v_row.label, v_row.max_value using errcode = 'TB002';
    end if;
  end if;

  update public.settings
     set value      = to_jsonb(p_value),
         updated_at = now(),
         updated_by = auth.uid()
   where key = p_key
  returning * into v_row;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'settings.update', 'setting', p_key, jsonb_build_object('value', p_value));

  return v_row;
end $$;

-- ── Amorçage : à exécuter dans l'éditeur SQL Supabase, jamais depuis le web ──
--  Volontairement non exposée aux rôles anon/authenticated (cf. 0004) : sans
--  cela, le premier étudiant à trouver l'appel deviendrait administrateur.
create or replace function public.promote_admin(p_email text)
returns public.profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.profiles;
begin
  update public.profiles
     set role = 'admin'
   where lower(email) = lower(btrim(p_email))
  returning * into v_row;

  if not found then
    raise exception 'Aucun compte pour « % ». L''étudiant doit s''être connecté au moins une fois.', p_email
      using errcode = 'TB002';
  end if;

  insert into public.admin_allowlist (email, note)
  values (lower(btrim(p_email)), 'Promu administrateur')
  on conflict (email) do nothing;

  return v_row;
end $$;

-- ── Gestion des comptes (console admin) ─────────────────────────────────────
create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role)
returns public.profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and p_role = 'student' then
    raise exception 'Vous ne pouvez pas retirer vos propres droits.' using errcode = 'TB002';
  end if;

  update public.profiles set role = p_role where id = p_user_id returning * into v_row;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'TB002';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'profile.role', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
  return v_row;
end $$;

create or replace function public.admin_set_suspension(p_user_id uuid, p_days int)
returns public.profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.profiles
     set suspended_until = case when p_days <= 0 then null else now() + make_interval(days => p_days) end,
         karma = case when p_days <= 0 then greatest(karma, 50) else karma end
   where id = p_user_id
  returning * into v_row;

  if not found then
    raise exception 'Compte introuvable.' using errcode = 'TB002';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), case when p_days <= 0 then 'profile.unsuspend' else 'profile.suspend' end,
          'profile', p_user_id::text, jsonb_build_object('days', p_days));
  return v_row;
end $$;

create or replace function public.admin_resolve_report(
  p_report_id uuid, p_status public.report_status, p_note text default null)
returns public.machine_reports
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.machine_reports;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.machine_reports
     set status = p_status, admin_note = p_note,
         resolved_by = auth.uid(),
         resolved_at = case when p_status in ('resolved', 'rejected') then now() else null end
   where id = p_report_id
  returning * into v_row;

  if not found then
    raise exception 'Signalement introuvable.' using errcode = 'TB002';
  end if;
  return v_row;
end $$;
