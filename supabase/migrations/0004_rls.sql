-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0004 — Row Level Security & privilèges
--
--  Doctrine : le client ne dispose QUE des droits qu'il ne peut pas détourner.
--  • Les colonnes sensibles du profil (rôle, karma, suspension) ne sont pas
--    accessibles en écriture au rôle « authenticated » — pas de RLS à
--    contourner, le privilège n'existe simplement pas.
--  • Les transitions de réservation passent par des fonctions SECURITY DEFINER
--    qui portent leur propre contrôle d'accès.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles        enable row level security;
alter table public.rooms           enable row level security;
alter table public.machines        enable row level security;
alter table public.bookings        enable row level security;
alter table public.waitlist        enable row level security;
alter table public.machine_reports enable row level security;
alter table public.announcements   enable row level security;
alter table public.settings        enable row level security;
alter table public.audit_log       enable row level security;
alter table public.admin_allowlist enable row level security;

-- ── Privilèges de base ──────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;

-- Tableau public (« y a-t-il une machine libre ? »), sans donnée personnelle.
grant select on public.rooms, public.announcements to anon, authenticated;

-- `machines` : tout est public sauf le code QR. Celui-ci est la preuve de
-- présence devant la machine ; le lire par l'API permettrait de pointer depuis
-- son lit. Il ne sort que par admin_machine_codes(), qui vérifie le rôle.
revoke select on public.machines from anon, authenticated;
grant select (id, room_id, name, kind, status, capacity_kg, brand, model,
              cycle_minutes, position, note, created_at, updated_at)
  on public.machines to anon, authenticated;
grant select on public.settings to anon, authenticated;

grant select on public.profiles, public.bookings, public.waitlist,
                public.machine_reports to authenticated;
grant insert on public.bookings, public.waitlist, public.machine_reports to authenticated;
grant delete on public.waitlist to authenticated;

-- Écriture de profil : strictement les préférences de l'étudiant.
-- Rôle, karma, compteurs et suspension restent hors de portée.
grant update (locale, theme, notify_reminders, promo) on public.profiles to authenticated;

-- Le service_role (serveur uniquement) garde la main sur tout.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- ── profiles ────────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── rooms ───────────────────────────────────────────────────────────────────
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists rooms_admin_write on public.rooms;
create policy rooms_admin_write on public.rooms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── machines ────────────────────────────────────────────────────────────────
drop policy if exists machines_select on public.machines;
create policy machines_select on public.machines for select to anon, authenticated
  using (true);

drop policy if exists machines_admin_write on public.machines;
create policy machines_admin_write on public.machines for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── bookings ────────────────────────────────────────────────────────────────
-- Tout étudiant connecté voit l'occupation de la grille (c'est le principe
-- même d'un planning partagé) ; l'identité derrière chaque créneau est
-- filtrée par la vue publique plus bas.
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings for select to authenticated
  using (true);

drop policy if exists bookings_insert_self on public.bookings;
create policy bookings_insert_self on public.bookings for insert to authenticated
  with check (user_id = auth.uid() and status = 'booked');

-- Aucune politique UPDATE/DELETE : les transitions passent exclusivement par
-- cancel_booking() / check_in() / sweep_maintenance().
drop policy if exists bookings_admin_write on public.bookings;
create policy bookings_admin_write on public.bookings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── waitlist ────────────────────────────────────────────────────────────────
drop policy if exists waitlist_select on public.waitlist;
create policy waitlist_select on public.waitlist for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists waitlist_insert_self on public.waitlist;
create policy waitlist_insert_self on public.waitlist for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists waitlist_delete_self on public.waitlist;
create policy waitlist_delete_self on public.waitlist for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ── machine_reports ─────────────────────────────────────────────────────────
-- Transparence assumée : savoir qu'une machine a déjà été signalée trois fois
-- évite d'y laisser son linge.
drop policy if exists reports_select on public.machine_reports;
create policy reports_select on public.machine_reports for select to authenticated
  using (true);

drop policy if exists reports_insert_self on public.machine_reports;
create policy reports_insert_self on public.machine_reports for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists reports_admin_write on public.machine_reports;
create policy reports_admin_write on public.machine_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── announcements ───────────────────────────────────────────────────────────
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to anon, authenticated
  using ((is_active and starts_at <= now() and (ends_at is null or ends_at > now()))
         or public.is_admin());

drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── settings ────────────────────────────────────────────────────────────────
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to anon, authenticated
  using (true);
-- Écriture : uniquement via set_setting() (SECURITY DEFINER).

