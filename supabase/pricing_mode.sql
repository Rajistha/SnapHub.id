-- ============================================================================
-- SnapHub — Mode tarif per event: 'voucher' atau 'percent'
-- Jalankan di SQL Editor Supabase (setelah event_pricing.sql & crew_link.sql). Aman diulang.
--
--   voucher : seperti sebelumnya (tarif voucher / non-voucher, sharing Rp per voucher)
--   percent : satu tarif per sesi (tanpa voucher), sharing profit = persentase dari pemasukan sesi
-- ============================================================================

alter table public.financial_events
  add column if not exists pricing_mode text not null default 'voucher',
  add column if not exists session_price integer not null default 45000,
  add column if not exists share_percent numeric(5,2) not null default 15;

-- Default harga sesi mode persentase = 45.000 (kolom lama yang belum pernah diatur ikut disesuaikan).
alter table public.financial_events alter column session_price set default 45000;
update public.financial_events set session_price = 45000 where pricing_mode = 'voucher' and session_price = 30000;
-- Default sharing mode persentase = 15% (hanya event mode voucher yang belum pernah diatur).
alter table public.financial_events alter column share_percent set default 15;
update public.financial_events set share_percent = 15 where pricing_mode = 'voucher' and share_percent = 0;

alter table public.financial_events drop constraint if exists financial_events_pricing_mode_chk;
alter table public.financial_events add constraint financial_events_pricing_mode_chk
  check (pricing_mode in ('voucher', 'percent'));

alter table public.financial_events drop constraint if exists financial_events_share_percent_chk;
alter table public.financial_events add constraint financial_events_share_percent_chk
  check (share_percent between 0 and 100);

-- ── Hitung ulang pemasukan & sharing profit sesuai mode event ───────────────
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

  if coalesce(ev.pricing_mode, 'voucher') = 'percent' then
    -- Satu tarif per sesi; sharing = persentase dari pemasukan sesi.
    select coalesce(sum(coalesce(ev.session_price, 45000)
                        + coalesce((s->>'prints')::int, 0) * v_print_price), 0)
    into v_total
    from jsonb_array_elements(ev.sessions) s;

    v_sharing := round(v_total * coalesce(ev.share_percent, 0) / 100);
  else
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

    v_sharing := v_vouchers * coalesce(ev.share_per_voucher, 0);
  end if;

  update public.financial_events
  set income = v_total + coalesce(income_adjustment, 0)
  where id = p_event_id;

  update public.transactions
  set amount = v_sharing
  where event_id = p_event_id and auto_source = 'sharing_profit';

  if not found and v_sharing > 0 then
    insert into public.transactions (date, type, description, amount, event_id, auto_source)
    values (current_date, 'event_expense', 'Sharing profit (otomatis)', v_sharing, p_event_id, 'sharing_profit');
  end if;
end $$;

revoke execute on function public.recalc_event_finance(bigint) from public, anon, authenticated;

-- ── Halaman live customer: sertakan mode & nominal sharing ──────────────────
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
    'pricing_mode', e.pricing_mode,
    'share_percent', e.share_percent,
    'sharing_amount', case when e.pricing_mode = 'percent' then
        round((select coalesce(sum(e.session_price + coalesce((s->>'prints')::int, 0) * coalesce(e.print_price, 10000)), 0)
               from jsonb_array_elements(e.sessions) s) * e.share_percent / 100)
      else null end,
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

-- ── Link crew: sertakan mode & tarif sesi agar tombol voucher disembunyikan ─
create or replace function public.get_crew_event(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', e.name,
    'date', e.date,
    'pricing_mode', e.pricing_mode,
    'session_price', e.session_price,
    'sessions', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', s->>'id',
          'no_voucher', coalesce((s->>'no_voucher')::boolean, false),
          'prints', coalesce((s->>'prints')::int, 0),
          'created_at', s->>'created_at') order by ord)
       from jsonb_array_elements(e.sessions) with ordinality as t(s, ord)),
      '[]'::jsonb)
  )
  from public.financial_events e
  where p_token is not null and e.crew_token = p_token
  limit 1;
$$;

-- Hitung ulang event yang sudah ada (tidak mengubah apa pun bila semua event masih mode voucher).
do $$
declare r record;
begin
  for r in select id from public.financial_events where pricing_mode = 'percent' loop
    perform public.recalc_event_finance(r.id);
  end loop;
end $$;
