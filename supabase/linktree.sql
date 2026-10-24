-- ============================================================================
-- SnapHub Linktree & Bio Links Configuration
-- ============================================================================
-- Secara bawaan, data Linktree (profil & daftar link kegiatan) disimpan 
-- pada tabel 'site_settings' dengan key = 'linktree'.
--
-- Tabel 'site_settings' sudah ada dan memiliki policy RLS:
-- - Public read (pengunjung website bisa membaca link)
-- - Authenticated write (hanya admin login yang bisa mengubah/menambah link)
--
-- File ini menyediakan script SQL untuk memastikan tabel 'site_settings'
-- siap digunakan atau jika Anda ingin membuat tabel tersendiri di masa mendatang.
-- ============================================================================

-- 1. Pastikan tabel site_settings sudah ada
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- 2. Policy untuk membaca (semua pengunjung boleh baca)
drop policy if exists "site_settings read" on public.site_settings;
create policy "site_settings read" on public.site_settings
  for select using (true);

-- 3. Policy untuk menulis (hanya admin authenticated)
drop policy if exists "site_settings write" on public.site_settings;
create policy "site_settings write" on public.site_settings
  for all to authenticated using (true) with check (true);

-- 4. Pastikan storage bucket 'client-logos' public dan dapat diakses untuk logo kegiatan
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do update set public = true;

-- 5. RPC Tambahan untuk mencatat jumlah klik (opsional/opsi cepat)
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
  if current_val is null or current_val->'links' is null then
    return;
  end if;

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
