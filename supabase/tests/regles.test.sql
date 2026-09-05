-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR — vérification des règles métier
--
--  Les créneaux visés sont calculés en décalage de `now()` plutôt qu'en heures
--  fixes : la suite donne le même verdict à 3 h du matin qu'à midi.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP off
\timing off
\pset pager off

create or replace function pg_temp.expect_fail(p_sql text, p_label text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return '✗ ' || p_label || ' — AURAIT DÛ ÉCHOUER';
exception when others then
  return '✓ ' || p_label || ' → ' || sqlstate || ' ' || left(sqlerrm, 88);
end $$;

create or replace function pg_temp.expect_ok(p_sql text, p_label text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return '✓ ' || p_label;
exception when others then
  return '✗ ' || p_label || ' — ÉCHEC INATTENDU: ' || sqlstate || ' ' || left(sqlerrm, 110);
end $$;

create or replace function pg_temp.expect_eq(p_valeur boolean, p_attendu boolean, p_label text)
returns text language sql as $$
  select case when p_valeur is not distinct from p_attendu
              then '✓ ' || p_label
              else '✗ ' || p_label || ' — attendu ' || p_attendu || ', obtenu ' || coalesce(p_valeur::text, 'null') end;
$$;

-- Machines de test, dans l'ordre, et créneau de départ aligné sur la grille.
create temp table m as
  select row_number() over (order by r.position, mm.position, mm.name) - 1 as n, mm.id, mm.room_id
    from public.machines mm join public.rooms r on r.id = mm.room_id;
-- h0 = le prochain 07:00 local. Toujours à moins de 24 h, et hors de la
-- tranche de nuit quelle que soit l'heure à laquelle la suite est lancée :
-- les tests de quota ne dépendent donc pas de la pendule.
create temp table t as
select (case
          when (now() at time zone 'Africa/Casablanca')
               < (date_trunc('day', now() at time zone 'Africa/Casablanca') + interval '7 hours')
          then  date_trunc('day', now() at time zone 'Africa/Casablanca') + interval '7 hours'
          else  date_trunc('day', now() at time zone 'Africa/Casablanca') + interval '1 day' + interval '7 hours'
        end) at time zone 'Africa/Casablanca' as h0;
-- Sans ces droits, les requêtes exécutées sous le rôle « authenticated »
-- échouent sur la table temporaire — et un test de refus passerait au vert
-- pour la mauvaise raison.
grant select on m, t to public;

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
\echo '━━━ 2. Longueur de créneau : une heure ou deux ━━━'
-- Horizon élargi le temps de poser les créneaux de la journée type ; la
-- tranche de nuit garde sa valeur réelle (00 h–06 h) pour toute la suite.
update public.settings set value = to_jsonb('48'::text) where key = 'booking_horizon_hours';
update public.settings set value = to_jsonb('9'::text)  where key = 'max_active_bookings';

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);

select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from m where n = 0), %L, 1)$q$,
  (select h0 from t)), 'créneau d''une heure');
select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from m where n = 1), %L, 2)$q$,
  (select h0 from t)), 'créneau de deux heures');
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from m where n = 2), %L, 3)$q$,
  (select h0 from t)), 'trois heures refusées (TB011)');
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from m where n = 2), %L, 0)$q$,
  (select h0 from t)), 'durée nulle refusée (TB011)');

reset role;
\echo '   → le créneau de 2 h occupe bien les deux heures :'
select mm.name,
       to_char(b.starts_at at time zone 'Africa/Casablanca','HH24:MI') as debut,
       to_char(b.ends_at   at time zone 'Africa/Casablanca','HH24:MI') as fin,
       (extract(epoch from (b.ends_at - b.starts_at))/60)::int as minutes
  from public.bookings b join public.machines mm on mm.id = b.machine_id
 where b.user_id = '11111111-1111-1111-1111-111111111111' order by mm.name;

set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from m where n = 1), %L, 1)$q$,
  (select h0 + interval '1 hour' from t)),
  'la 2e heure du créneau de 2 h est bien occupée (23P01)');

\echo ''
\echo '━━━ 3. Quota : 4 réservations, quelle que soit leur durée ━━━'
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.expect_ok(format($q$select public.book_slot((select id from m where n = 2), %L, 2)$q$,
  (select h0 + interval '4 hours' from t)), 'réservation 1/4 (2 h)');
select pg_temp.expect_ok(format($q$select public.book_slot((select id from m where n = 2), %L, 2)$q$,
  (select h0 + interval '6 hours' from t)), 'réservation 2/4 (2 h)');
