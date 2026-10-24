-- ============================================================================
-- SnapHub — Master All-in-One SQL Sync (Sesi Foto, Antrian, Bio Link & MoU)
-- Jalankan SELURUH script ini di SQL Editor Supabase untuk memastikan
-- semua fitur (Antrian, Kelola Sesi, MoU Event, dan Link Bio) 100% SINKRON!
-- Aman dijalankan berulang kali (Idempotent).
-- ============================================================================

-- ============================================================================
-- 1. TABEL FINANCIAL_EVENTS (MoU & Tarif Khusus Per Event)
-- ============================================================================
alter table public.financial_events
  add column if not exists voucher_price integer not null default 30000,
  add column if not exists no_voucher_price integer not null default 35000,
  add column if not exists print_price integer not null default 10000,
  add column if not exists share_per_voucher integer not null default 0,
  add column if not exists share_token text unique,
  add column if not exists crew_token text unique;

-- Izin anon (tamu/publik) membaca data dasar event (nama, tanggal) yang memiliki token
drop policy if exists "Anon read basic financial_events" on public.financial_events;
create policy "Anon read basic financial_events"
  on public.financial_events
  for select
  using (share_token is not null);

-- ============================================================================
-- 2. TABEL EVENT_QUEUES (Sistem Antrian Cerdas)
-- ============================================================================
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

-- Index performa antrian
create index if not exists idx_event_queues_event_seq on public.event_queues(event_id, seq_number);
create index if not exists idx_event_queues_status on public.event_queues(event_id, status);

-- Aktifkan Realtime Supabase untuk tabel antrian
alter table public.event_queues replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_queues'
  ) then
    alter publication supabase_realtime add table public.event_queues;
  end if;
end $$;

-- Kebijakan RLS Antrian
alter table public.event_queues enable row level security;

drop policy if exists "Anon read event_queues" on public.event_queues;
create policy "Anon read event_queues" on public.event_queues for select using (true);

drop policy if exists "Anon insert event_queues" on public.event_queues;
create policy "Anon insert event_queues" on public.event_queues for insert with check (true);

drop policy if exists "Auth update event_queues" on public.event_queues;
create policy "Auth update event_queues" on public.event_queues for update using (true);

drop policy if exists "Auth delete event_queues" on public.event_queues;
create policy "Auth delete event_queues" on public.event_queues for delete using (true);

-- ============================================================================
-- 3. FUNGSI RPC ANTRIAN (Security Definer - Aman & Cepat)
-- ============================================================================

-- Fungsi membaca event antrian untuk tamu & layar display TV
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

-- Fungsi atomik ambil tiket antrian (otomatis deteksi event via id atau token)
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

  -- Jika event_id belum ada, temukan lewat token
  if (v_event_id is null or v_event_id = 0) and p_token is not null then
    select id into v_event_id
    from public.financial_events
    where share_token = p_token or id::text = p_token
    limit 1;
  end if;

  if v_event_id is null then
    raise exception 'Event tidak ditemukan atau link tidak valid';
  end if;

  -- Kunci baris event supaya nomor urut tidak ganda saat diklik bersamaan
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

-- ============================================================================
-- 4. FUNGSI HITUNG KEUANGAN SESUAI MOU EVENT (recalc_event_finance)
-- ============================================================================
create or replace function public.recalc_event_finance(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.financial_events%rowtype;
  v_total numeric;
  v_vouchers integer;
  v_sharing numeric;
  v_voucher_price integer;
  v_novoucher_price integer;
  v_print_price integer;
begin
  select * into ev from public.financial_events where id = p_event_id;
  if not found then return; end if;

  v_voucher_price := coalesce(ev.voucher_price, 30000);
  v_novoucher_price := coalesce(ev.no_voucher_price, 35000);
  v_print_price := coalesce(ev.print_price, 10000);

  -- Hitung total pemasukan berdasarkan tarif MoU spesifik event ini
  select
    coalesce(sum(
      (case when coalesce((s->>'no_voucher')::boolean, false)
            then v_novoucher_price
            else v_voucher_price
       end)
      + coalesce((s->>'prints')::int, 0) * v_print_price), 0),
    count(*) filter (where not coalesce((s->>'no_voucher')::boolean, false))
  into v_total, v_vouchers
  from jsonb_array_elements(ev.sessions) s;

  -- Perbarui kolom income di financial_events
  update public.financial_events
  set income = v_total + coalesce(income_adjustment, 0)
  where id = p_event_id;

  -- Hitung bagi hasil (sharing profit)
  v_sharing := v_vouchers * coalesce(ev.share_per_voucher, 0);

  -- Sinkronisasi baris transaksi sharing profit otomatis
  update public.transactions
  set amount = v_sharing
  where event_id = p_event_id and auto_source = 'sharing_profit';

  if not found and v_sharing > 0 then
    insert into public.transactions (date, type, description, amount, event_id, auto_source)
    values (current_date, 'event_expense', 'Sharing profit (otomatis)', v_sharing, p_event_id, 'sharing_profit');
  end if;
end $$;

revoke execute on function public.recalc_event_finance(bigint) from public, anon, authenticated;

-- ============================================================================
-- 5. TABEL SITE_SETTINGS & BIO LINK (Linktree)
-- ============================================================================
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings read" on public.site_settings;
create policy "site_settings read" on public.site_settings for select using (true);

drop policy if exists "site_settings write" on public.site_settings;
create policy "site_settings write" on public.site_settings for all to authenticated using (true) with check (true);

-- Storage bucket untuk client logos
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do update set public = true;

-- RPC hitung klik link
create or replace function public.increment_link_clicks(p_link_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_val jsonb;
  links_arr jsonb;
  updated_arr jsonb;
  elem jsonb;
begin
  select value into current_val from public.site_settings where key = 'linktree';
  if current_val is null or current_val->'links' is null then return; end if;

  links_arr := current_val->'links';
  updated_arr := '[]'::jsonb;

  for elem in select * from jsonb_array_elements(links_arr)
  loop
    if elem->>'id' = p_link_id then
      elem := jsonb_set(elem, '{clicks}', to_jsonb(coalesce((elem->>'clicks')::int, 0) + 1));
    end if;
    updated_arr := updated_arr || jsonb_build_array(elem);
  end loop;

  update public.site_settings
  set value = jsonb_set(current_val, '{links}', updated_arr),
      updated_at = now()
  where key = 'linktree';
end;
$$;

grant execute on function public.increment_link_clicks(text) to anon, authenticated;
