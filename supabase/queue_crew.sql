-- ============================================================================
-- SnapHub — Link Akses Kru Antrian (Tanpa Login)
-- Jalankan di SQL Editor Supabase. Aman diulang berkali-kali (idempotent).
-- ============================================================================

-- ── 1. Kolom token kru antrian di financial_events ───────────────────────────
alter table public.financial_events
  add column if not exists queue_crew_token text unique;

create index if not exists idx_financial_events_queue_crew_token
  on public.financial_events(queue_crew_token);

-- ── 2. Helper validasi token kru ──────────────────────────────────────────────
create or replace function public.queue_crew_event_id(p_token text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.financial_events
  where p_token is not null and length(p_token) >= 8 and queue_crew_token = p_token
  limit 1;
$$;

revoke execute on function public.queue_crew_event_id(text) from public, anon, authenticated;

-- ── 3. Ambil data antrian untuk kru ──────────────────────────────────────────
create or replace function public.get_crew_queue_data(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
  v_event jsonb;
  v_queues jsonb;
begin
  if v_event_id is null then return null; end if;

  select jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'date', e.date,
    'queue_token', e.queue_token,
    'pricing_mode', coalesce(e.pricing_mode, 'voucher'),
    'session_price', coalesce(e.session_price, 45000),
    'voucher_price', coalesce(e.voucher_price, 30000),
    'no_voucher_price', coalesce(e.no_voucher_price, 35000),
    'print_price', coalesce(e.print_price, 10000)
  )
  into v_event
  from public.financial_events e
  where e.id = v_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'event_id', q.event_id,
    'queue_number', q.queue_number,
    'seq_number', q.seq_number,
    'customer_name', q.customer_name,
    'customer_phone', q.customer_phone,
    'status', q.status,
    'called_count', q.called_count,
    'called_at', q.called_at,
    'created_at', q.created_at,
    'prints', coalesce(q.prints, 0),
    'no_voucher', coalesce(q.no_voucher, false)
  ) order by q.seq_number), '[]'::jsonb)
  into v_queues
  from public.event_queues q
  where q.event_id = v_event_id;

  return jsonb_build_object('event', v_event, 'queues', v_queues);
end $$;

grant execute on function public.get_crew_queue_data(text) to anon, authenticated;