select pg_temp.expect_ok(format($q$select public.book_slot((select id from m where n = 2), %L, 1)$q$,
  (select h0 + interval '8 hours' from t)), 'réservation 3/4 (1 h)');
select pg_temp.expect_ok(format($q$select public.book_slot((select id from m where n = 2), %L, 1)$q$,
  (select h0 + interval '9 hours' from t)), 'réservation 4/4 (1 h)');
select pg_temp.expect_fail(format($q$select public.book_slot((select id from m where n = 2), %L, 1)$q$,
  (select h0 + interval '10 hours' from t)), 'la 5e est refusée (TB001)');

\echo '   → 6 h de machine consommées, mais 4 réservations décomptées :'
select used, quota, remaining, night_used from public.my_week_status();

\echo ''
\echo '━━━ 4. Horizon glissant de 24 h ━━━'
reset role;
update public.settings set value = to_jsonb('24'::text) where key = 'booking_horizon_hours';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.expect_ok(
  $q$select public.book_slot((select id from m where n = 3),
        date_trunc('hour', now()) + interval '20 hours', 1)$q$,
  'créneau à +20 h accepté');
select pg_temp.expect_fail(
  $q$select public.book_slot((select id from m where n = 3),
        date_trunc('hour', now()) + interval '30 hours', 1)$q$,
  'créneau à +30 h refusé (TB005)');
select pg_temp.expect_fail(
  $q$select public.book_slot((select id from m where n = 3), now() - interval '3 hours', 1)$q$,
  'créneau passé refusé (TB004)');
select pg_temp.expect_fail(
  $q$select public.book_slot((select id from m where n = 3),
        date_trunc('hour', now()) + interval '2 hours 30 minutes', 1)$q$,
  'créneau hors grille refusé (TB008)');

\echo ''
\echo '━━━ 5. Créneaux de nuit ━━━'
reset role;
update public.settings set value = to_jsonb('48'::text) where key = 'booking_horizon_hours';

\echo '   → la règle, isolée de l''heure qu''il est :'
select pg_temp.expect_eq(
  public.est_creneau_nuit(('2026-06-10 02:00'::timestamp at time zone 'Africa/Casablanca')),
  true, '02:00 est un créneau de nuit');
select pg_temp.expect_eq(
  public.est_creneau_nuit(('2026-06-10 06:00'::timestamp at time zone 'Africa/Casablanca')),
  false, '06:00 n''en est plus un (borne exclue)');
select pg_temp.expect_eq(
  public.est_creneau_nuit(('2026-06-10 14:00'::timestamp at time zone 'Africa/Casablanca')),
  false, '14:00 est un créneau ordinaire');
select pg_temp.expect_eq(
  public.nuit_reservable(
    ('2026-06-10 02:00'::timestamp at time zone 'Africa/Casablanca'),
    ('2026-06-09 22:00'::timestamp at time zone 'Africa/Casablanca')),
  true, 'réservé la veille à 22 h : autorisé');
select pg_temp.expect_eq(
  public.nuit_reservable(
    ('2026-06-10 02:00'::timestamp at time zone 'Africa/Casablanca'),
    ('2026-06-10 01:00'::timestamp at time zone 'Africa/Casablanca')),
  true, 'réservé à 1 h du matin pour 2 h : maintenant autorisé');
select pg_temp.expect_eq(
  public.nuit_reservable(
    ('2026-06-10 02:00'::timestamp at time zone 'Africa/Casablanca'),
    ('2026-06-09 23:59'::timestamp at time zone 'Africa/Casablanca')),
  true, 'une minute avant minuit : encore autorisé');
select pg_temp.expect_eq(
  public.nuit_reservable(
    ('2026-06-10 14:00'::timestamp at time zone 'Africa/Casablanca'),
    ('2026-06-10 13:00'::timestamp at time zone 'Africa/Casablanca')),
  true, 'un créneau de jour ne subit pas la règle');

\echo '   → et hors quota, en conditions réelles :'
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from m where n = 4), %L, 1)$q$,
  ((date_trunc('day', now() at time zone 'Africa/Casablanca') + interval '1 day' + interval '2 hours')
     at time zone 'Africa/Casablanca')),
  'quota épuisé, mais la nuit reste ouverte');

\echo '   → la nuit s''ajoute sans toucher au quota :'
select used, quota, remaining, night_used from public.my_week_status();

\echo ''
\echo '━━━ 6. Machine hors service et buanderie à horaires ━━━'
reset role;
update public.machines set status = 'out_of_order' where id = (select id from m where n = 5);
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.expect_fail(format($q$select public.book_slot((select id from m where n = 5), %L, 1)$q$,
  (select h0 + interval '12 hours' from t)), 'machine hors service (TB002)');

