\set ON_ERROR_STOP off
\timing off
\pset pager off

create or replace function pg_temp.expect_fail(p_sql text, p_label text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return '✗ ' || p_label || ' — AURAIT DÛ ÉCHOUER';
exception when others then
  return '✓ ' || p_label || ' → ' || sqlstate || ' ' || left(sqlerrm, 90);
end $$;

create or replace function pg_temp.expect_ok(p_sql text, p_label text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return '✓ ' || p_label;
exception when others then
  return '✗ ' || p_label || ' — ÉCHEC INATTENDU: ' || sqlstate || ' ' || left(sqlerrm, 120);
end $$;

\echo '━━━ 1. Contrôle du domaine e-mail ━━━'
select pg_temp.expect_ok(
  $q$insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','Rudolf.Staline@centrale-casablanca.ma')$q$,
  'prenom.nom@centrale-casablanca.ma accepté');
select pg_temp.expect_ok(
  $q$insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222','jean-pierre.du-pont@centrale-casablanca.ma')$q$,
  'prénom et nom composés acceptés');
select pg_temp.expect_ok(
  $q$insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333','amine.tazi2@centrale-casablanca.ma')$q$,
  'suffixe homonyme (nom2) accepté');
select pg_temp.expect_fail(
  $q$insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444','pirate@gmail.com')$q$,
  'domaine externe refusé');
select pg_temp.expect_fail(
  $q$insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555','jesuisunhacker@centrale-casablanca.ma')$q$,
  'bon domaine mais format libre refusé');
select pg_temp.expect_fail(
  $q$insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666','a.b@centrale-casablanca.ma.evil.com')$q$,
  'domaine suffixé refusé');

\echo ''
\echo '━━━ Profils créés ━━━'
select email, first_name, last_name, display_name, role, karma from public.profiles order by email;

\echo ''
\echo '━━━ 2. Quota hebdomadaire : 4 réservations ━━━'
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);

-- Demain, sur la grille horaire locale.
create temp table t as
select (date_trunc('day', (now() at time zone 'Africa/Casablanca')) + interval '1 day') as d;

select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1), %L)$q$,
  ((select d from t) + interval '9 hours') at time zone 'Africa/Casablanca'), 'réservation 1/4');
select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1), %L)$q$,
  ((select d from t) + interval '10 hours') at time zone 'Africa/Casablanca'), 'réservation 2/4');

reset role;
-- On relève le plafond de réservations simultanées pour isoler le test du quota.
update public.settings set value = to_jsonb('9'::text) where key = 'max_active_bookings';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);

select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1), %L)$q$,
  ((select d from t) + interval '11 hours') at time zone 'Africa/Casablanca'), 'réservation 3/4');
select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1), %L)$q$,
  ((select d from t) + interval '12 hours') at time zone 'Africa/Casablanca'), 'réservation 4/4');
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1), %L)$q$,
  ((select d from t) + interval '13 hours') at time zone 'Africa/Casablanca'), 'la 5e est refusée (TB001)');

select * from public.my_week_status();

\echo ''
\echo '━━━ 3. Double réservation d''un même créneau ━━━'
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1), %L)$q$,
  ((select d from t) + interval '9 hours') at time zone 'Africa/Casablanca'),
  'créneau déjà pris par un autre étudiant (23P01)');
select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1 offset 1), %L)$q$,
  ((select d from t) + interval '9 hours') at time zone 'Africa/Casablanca'),
  'même heure mais autre machine : accepté');

\echo ''
\echo '━━━ 4. Horaires et grille ━━━'
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1 offset 2), %L)$q$,
  ((select d from t) + interval '3 hours') at time zone 'Africa/Casablanca'), 'avant l''ouverture (TB003)');
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1 offset 2), %L)$q$,
  ((select d from t) + interval '23 hours') at time zone 'Africa/Casablanca'), 'après la fermeture (TB003)');
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1 offset 2), %L)$q$,
  ((select d from t) + interval '9 hours 30 minutes') at time zone 'Africa/Casablanca'), 'hors grille (TB008)');
select pg_temp.expect_fail(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1 offset 2), now() - interval '2 hours')$q$,
  'créneau passé (TB004)');
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1 offset 2), %L)$q$,
  ((select d from t) + interval '60 days' + interval '9 hours') at time zone 'Africa/Casablanca'), 'au-delà de l''horizon (TB005)');

