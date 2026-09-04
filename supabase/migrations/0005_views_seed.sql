-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0005 — Vues de lecture & données initiales
-- ════════════════════════════════════════════════════════════════════════════

-- ── Le planning ─────────────────────────────────────────────────────────────
--  security_invoker = off : la vue s'exécute avec les droits de son
--  propriétaire, ce qui permet d'exposer le prénom du réservataire SANS ouvrir
--  la table profiles. Un planning partagé où chaque case est anonyme
--  n'aiderait personne à récupérer son linge.
drop view if exists public.v_board cascade;
create view public.v_board with (security_invoker = off) as
select
  b.id,
  b.machine_id,
  b.user_id,
  b.starts_at,
  b.ends_at,
  b.status,
  b.checked_in_at,
  m.room_id,
  m.kind,
  m.name        as machine_name,
  p.first_name  as owner_first_name,
  left(p.last_name, 1) || '.' as owner_last_initial,
  (b.user_id = auth.uid()) as is_mine
from public.bookings b
join public.machines m on m.id = b.machine_id
join public.profiles p on p.id = b.user_id
where b.status in ('booked', 'checked_in', 'completed')
  and b.starts_at > now() - interval '30 days';

grant select on public.v_board to authenticated;

-- ── État instantané du parc ─────────────────────────────────────────────────
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
  m.qr_code,
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
     and x.status in ('booked', 'checked_in')
     and now() >= x.starts_at and now() < x.ends_at
   limit 1
) cur on true
left join lateral (
  select x.starts_at
    from public.bookings x
   where x.machine_id = m.id
     and x.status in ('booked', 'checked_in')
     and x.starts_at > now()
   order by x.starts_at
   limit 1
) nxt on true;

grant select on public.v_machine_live to anon, authenticated;

-- ── Statistiques personnelles ───────────────────────────────────────────────
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
   where user_id = v_uid and status in ('completed', 'checked_in');

  select jsonb_build_object(
    'total',       (select count(*) from public.bookings where user_id = v_uid and status <> 'cancelled'),
    'completed',   v_done,
    'no_show',     (select count(*) from public.bookings where user_id = v_uid and status = 'no_show'),
    'cancelled',   (select count(*) from public.bookings where user_id = v_uid and status in ('cancelled', 'cancelled_late')),
    'karma',       (select karma from public.profiles where id = v_uid),
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
      -- Semaines consécutives, en remontant, avec au moins un cycle mené à terme.
      select count(*) from (
        select distinct date_trunc('week', starts_at at time zone public.app_tz()) as w
          from public.bookings
         where user_id = v_uid and status = 'completed'
      ) s
      where s.w > date_trunc('week', (now() at time zone public.app_tz())) - interval '12 weeks')
  ) into v_out;

  return v_out;
end $$;

grant execute on function public.my_stats() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  Données initiales
-- ════════════════════════════════════════════════════════════════════════════

insert into public.settings (key, value, label, description, kind, min_value, max_value, position) values
  ('max_bookings_per_week',    to_jsonb('4'::text),   'Réservations par semaine',
   'Nombre maximum de créneaux qu''un étudiant peut poser sur une semaine (lundi → dimanche).', 'number', 1, 21, 10),
  ('max_active_bookings',      to_jsonb('2'::text),   'Réservations à venir simultanées',
   'Empêche de bloquer toute la semaine d''un coup.', 'number', 1, 10, 20),
  ('booking_horizon_days',     to_jsonb('14'::text),  'Horizon de réservation (jours)',
   'À combien de jours à l''avance la grille s''ouvre.', 'number', 1, 60, 30),
  ('cancel_deadline_minutes',  to_jsonb('60'::text),  'Annulation gratuite (minutes avant)',
   'Passé ce délai, l''annulation libère la machine mais consomme le quota.', 'number', 0, 1440, 40),
  ('checkin_grace_minutes',    to_jsonb('15'::text),  'Tolérance de pointage (minutes)',
   'Au-delà, la réservation est marquée « absent » et la machine se libère.', 'number', 5, 60, 50),
  ('no_show_penalty',          to_jsonb('20'::text),  'Malus par absence (points)',
   'Retiré du score de fiabilité.', 'number', 0, 100, 60),
  ('completion_bonus',         to_jsonb('5'::text),   'Bonus par cycle terminé (points)',
   'Rendu au score de fiabilité.', 'number', 0, 50, 70),
  ('suspension_days',          to_jsonb('7'::text),   'Suspension (jours)',
   'Durée de suspension lorsque le score de fiabilité tombe à zéro.', 'number', 1, 90, 80),
  ('auto_maintenance_reports', to_jsonb('3'::text),   'Signalements avant mise en maintenance',
   'Nombre d''étudiants distincts après lequel la machine se retire d''elle-même.', 'number', 1, 20, 90),
  ('eco_water_liters',         to_jsonb('50'::text),  'Eau par cycle (litres)',
   'Sert au calcul de l''empreinte affichée dans les statistiques.', 'number', 1, 200, 100),
  ('eco_wh_per_cycle',         to_jsonb('700'::text), 'Énergie par cycle (Wh)',
   'Sert au calcul de l''empreinte affichée dans les statistiques.', 'number', 1, 5000, 110),
  ('email_domain',             to_jsonb('centrale-casablanca.ma'::text), 'Domaine e-mail autorisé',
   'Seules les adresses prenom.nom@<domaine> peuvent créer un compte.', 'text', null, null, 1),
  ('timezone',                 to_jsonb('Africa/Casablanca'::text), 'Fuseau horaire',
   'Base de calcul des semaines, des horaires et de la grille.', 'text', null, null, 2)
on conflict (key) do nothing;

-- ── Parc initial (entièrement modifiable depuis la console admin) ───────────
insert into public.rooms (name, building, description, opens_at, closes_at, slot_minutes, position)
values
  ('Buanderie Résidence A', 'Résidence A', 'Rez-de-chaussée, aile est',  '07:00', '23:00', 60, 1),
  ('Buanderie Résidence B', 'Résidence B', 'Sous-sol, à côté du foyer',  '07:00', '23:00', 60, 2)
on conflict do nothing;

do $$
declare
  v_room record;
  i int;
begin
  for v_room in select id, position from public.rooms order by position loop
    for i in 1..4 loop
      insert into public.machines (room_id, name, kind, capacity_kg, cycle_minutes, position, brand)
      values (v_room.id, 'Lave-linge ' || i, 'washer', 8.0, 60, i, 'Miele')
      on conflict do nothing;
    end loop;
    for i in 1..2 loop
      insert into public.machines (room_id, name, kind, capacity_kg, cycle_minutes, position, brand)
      values (v_room.id, 'Sèche-linge ' || i, 'dryer', 8.0, 60, 10 + i, 'Miele')
      on conflict do nothing;
    end loop;
  end loop;
end $$;

insert into public.announcements (title, body, level)
values ('Bienvenue sur Tambour',
        'Réservez votre machine, pointez avec le QR code affiché dessus, et récupérez votre linge à l''heure. Quatre créneaux par semaine et par étudiant — annulez si vous ne venez pas, quelqu''un en profitera.',
        'info')
on conflict do nothing;
