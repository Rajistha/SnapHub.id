-- Jalankan di Supabase SQL Editor (setelah photo_session_live.sql).
-- Pencatatan sesi foto sekarang menempel pada tabel financial_events (daftar event keuangan).

-- 1) Kolom baru di financial_events
alter table public.financial_events
  add column if not exists sessions jsonb not null default '[]'::jsonb,
  add column if not exists session_notes text not null default '',
  add column if not exists share_per_voucher integer not null default 0,
  add column if not exists share_token text unique,
  -- selisih manual antara pemasukan di keuangan dan total sesi foto
  add column if not exists income_adjustment numeric not null default 0;

-- 2) Penanda pengeluaran otomatis di transactions (satu baris sharing profit per event)
alter table public.transactions
  add column if not exists auto_source text;

create unique index if not exists transactions_auto_source_unique
  on public.transactions (event_id, auto_source)
  where auto_source is not null;

-- 2b) Event lama yang belum ada di financial_events dibuat otomatis (tanggal = tanggal event,
--     atau tanggal dibuat bila event lama tidak punya tanggal).
insert into public.financial_events (name, date, income)
select pe.name, coalesce(pe.date, pe.created_at::date), 0
from public.photo_session_events pe
where not exists (
  select 1 from public.financial_events fe
  where lower(trim(fe.name)) = lower(trim(pe.name))
);

-- 3) Pindahkan data lama dari photo_session_events (dicocokkan lewat nama event)
with src as (
  select
    fe.id as fe_id,
    pe.sessions::jsonb as sessions,
    coalesce(pe.notes, '') as notes,
    coalesce(pe.share_per_voucher, 0) as share_per_voucher,
    pe.share_token,
    (
      select coalesce(sum(
        (case when coalesce((s->>'no_voucher')::boolean, false) then 35000 else 30000 end)
        + coalesce((s->>'prints')::int, 0) * 10000
      ), 0)
      from jsonb_array_elements(pe.sessions::jsonb) s
    ) as total
  from public.photo_session_events pe
  join public.financial_events fe on lower(trim(fe.name)) = lower(trim(pe.name))
)
update public.financial_events fe
set sessions = src.sessions,
    session_notes = src.notes,
    share_per_voucher = src.share_per_voucher,
    share_token = src.share_token,
    -- pemasukan yang sudah diisi tetap dipertahankan (selisihnya jadi penyesuaian)
    income_adjustment = case when coalesce(fe.income, 0) = 0 then 0 else fe.income - src.total end,
    income = case when coalesce(fe.income, 0) = 0 then src.total else fe.income end
from src
where fe.id = src.fe_id
  and jsonb_array_length(fe.sessions) = 0;

-- 3b) Event tanpa sesi tapi pemasukannya sudah diisi manual: simpan sebagai penyesuaian
--     supaya tidak tertimpa saat sesi pertama dicatat.
update public.financial_events
set income_adjustment = income
where jsonb_array_length(sessions) = 0
  and coalesce(income, 0) > 0
  and income_adjustment = 0;

-- 4) Buat pengeluaran sharing profit untuk event yang sudah punya nominal
insert into public.transactions (date, type, description, amount, event_id, auto_source)
select
  current_date,
  'event_expense',
  'Sharing profit (otomatis)',
  (select count(*) from jsonb_array_elements(fe.sessions) s
     where not coalesce((s->>'no_voucher')::boolean, false)) * fe.share_per_voucher,
  fe.id,
  'sharing_profit'
from public.financial_events fe
where fe.share_per_voucher > 0
on conflict do nothing;

-- 5) Halaman live customer sekarang membaca dari financial_events
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

-- Cek event lama yang TIDAK ketemu pasangannya di financial_events (nama beda):
-- select pe.name from public.photo_session_events pe
-- where not exists (select 1 from public.financial_events fe
--                   where lower(trim(fe.name)) = lower(trim(pe.name)));
