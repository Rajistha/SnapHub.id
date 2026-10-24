-- ============================================================================
-- SnapHub — Hardening keamanan & performa (Antrian + Link Bio)
-- Jalankan di SQL Editor Supabase. Aman dijalankan ulang (idempotent).
--
-- Prasyarat: finance_photo_session.sql, crew_link.sql (admin_add_session), dan linktree.sql sudah dijalankan.
--
-- Yang diperbaiki:
--   1. event_queues sebelumnya bisa di-UPDATE/DELETE siapa saja (policy using(true))
--      dan nomor WhatsApp semua tamu bisa dibaca anon. Sekarang tabel hanya untuk admin;
--      tamu & layar TV memakai fungsi RPC yang hanya mengembalikan data minimal.
--   2. financial_events sebelumnya terbaca anon (pemasukan, sesi, crew_token) lewat
--      policy "Anon read basic financial_events". Policy itu dihapus.
--   3. Antrian memakai token sendiri (queue_token), tidak lagi berbagi dengan link live.
--   4. Aksi "panggil berikutnya" & "selesai" atomik di server (tanpa balapan antar admin).
--   5. Klik link bio dihitung di tabel terpisah, tidak menimpa isi linktree saat admin simpan.
-- ============================================================================

-- ── 1. Token antrian terpisah dari link live ────────────────────────────────
alter table public.financial_events
  add column if not exists queue_token text unique;

-- Link/QR lama tetap berfungsi: salin token yang sudah beredar.
update public.financial_events
set queue_token = share_token
where queue_token is null and share_token is not null;

-- Default tarif print harus sama dengan klien (Rp 10.000), bukan 5.000.
do $$
begin
  alter table public.financial_events alter column print_price set default 10000;
exception when undefined_column then
  null; -- event_pricing.sql belum dijalankan: tidak ada kolom tarif untuk diperbaiki
end $$;

-- ── 2. Kunci tabel & policy ─────────────────────────────────────────────────
drop policy if exists "Anon read basic financial_events" on public.financial_events;

alter table public.event_queues enable row level security;

drop policy if exists "Anon read event_queues" on public.event_queues;
drop policy if exists "Anon insert event_queues" on public.event_queues;
drop policy if exists "Auth update event_queues" on public.event_queues;
drop policy if exists "Auth delete event_queues" on public.event_queues;
drop policy if exists "Admin all event_queues" on public.event_queues;

create policy "Admin all event_queues" on public.event_queues
  for all to authenticated using (true) with check (true);

revoke all on public.event_queues from anon;

-- Validasi data di level database
alter table public.event_queues drop constraint if exists event_queues_status_chk;
alter table public.event_queues add constraint event_queues_status_chk
  check (status in ('waiting','called','heading','serving','completed','skipped','cancelled')) not valid;

alter table public.event_queues drop constraint if exists event_queues_len_chk;
alter table public.event_queues add constraint event_queues_len_chk
  check (char_length(customer_name) between 1 and 40 and char_length(customer_phone) <= 20) not valid;

create unique index if not exists uq_event_queues_event_seq
  on public.event_queues(event_id, seq_number);

-- ── 3. RPC publik (tamu & layar TV) ─────────────────────────────────────────
drop function if exists public.get_queue_event(text);
drop function if exists public.take_queue_ticket(bigint, text, text, text);

create or replace function public.queue_event_id(p_token text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.financial_events
  where p_token is not null and length(p_token) >= 8 and queue_token = p_token
  limit 1;
$$;
revoke execute on function public.queue_event_id(text) from public, anon, authenticated;

-- Satu panggilan untuk semua kebutuhan layar: info event, papan antrian aktif, dan tiket milik sendiri.
-- Nama di papan hanya nama depan; nomor WhatsApp tidak pernah dikirim.
create or replace function public.get_queue_state(p_token text, p_ticket_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_event_id(p_token);
  v_event jsonb;
  v_board jsonb;
  v_ticket jsonb;
  v_done int;
begin
  if v_event_id is null then return null; end if;

  select jsonb_build_object('id', e.id, 'name', e.name, 'date', e.date)
  into v_event from public.financial_events e where e.id = v_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'queue_number', q.queue_number,
      'seq_number', q.seq_number,
      'status', q.status,
      'name', split_part(q.customer_name, ' ', 1),
      'called_at', q.called_at,
      'called_count', q.called_count) order by q.seq_number), '[]'::jsonb)
  into v_board
  from (
    select * from public.event_queues
    where event_id = v_event_id and status in ('waiting','called','heading','serving')
    order by seq_number
    limit 300
  ) q;

  select count(*) into v_done from public.event_queues
  where event_id = v_event_id and status = 'completed';

  if p_ticket_id is not null then
    select jsonb_build_object(
      'id', q.id,
      'queue_number', q.queue_number,
      'seq_number', q.seq_number,
      'status', q.status,
      'customer_name', q.customer_name,
      'called_at', q.called_at,
      'called_count', q.called_count)
    into v_ticket
    from public.event_queues q
    where q.id = p_ticket_id and q.event_id = v_event_id;
  end if;

  return jsonb_build_object('event', v_event, 'board', v_board, 'completed_count', v_done, 'ticket', v_ticket);
end $$;

create or replace function public.take_queue_ticket(p_token text, p_name text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_event_id(p_token);
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 40);
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_next int;
  v_row public.event_queues%rowtype;
