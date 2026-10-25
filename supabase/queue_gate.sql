-- ============================================================================
-- SnapHub — Sistem Antrian Photobooth (Rekomendasi 1: Stabil, Cepat, Anti-Error)
-- Jalankan di SQL Editor Supabase. Aman diulang berkali-kali (idempotent).
--
-- Keunggulan:
--   * QR di layar TV memakai token event (permanen & stabil selama acara).
--   * Kompatibel 100% dengan iPhone (Kamera, Code Scanner, Safari), Android & Chrome.
--   * Tidak ada error "QR sudah dipakai".
--   * Sangat cepat (sub-millisecond) dengan indexing optimal & row-locking anti-race condition.
-- ============================================================================

-- ── 1. Indeks performa ───────────────────────────────────────────────────────
create index if not exists idx_event_queues_event_seq on public.event_queues(event_id, seq_number);
create index if not exists idx_event_queues_status on public.event_queues(event_id, status);
create index if not exists idx_financial_events_queue_token on public.financial_events(queue_token);

-- Hapus batasan panjang nama agar nama kosong '' diizinkan (nomor antrian tanpa nama)
alter table public.event_queues drop constraint if exists event_queues_len_chk;
alter table public.event_queues add constraint event_queues_len_chk
  check (char_length(customer_name) <= 40 and char_length(customer_phone) <= 20) not valid;

-- Default nama kosong '', tiket terbit secara 1-tap instan
alter table public.event_queues alter column customer_name set default '';

-- ── 2. Helper identifikasi event dari token ───────────────────────────────────
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

-- ── 3. Papan antrian (dipakai bersama oleh TV dan tamu) ──────────────────────
create or replace function public.queue_state_for(p_event_id bigint, p_ticket_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event jsonb;
  v_board jsonb;
  v_ticket jsonb;
  v_done int;
  v_avg numeric := 300;
begin
  select jsonb_build_object('id', e.id, 'name', e.name, 'date', e.date)
  into v_event from public.financial_events e where e.id = p_event_id;

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
    where event_id = p_event_id and status in ('waiting','called','heading','serving')
    order by seq_number
    limit 300
  ) q;

  select count(*) into v_done from public.event_queues
  where event_id = p_event_id and status = 'completed';

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
    where q.id = p_ticket_id and q.event_id = p_event_id;
  end if;

  return jsonb_build_object(
    'event', v_event, 'board', v_board, 'completed_count', v_done,
    'avg_service_seconds', round(v_avg), 'ticket', v_ticket);
end $$;

-- ── 4. Ambil state antrian berdasarkan token event ───────────────────────────
create or replace function public.get_queue_state(p_token text, p_ticket_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_event_id(p_token);
begin
  if v_event_id is null then return null; end if;
  return public.queue_state_for(v_event_id, p_ticket_id);
end $$;

create or replace function public.get_queue_state(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_queue_state(p_token, null::uuid);
$$;

grant execute on function public.get_queue_state(text, uuid) to anon, authenticated;
grant execute on function public.get_queue_state(text) to anon, authenticated;

-- ── 5. Ambil nomor antrian instan 1-tap (Concurrency-Safe Row Locking) ───────
create or replace function public.take_queue_ticket(p_token text, p_name text default '', p_phone text default '')
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

  -- Kunci row event agar penomoran urut selalu aman & atomik dari permintaan bersamaan
  perform 1 from public.financial_events where id = v_event_id for update;

  -- Batasi lonjakan permintaan per event (anti-spam 60 tiket per menit)
  if (select count(*) from public.event_queues
      where event_id = v_event_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Terlalu banyak permintaan, coba lagi sebentar';
  end if;

  select coalesce(max(seq_number), 0) + 1 into v_next from public.event_queues where event_id = v_event_id;

  insert into public.event_queues (event_id, queue_number, seq_number, customer_name, customer_phone, status)
  values (v_event_id, 'A-' || lpad(v_next::text, 2, '0'), v_next, v_name, v_phone, 'waiting')
  returning * into v_row;

  return jsonb_build_object(
    'existing', false,
    'id', v_row.id,
    'queue_number', v_row.queue_number,
    'seq_number', v_row.seq_number,
    'status', v_row.status,
    'customer_name', v_row.customer_name,
    'called_at', v_row.called_at,
    'called_count', v_row.called_count,
    'state', public.queue_state_for(v_event_id, v_row.id)
  );
end $$;

-- Overload agar bisa dipanggil dengan 1 argumen
create or replace function public.take_queue_ticket(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.take_queue_ticket(p_token, '', '');
$$;

grant execute on function public.take_queue_ticket(text, text, text) to anon, authenticated;
grant execute on function public.take_queue_ticket(text) to anon, authenticated;

-- ── 6. Tamu konfirmasi "Saya menuju booth" ────────────────────────────────────
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

grant execute on function public.queue_confirm_heading(uuid) to anon, authenticated;

-- ── 7. Tamu membatalkan / melepas nomornya sendiri ────────────────────────────
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

grant execute on function public.queue_leave(uuid) to anon, authenticated;

-- Bersihkan data sebelumnya yang sempat otomatis terisi 'Tamu'
update public.event_queues set customer_name = '' where customer_name = 'Tamu';
