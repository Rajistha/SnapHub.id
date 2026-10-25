-- ============================================================================
-- SnapHub — Perbaikan alur antrian + estimasi waktu tunggu
-- Jalankan di SQL Editor Supabase setelah security_hardening.sql. Aman diulang.
--
--   1. get_queue_state: tambah avg_service_seconds (rata-rata durasi layanan 10 tamu
--      terakhir, 1–30 menit; null bila belum ada data) untuk estimasi di halaman tamu.
--   2. admin_queue_call_next: parameter p_current_action ('complete' | 'skip') menentukan
--      nasib tamu yang sedang aktif. 'skip' tidak mencatat sesi foto (tamu tidak datang).
--   3. admin_queue_start: tandai tamu mulai difoto (status 'serving').
--   4. Kolom prints & no_voucher di event_queues: print tambahan dan status tanpa voucher
--      ikut tercatat ke sesi saat tamu selesai.
-- ============================================================================

-- ── 1. Papan antrian + rata-rata durasi layanan ─────────────────────────────
create or replace function public.get_queue_state(p_token text, p_ticket_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_event_id(p_token);
  v_event jsonb;
  v_board jsonb;
  v_ticket jsonb;
  v_done int;
  v_avg numeric;
begin
  if v_event_id is null then return null; end if;

  select jsonb_build_object('id', e.id, 'name', e.name, 'date', e.date)
  into v_event from public.financial_events e where e.id = v_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'queue_number', q.queue_number,
      'seq_number', q.seq_number,
      'status', q.status,
      'name', split_part(q.customer_name, ' ', 1),
      'called_at', q.called_at,
      'called_count', q.called_count) order by q.seq_number), '[]'::jsonb)
  into v_board
  from (
    select * from public.event_queues
    where event_id = v_event_id and status in ('waiting','called','heading','serving')
    order by seq_number
    limit 300
  ) q;

  select count(*) into v_done from public.event_queues
  where event_id = v_event_id and status = 'completed';

  select least(greatest(avg(extract(epoch from (s.completed_at - s.called_at))), 60), 1800)
  into v_avg
  from (
    select completed_at, called_at from public.event_queues
    where event_id = v_event_id and status = 'completed'
      and completed_at is not null and called_at is not null and completed_at > called_at
    order by completed_at desc
    limit 10
  ) s
  having count(*) >= 2;

  if p_ticket_id is not null then
    select jsonb_build_object(
      'id', q.id,
      'queue_number', q.queue_number,
      'seq_number', q.seq_number,
      'status', q.status,
      'customer_name', q.customer_name,
      'called_at', q.called_at,
      'called_count', q.called_count)
    into v_ticket
    from public.event_queues q
    where q.id = p_ticket_id and q.event_id = v_event_id;
  end if;

  return jsonb_build_object(
    'event', v_event, 'board', v_board, 'completed_count', v_done,
    'avg_service_seconds', round(v_avg), 'ticket', v_ticket);
end $$;

grant execute on function public.get_queue_state(text, uuid) to anon, authenticated;

-- ── 2. Panggil berikutnya: pilih nasib tamu yang sedang aktif ───────────────
drop function if exists public.admin_queue_call_next(bigint, boolean);

create or replace function public.admin_queue_call_next(
  p_event_id bigint,
  p_auto_session boolean default true,
  p_current_action text default 'complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur public.event_queues%rowtype;
  v_next public.event_queues%rowtype;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;
  if p_current_action not in ('complete', 'skip') then raise exception 'invalid action'; end if;

  perform 1 from public.financial_events where id = p_event_id for update;

  -- Proteksi klik ganda (double-click/double-tap): jika tamu aktif baru saja dipanggil kurang dari 2 detik lalu,
  -- kembalikan tamu aktif tersebut dan jangan tutup/pindahkan antrian secara instan.
  select * into v_cur from public.event_queues
  where event_id = p_event_id and status in ('called','heading','serving')
  order by called_at desc nulls last limit 1;

  if found and v_cur.called_at is not null and v_cur.called_at > now() - interval '2 seconds' then
    return to_jsonb(v_cur);
  end if;

  -- Pastikan ada tamu yang menunggu SEBELUM menyentuh tamu aktif. Bila tidak ada, jangan ubah apa pun:
  -- tamu yang sedang dilayani tidak boleh diselesaikan/dilewati diam-diam oleh panggilan yang sia-sia.
  select * into v_next from public.event_queues
  where event_id = p_event_id and status = 'waiting'
  order by seq_number limit 1 for update;

  if not found then return null; end if;

  for v_cur in
    select * from public.event_queues
    where event_id = p_event_id and status in ('called','heading','serving')
  loop
    if p_current_action = 'skip' then
      update public.event_queues set status = 'skipped' where id = v_cur.id;
    else
      update public.event_queues set status = 'completed', completed_at = now() where id = v_cur.id;
      if p_auto_session then
        perform public.admin_add_session(p_event_id, substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), v_cur.no_voucher, v_cur.prints);
      end if;
    end if;
  end loop;

  update public.event_queues
  set status = 'called', called_at = now(), called_count = coalesce(called_count, 0) + 1
  where id = v_next.id
  returning * into v_next;

  return to_jsonb(v_next);
