-- ============================================================================
-- SnapHub — QR antrian sekali pakai (satu scan = satu nomor)
-- Jalankan di SQL Editor Supabase SETELAH security_hardening.sql dan queue_flow.sql. Aman diulang.
--
-- Cara kerja:
--   * Layar TV / halaman QR menampilkan QR berisi "gate" (token sekali pakai).
--   * Saat tamu membuka link QR, gate langsung ditandai terpakai (diklaim) dan server membuat
--     gate baru, sehingga QR di layar otomatis berganti. Tamu mendapat "sesi" pribadi.
--   * Satu sesi hanya bisa mengambil satu nomor. Mau antri lagi = harus scan QR lagi.
--   * Mengambil nomor lewat link permanen event DITUTUP (fungsi lama dihapus).
-- ============================================================================

create table if not exists public.queue_entries (
  gate text primary key,
  event_id bigint not null references public.financial_events(id) on delete cascade,
  session uuid not null unique default gen_random_uuid(),
  claimed_at timestamptz,
  ticket_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_queue_entries_event on public.queue_entries(event_id, claimed_at);

-- Tabel hanya diakses lewat fungsi di bawah (security definer); tidak ada akses langsung.
alter table public.queue_entries enable row level security;
revoke all on public.queue_entries from anon, authenticated;

-- ── Papan antrian (dipakai bersama oleh TV dan tamu) ────────────────────────
create or replace function public.queue_state_for(p_event_id bigint, p_ticket_id uuid)
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
  v_avg numeric;
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

  -- Estimasi per sesi dipatok 5 menit (300 detik) agar ringan & tidak melenceng.
  v_avg := 300;

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

revoke execute on function public.queue_state_for(bigint, uuid) from public, anon, authenticated;

-- TV / halaman QR (memakai token permanen event, hanya diketahui kru)
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

grant execute on function public.get_queue_state(text, uuid) to anon, authenticated;

-- Tamu (memakai sesi pribadi dari hasil scan)
create or replace function public.get_entry_state(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
begin
  select * into v_entry from public.queue_entries where session = p_session and claimed_at is not null;
  if not found then return null; end if;
  return public.queue_state_for(v_entry.event_id, v_entry.ticket_id);
end $$;

grant execute on function public.get_entry_state(uuid) to anon, authenticated;

-- ── QR sekarang: gate yang belum diklaim (dibuat bila belum ada) ────────────
create or replace function public.queue_current_gate(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_event_id(p_token);
  v_gate text;
begin
  if v_event_id is null then return null; end if;

  select gate into v_gate from public.queue_entries
  where event_id = v_event_id and claimed_at is null
  order by created_at desc limit 1;

  if v_gate is null then
    -- bersihkan gate lama yang sudah terpakai agar tabel tidak menumpuk
    delete from public.queue_entries where event_id = v_event_id and claimed_at < now() - interval '3 days';
    v_gate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into public.queue_entries (gate, event_id) values (v_gate, v_event_id);
  end if;
  return v_gate;
end $$;

grant execute on function public.queue_current_gate(text) to anon, authenticated;

-- ── Tamu membuka link QR: gate diklaim, QR baru langsung dibuat ─────────────
create or replace function public.queue_claim_gate(p_gate text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
  v_ev_id bigint;
  v_new_gate text;
begin
  if p_gate is null or length(p_gate) not between 8 and 64 then return null; end if;

  select * into v_entry from public.queue_entries
  where gate = p_gate and claimed_at is null
  for update;

  if not found then
    -- Dukung fallback bila link yang dipindai adalah queue_token event langsung
    v_ev_id := public.queue_event_id(p_gate);
    if v_ev_id is not null then
      v_new_gate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
      insert into public.queue_entries (gate, event_id, claimed_at)
      values (v_new_gate, v_ev_id, now())
      returning * into v_entry;
    else
      return null;
    end if;
  else
    -- Batasi lonjakan klaim per event (anti-spam)
    if (select count(*) from public.queue_entries
        where event_id = v_entry.event_id and claimed_at > now() - interval '1 minute') >= 60 then
      raise exception 'Terlalu banyak permintaan, coba lagi sebentar';
    end if;

    update public.queue_entries set claimed_at = now() where gate = p_gate;

    -- QR di layar otomatis berganti ke gate baru
    insert into public.queue_entries (gate, event_id)
    values (substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), v_entry.event_id);
  end if;

  -- Kembalikan sesi sekaligus data antrian awal agar HP tamu tidak perlu request 2 kali (muat instan)
  return jsonb_build_object(
    'session', v_entry.session,
    'state', public.queue_state_for(v_entry.event_id, null)
  );
end $$;

grant execute on function public.queue_claim_gate(text) to anon, authenticated;

-- ── Ambil nomor: hanya lewat sesi hasil scan, satu sesi = satu nomor ────────
drop function if exists public.take_queue_ticket(uuid, text);
drop function if exists public.take_queue_ticket(uuid);
drop function if exists public.take_queue_ticket(text, text, text);
drop function if exists public.take_queue_ticket(text, text);

-- Nama tamu bersifat opsional (default 'Tamu'), tiket tetap terbit secara 1-tap instan
alter table public.event_queues alter column customer_name set default 'Tamu';

create or replace function public.take_queue_ticket(p_session uuid, p_name text default 'Tamu')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.queue_entries%rowtype;
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 40);
  v_next int;
  v_row public.event_queues%rowtype;
begin
  select * into v_entry from public.queue_entries
  where session = p_session and claimed_at is not null
  for update;
  if not found then raise exception 'Sesi tidak valid. Pindai QR lagi.'; end if;

  -- Sesi ini sudah punya tiket: kembalikan yang sama (kirim ulang tidak membuat tiket ganda)
  if v_entry.ticket_id is not null then
    select * into v_row from public.event_queues where id = v_entry.ticket_id;
    if found then
      return jsonb_build_object('existing', true, 'id', v_row.id, 'queue_number', v_row.queue_number,
        'seq_number', v_row.seq_number, 'status', v_row.status, 'customer_name', v_row.customer_name,
        'called_at', v_row.called_at, 'called_count', v_row.called_count,
        'state', public.queue_state_for(v_entry.event_id, v_row.id));
    end if;
  end if;

  if (select count(*) from public.event_queues
      where event_id = v_entry.event_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Terlalu banyak permintaan, coba lagi sebentar';
  end if;

  select coalesce(max(seq_number), 0) + 1 into v_next from public.event_queues where event_id = v_entry.event_id;

  if length(v_name) = 0 then v_name := 'Tamu'; end if;

  insert into public.event_queues (event_id, queue_number, seq_number, customer_name, customer_phone, status)
  values (v_entry.event_id, 'A-' || lpad(v_next::text, 2, '0'), v_next, v_name, '', 'waiting')
  returning * into v_row;

  update public.queue_entries set ticket_id = v_row.id where session = p_session;

  return jsonb_build_object('existing', false, 'id', v_row.id, 'queue_number', v_row.queue_number,
    'seq_number', v_row.seq_number, 'status', v_row.status, 'customer_name', v_row.customer_name,
    'called_at', v_row.called_at, 'called_count', v_row.called_count,
    'state', public.queue_state_for(v_entry.event_id, v_row.id));
end $$;

grant execute on function public.take_queue_ticket(uuid, text) to anon, authenticated;
