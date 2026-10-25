import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { FiRefreshCw, FiDatabase, FiHardDrive, FiUsers, FiActivity, FiGlobe, FiGitCommit, FiAlertTriangle } from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';

// Batas paket gratis. Ubah jika paket berubah.
const LIMITS = {
  supabase: { db: 500 * 1024 ** 2, storage: 1024 ** 3, users: 50000 },
  vercel: { deploysPerMonth: 3000 },
};

const fmtBytes = (n) => {
  n = Number(n) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  const mb = n / 1024 ** 2;
  return `${mb.toLocaleString('id-ID', { maximumFractionDigits: mb >= 100 ? 0 : 1 })} MB`;
};

const fmtQty = (n, unit) => {
  if (/byte/i.test(unit)) return fmtBytes(n);
  return `${Math.round(n * 100) / 100}${unit ? ` ${unit}` : ''}`;
};

const Meter = ({ label, used, limit, format: f = fmtBytes, icon }) => {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct >= 90 ? 'var(--admin-danger)' : pct >= 70 ? 'var(--admin-warn)' : 'var(--admin-ok)';
  return (
    <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">{icon}{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="text-2xl font-bold font-heading text-[var(--admin-text-main)]">{f(used)}</div>
      <div className="text-xs text-[var(--admin-text-muted)] mb-3">dari {f(limit)}</div>
      <div className="h-2 rounded-full bg-[var(--admin-hover-bg)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

const Card = ({ title, icon, children, right }) => (
  <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--admin-text-main)]">{icon}{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

const Stat = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">{label}</div>
    <div className="text-sm font-semibold text-[var(--admin-text-main)] break-words">{value ?? '-'}</div>
  </div>
);

const Notice = ({ children }) => (
  <div className="flex items-start gap-2 text-xs text-[var(--admin-warn)] bg-[var(--admin-hover-bg)] rounded-xl p-3">
    <FiAlertTriangle className="mt-0.5 shrink-0" />
    <span>{children}</span>
  </div>
);

const STATE_COLOR = { READY: 'var(--admin-ok)', ERROR: 'var(--admin-danger)', CANCELED: 'var(--admin-text-muted)' };