end $$;

revoke execute on function public.admin_queue_call_next(bigint, boolean, text) from public, anon;
grant execute on function public.admin_queue_call_next(bigint, boolean, text) to authenticated;

-- ── 3. Mulai foto ───────────────────────────────────────────────────────────
create or replace function public.admin_queue_start(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;
  update public.event_queues set status = 'serving'
  where id = p_id and status in ('called','heading');
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

revoke execute on function public.admin_queue_start(uuid) from public, anon;
grant execute on function public.admin_queue_start(uuid) to authenticated;

-- ── 4. Print tambahan & status voucher per tamu ──────────────────────────────────────────────
-- Kru mengisi jumlah print di kartu "Sedang dilayani"; nilainya ikut tercatat ke sesi saat tamu selesai.
alter table public.event_queues add column if not exists prints integer not null default 0;
alter table public.event_queues add column if not exists no_voucher boolean not null default false;
alter table public.event_queues drop constraint if exists event_queues_prints_chk;
alter table public.event_queues add constraint event_queues_prints_chk check (prints between 0 and 50);

create or replace function public.admin_queue_complete(p_id uuid, p_auto_session boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.event_queues%rowtype;
begin
  if auth.role() <> 'authenticated' then raise exception 'not allowed'; end if;

  update public.event_queues
  set status = 'completed', completed_at = now()
  where id = p_id and status in ('called','heading','serving')
  returning * into v_row;

  if not found then return null; end if;

  if p_auto_session then
    perform public.admin_add_session(v_row.event_id, substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), v_row.no_voucher, v_row.prints);
  end if;
  return to_jsonb(v_row);
end $$;

revoke execute on function public.admin_queue_complete(uuid, boolean) from public, anon;
grant execute on function public.admin_queue_complete(uuid, boolean) to authenticated;

-- ── 5. Nomor WhatsApp dan Nama tamu tidak wajib (1-Tap Instan) ────────────
-- Tamu bisa langsung mengambil antrian. customer_name dan customer_phone disimpan '' bila kosong.
alter table public.event_queues alter column customer_phone set default '';
alter table public.event_queues alter column customer_name set default '';

create or replace function public.take_queue_ticket(p_token text, p_name text default '', p_phone text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id bigint := public.queue_event_id(p_token);
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 40);
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_next int;
  v_row public.event_queues%rowtype;
begin
  if v_event_id is null then
    raise exception 'Link antrian tidak valid';
  end if;
  if left(v_phone, 1) = '0' then v_phone := '62' || substr(v_phone, 2); end if;
  if v_phone <> '' and length(v_phone) not between 9 and 15 then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;

  perform 1 from public.financial_events where id = v_event_id for update;

  -- Nomor yang sama (bila diisi) tidak boleh punya dua tiket aktif: kembalikan tiket yang sudah ada.
  if v_phone <> '' then
    select * into v_row from public.event_queues
    where event_id = v_event_id and customer_phone = v_phone
      and status in ('waiting','called','heading','serving')
    order by seq_number desc limit 1;

    if found then
      return jsonb_build_object('existing', true, 'id', v_row.id, 'queue_number', v_row.queue_number,
        'seq_number', v_row.seq_number, 'status', v_row.status, 'customer_name', v_row.customer_name,
        'called_at', v_row.called_at, 'called_count', v_row.called_count);
    end if;
  end if;

  -- Batasi lonjakan permintaan per event (anti-spam)
  if (select count(*) from public.event_queues
      where event_id = v_event_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Terlalu banyak permintaan, coba lagi sebentar';
  end if;

  select coalesce(max(seq_number), 0) + 1 into v_next from public.event_queues where event_id = v_event_id;

  insert into public.event_queues (event_id, queue_number, seq_number, customer_name, customer_phone, status)
  values (v_event_id, 'A-' || lpad(v_next::text, 2, '0'), v_next, v_name, v_phone, 'waiting')
  returning * into v_row;

  return jsonb_build_object('existing', false, 'id', v_row.id, 'queue_number', v_row.queue_number,
    'seq_number', v_row.seq_number, 'status', v_row.status, 'customer_name', v_row.customer_name,
    'called_at', v_row.called_at, 'called_count', v_row.called_count);
end $$;

grant execute on function public.take_queue_ticket(text, text, text) to anon, authenticated;
