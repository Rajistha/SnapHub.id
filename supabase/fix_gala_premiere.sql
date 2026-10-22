-- Sambungkan data sesi "GALA PREMIERE BEM FILKOM" (catatan lama) ke event keuangan
-- "Gala Premiere BEM FILKOM Universitas Brawijaya". Jalankan SEKALI di Supabase SQL Editor.
-- (Jangan jalankan ulang seluruh finance_photo_session.sql, karena langkah 2b akan membuat event duplikat.)

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
  join public.financial_events fe
    on pe.name ilike 'gala premiere%' and fe.name ilike 'gala premiere%'
)
update public.financial_events fe
set sessions = src.sessions,
    session_notes = src.notes,
    share_per_voucher = src.share_per_voucher,
    share_token = src.share_token,
    income_adjustment = case when coalesce(fe.income, 0) = 0 then 0 else fe.income - src.total end,
    income = case when coalesce(fe.income, 0) = 0 then src.total else fe.income end
from src
where fe.id = src.fe_id
  and jsonb_array_length(fe.sessions) = 0;

-- Pengeluaran sharing profit otomatis (jika nominal sharing sudah diatur)
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
where fe.name ilike 'gala premiere%' and fe.share_per_voucher > 0
on conflict do nothing;

-- Cek hasil:
-- select name, jsonb_array_length(sessions) as jumlah_sesi, income from public.financial_events where name ilike 'gala premiere%';
