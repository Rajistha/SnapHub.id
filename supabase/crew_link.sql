-- Jalankan di Supabase SQL Editor (setelah finance_photo_session.sql).
-- Link crew: crew bisa mencatat sesi lewat link rahasia tanpa login.
-- Akses hanya lewat fungsi di bawah (token wajib cocok); tabel tetap terkunci untuk anon.

alter table public.financial_events
  add column if not exists crew_token text unique,
  add column if not exists pricing_mode text not null default 'voucher',
  add column if not exists session_price integer not null default 45000,
  add column if not exists share_percent numeric(5,2) not null default 15,
  add column if not exists voucher_price integer not null default 30000,
  add column if not exists no_voucher_price integer not null default 35000,
  add column if not exists print_price integer not null default 10000;

-- Hitung ulang pemasukan event dan pengeluaran "Sharing profit" dari daftar sesi sesuai MoU event.
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

-- Data yang boleh dilihat crew: nama, tanggal, sesi & konfigurasi tarif MoU (mode persentase/voucher).
create or replace function public.get_crew_event(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', e.name,
    'date', e.date,
    'pricing_mode', coalesce(e.pricing_mode, 'voucher'),
    'session_price', coalesce(e.session_price, 45000),
    'voucher_price', coalesce(e.voucher_price, 30000),
    'no_voucher_price', coalesce(e.no_voucher_price, 35000),
    'print_price', coalesce(e.print_price, 10000),
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

-- Tambah satu sesi. p_id dibuat oleh klien, jadi kirim ulang (koneksi putus) tidak membuat sesi ganda.
create or replace function public.crew_add_session(p_token text, p_id text, p_no_voucher boolean, p_prints integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_id bigint;
  v_last_session jsonb;
  v_last_created timestamptz;
begin
  if p_token is null or p_id is null or length(p_id) not between 1 and 64 then
    return null;
  end if;

  -- Kunci baris event supaya dua crew yang mencatat bersamaan tidak saling menimpa
  select id into ev_id from public.financial_events where crew_token = p_token for update;
  if ev_id is null then return null; end if;

  -- Proteksi duplikasi cepat (< 1 detik untuk tipe & print yang identik)
  select s into v_last_session
  from public.financial_events e,
       lateral jsonb_array_elements(e.sessions) s
  where e.id = ev_id
  order by (s->>'created_at')::timestamptz desc
  limit 1;

  if v_last_session is not null then
    begin
      v_last_created := (v_last_session->>'created_at')::timestamptz;
      if now() - v_last_created < interval '1 second'
         and coalesce((v_last_session->>'no_voucher')::boolean, false) = coalesce(p_no_voucher, false)
         and coalesce((v_last_session->>'prints')::int, 0) = coalesce(p_prints, 0) then
        return public.get_crew_event(p_token);
      end if;
    exception when others then
      -- Abaikan bila parsing tanggal sesi lama gagal
    end;
  end if;

  update public.financial_events
  set sessions = sessions || jsonb_build_array(jsonb_build_object(
        'id', p_id,
        'no_voucher', coalesce(p_no_voucher, false),
        'prints', greatest(0, least(coalesce(p_prints, 0), 50)),
        'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
  where id = ev_id
    and not exists (select 1 from jsonb_array_elements(sessions) s where s->>'id' = p_id);

  perform public.recalc_event_finance(ev_id);
  return public.get_crew_event(p_token);
end $$;

create or replace function public.crew_delete_session(p_token text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_id bigint;
begin
  if p_token is null or p_id is null then return null; end if;

  select id into ev_id from public.financial_events where crew_token = p_token for update;
  if ev_id is null then return null; end if;

  update public.financial_events
  set sessions = coalesce(
        (select jsonb_agg(s order by ord)
         from jsonb_array_elements(sessions) with ordinality as t(s, ord)
         where s->>'id' <> p_id),
        '[]'::jsonb)
  where id = ev_id;

  perform public.recalc_event_finance(ev_id);
  return public.get_crew_event(p_token);
end $$;

grant execute on function public.get_crew_event(text) to anon, authenticated;
grant execute on function public.crew_add_session(text, text, boolean, integer) to anon, authenticated;
grant execute on function public.crew_delete_session(text, text) to anon, authenticated;

-- ── Pencatatan admin: sama atomiknya dengan crew (tidak menimpa catatan orang lain) ──
-- Hanya untuk user yang login. Mengembalikan sesi & pemasukan terbaru dari server.
create or replace function public.admin_add_session(p_event_id bigint, p_id text, p_no_voucher boolean, p_prints integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_last_session jsonb;
  v_last_created timestamptz;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;
  if p_id is null or length(p_id) not between 1 and 64 then return null; end if;

  perform 1 from public.financial_events where id = p_event_id for update;
  if not found then return null; end if;

  -- Proteksi duplikasi cepat (< 1 detik untuk tipe & print yang identik)
  select s into v_last_session
  from public.financial_events e,
       lateral jsonb_array_elements(e.sessions) s
  where e.id = p_event_id
  order by (s->>'created_at')::timestamptz desc
  limit 1;

  if v_last_session is not null then
    begin
      v_last_created := (v_last_session->>'created_at')::timestamptz;
      if now() - v_last_created < interval '1 second'
         and coalesce((v_last_session->>'no_voucher')::boolean, false) = coalesce(p_no_voucher, false)
         and coalesce((v_last_session->>'prints')::int, 0) = coalesce(p_prints, 0) then
        select jsonb_build_object('sessions', sessions, 'income', income) into result
        from public.financial_events where id = p_event_id;
        return result;
      end if;
    exception when others then
      -- Abaikan bila parsing tanggal sesi lama gagal
    end;
  end if;

  update public.financial_events
  set sessions = sessions || jsonb_build_array(jsonb_build_object(
        'id', p_id,
        'no_voucher', coalesce(p_no_voucher, false),
        'prints', greatest(0, least(coalesce(p_prints, 0), 50)),
        'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
  where id = p_event_id
    and not exists (select 1 from jsonb_array_elements(sessions) s where s->>'id' = p_id);

  perform public.recalc_event_finance(p_event_id);
  select jsonb_build_object('sessions', sessions, 'income', income) into result
  from public.financial_events where id = p_event_id;
  return result;
end $$;

create or replace function public.admin_delete_session(p_event_id bigint, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;

  perform 1 from public.financial_events where id = p_event_id for update;
  if not found then return null; end if;

  update public.financial_events
  set sessions = coalesce(
        (select jsonb_agg(s order by ord)
         from jsonb_array_elements(sessions) with ordinality as t(s, ord)
         where s->>'id' <> p_id),
        '[]'::jsonb)
  where id = p_event_id;

  perform public.recalc_event_finance(p_event_id);
  select jsonb_build_object('sessions', sessions, 'income', income) into result
  from public.financial_events where id = p_event_id;
  return result;
end $$;

revoke execute on function public.admin_add_session(bigint, text, boolean, integer) from public, anon;
revoke execute on function public.admin_delete_session(bigint, text) from public, anon;
grant execute on function public.admin_add_session(bigint, text, boolean, integer) to authenticated;
grant execute on function public.admin_delete_session(bigint, text) to authenticated;