reset role;
-- Une buanderie peut rester à horaires restreints : la règle tient toujours.
update public.rooms set opens_at = '08:00', closes_at = '20:00'
 where id = (select room_id from m where n = 6);
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.expect_fail(format($q$select public.book_slot((select id from m where n = 6), %L, 1)$q$,
  ((date_trunc('day', now() at time zone 'Africa/Casablanca') + interval '1 day' + interval '5 hours')
     at time zone 'Africa/Casablanca')),
  'hors des horaires d''une buanderie restreinte (TB003)');

\echo ''
\echo '━━━ 7. Escalade de privilèges ━━━'
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
  $q$select public.set_setting('night_end_hour','24')$q$,
  'ni ouvrir la tranche de nuit sur toute la journée');
select pg_temp.expect_fail(
  $q$update public.bookings set status = 'cancelled' where user_id <> auth.uid()$q$,
  'un étudiant ne peut pas toucher aux réservations des autres');
select pg_temp.expect_fail(
  $q$select public.sweep_maintenance()$q$,
  'le balayage cron n''est pas exposé aux étudiants');
select pg_temp.expect_fail(
  $q$select public.promote_admin('rudolf.staline@centrale-casablanca.ma')$q$,
  'ni s''auto-nommer administrateur');
select pg_temp.expect_fail(
  $q$select qr_code from public.machines limit 1$q$,
  'ni lire les codes QR — sinon on pointe sans venir');
select pg_temp.expect_fail(
  $q$select public.admin_machine_codes()$q$,
  'ni les obtenir par la fonction d''administration');
select pg_temp.expect_ok(
  $q$select name, status from public.machines limit 1$q$,
  'mais le reste du parc lui reste lisible');

\echo ''
\echo '━━━ 7 bis. Ce qu''un visiteur non connecté peut atteindre ━━━'
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_fail($q$select public.admin_machine_codes()$q$,
  'anon ne peut pas appeler la fonction des codes QR');
select pg_temp.expect_fail($q$select public.admin_overview()$q$,
  'ni le tableau de bord d''administration');
select pg_temp.expect_fail($q$select public.set_setting('max_bookings_per_week','99')$q$,
  'ni toucher aux réglages');
select pg_temp.expect_fail(
  $q$select public.book_slot((select id from m where n = 0), now() + interval '3 hours', 1)$q$,
  'ni réserver');
select pg_temp.expect_fail($q$select qr_code from public.machines limit 1$q$,
  'ni lire un code QR');
select pg_temp.expect_ok($q$select name, live_status from public.v_machine_live limit 1$q$,
  'mais le tableau public du parc reste lisible');
select pg_temp.expect_ok($q$select name from public.rooms limit 1$q$,
  'et les buanderies aussi — la politique évalue is_admin() sans erreur');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);

\echo ''
\echo '━━━ 8. Annulation et file d''attente ━━━'
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.expect_ok(format(
  $q$select public.join_waitlist((select room_id from m where n = 0), 'washer', %L)$q$,
  (select h0 from t)), 'inscription en file d''attente sur un créneau complet');

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select pg_temp.expect_ok(format(
  $q$select public.cancel_booking((select id from public.bookings
       where user_id = '11111111-1111-1111-1111-111111111111' and starts_at = %L limit 1))$q$,
  (select h0 from t)), 'annulation du créneau libéré');

reset role;
\echo '   → le créneau libéré est repris automatiquement :'
select p.first_name, b.status,
       to_char(b.starts_at at time zone 'Africa/Casablanca','DD/MM HH24:MI') as creneau
  from public.bookings b join public.profiles p on p.id = b.user_id
 where b.starts_at = (select h0 from t) and b.machine_id = (select id from m where n = 0)
 order by b.created_at;

\echo ''
\echo '━━━ 9. Absence : balayage automatique ━━━'
-- Relevé avant balayage : les vérifications portent sur l'écart, pas sur une
-- valeur absolue qui dépendrait de ce qu'ont fait les sections précédentes.
create temp table avant as
  select karma, no_show_count from public.profiles
   where id = '22222222-2222-2222-2222-222222222222';

insert into public.bookings (machine_id, user_id, starts_at, ends_at, status)
select (select id from m where n = 7), '22222222-2222-2222-2222-222222222222',
       date_trunc('hour', now()) + interval '2 hours',
       date_trunc('hour', now()) + interval '3 hours', 'booked';
update public.bookings
   set starts_at = now() - interval '40 minutes', ends_at = now() + interval '20 minutes'
 where machine_id = (select id from m where n = 7);
select public.sweep_maintenance();

