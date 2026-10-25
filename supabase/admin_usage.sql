-- Statistik pemakaian Supabase untuk halaman Admin > Usage.
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Hanya user yang sudah login (role authenticated) yang boleh memanggilnya.

create or replace function public.admin_usage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'pg_version', current_setting('server_version'),
    'started_at', pg_postmaster_start_time(),
    'db_size_bytes', pg_database_size(current_database()),
    'connections', (select count(*) from pg_stat_activity where datname = current_database()),
    'max_connections', current_setting('max_connections')::int,
    'auth_users', (select count(*) from auth.users),
    'tables', coalesce((
      select jsonb_agg(t order by t.size_bytes desc)
      from (
        select
          c.relname as name,
          greatest(c.reltuples, 0)::bigint as rows_estimate,
          pg_total_relation_size(c.oid) as size_bytes
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
      ) t
    ), '[]'::jsonb),
    'buckets', coalesce((
      select jsonb_agg(b order by b.bytes desc)
      from (
        select
          bk.name as bucket,
          bk.public as is_public,
          count(o.id) as files,
          coalesce(sum((o.metadata->>'size')::bigint), 0) as bytes
        from storage.buckets bk
        left join storage.objects o on o.bucket_id = bk.id
        group by bk.name, bk.public
      ) b
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_usage_stats() from public, anon;
grant execute on function public.admin_usage_stats() to authenticated;
