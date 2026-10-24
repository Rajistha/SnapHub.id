-- Jalankan di Supabase SQL Editor.
-- Migrasi Sistem Antrian Cerdas SnapHub (Smart Queue System)

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

-- Index untuk filter cepat
create index if not exists idx_event_queues_event_seq on public.event_queues(event_id, seq_number);
create index if not exists idx_event_queues_status on public.event_queues(event_id, status);

-- Aktifkan Realtime
alter publication supabase_realtime add table public.event_queues;

-- Kebijakan RLS (Row Level Security)
alter table public.event_queues enable row level security;

-- Anon boleh membaca antrian dan insert antrian (tamu scan QR ambil nomor)
create policy "Anon read event_queues" on public.event_queues for select using (true);
create policy "Anon insert event_queues" on public.event_queues for insert with check (true);

-- Authenticated (admin & kru) boleh update dan delete
create policy "Auth update event_queues" on public.event_queues for update using (true);
create policy "Auth delete event_queues" on public.event_queues for delete using (true);

-- Fungsi Atomik Ambil Nomor Antrian Baru (Anon / Tamu)
create or replace function public.take_queue_ticket(
  p_event_id bigint,
  p_name text,
  p_phone text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_seq int;
  v_code text;
  v_new_row public.event_queues%rowtype;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Nama wajib diisi';
  end if;

  -- Kunci baris event supaya urutan nomor tidak ganda saat diklik bersamaan
  perform 1 from public.financial_events where id = p_event_id for update;

  select coalesce(max(seq_number), 0) + 1 into v_next_seq
  from public.event_queues
  where event_id = p_event_id;

  v_code := 'A-' || lpad(v_next_seq::text, 2, '0');

  insert into public.event_queues (
    event_id,
    queue_number,
    seq_number,
    customer_name,
    customer_phone,
    status
  ) values (
    p_event_id,
    v_code,
    v_next_seq,
    trim(p_name),
    trim(p_phone),
    'waiting'
  ) returning * into v_new_row;

  return to_jsonb(v_new_row);
end;
$$;

grant execute on function public.take_queue_ticket(bigint, text, text) to anon, authenticated;
