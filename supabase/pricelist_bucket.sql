-- Bucket khusus file pricelist (terpisah dari client-logos).
-- Jalankan sekali di Supabase SQL Editor (aman diulang).

insert into storage.buckets (id, name, public, file_size_limit)
values ('pricelist', 'pricelist', true, 20 * 1024 * 1024)
on conflict (id) do update set public = true, file_size_limit = 20 * 1024 * 1024;

-- Semua orang boleh membaca (link publik snaphub.my.id/pricelist.pdf)
drop policy if exists "pricelist public read" on storage.objects;
create policy "pricelist public read" on storage.objects
  for select using (bucket_id = 'pricelist');

-- Hanya admin login yang boleh upload / ganti / hapus
drop policy if exists "pricelist admin write" on storage.objects;
create policy "pricelist admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'pricelist')
  with check (bucket_id = 'pricelist');