-- ── 4. Kru: Panggil berikutnya ────────────────────────────────────────────────
create or replace function public.crew_queue_call_next(
  p_token text,
  p_auto_session boolean default true,
  p_current_action text default 'complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
  v_cur public.event_queues%rowtype;
  v_next public.event_queues%rowtype;
  v_session_id text;
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;
  if p_current_action not in ('complete', 'skip') then raise exception 'Aksi tidak valid'; end if;

  perform 1 from public.financial_events where id = v_event_id for update;

  -- Proteksi klik ganda: jika tamu aktif baru saja dipanggil kurang dari 2 detik lalu, kembalikan tamu tersebut
  select * into v_cur from public.event_queues
  where event_id = v_event_id and status in ('called','heading','serving')
  order by called_at desc nulls last limit 1;

  if found and v_cur.called_at is not null and v_cur.called_at > now() - interval '2 seconds' then
    return to_jsonb(v_cur);
  end if;

  -- Pastikan ada tamu yang menunggu SEBELUM menyentuh tamu aktif
  select * into v_next from public.event_queues
  where event_id = v_event_id and status = 'waiting'
  order by seq_number limit 1 for update;

  if not found then return null; end if;

  for v_cur in
    select * from public.event_queues
    where event_id = v_event_id and status in ('called','heading','serving')
  loop
    if p_current_action = 'skip' then
      update public.event_queues set status = 'skipped' where id = v_cur.id;
    else
      update public.event_queues set status = 'completed', completed_at = now() where id = v_cur.id;
      if p_auto_session then
        v_session_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
        update public.financial_events
        set sessions = sessions || jsonb_build_array(jsonb_build_object(
          'id', v_session_id,
          'no_voucher', coalesce(v_cur.no_voucher, false),
          'prints', greatest(0, least(coalesce(v_cur.prints, 0), 50)),
          'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
        where id = v_event_id
          and not exists (select 1 from jsonb_array_elements(sessions) s where s->>'id' = v_session_id);
        perform public.recalc_event_finance(v_event_id);
      end if;
    end if;
  end loop;

  update public.event_queues
  set status = 'called', called_at = now(), called_count = coalesce(called_count, 0) + 1
  where id = v_next.id
  returning * into v_next;

  return to_jsonb(v_next);
end $$;

grant execute on function public.crew_queue_call_next(text, boolean, text) to anon, authenticated;

-- ── 5. Kru: Selesaikan nomor antrian ───────────────────────────────────────────
create or replace function public.crew_queue_complete(
  p_token text,
  p_id uuid,
  p_auto_session boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
  v_row public.event_queues%rowtype;
  v_session_id text;
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  update public.event_queues
  set status = 'completed', completed_at = now()
  where id = p_id and event_id = v_event_id
  returning * into v_row;

  if not found then raise exception 'Antrian tidak ditemukan'; end if;

  if p_auto_session then
    v_session_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    update public.financial_events
    set sessions = sessions || jsonb_build_array(jsonb_build_object(
      'id', v_session_id,
      'no_voucher', coalesce(v_row.no_voucher, false),
      'prints', greatest(0, least(coalesce(v_row.prints, 0), 50)),
      'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    where id = v_event_id
      and not exists (select 1 from jsonb_array_elements(sessions) s where s->>'id' = v_session_id);
    perform public.recalc_event_finance(v_event_id);
  end if;

  return to_jsonb(v_row);
end $$;

grant execute on function public.crew_queue_complete(text, uuid, boolean) to anon, authenticated;

-- ── 6. Kru: Mulai difoto (serving) ────────────────────────────────────────────
create or replace function public.crew_queue_start(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  update public.event_queues
  set status = 'serving'
  where id = p_id and event_id = v_event_id;

  return found;
end $$;

grant execute on function public.crew_queue_start(text, uuid) to anon, authenticated;

-- ── 7. Kru: Panggil ulang (recall) ────────────────────────────────────────────
create or replace function public.crew_queue_recall(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
  v_row public.event_queues%rowtype;
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  update public.event_queues
  set status = 'called', called_at = now(), called_count = coalesce(called_count, 0) + 1
  where id = p_id and event_id = v_event_id
  returning * into v_row;

  return to_jsonb(v_row);
end $$;

grant execute on function public.crew_queue_recall(text, uuid) to anon, authenticated;

-- ── 8. Kru: Lewati antrian (skip) ─────────────────────────────────────────────
create or replace function public.crew_queue_skip(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  update public.event_queues
  set status = 'skipped'
  where id = p_id and event_id = v_event_id;

  return found;
end $$;

grant execute on function public.crew_queue_skip(text, uuid) to anon, authenticated;

-- ── 9. Kru: Kembalikan ke antrean (requeue) ───────────────────────────────────
create or replace function public.crew_queue_requeue(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  update public.event_queues
  set status = 'waiting'
  where id = p_id and event_id = v_event_id;

  return found;
end $$;

grant execute on function public.crew_queue_requeue(text, uuid) to anon, authenticated;

-- ── 10. Kru: Tambah antrian manual ────────────────────────────────────────────
create or replace function public.crew_queue_add_manual(
  p_token text,
  p_name text default '',
  p_phone text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
  v_next int;
  v_row public.event_queues%rowtype;
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  perform 1 from public.financial_events where id = v_event_id for update;

  select coalesce(max(seq_number), 0) + 1 into v_next from public.event_queues where event_id = v_event_id;

  insert into public.event_queues (event_id, queue_number, seq_number, customer_name, customer_phone, status)
  values (v_event_id, 'A-' || lpad(v_next::text, 2, '0'), v_next, coalesce(p_name, ''), coalesce(p_phone, ''), 'waiting')
  returning * into v_row;

  return to_jsonb(v_row);
end $$;

grant execute on function public.crew_queue_add_manual(text, text, text) to anon, authenticated;

-- ── 11. Kru: Ubah print / voucher ─────────────────────────────────────────────
create or replace function public.crew_queue_update_item(
  p_token text,
  p_id uuid,
  p_prints int default null,
  p_no_voucher boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  update public.event_queues
  set prints = coalesce(p_prints, prints),
      no_voucher = coalesce(p_no_voucher, no_voucher)
  where id = p_id and event_id = v_event_id;

  return found;
end $$;

grant execute on function public.crew_queue_update_item(text, uuid, int, boolean) to anon, authenticated;

-- ── 12. Kru: Hapus antrian ────────────────────────────────────────────────────
create or replace function public.crew_queue_remove(p_token text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_crew_event_id(p_token);
begin
  if v_event_id is null then raise exception 'Akses tidak sah'; end if;

  delete from public.event_queues
  where id = p_id and event_id = v_event_id;

  return found;
end $$;

grant execute on function public.crew_queue_remove(text, uuid) to anon, authenticated;
