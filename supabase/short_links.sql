-- ============================================================================
-- SnapHub — Shortener link (snaphub.my.id/<slug>)
-- Dikelola di app.snaphub.my.id/short. Jalankan di SQL Editor Supabase (aman diulang).
-- ============================================================================

create table if not exists public.short_links (
  slug text primary key,
  url text not null,
  title text,
  is_active boolean not null default true,
  clicks bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slug hanya huruf kecil/angka/-/_ dan tidak boleh bentrok dengan halaman situs.
alter table public.short_links drop constraint if exists short_links_slug_chk;
alter table public.short_links add constraint short_links_slug_chk
  check (slug ~ '^[a-z0-9][a-z0-9_-]{1,39}$'
         and slug not in ('admin','queue','links','linktree','bio','sesi','sesi-foto','live','crew','short','app','api','assets'));

-- Tujuan hanya http(s): mencegah javascript:/data: sebagai target redirect.
alter table public.short_links drop constraint if exists short_links_url_chk;
alter table public.short_links add constraint short_links_url_chk
  check (url ~* '^https?://' and char_length(url) <= 2048);

alter table public.short_links enable row level security;
drop policy if exists "Admin all short_links" on public.short_links;
create policy "Admin all short_links" on public.short_links
  for all to authenticated using (true) with check (true);
revoke all on public.short_links from anon;

-- Dipakai halaman redirect publik: mengembalikan URL tujuan dan menambah hitungan klik secara atomik.
-- Tabel tetap tertutup untuk anon, jadi daftar link tidak bisa di-scrape.
create or replace function public.resolve_short_link(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  if p_slug is null or length(p_slug) > 40 then return null; end if;
  update public.short_links
  set clicks = clicks + 1
  where slug = lower(p_slug) and is_active
  returning url into v_url;
  return v_url;
end $$;

grant execute on function public.resolve_short_link(text) to anon, authenticated;