\echo ''
\echo '━━━ 5. Machine hors service ━━━'
reset role;
update public.machines set status = 'out_of_order'
 where id = (select id from public.machines order by name, room_id limit 1 offset 3);
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from public.machines order by name, room_id limit 1 offset 3), %L)$q$,
  ((select d from t) + interval '14 hours') at time zone 'Africa/Casablanca'), 'machine hors service (TB002)');

\echo ''
\echo '━━━ 6. Escalade de privilèges ━━━'
select pg_temp.expect_fail(
  $q$update public.profiles set role = 'admin' where id = auth.uid()$q$,
  'un étudiant ne peut pas se promouvoir admin');
select pg_temp.expect_fail(
  $q$update public.profiles set karma = 100, no_show_count = 0 where id = auth.uid()$q$,
  'un étudiant ne peut pas réécrire son karma');
select pg_temp.expect_ok(
  $q$update public.profiles set locale = 'en', theme = 'light' where id = auth.uid()$q$,
  'il peut modifier ses préférences');
select pg_temp.expect_fail(
  $q$select public.set_setting('max_bookings_per_week','99')$q$,
  'un étudiant ne peut pas relever son propre quota');
select pg_temp.expect_fail(
  $q$update public.bookings set status = 'cancelled' where user_id <> auth.uid()$q$,
  'un étudiant ne peut pas toucher aux réservations des autres');
select pg_temp.expect_fail(
  $q$select public.sweep_maintenance()$q$,
  'le balayage cron n''est pas exposé aux étudiants');

\echo ''
\echo '━━━ 7. Annulation et file d''attente ━━━'
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.expect_ok(format(
  $q$select public.join_waitlist(
      (select room_id from public.machines order by name, room_id limit 1),
      'washer', %L)$q$,
  ((select d from t) + interval '11 hours') at time zone 'Africa/Casablanca'),
  'inscription en file d''attente sur un créneau complet');

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select pg_temp.expect_ok(
  $q$select public.cancel_booking((select id from public.bookings
       where user_id = '11111111-1111-1111-1111-111111111111'
         and starts_at = ((select d from t) + interval '11 hours') at time zone 'Africa/Casablanca'
       limit 1))$q$,
  'annulation de la réservation de 11h');

reset role;
\echo '   → le créneau libéré doit être repris automatiquement :'
select p.first_name, b.status, to_char(b.starts_at at time zone 'Africa/Casablanca','DD/MM HH24:MI') as creneau
  from public.bookings b join public.profiles p on p.id = b.user_id
 where b.starts_at = ((select d from t) + interval '11 hours') at time zone 'Africa/Casablanca'
 order by b.created_at;
select count(*) as reste_en_file from public.waitlist;

\echo ''
\echo '━━━ 8. Absence : balayage automatique ━━━'
insert into public.bookings (machine_id, user_id, starts_at, ends_at, status)
select (select id from public.machines where status='operational' order by name limit 1 offset 4),
       '22222222-2222-2222-2222-222222222222',
       ((select d from t) + interval '15 hours') at time zone 'Africa/Casablanca',
       ((select d from t) + interval '16 hours') at time zone 'Africa/Casablanca', 'booked';

-- On antidate ensuite : le trigger interdit (à raison) d'insérer dans le passé.
update public.bookings
   set starts_at = now() - interval '40 minutes',
       ends_at   = now() + interval '20 minutes'
 where user_id = '22222222-2222-2222-2222-222222222222'
   and starts_at = ((select d from t) + interval '15 hours') at time zone 'Africa/Casablanca';
select public.sweep_maintenance();
select display_name, karma, no_show_count from public.profiles
 where id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '━━━ 9. Réglage du quota par l''admin ━━━'
update public.profiles set role='admin' where id='11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select pg_temp.expect_ok($q$select public.set_setting('max_bookings_per_week','6')$q$,
  'un admin peut porter le quota à 6');
select pg_temp.expect_fail($q$select public.set_setting('max_bookings_per_week','999')$q$,
  'mais pas au-delà de la borne maximale');
select quota from public.my_week_status();
reset role;

\echo ''
\echo '━━━ 10. Vues de lecture ━━━'
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select live_status, count(*) from public.v_machine_live group by 1 order by 1;
select count(*) as lignes_planning from public.v_board;
reset role;