const AdminUsage = () => {
  const [sb, setSb] = useState(null);
  const [sbError, setSbError] = useState('');
  const [vc, setVc] = useState(null);
  const [vcError, setVcError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setSbError('');
    setVcError('');

    const supa = supabase.rpc
      ? supabase.rpc('admin_usage_stats').then(({ data, error }) => {
          if (error) throw error;
          setSb(data);
        })
      : Promise.reject(new Error('Supabase belum dikonfigurasi'));

    const vercel = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/vercel-usage', {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const type = r.headers.get('content-type') || '';
      if (!type.includes('application/json')) {
        throw new Error('Endpoint /api/vercel-usage tidak ditemukan. Fungsi API hanya jalan di Vercel (atau via `vercel dev`).');
      }
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      setVc(body);
    })();

    const [a, b] = await Promise.allSettled([supa, vercel]);
    if (a.status === 'rejected') {
      const m = a.reason?.message || String(a.reason);
      setSbError(/admin_usage_stats|function/i.test(m)
        ? 'Fungsi admin_usage_stats belum dibuat. Jalankan supabase/admin_usage.sql di SQL Editor Supabase.'
        : m);
    }
    if (b.status === 'rejected') setVcError(b.reason?.message || String(b.reason));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const storageBytes = sb?.buckets?.reduce((s, x) => s + Number(x.bytes), 0) ?? 0;
  const storageFiles = sb?.buckets?.reduce((s, x) => s + Number(x.files), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--admin-text-muted)]">
          {sb?.generated_at || vc?.generated_at
            ? `Diperbarui ${format(new Date(sb?.generated_at || vc?.generated_at), 'dd MMM yyyy, HH:mm')}`
            : 'Memuat data…'}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--admin-border)] text-xs font-semibold text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] disabled:opacity-50 cursor-pointer"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ---------- SUPABASE ---------- */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold font-heading text-[var(--admin-text-main)]">Supabase</h2>
        {sbError && <Notice>{sbError}</Notice>}

        {sb && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Meter label="Database" used={sb.db_size_bytes} limit={LIMITS.supabase.db} icon={<FiDatabase />} />
              <Meter label="Storage" used={storageBytes} limit={LIMITS.supabase.storage} icon={<FiHardDrive />} />
              <Meter label="Auth users" used={sb.auth_users} limit={LIMITS.supabase.users} format={(n) => Number(n).toLocaleString('id-ID')} icon={<FiUsers />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Server" icon={<FiActivity />}>
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="Postgres" value={sb.pg_version} />
                  <Stat label="Aktif sejak" value={sb.started_at ? formatDistanceToNow(new Date(sb.started_at)) : '-'} />
                  <Stat label="Koneksi" value={`${sb.connections} / ${sb.max_connections}`} />
                  <Stat label="File storage" value={`${storageFiles.toLocaleString('id-ID')} file`} />
                </div>
              </Card>

              <Card title="Storage per bucket" icon={<FiHardDrive />}>
                <div className="space-y-3">
                  {sb.buckets.length === 0 && <p className="text-xs text-[var(--admin-text-muted)]">Tidak ada bucket.</p>}
                  {sb.buckets.map((b) => (
                    <div key={b.bucket}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-[var(--admin-text-main)]">
                          {b.bucket} <span className="text-[var(--admin-text-muted)] font-normal">· {b.files} file · {b.is_public ? 'public' : 'private'}</span>
                        </span>
                        <span className="text-[var(--admin-text-muted)]">{fmtBytes(b.bytes)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--admin-hover-bg)] overflow-hidden">
                        <div className="h-full bg-[var(--admin-accent)]" style={{ width: `${storageBytes ? (b.bytes / storageBytes) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card title="Tabel (schema public)" icon={<FiDatabase />}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--admin-text-muted)] uppercase tracking-wider text-[10px]">
                      <th className="py-2 pr-4">Tabel</th>
                      <th className="py-2 pr-4 text-right">Baris (≈)</th>
                      <th className="py-2 text-right">Ukuran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sb.tables.map((t) => (
                      <tr key={t.name} className="border-t border-[var(--admin-border-subtle)] text-[var(--admin-text-main)]">
                        <td className="py-2 pr-4 font-medium">{t.name}</td>
                        <td className="py-2 pr-4 text-right">{Number(t.rows_estimate).toLocaleString('id-ID')}</td>
                        <td className="py-2 text-right">{fmtBytes(t.size_bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ---------- VERCEL ---------- */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold font-heading text-[var(--admin-text-main)]">Vercel</h2>
        {vcError && <Notice>{vcError}</Notice>}
        {vc && vc.configured === false && <Notice>{vc.error}</Notice>}

        {vc?.configured && (
          <>
            {Object.entries(vc.errors || {}).map(([k, m]) => (
              <Notice key={k}>{k}: {m}</Notice>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vc.deployments && (
                <Meter
                  label="Deploy bulan ini"
                  used={vc.deployments.this_month}
                  limit={LIMITS.vercel.deploysPerMonth}
                  format={(n) => Number(n).toLocaleString('id-ID')}
                  icon={<FiGitCommit />}
                />
              )}
              {vc.usage && (
                <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">Biaya bulan ini</span>
                  <div className="text-2xl font-bold font-heading text-[var(--admin-text-main)] mt-3">${vc.usage.total_cost.toFixed(2)}</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">{vc.usage.services.length} layanan terpakai</div>
                </div>
              )}
              {vc.project && (
                <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5 grid grid-cols-2 gap-3">
                  <Stat label="Project" value={vc.project.name} />
                  <Stat label="Framework" value={vc.project.framework} />
                  <Stat label="Node" value={vc.project.node_version} />
                  <Stat label="Repo" value={vc.project.git_repo} />
                </div>
              )}
            </div>

            {vc.usage?.services.length > 0 && (
              <Card title="Pemakaian bulan ini" icon={<FiActivity />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[var(--admin-text-muted)] uppercase tracking-wider text-[10px]">
                        <th className="py-2 pr-4">Layanan</th>
                        <th className="py-2 pr-4 text-right">Jumlah</th>
                        <th className="py-2 text-right">Biaya</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vc.usage.services.map((s) => (
                        <tr key={s.service} className="border-t border-[var(--admin-border-subtle)] text-[var(--admin-text-main)]">
                          <td className="py-2 pr-4 font-medium">{s.service}</td>
                          <td className="py-2 pr-4 text-right">{fmtQty(s.quantity, s.unit)}</td>
                          <td className="py-2 text-right">${s.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {vc.deployments && (
                <Card
                  title="Deployment terbaru"
                  icon={<FiGitCommit />}
                  right={vc.deployments.this_month_failed > 0 && (
                    <span className="text-[10px] font-bold text-[var(--admin-danger)]">{vc.deployments.this_month_failed} gagal bulan ini</span>
                  )}
                >
                  <ul className="space-y-3">
                    {vc.deployments.recent.map((d) => (
                      <li key={d.id} className="flex items-start gap-3 text-xs">
                        <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: STATE_COLOR[d.state] || 'var(--admin-warn)' }} title={d.state} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[var(--admin-text-main)] truncate">{d.commit || d.url}</div>
                          <div className="text-[var(--admin-text-muted)]">
                            {d.target} {d.branch && `· ${d.branch}`} · {formatDistanceToNow(new Date(d.created), { addSuffix: true })}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {vc.domains && (
                <Card title="Domain" icon={<FiGlobe />}>
                  <ul className="space-y-2">
                    {vc.domains.map((d) => (
                      <li key={d.name} className="flex items-center justify-between text-xs text-[var(--admin-text-main)]">
                        <span className="font-medium">{d.name}{d.redirect && <span className="text-[var(--admin-text-muted)]"> → {d.redirect}</span>}</span>
                        <span style={{ color: d.verified ? 'var(--admin-ok)' : 'var(--admin-warn)' }}>{d.verified ? 'verified' : 'unverified'}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUsage;
