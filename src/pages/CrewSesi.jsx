import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { FiLink2, FiWifiOff, FiCalendar, FiPlus, FiMinus, FiTrash2, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi';
import SwipeableSessionRow from '../components/SwipeableSessionRow';
import { VOUCHER_PRICE, NO_VOUCHER_PRICE, PRINT_PRICE, sessionPrice, eventTotal, pricingOf } from '../lib/photoSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const REFRESH_MS = 4000;

// Panggilan ringan lewat fetch (tanpa memuat supabase-js untuk halaman publik).
const rpc = (fn, args) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));

const formatRp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(n || 0)}`;

const formatDate = (date) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tanpa tanggal';

const CrewSesi = () => {
  const { slug } = useParams();
  const token = slug?.split('-').pop();
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [noVoucher, setNoVoucher] = useState(false);
  const [prints, setPrints] = useState(0);
  const pricing = pricingOf(event);
  const percent = pricing.mode === 'percent'; // mode persentase: satu tarif, tanpa voucher
  const [confirmId, setConfirmId] = useState(null);
  const [hideTotal, setHideTotal] = useState(() => {
    try { return localStorage.getItem('sesiHideTotal') === '1'; } catch { return false; }
  });

  // Perubahan dikirim berurutan; polling dilewati selama masih ada yang belum terkirim.
  const chain = useRef(Promise.resolve());
  const pending = useRef(0);
  const isAddingRef = useRef(false);
  const [isAddingSession, setIsAddingSession] = useState(false);

  useEffect(() => {
    const robotsMeta = document.querySelector('meta[name="robots"]');
    const previousContent = robotsMeta?.getAttribute('content');
    robotsMeta?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previousContent) robotsMeta?.setAttribute('content', previousContent);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem('sesiHideTotal', hideTotal ? '1' : '0'); } catch { /* abaikan */ }
  }, [hideTotal]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (pending.current > 0) return;
      try {
        const data = await rpc('get_crew_event', { p_token: token });
        if (!active || pending.current > 0) return;
        if (!data) {
          setEvent(null);
          setStatus('notfound');
          return;
        }
        setEvent(data);
        setStatus('ready');
      } catch {
        if (active) setStatus((s) => (s === 'ready' ? s : 'error'));
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);

  // Tampilkan perubahan langsung, lalu kirim ke server dan pakai balasan server sebagai data akhir.
  const mutate = (optimistic, fn, args, errorMessage) => {
    setEvent((ev) => {
      if (!ev) return ev;
      const rawList = optimistic(ev.sessions || []);
      const seen = new Set();
      const cleanList = rawList.filter((s) => {
        if (!s || !s.id) return false;
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      return { ...ev, sessions: cleanList };
    });
    pending.current += 1;
    chain.current = chain.current.then(async () => {
      try {
        const data = await rpc(fn, { p_token: token, ...args });
        if (!data) {
          setStatus('notfound');
        } else if (pending.current === 1) {
          const rawServer = Array.isArray(data.sessions) ? data.sessions : [];
          const sSeen = new Set();
          const cleanSessions = rawServer.filter((s) => {
            if (!s || !s.id) return false;
            if (sSeen.has(s.id)) return false;
            sSeen.add(s.id);
            return true;
          });
          setEvent({ ...data, sessions: cleanSessions });
        }
      } catch {
        toast.error(errorMessage);
        pending.current -= 1;
        try {
          const data = await rpc('get_crew_event', { p_token: token });
          if (data && pending.current === 0) setEvent(data);
        } catch {
          /* polling berikutnya akan menyegarkan */
        }
        return;
      }
      pending.current -= 1;
    });
    return chain.current;
  };

  const handleAdd = async () => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;
    setIsAddingSession(true);

    const session = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      no_voucher: percent ? false : noVoucher,
      prints,
      created_at: new Date().toISOString(),
    };

    setNoVoucher(false);
    setPrints(0);

    try {
      await mutate(
        (list) => (list.some((s) => s.id === session.id) ? list : [...list, session]),
        'crew_add_session',
        { p_id: session.id, p_no_voucher: session.no_voucher, p_prints: session.prints },
        'Gagal mencatat sesi, coba lagi'
      );
      toast.success('Sesi dicatat');
    } catch {
      // error ditangani di mutate
    } finally {
      setTimeout(() => {
        isAddingRef.current = false;
        setIsAddingSession(false);
      }, 500);
    }
  };

  const handleDelete = (id) => {
    mutate((list) => list.filter((s) => s.id !== id), 'crew_delete_session', { p_id: id }, 'Gagal menghapus sesi, coba lagi');
    setConfirmId(null);
  };

  const sessions = event?.sessions || [];
  const voucherCount = sessions.filter((s) => !s.no_voucher).length;
  const printCount = sessions.reduce((sum, s) => sum + (s.prints || 0), 0);

  const stats = percent
    ? [{ label: 'Sesi', value: sessions.length }, { label: 'Print', value: printCount }]
    : [
        { label: 'Voucher', value: voucherCount },
        { label: 'Non-voucher', value: sessions.length - voucherCount },
        { label: 'Print', value: printCount },
      ];

  return (
    <div className="relative min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] overflow-hidden">
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px]" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 0%, rgba(217,4,41,0.14), transparent 70%)' }} />
      <div className="relative max-w-xl mx-auto px-4 py-8">
        {status === 'loading' && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {(status === 'notfound' || status === 'error') && (
          <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center text-[var(--admin-accent)] mb-6">
              {status === 'notfound' ? <FiLink2 size={30} /> : <FiWifiOff size={30} />}
            </div>
            <h1 className="text-2xl font-bold font-heading">
              {status === 'notfound' ? 'Link crew tidak tersedia' : 'Gagal memuat data'}
            </h1>
            <p className="text-sm text-[var(--admin-text-muted)] mt-3 max-w-sm leading-relaxed">
              {status === 'notfound'
                ? 'Link ini tidak ditemukan atau sudah dinonaktifkan. Minta link terbaru ke admin SnapHub.'
                : 'Periksa koneksi internet lalu coba lagi.'}
            </p>
            {status === 'error' && (
              <button
                onClick={() => window.location.reload()}
                className="mt-8 px-6 py-3 rounded-xl bg-[#D90429] hover:bg-[#A50320] text-white text-sm font-semibold transition-colors"
              >
                Muat ulang
              </button>
            )}
          </div>
        )}

        {status === 'ready' && event && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <img src="/icons.svg" alt="SnapHub" className="h-9 w-auto" />
              <span className="px-3 py-1.5 rounded-full bg-[var(--admin-accent-bg)] text-[var(--admin-accent)] text-xs font-semibold">Crew</span>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--admin-accent)] font-semibold">Catat Sesi Foto</p>
              <h1 className="text-2xl md:text-3xl font-bold font-heading mt-2 leading-tight">{event.name}</h1>
              <p className="text-sm text-[var(--admin-text-muted)] mt-2 flex items-center gap-1.5">
                <FiCalendar size={14} /> {formatDate(event.date)}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--admin-accent-bg)] border border-[var(--admin-border)] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Total · {sessions.length} sesi</p>
                <button
                  type="button"
                  onClick={() => setHideTotal((h) => !h)}
                  className="p-1 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors"
                  aria-label={hideTotal ? 'Tampilkan total' : 'Sembunyikan total'}
                >
                  {hideTotal ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              <p className="text-2xl font-bold text-[var(--admin-accent)] mt-1 tabular-nums font-heading">
                {hideTotal ? 'Rp ••••••' : formatRp(eventTotal(event))}
              </p>
            </div>

            <div className={`grid gap-2 ${stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {stats.map((c) => (
                <div key={c.label} className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums font-heading">{c.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)] mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Form catat sesi */}
            <div className="rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)] mb-4">Sesi Baru</h2>

              {!percent && (
              <>
              <p className="text-xs text-[var(--admin-text-muted)] mb-2">Tipe</p>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--admin-hover-bg)]">
                {[
                  { value: false, label: 'Voucher', price: pricing.voucherPrice },
                  { value: true, label: 'Non-voucher', price: pricing.noVoucherPrice },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setNoVoucher(opt.value)}
                    className={`px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${
                      noVoucher === opt.value
                        ? 'bg-[var(--admin-accent)] text-[#1a0a0d] shadow-sm'
                        : 'text-[var(--admin-text-main)]/70 hover:text-[var(--admin-text-main)]'
                    }`}
                  >
                    <span className="block">{opt.label}</span>
                    <span className="block text-[11px] font-normal opacity-90 tabular-nums">{formatRp(opt.price)}</span>
                  </button>
                ))}
              </div>
              </>
              )}

              <p className="text-xs text-[var(--admin-text-muted)] mt-4 mb-2">Jumlah print (+{formatRp(pricing.printPrice)}/print)</p>
              <div className="flex items-center justify-between rounded-xl bg-[var(--admin-hover-bg)] p-1">
                <button
                  type="button"
                  onClick={() => setPrints((p) => Math.max(0, p - 1))}
                  className="w-12 h-12 flex items-center justify-center rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors"
                  aria-label="Kurangi print"
                >
                  <FiMinus size={18} />
                </button>
                <span className="text-xl font-semibold tabular-nums">{prints}</span>
                <button
                  type="button"
                  onClick={() => setPrints((p) => Math.min(50, p + 1))}
                  className="w-12 h-12 flex items-center justify-center rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors"
                  aria-label="Tambah print"
                >
                  <FiPlus size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-[var(--admin-border-subtle)]">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Harga sesi</p>
                  <p className="text-lg font-bold text-[var(--admin-accent)] tabular-nums">
                    {formatRp((percent ? pricing.sessionPrice : noVoucher ? pricing.noVoucherPrice : pricing.voucherPrice) + prints * pricing.printPrice)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isAddingSession}
                  className="btn-primary px-5 py-3 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isAddingSession ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <FiPlus size={16} />
                      <span>Tambah Sesi</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Riwayat */}
            <div className="border border-[var(--admin-border)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                  Riwayat Sesi ({sessions.length})
                </h2>
              </div>

              {sessions.length === 0 ? (
                <p className="text-sm text-[var(--admin-text-muted)] text-center py-8">Belum ada sesi tercatat.</p>
              ) : (
                <div className={`divide-y divide-[var(--admin-border-subtle)] ${sessions.length > 5 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}>
                  {[...sessions].reverse().map((s, idx) => (
                    <SwipeableSessionRow key={s.id} onDelete={() => setConfirmId(s.id)}>
                      <div className="flex items-center justify-between gap-3 py-3 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-[var(--admin-hover-bg)] text-xs font-semibold text-[var(--admin-text-muted)] tabular-nums">
                            {sessions.length - idx}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!percent && (
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                s.no_voucher
                                  ? 'bg-amber-500/15 text-amber-500'
                                  : 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)]'
                              }`}>
                                {s.no_voucher ? 'Non-voucher' : 'Voucher'}
                              </span>
                              )}
                              {s.prints > 0 && (
                                <span className="text-xs text-[var(--admin-text-muted)]">{s.prints} print</span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                              {new Date(s.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-[var(--admin-text-main)] tabular-nums">{formatRp(sessionPrice(s, pricing))}</span>
                          <button
                            onClick={() => setConfirmId(s.id)}
                            className="hidden sm:block p-1.5 rounded-md text-[var(--admin-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Hapus sesi"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </SwipeableSessionRow>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-[11px] text-[var(--admin-text-muted)] pb-4">
              Diperbarui otomatis · Jangan bagikan link ini ke customer
            </p>
          </div>
        )}
      </div>
      {confirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmId(null)} />
          <div className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-red-400 mb-2">Hapus Sesi?</h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-6">
              Sesi ini akan terhapus permanen dan pemasukan di keuangan ikut berkurang.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors font-medium text-sm"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrewSesi;
