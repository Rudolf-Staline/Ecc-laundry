-- ════════════════════════════════════════════════════════════════════════════
--  TAMBOUR · 0007 — Réclamations, référence de réservation, motif
--
--  Inspiré du modèle de BiblioBox (la plateforme de réservation des box de
--  la bibliothèque), avec trois différences assumées :
--   • une réclamation n'est pas un formulaire sans suite mais un fil de
--     discussion : l'étudiant voit ce que l'équipe répond ;
--   • la référence est préfixée (TB-1042) plutôt qu'un entier nu, pour rester
--     sans ambiguïté à l'oral comme à l'écrit ;
--   • le motif est facultatif — on ne bloque pas une réservation sur un champ
--     dont l'étudiant n'a pas besoin.
--
--  Codes d'erreur ajoutés :
--    TB013  réclamation introuvable ou fermée
-- ════════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ── Référence lisible ───────────────────────────────────────────────────────
create sequence if not exists public.booking_reference_seq start 1042;

alter table public.bookings add column if not exists reference text;
alter table public.bookings add column if not exists purpose   text;

do $$ begin
  alter table public.bookings add constraint bookings_purpose_valid
    check (purpose is null or purpose in
      ('courant', 'draps', 'sport', 'delicat', 'volumineux', 'autre'));
exception when duplicate_object then null; end $$;

create unique index if not exists bookings_reference_key on public.bookings (reference);

create or replace function public.attribuer_reference()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.reference is null then
    new.reference := 'TB-' || nextval('public.booking_reference_seq');
  end if;
  return new;
end $$;

drop trigger if exists trg_bookings_reference on public.bookings;
create trigger trg_bookings_reference
  before insert on public.bookings
  for each row execute function public.attribuer_reference();

-- Rattrapage des réservations créées avant l'introduction de la référence.
update public.bookings
   set reference = 'TB-' || nextval('public.booking_reference_seq')
 where reference is null;

-- ── Réclamations ────────────────────────────────────────────────────────────
create sequence if not exists public.claim_reference_seq start 1;