begin
  if v_event_id is null then
    raise exception 'Link antrian tidak valid';
  end if;
  if length(v_name) = 0 then
    raise exception 'Nama wajib diisi';
  end if;
  if left(v_phone, 1) = '0' then v_phone := '62' || substr(v_phone, 2); end if;
  if length(v_phone) not between 9 and 15 then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;

  perform 1 from public.financial_events where id = v_event_id for update;

  -- Nomor yang sama tidak boleh punya dua tiket aktif: kembalikan tiket yang sudah ada.
  select * into v_row from public.event_queues
  where event_id = v_event_id and customer_phone = v_phone
    and status in ('waiting','called','heading','serving')
  order by seq_number desc limit 1;

  if found then
    return jsonb_build_object('existing', true, 'id', v_row.id, 'queue_number', v_row.queue_number,
      'seq_number', v_row.seq_number, 'status', v_row.status, 'customer_name', v_row.customer_name,
      'called_at', v_row.called_at, 'called_count', v_row.called_count);
  end if;

  -- Batasi lonjakan permintaan per event (anti-spam)
  if (select count(*) from public.event_queues
      where event_id = v_event_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Terlalu banyak permintaan, coba lagi sebentar';
  end if;

  select coalesce(max(seq_number), 0) + 1 into v_next from public.event_queues where event_id = v_event_id;

  insert into public.event_queues (event_id, queue_number, seq_number, customer_name, customer_phone, status)
  values (v_event_id, 'A-' || lpad(v_next::text, 2, '0'), v_next, v_name, v_phone, 'waiting')
  returning * into v_row;

  return jsonb_build_object('existing', false, 'id', v_row.id, 'queue_number', v_row.queue_number,
    'seq_number', v_row.seq_number, 'status', v_row.status, 'customer_name', v_row.customer_name,
    'called_at', v_row.called_at, 'called_count', v_row.called_count);
end $$;

-- Tamu menekan "Saya menuju booth". Hanya sah jika tiketnya sedang dipanggil.
create or replace function public.queue_confirm_heading(p_ticket_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.event_queues set status = 'heading'
    where id = p_ticket_id and status in ('called','serving')
    returning 1
  ) select exists(select 1 from u);
$$;

-- Tamu melepas tiketnya sendiri (hanya jika masih menunggu).
create or replace function public.queue_leave(p_ticket_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.event_queues set status = 'cancelled'
    where id = p_ticket_id and status = 'waiting'
    returning 1
  ) select exists(select 1 from u);
$$;

grant execute on function public.get_queue_state(text, uuid) to anon, authenticated;
grant execute on function public.take_queue_ticket(text, text, text) to anon, authenticated;
grant execute on function public.queue_confirm_heading(uuid) to anon, authenticated;
grant execute on function public.queue_leave(uuid) to anon, authenticated;

-- ── 4. RPC admin: aksi antrian atomik ───────────────────────────────────────
create or replace function public.admin_queue_complete(p_id uuid, p_auto_session boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.event_queues%rowtype;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;

  update public.event_queues
  set status = 'completed', completed_at = now()
  where id = p_id and status in ('called','heading','serving')
  returning * into v_row;

  if not found then return null; end if;

  if p_auto_session then
    perform public.admin_add_session(v_row.event_id, substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), false, 0);
  end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.admin_queue_call_next(p_event_id bigint, p_auto_session boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur public.event_queues%rowtype;
  v_next public.event_queues%rowtype;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;

  perform 1 from public.financial_events where id = p_event_id for update;

  for v_cur in
    select * from public.event_queues
    where event_id = p_event_id and status in ('called','heading','serving')
  loop
    update public.event_queues set status = 'completed', completed_at = now() where id = v_cur.id;
    if p_auto_session then
      perform public.admin_add_session(p_event_id, substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), false, 0);
    end if;
  end loop;

  select * into v_next from public.event_queues
  where event_id = p_event_id and status = 'waiting'
  order by seq_number limit 1 for update skip locked;

  if not found then return null; end if;

  update public.event_queues
  set status = 'called', called_at = now(), called_count = coalesce(called_count, 0) + 1
  where id = v_next.id
  returning * into v_next;

  return to_jsonb(v_next);
end $$;

revoke execute on function public.admin_queue_complete(uuid, boolean) from public, anon;
revoke execute on function public.admin_queue_call_next(bigint, boolean) from public, anon;
grant execute on function public.admin_queue_complete(uuid, boolean) to authenticated;
grant execute on function public.admin_queue_call_next(bigint, boolean) to authenticated;

-- ── 5. Penghitung klik link bio (tabel terpisah) ────────────────────────────
create table if not exists public.link_clicks (
  link_id text primary key,
  clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.link_clicks enable row level security;
drop policy if exists "Admin all link_clicks" on public.link_clicks;
create policy "Admin all link_clicks" on public.link_clicks
  for all to authenticated using (true) with check (true);
revoke all on public.link_clicks from anon;

-- Pindahkan hitungan lama dari JSON linktree
insert into public.link_clicks (link_id, clicks)
select l->>'id', coalesce((l->>'clicks')::bigint, 0)
from public.site_settings s, jsonb_array_elements(s.value->'links') l
where s.key = 'linktree' and l->>'type' is distinct from 'header' and l->>'id' is not null
on conflict (link_id) do nothing;

drop function if exists public.increment_link_clicks(text);

-- Hanya link yang benar-benar ada & aktif di linktree yang bisa dihitung.
create or replace function public.track_link_click(p_link_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_link_id is null or length(p_link_id) > 64 then return; end if;
  if not exists (
    select 1 from public.site_settings s, jsonb_array_elements(s.value->'links') l
    where s.key = 'linktree' and l->>'id' = p_link_id and coalesce((l->>'isActive')::boolean, true)
  ) then return; end if;

  insert into public.link_clicks (link_id, clicks) values (p_link_id, 1)
  on conflict (link_id) do update set clicks = public.link_clicks.clicks + 1, updated_at = now();
end $$;

grant execute on function public.track_link_click(text) to anon, authenticated;
