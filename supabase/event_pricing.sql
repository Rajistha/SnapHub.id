-- ============================================================================
-- SnapHub — MoU & Tarif Khusus Per Event (Custom Pricing per Event)
-- Jalankan script ini di SQL Editor Supabase untuk mendukung tarif MoU yang
-- berbeda di setiap event (Voucher, Non-Voucher, Print, dan Sharing Profit).
-- ============================================================================

-- 1. Tambahkan kolom tarif MoU ke tabel financial_events jika belum ada
alter table public.financial_events
  add column if not exists voucher_price integer not null default 30000,
  add column if not exists no_voucher_price integer not null default 35000,
  add column if not exists print_price integer not null default 5000;

-- 2. Perbarui fungsi hitung keuangan event agar menggunakan tarif spesifik masing-masing event
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

  -- Hitung total pemasukan berdasarkan tarif MoU event ini
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

  -- Sinkronisasi baris transaksi sharing profit
  update public.transactions
  set amount = v_sharing
  where event_id = p_event_id and auto_source = 'sharing_profit';

  if not found and v_sharing > 0 then
    insert into public.transactions (date, type, description, amount, event_id, auto_source)
    values (current_date, 'event_expense', 'Sharing profit (otomatis)', v_sharing, p_event_id, 'sharing_profit');
  end if;
end $$;

revoke execute on function public.recalc_event_finance(bigint) from public, anon, authenticated;
