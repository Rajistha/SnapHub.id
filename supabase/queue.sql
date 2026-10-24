-- ============================================================================
-- SnapHub — Migrasi Sistem Antrian Cerdas (Smart Queue System)
-- Jalankan di SQL Editor Supabase.
-- Aman dijalankan ulang (idempotent).
-- ============================================================================

-- 1. Tabel antrian tamu per event
create table if not exists public.event_queues (
  id uuid primary key default gen_random_uuid(),
  event_id bigint not null references public.financial_events(id) on delete cascade,
  queue_number text not null,               -- 'A-01', 'A-02', dst.
  seq_number int not null,                  -- 1, 2, 3...
  customer_name text not null,              -- Nama tamu
  customer_phone text not null,             -- No WhatsApp
  status text not null default 'waiting',   -- 'waiting', 'called', 'serving', 'completed', 'skipped'
  wa_notified boolean default false,        -- Flag sudah kirim notifikasi WA
  called_count int default 0,
  created_at timestamptz default now(),
  called_at timestamptz,
  completed_at timestamptz
);

-- Index untuk performa
create index if not exists idx_event_queues_event_seq on public.event_queues(event_id, seq_number);
create index if not exists idx_event_queues_status on public.event_queues(event_id, status);

-- 2. Aktifkan Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_queues'
  ) then
    alter publication supabase_realtime add table public.event_queues;
  end if;
end $$;

-- 3. Row Level Security (RLS)
alter table public.event_queues enable row level security;

drop policy if exists "Anon read event_queues" on public.event_queues;
create policy "Anon read event_queues" on public.event_queues for select using (true);

drop policy if exists "Anon insert event_queues" on public.event_queues;
create policy "Anon insert event_queues" on public.event_queues for insert with check (true);

drop policy if exists "Auth update event_queues" on public.event_queues;
create policy "Auth update event_queues" on public.event_queues for update using (true);

drop policy if exists "Auth delete event_queues" on public.event_queues;
create policy "Auth delete event_queues" on public.event_queues for delete using (true);

-- Izinkan anon membaca info dasar event (nama, tanggal) yang memiliki share_token
drop policy if exists "Anon read basic financial_events" on public.financial_events;
create policy "Anon read basic financial_events"
  on public.financial_events
  for select
  using (share_token is not null);

-- 4. Fungsi Mengambil Info Event Antrian (Tamu & Layar Display TV)
create or replace function public.get_queue_event(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'date', e.date,
    'share_token', e.share_token
  )
  from public.financial_events e
  where p_token is not null and (e.share_token = p_token or e.id::text = p_token)
  limit 1;
$$;

grant execute on function public.get_queue_event(text) to anon, authenticated;

-- 5. Fungsi Atomik Ambil Nomor Antrian Baru (Mendukung event_id dan token)
create or replace function public.take_queue_ticket(
  p_event_id bigint,
  p_name text,
  p_phone text,
  p_token text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := p_event_id;
  v_next_seq int;
  v_code text;
  v_new_row public.event_queues%rowtype;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Nama wajib diisi';
  end if;

  -- Jika event_id kosong/null, cari berdasarkan p_token
  if (v_event_id is null or v_event_id = 0) and p_token is not null then
    select id into v_event_id
    from public.financial_events
    where share_token = p_token or id::text = p_token
    limit 1;
  end if;

  if v_event_id is null then
    raise exception 'Event tidak ditemukan atau link tidak valid';
  end if;

  -- Kunci baris event supaya urutan nomor tidak ganda saat diklik bersamaan
  perform 1 from public.financial_events where id = v_event_id for update;

  select coalesce(max(seq_number), 0) + 1 into v_next_seq
  from public.event_queues
  where event_id = v_event_id;

  v_code := 'A-' || lpad(v_next_seq::text, 2, '0');

  insert into public.event_queues (
    event_id,
    queue_number,
    seq_number,
    customer_name,
    customer_phone,
    status
  ) values (
    v_event_id,
    v_code,
    v_next_seq,
    trim(p_name),
    trim(p_phone),
    'waiting'
  ) returning * into v_new_row;

  return to_jsonb(v_new_row);
end;
$$;

grant execute on function public.take_queue_ticket(bigint, text, text, text) to anon, authenticated;
