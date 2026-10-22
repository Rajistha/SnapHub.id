-- Jalankan di Supabase SQL Editor.
alter table public.photo_session_events
  add column if not exists share_per_voucher integer not null default 0,
  add column if not exists share_token text unique;

-- Halaman live customer: baca event lewat token tanpa login.
-- Hanya mengembalikan data yang boleh dilihat customer (tanpa harga/print/keuntungan).
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
       from jsonb_array_elements(e.sessions::jsonb) s),
      '[]'::jsonb)
  )
  from public.photo_session_events e
  where p_token is not null and e.share_token = p_token
  limit 1;
$$;

grant execute on function public.get_live_event(text) to anon, authenticated;
