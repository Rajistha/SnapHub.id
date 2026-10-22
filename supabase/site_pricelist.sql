-- Jalankan di Supabase SQL Editor.
-- Penyimpanan pengaturan situs (dipakai untuk pricelist yang bisa diedit dari admin).
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- Semua pengunjung boleh membaca (pricelist tampil di website).
drop policy if exists "site_settings read" on public.site_settings;
create policy "site_settings read" on public.site_settings
  for select using (true);

-- Hanya admin yang login boleh menulis.
drop policy if exists "site_settings write" on public.site_settings;
create policy "site_settings write" on public.site_settings
  for all to authenticated using (true) with check (true);
