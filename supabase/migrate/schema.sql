-- ============================================================================
-- SnapHub — skema lengkap untuk project Supabase BARU
-- Jalankan SEKALI di SQL Editor project baru, SEBELUM menjalankan migrate-data.mjs.
-- Aman dijalankan ulang (memakai "if not exists").
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Tabel ───────────────────────────────────────────────────────────────────

-- Event keuangan + pencatatan sesi foto
create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  income numeric not null default 0,
  is_locked boolean not null default false,
  -- pencatatan sesi foto
  sessions jsonb not null default '[]'::jsonb,
  session_notes text not null default '',
  share_per_voucher integer not null default 0,
  share_token text unique,
  -- selisih manual antara pemasukan keuangan dan total sesi foto
  income_adjustment numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null,                       -- 'event_expense'
  description text not null default '',
  amount numeric not null default 0,
  event_id uuid references public.financial_events(id) on delete cascade,
  auto_source text,                         -- 'sharing_profit' untuk baris otomatis
  created_at timestamptz not null default now()
);

create unique index if not exists transactions_auto_source_unique
  on public.transactions (event_id, auto_source)
  where auto_source is not null;

create table if not exists public.booked_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  event_name text not null default 'Event Booked',
  created_at timestamptz not null default now()
);

-- Target, pengeluaran operasional, dll. (value berisi angka atau JSON dalam bentuk teks)
create table if not exists public.settings (
  key text primary key,
  value text,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  category text,
  title text,
  alt text,
  span text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  event_type text,
  rating integer not null default 5,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.client_logos (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  logo_url text not null,
  instagram_url text,
  created_at timestamptz not null default now()
);

-- Pricelist & syarat ketentuan yang bisa diedit dari admin
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Data yang tampil di website: boleh dibaca siapa saja, ditulis admin (login) saja.
-- Data keuangan: hanya admin (login).

do $$
declare
  t text;
begin
  foreach t in array array['booked_dates','gallery_images','reviews','client_logos','site_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (true)', t, t);
  end loop;

  foreach t in array array['financial_events','transactions','settings','booked_dates','gallery_images','reviews','client_logos','site_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s admin all" on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- ── Link live customer ──────────────────────────────────────────────────────
-- Dibaca tanpa login lewat token. Hanya mengembalikan data yang boleh dilihat customer.
create or replace function public.get_live_event(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', e.name,
    'date', e.date,
    'share_per_voucher', e.share_per_voucher,
    'sessions', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', s->>'id',
          'no_voucher', coalesce((s->>'no_voucher')::boolean, false),
          'created_at', s->>'created_at'))
       from jsonb_array_elements(e.sessions) s),
      '[]'::jsonb)
  )
  from public.financial_events e
  where p_token is not null and e.share_token = p_token
  limit 1;
$$;

grant execute on function public.get_live_event(text) to anon, authenticated;

-- ── Storage (gambar galeri & logo klien) ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true), ('client-logos', 'client-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "snaphub storage public read" on storage.objects;
create policy "snaphub storage public read" on storage.objects
  for select using (bucket_id in ('gallery', 'client-logos'));

drop policy if exists "snaphub storage admin write" on storage.objects;
create policy "snaphub storage admin write" on storage.objects
  for all to authenticated
  using (bucket_id in ('gallery', 'client-logos'))
  with check (bucket_id in ('gallery', 'client-logos'));