-- ── audit_log & admin_allowlist ─────────────────────────────────────────────
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select to authenticated
  using (public.is_admin());
grant select on public.audit_log to authenticated;

drop policy if exists allowlist_admin on public.admin_allowlist;
create policy allowlist_admin on public.admin_allowlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.admin_allowlist to authenticated;

-- ── Exécution des RPC ───────────────────────────────────────────────────────
--  PostgreSQL accorde EXECUTE à PUBLIC par défaut : révoquer depuis
--  « authenticated » seul ne suffit pas, il faut retirer le droit à PUBLIC.
--  Sans cette précaution, n'importe quel étudiant pourrait déclencher le
--  balayage des absences ou se promouvoir administrateur.
revoke execute on function public.sweep_maintenance()                 from public, anon, authenticated;
revoke execute on function public.promote_waitlist(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.promote_admin(text)                 from public, anon, authenticated;
revoke execute on function public.handle_new_user()                   from public, anon, authenticated;
revoke execute on function public.enforce_booking_rules()             from public, anon, authenticated;
revoke execute on function public.handle_booking_transition()         from public, anon, authenticated;
revoke execute on function public.touch_updated_at()                  from public, anon, authenticated;

-- Même raisonnement pour les RPC réservées aux administrateurs : elles
-- vérifient bien le rôle en interne, mais laisser PUBLIC les appeler pour
-- récolter un 42501 ouvre une surface inutile — et, le jour où l'une d'elles
-- perdrait sa garde, le droit d'exécution serait déjà là.
revoke execute on function public.admin_machine_codes()                               from public, anon;
revoke execute on function public.admin_overview()                                    from public, anon;
revoke execute on function public.admin_set_role(uuid, public.user_role)              from public, anon;
revoke execute on function public.admin_set_suspension(uuid, int)                     from public, anon;
revoke execute on function public.admin_resolve_report(uuid, public.report_status, text) from public, anon;
revoke execute on function public.set_setting(text, text)                             from public, anon;

-- Et pour les RPC étudiantes : sans session, elles ne peuvent rien faire,
-- autant qu'elles ne soient pas appelables du tout.
revoke execute on function public.book_slot(uuid, timestamptz, int)                    from public, anon;
revoke execute on function public.cancel_booking(uuid)                                 from public, anon;
revoke execute on function public.check_in(text)                                       from public, anon;
revoke execute on function public.join_waitlist(uuid, public.machine_kind, timestamptz) from public, anon;
revoke execute on function public.leave_waitlist(uuid)                                 from public, anon;
revoke execute on function public.my_week_status(timestamptz)                          from public, anon;
revoke execute on function public.report_machine(uuid, text, text)                     from public, anon;

-- Amorçage et tâches planifiées : côté serveur uniquement.
grant execute on function public.sweep_maintenance() to service_role;
grant execute on function public.promote_admin(text) to service_role;

grant execute on function public.book_slot(uuid, timestamptz, int)                  to authenticated;
grant execute on function public.cancel_booking(uuid)                               to authenticated;
grant execute on function public.check_in(text)                                     to authenticated;
grant execute on function public.join_waitlist(uuid, public.machine_kind, timestamptz) to authenticated;
grant execute on function public.leave_waitlist(uuid)                               to authenticated;
grant execute on function public.my_week_status(timestamptz)                        to authenticated;
grant execute on function public.report_machine(uuid, text, text)                   to authenticated;
grant execute on function public.affluence(uuid, int)                               to anon, authenticated;
grant execute on function public.admin_overview()                                   to authenticated;
grant execute on function public.admin_machine_codes()                              to authenticated;
grant execute on function public.set_setting(text, text)                            to authenticated;
grant execute on function public.is_admin()                                         to anon, authenticated;
grant execute on function public.week_bounds(timestamptz)                           to anon, authenticated;
grant execute on function public.est_creneau_nuit(timestamptz)                      to anon, authenticated;
grant execute on function public.nuit_reservable(timestamptz, timestamptz)          to anon, authenticated;
grant execute on function public.setting_int(text, int)                             to anon, authenticated;
grant execute on function public.setting_text(text, text)                           to anon, authenticated;
grant execute on function public.app_tz()                                           to anon, authenticated;
grant execute on function public.admin_set_role(uuid, public.user_role)             to authenticated;
grant execute on function public.admin_set_suspension(uuid, int)                    to authenticated;
grant execute on function public.admin_resolve_report(uuid, public.report_status, text) to authenticated;