select pg_temp.expect_eq(
  (select bool_and(status = 'no_show') from public.bookings
    where machine_id = (select id from m where n = 7)),
  true, 'le créneau jamais pointé bascule en absence');
select pg_temp.expect_eq(
  (select p.no_show_count = a.no_show_count + 1
     from public.profiles p, avant a
    where p.id = '22222222-2222-2222-2222-222222222222'),
  true, 'l''absence est portée au dossier de l''étudiant');
select pg_temp.expect_eq(
  (select p.karma = greatest(0, a.karma - public.setting_int('no_show_penalty', 20))
     from public.profiles p, avant a
    where p.id = '22222222-2222-2222-2222-222222222222'),
  true, 'et le karma amputé de la pénalité');

\echo ''
\echo '━━━ 10. Réglages par l''admin ━━━'
update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select pg_temp.expect_ok($q$select public.set_setting('max_bookings_per_week','6')$q$,
  'un admin peut porter le quota à 6');
select pg_temp.expect_fail($q$select public.set_setting('max_bookings_per_week','999')$q$,
  'mais pas au-delà de la borne maximale');
select pg_temp.expect_ok($q$select public.set_setting('booking_horizon_hours','48')$q$,
  'et peut élargir l''horizon');
select quota from public.my_week_status();

\echo ''
\echo '━━━ 11 bis. Référence, motif et réclamations ━━━'
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);

\echo '   → toute réservation porte une référence lisible :'
select count(*) filter (where reference like 'TB-%') as avec_reference,
       count(*) as total
  from public.bookings;

select pg_temp.expect_ok(format(
  $q$select public.book_slot((select id from m where n = 3), %L, 1, 'draps')$q$,
  (select h0 + interval '18 hours' from t)), 'réservation avec un motif');
select pg_temp.expect_fail(format(
  $q$select public.book_slot((select id from m where n = 3), %L, 1, 'nimportequoi')$q$,
  (select h0 + interval '19 hours' from t)), 'motif hors liste refusé');

select pg_temp.expect_ok(
  $q$select public.file_claim('linge_sorti', 'Mon linge a été sorti',
        'Je suis arrivé à la fin de mon créneau, la machine était vide et mon linge posé par terre.',
        (select id from public.bookings where user_id = auth.uid() order by created_at limit 1))$q$,
  'dépôt d''une réclamation liée à sa réservation');

select pg_temp.expect_fail(
  $q$select public.file_claim('autre', 'Test', 'Corps du message',
        (select id from public.bookings where user_id <> auth.uid() limit 1))$q$,
  'impossible de la rattacher à la réservation d''un autre');

select pg_temp.expect_ok(
  $q$select public.reply_claim((select id from public.claims where user_id = auth.uid() limit 1),
        'J''ai retrouvé une chaussette, pas le reste.')$q$,
  'réponse dans son propre fil');

\echo '   → le fil, tel que l''auteur le voit :'
select c.reference, c.category, c.status, cm.from_staff, left(cm.body, 46) as message
  from public.claims c join public.claim_messages cm on cm.claim_id = c.id
 where c.user_id = auth.uid() order by cm.created_at;

\echo '   → un autre étudiant n''y a pas accès :'
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select count(*) as reclamations_visibles from public.claims;
select pg_temp.expect_fail(
  $q$select public.reply_claim((select id from public.claims limit 1), 'Je m''incruste')$q$,
  'ni ne peut répondre dans le fil d''autrui');

\echo '   → l''équipe, elle, voit tout et peut traiter :'
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select count(*) as reclamations_visibles_admin from public.claims;
select pg_temp.expect_ok(
  $q$select public.reply_claim((select id from public.claims limit 1),
        'Nous avons interrogé les étudiants du créneau suivant.')$q$,
  'un admin peut répondre');
select pg_temp.expect_ok(
  $q$select public.admin_set_claim_status((select id from public.claims limit 1), 'resolved')$q$,
  'et clore le dossier');

\echo '   → et un visiteur non connecté n''atteint rien de tout ça :'
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_fail($q$select public.file_claim('autre','Anonyme','Corps')$q$,
  'anon ne peut pas déposer de réclamation');
select pg_temp.expect_fail($q$select public.reply_claim(gen_random_uuid(), 'Corps')$q$,
  'ni répondre dans un fil');
reset role;

\echo ''
\echo '━━━ 11. Vues de lecture ━━━'
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select live_status, count(*) from public.v_machine_live group by 1 order by 1;
select count(*) filter (where is_night) as creneaux_nuit,
       count(*) filter (where duration_minutes = 120) as creneaux_2h,
       count(*) as lignes_planning
  from public.v_board;
reset role;