create table if not exists public.claims (
  id          uuid primary key default gen_random_uuid(),
  reference   text        not null,
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  -- Une réclamation porte souvent sur un créneau précis (« on a sorti mon
  -- linge pendant ma réservation ») : le lien évite de tout réexpliquer.
  booking_id  uuid        references public.bookings (id) on delete set null,
  machine_id  uuid        references public.machines (id) on delete set null,
  category    text        not null default 'autre'
                check (category in ('linge_sorti', 'linge_abime', 'creneau_occupe',
                                    'pointage', 'quota', 'proprete', 'autre')),
  subject     text        not null check (length(btrim(subject)) between 3 and 120),
  status      public.report_status not null default 'open',
  resolved_by uuid        references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists claims_reference_key on public.claims (reference);
create index if not exists claims_user_idx   on public.claims (user_id, created_at desc);
create index if not exists claims_status_idx on public.claims (status, created_at desc);

create or replace function public.attribuer_reference_reclamation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'REC-' || lpad(nextval('public.claim_reference_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_claims_reference on public.claims;
create trigger trg_claims_reference
  before insert on public.claims
  for each row execute function public.attribuer_reference_reclamation();

drop trigger if exists trg_claims_touch on public.claims;
create trigger trg_claims_touch before update on public.claims
  for each row execute function public.touch_updated_at();

-- ── Fil de discussion ───────────────────────────────────────────────────────
--  C'est là que Tambour se sépare du modèle d'origine : une réclamation sans
--  réponse visible n'est qu'une boîte aux lettres.
create table if not exists public.claim_messages (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid        not null references public.claims (id) on delete cascade,
  author_id  uuid        references public.profiles (id) on delete set null,
  body       text        not null check (length(btrim(body)) between 1 and 4000),
  from_staff boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists claim_messages_claim_idx on public.claim_messages (claim_id, created_at);

-- ── Vue : mon historique complet ────────────────────────────────────────────
--  security_invoker = on + filtre explicite : chacun ne lit que ses lignes,
--  y compris les annulations et les absences, que `v_board` masque à dessein.
drop view if exists public.v_historique cascade;
create view public.v_historique with (security_invoker = on) as
select
  b.id, b.reference, b.machine_id, b.user_id, b.starts_at, b.ends_at, b.status,
  b.purpose, b.checked_in_at, b.cancelled_at, b.created_at,
  (extract(epoch from (b.ends_at - b.starts_at)) / 60)::int as duration_minutes,
  public.est_creneau_nuit(b.starts_at) as is_night,
  m.name as machine_name, m.kind, m.qr_code is not null as has_code,
  r.id   as room_id, r.name as room_name
from public.bookings b
join public.machines m on m.id = b.machine_id
join public.rooms    r on r.id = m.room_id
where b.user_id = auth.uid();

grant select on public.v_historique to authenticated;

-- ── Vue : réclamations avec leur contexte ───────────────────────────────────
drop view if exists public.v_reclamations cascade;
create view public.v_reclamations with (security_invoker = on) as
select
  c.id, c.reference, c.user_id, c.booking_id, c.machine_id, c.category,
  c.subject, c.status, c.created_at, c.updated_at, c.resolved_at,
  p.display_name as auteur,
  p.email        as auteur_email,
  b.reference    as booking_reference,
  b.starts_at    as booking_starts_at,
  m.name         as machine_name,
  r.name         as room_name,
  (select count(*) from public.claim_messages cm where cm.claim_id = c.id) as message_count,
  (select max(cm.created_at) from public.claim_messages cm where cm.claim_id = c.id) as last_message_at
from public.claims c
join public.profiles p on p.id = c.user_id
left join public.bookings b on b.id = c.booking_id
left join public.machines m on m.id = c.machine_id
left join public.rooms    r on r.id = m.room_id;

grant select on public.v_reclamations to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  API
-- ════════════════════════════════════════════════════════════════════════════

-- ── Le motif rejoint la réservation ─────────────────────────────────────────
--  Ajouté en paramètre facultatif : réserver sans le renseigner reste possible.
drop function if exists public.book_slot(uuid, timestamptz, int);

create or replace function public.book_slot(
  p_machine_id uuid,
  p_starts_at  timestamptz,
  p_blocs      int  default 1,
  p_motif      text default null)
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
    insert into public.bookings (machine_id, user_id, starts_at, ends_at, purpose)
    values (p_machine_id, v_uid, p_starts_at,
            p_starts_at + make_interval(mins => v_slot * p_blocs),
            nullif(btrim(coalesce(p_motif, '')), ''))
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

-- ── Déposer une réclamation ─────────────────────────────────────────────────
create or replace function public.file_claim(
  p_category   text,
  p_subject    text,
  p_message    text,
  p_booking_id uuid default null,
  p_machine_id uuid default null)
returns public.claims
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_row public.claims;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = 'TB007';
  end if;

  -- On ne rattache que ses propres réservations : sans ce contrôle, la
  -- référence d'un créneau voisin suffirait à en apprendre le détail.
  if p_booking_id is not null
     and not exists (select 1 from public.bookings b
                      where b.id = p_booking_id and b.user_id = v_uid) then
    raise exception 'Cette réservation n''est pas la vôtre.' using errcode = '42501';
  end if;

  insert into public.claims (user_id, booking_id, machine_id, category, subject)
  values (v_uid, p_booking_id, p_machine_id, p_category, btrim(p_subject))
  returning * into v_row;

  insert into public.claim_messages (claim_id, author_id, body, from_staff)
  values (v_row.id, v_uid, btrim(p_message), false);

  return v_row;
end $$;

-- ── Répondre dans le fil ────────────────────────────────────────────────────
create or replace function public.reply_claim(p_claim_id uuid, p_body text)
returns public.claim_messages
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_claim public.claims%rowtype;
  v_row   public.claim_messages;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if not found then
    raise exception 'Réclamation introuvable.' using errcode = 'TB013';
  end if;

  if v_claim.user_id <> v_uid and not v_admin then
    raise exception 'Vous n''avez pas accès à cette réclamation.' using errcode = '42501';
  end if;

  if v_claim.status in ('resolved', 'rejected') and not v_admin then
    raise exception
      'Cette réclamation est close. Ouvrez-en une nouvelle si le problème persiste.'
      using errcode = 'TB013';
  end if;

  insert into public.claim_messages (claim_id, author_id, body, from_staff)
  values (p_claim_id, v_uid, btrim(p_body), v_admin)
  returning * into v_row;

  -- Une réponse de l'étudiant sur un dossier clos par l'équipe le rouvre ;
  -- une réponse de l'équipe le fait passer en traitement.
  update public.claims
     set status = case
                    when v_admin and status = 'open' then 'acknowledged'
                    else status
                  end,
         updated_at = now()
   where id = p_claim_id;

  return v_row;
end $$;

-- ── Traitement par l'équipe ─────────────────────────────────────────────────
create or replace function public.admin_set_claim_status(
  p_claim_id uuid, p_status public.report_status)
returns public.claims
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.claims;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.claims
     set status      = p_status,
         resolved_by = case when p_status in ('resolved', 'rejected') then auth.uid() end,
         resolved_at = case when p_status in ('resolved', 'rejected') then now() end
   where id = p_claim_id
  returning * into v_row;

  if not found then
    raise exception 'Réclamation introuvable.' using errcode = 'TB013';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'claim.status', 'claim', v_row.reference,
          jsonb_build_object('status', p_status));

  return v_row;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
--  RLS & privilèges
-- ════════════════════════════════════════════════════════════════════════════
alter table public.claims         enable row level security;
alter table public.claim_messages enable row level security;

grant select on public.claims, public.claim_messages to authenticated;

drop policy if exists claims_select on public.claims;
create policy claims_select on public.claims for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists claim_messages_select on public.claim_messages;
create policy claim_messages_select on public.claim_messages for select to authenticated
  using (exists (select 1 from public.claims c
                  where c.id = claim_id
                    and (c.user_id = auth.uid() or public.is_admin())));

-- Aucune politique d'écriture : tout passe par les fonctions ci-dessus, qui
-- portent leur propre contrôle d'accès.

-- PostgreSQL accorde EXECUTE à PUBLIC par défaut : sans ces révocations, un
-- visiteur non connecté pourrait appeler ces RPC.
revoke execute on function public.book_slot(uuid, timestamptz, int, text)             from public, anon;
revoke execute on function public.file_claim(text, text, text, uuid, uuid)            from public, anon;
revoke execute on function public.reply_claim(uuid, text)                             from public, anon;
revoke execute on function public.admin_set_claim_status(uuid, public.report_status)  from public, anon;
revoke execute on function public.attribuer_reference()                               from public, anon, authenticated;
revoke execute on function public.attribuer_reference_reclamation()                    from public, anon, authenticated;

grant execute on function public.book_slot(uuid, timestamptz, int, text)              to authenticated;
grant execute on function public.file_claim(text, text, text, uuid, uuid)             to authenticated;
grant execute on function public.reply_claim(uuid, text)                              to authenticated;
grant execute on function public.admin_set_claim_status(uuid, public.report_status)   to authenticated;

-- Realtime : le fil de discussion se met à jour sans rechargement.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.claim_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.claims;         exception when duplicate_object then null; end;
  end if;
end $$;

-- ── Le tableau de bord admin remonte aussi les réclamations ─────────────────
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
    'open_claims',     (select count(*) from public.claims where status in ('open', 'acknowledged')),
    'suspended',       (select count(*) from public.profiles where suspended_until > now())
  ) into v_out;

  return v_out;
end $$;

revoke execute on function public.admin_overview() from public, anon;
grant  execute on function public.admin_overview() to authenticated;
