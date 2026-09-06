-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0010 — Retrait des réclamations
--
--  La fonctionnalité « réclamations » (dépôt, fil de discussion, triage admin)
--  est retirée. Restent inchangés : les signalements de panne (report_status,
--  machine_reports), qui partagent le même type d'énumération.
-- ════════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── Vue dépendante des deux tables ───────────────────────────────────────────
drop view if exists public.v_reclamations cascade;

-- ── API : à retirer avant les tables, dont le type ligne leur sert de retour ─
drop function if exists public.file_claim(text, text, text, uuid, uuid);
drop function if exists public.reply_claim(uuid, text);
drop function if exists public.admin_set_claim_status(uuid, public.report_status);

drop trigger if exists trg_claims_reference on public.claims;
drop function if exists public.attribuer_reference_reclamation();
drop trigger if exists trg_claims_touch on public.claims;

-- ── Fil de discussion, puis dossiers (l'ordre respecte la clé étrangère) ─────
drop table if exists public.claim_messages;
drop table if exists public.claims cascade;

drop sequence if exists public.claim_reference_seq;

-- ── Le tableau de bord admin ne remonte plus les réclamations ───────────────
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
    'open_reports',    (select count(*) from public.machine_reports where status = 'open')
  ) into v_out;

  return v_out;
end $$;

revoke execute on function public.admin_overview() from public, anon;
grant  execute on function public.admin_overview() to authenticated;
