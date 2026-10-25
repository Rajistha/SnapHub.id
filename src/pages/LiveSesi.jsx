import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { FiLink2, FiWifiOff, FiCalendar, FiClock, FiTag, FiUser, FiLayers, FiX } from 'react-icons/fi';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Panggilan ringan lewat fetch (tanpa memuat supabase-js ±200KB hanya untuk satu permintaan).
const fetchLiveEvent = (token) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/get_live_event`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));

// Muat pertama memakai permintaan yang sudah dimulai oleh index.html (kalau ada)
const takePrefetched = (token) => {
  const pre = window.__live;
  if (pre && pre.token === token) {
    window.__live = null;
    return pre.promise;
  }
  return null;
};

const REFRESH_MS = 4000;
const WA_URL = 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20butuh%20link%20live%20pencatatan%20terbaru.';

const formatRp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(n || 0)}`;

// Angka yang berhitung naik/turun halus saat nilainya berubah.
const AnimatedNumber = ({ value, format = (n) => String(n) }) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => {
        fromRef.current = v;
        setDisplay(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);

  return <>{format(display)}</>;
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
});

const LiveSesi = () => {
  const { slug } = useParams();
  const token = slug?.split('-').pop();
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    const robotsMeta = document.querySelector('meta[name="robots"]');
    const previousContent = robotsMeta?.getAttribute('content');
    robotsMeta?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previousContent) robotsMeta?.setAttribute('content', previousContent);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async (first = false) => {
      let data;
      try {
        data = await ((first && takePrefetched(token)) || fetchLiveEvent(token)).catch(() => fetchLiveEvent(token));
      } catch {
        if (!active) return;
        setStatus((s) => (s === 'ready' ? s : 'error'));
        return;
      }
      if (!active) return;
      if (!data) {
        setEvent(null);
        setStatus('notfound');
        return;
      }
      setEvent(data);
      setStatus('ready');
      setUpdatedAt(new Date());
    };
    load(true);
    const timer = setInterval(() => load(), REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);

  const sessions = event?.sessions || [];
  const voucherCount = sessions.filter((s) => !s.no_voucher).length;
  const noVoucherCount = sessions.length - voucherCount;
  const percent = event?.pricing_mode === 'percent';
  const sharing = percent ? Number(event?.sharing_amount || 0) : voucherCount * (event?.share_per_voucher || 0);

  // Kelompokkan per tanggal, terbaru di atas; n = nomor urut sesi.
  const groups = [];
  [...sessions].reverse().forEach((s, idx) => {
    const date = new Date(s.created_at).toLocaleDateString('id-ID', { dateStyle: 'long' });
    let g = groups[groups.length - 1];
    if (!g || g.date !== date) {
      g = { date, items: [] };
      groups.push(g);
    }
    g.items.push({ s, n: sessions.length - idx });
  });

  const stats = percent
    ? [
        { label: 'Total sesi', value: sessions.length, icon: <FiLayers size={14} />, tone: 'text-[var(--admin-text-main)] bg-[var(--admin-hover-bg)]' },
        { label: 'Sharing (%)', value: Number(event?.share_percent || 0), icon: <FiTag size={14} />, tone: 'text-[var(--admin-accent)] bg-[var(--admin-accent-bg)]' },
      ]
    : [
    { label: 'Voucher', value: voucherCount, icon: <FiTag size={14} />, tone: 'text-[var(--admin-accent)] bg-[var(--admin-accent-bg)]' },
    { label: 'Non-voucher', value: noVoucherCount, icon: <FiUser size={14} />, tone: 'text-amber-500 bg-amber-500/10' },
    { label: 'Total sesi', value: sessions.length, icon: <FiLayers size={14} />, tone: 'text-[var(--admin-text-main)] bg-[var(--admin-hover-bg)]' },
  ];

  return (
    <div className="relative min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px]" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 0%, rgba(217,4,41,0.14), transparent 70%)' }} />
      <div className="relative max-w-xl mx-auto px-4 py-8">
        {status === 'loading' && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {(status === 'notfound' || status === 'error') && (
          <div className="relative min-h-[85vh] flex flex-col items-center justify-center text-center">
            {/* Ambient glow + dot grid */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[480px] h-[480px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(217,4,41,0.18), transparent 70%)' }} />
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  maskImage: 'radial-gradient(ellipse 60% 50% at 50% 45%, black, transparent)',
                  WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 45%, black, transparent)',
                }}
              />
            </div>

            <motion.img {...fadeUp(0)} src="/icons.svg" alt="SnapHub" className="h-14 w-auto mb-12" />

            {/* Icon with pulsing rings */}
            <div className="relative w-28 h-28 flex items-center justify-center mb-8">
              {[0, 1].map((i) => (
                <motion.span
                  key={i}
                  className="absolute inset-0 rounded-full border border-[var(--admin-accent)]"
                  initial={{ scale: 0.7, opacity: 0.5 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 2.8, repeat: Infinity, delay: i * 1.4, ease: 'easeOut' }}
                />
              ))}
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.15 }}
                className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#2a1519] to-[#160F11] border border-[var(--admin-accent)]/30 shadow-[0_0_40px_rgba(217,4,41,0.25)] flex items-center justify-center text-[var(--admin-accent)]"
              >
                <motion.span
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex"
                >
                  {status === 'notfound' ? <FiLink2 size={30} /> : <FiWifiOff size={30} />}
                </motion.span>
              </motion.div>
            </div>

            <motion.h1 {...fadeUp(0.3)} className="text-2xl md:text-3xl font-bold font-heading">
              {status === 'notfound' ? 'Link tidak tersedia' : 'Gagal memuat data'}
            </motion.h1>
            <motion.p {...fadeUp(0.4)} className="text-sm md:text-base text-[var(--admin-text-muted)] mt-3 max-w-sm leading-relaxed">
              {status === 'notfound'
                ? 'Link ini tidak ditemukan atau sudah dinonaktifkan. Hubungi tim SnapHub untuk mendapatkan link terbaru.'
                : 'Terjadi kendala saat mengambil data. Periksa koneksi internet Anda lalu coba lagi.'}
            </motion.p>

            <motion.div {...fadeUp(0.5)} className="flex flex-col sm:flex-row gap-3 mt-8 w-full sm:w-auto">
              {status === 'error' ? (
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 rounded-xl bg-[#D90429] hover:bg-[#A50320] text-white text-sm font-semibold transition-colors"
                >
                  Muat ulang
                </button>
              ) : (
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-xl bg-[#D90429] hover:bg-[#A50320] text-white text-sm font-semibold transition-colors"
                >
                  Hubungi SnapHub
                </a>
              )}
              <a
                href="/"
                className="px-6 py-3 rounded-xl border border-[var(--admin-border)] text-sm font-medium text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
              >
                Ke Website
              </a>
            </motion.div>
          </div>
        )}

        {status === 'ready' && event && (
          <div className="space-y-5">
            {/* Top bar */}
            <motion.div {...fadeUp(0)} className="flex items-center justify-between">
              <img src="/icons.svg" alt="SnapHub" className="h-9 w-auto" />
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-green-500" />
                </span>
                LIVE
                {updatedAt && (
                  <span className="font-normal text-green-500/70 tabular-nums">
                    {updatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </span>
            </motion.div>

            {/* Title */}
            <motion.div {...fadeUp(0.08)} className="pt-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--admin-accent)] font-semibold">Pencatatan Live</p>
              <h1 className="text-3xl md:text-4xl font-bold font-heading mt-2 leading-tight">{event.name}</h1>
              <p className="text-sm text-[var(--admin-text-muted)] mt-2 flex items-center gap-1.5">
                <FiCalendar size={14} /> {event.date || 'Tanpa tanggal'}
              </p>
            </motion.div>

            {/* Sharing hero */}
            <motion.div
              {...fadeUp(0.16)}
              className="relative overflow-hidden rounded-3xl border border-[var(--admin-accent)]/20 bg-gradient-to-br from-[#2a1519] via-[#160F11] to-[#0b0708] p-6 md:p-7"
            >
              <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(217,4,41,0.22), transparent 70%)' }} />
              <div className="relative">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold">Estimasi sharing profit</p>
                <p className="text-4xl md:text-5xl font-bold text-[var(--admin-accent)] mt-3 tabular-nums font-heading">
                  <AnimatedNumber value={sharing} format={formatRp} />
                </p>
                <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 tabular-nums">
                  {percent ? `${Number(event.share_percent || 0)}% dari pemasukan sesi` : <>{voucherCount} voucher <FiX size={11} /> {formatRp(event.share_per_voucher)}</>}
                </span>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div {...fadeUp(0.24)} className={`grid gap-3 ${stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {stats.map((c) => (
                <div key={c.label} className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                  <span className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ${c.tone}`}>{c.icon}</span>
                  <p className="text-2xl font-bold mt-3 tabular-nums font-heading">
                    <AnimatedNumber value={c.value} />
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)] mt-0.5">{c.label}</p>
                </div>
              ))}
            </motion.div>

            {/* Voucher ratio bar */}
            {!percent && sessions.length > 0 && (
              <motion.div {...fadeUp(0.28)}>
                <div className="h-2 rounded-full bg-amber-500/30 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[var(--admin-accent)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(voucherCount / sessions.length) * 100}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut', delay: 0.4 }}
                  />
                </div>
                <p className="text-[11px] text-[var(--admin-text-muted)] mt-2">
                  {Math.round((voucherCount / sessions.length) * 100)}% sesi memakai voucher
                </p>
              </motion.div>
            )}

            {/* Session list */}
            <motion.div {...fadeUp(0.32)} className="rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold font-heading">Daftar Sesi</h2>
                <span className="text-xs text-[var(--admin-text-muted)] tabular-nums">{sessions.length} sesi</span>
              </div>

              {sessions.length === 0 ? (
                <p className="text-sm text-[var(--admin-text-muted)] text-center py-10">Belum ada sesi tercatat.</p>
              ) : (
                <div className="max-h-[520px] overflow-y-auto pr-2 -mr-2 space-y-4">
                  {groups.map((g) => (
                    <div key={g.date}>
                      <p className="text-[11px] uppercase tracking-wider text-[var(--admin-text-muted)] font-semibold mb-1 px-1">
                        {g.date} · {g.items.length} sesi
                      </p>
                      <div className="divide-y divide-[var(--admin-border-subtle)]">
                        <AnimatePresence initial={false}>
                          {g.items.map(({ s, n }) => (
                            <motion.div
                              key={s.id}
                              initial={{ opacity: 0, x: -24, backgroundColor: 'rgba(231,158,167,0.25)' }}
                              animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(231,158,167,0)' }}
                              transition={{ duration: 0.45, backgroundColor: { duration: 1.6 } }}
                              className="flex items-center justify-between gap-3 py-3 px-1 rounded-md"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-[var(--admin-hover-bg)] text-xs font-semibold text-[var(--admin-text-muted)] tabular-nums">
                                  {n}
                                </span>
                                {!percent && (
                                <span
                                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                    s.no_voucher ? 'bg-amber-500/15 text-amber-500' : 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)]'
                                  }`}
                                >
                                  {s.no_voucher ? 'Non-voucher' : 'Voucher'}
                                </span>
                                )}
                              </div>
                              <span className="flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] tabular-nums">
                                <FiClock size={12} />
                                {new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.p {...fadeUp(0.4)} className="text-center text-[11px] text-[var(--admin-text-muted)] pt-2 pb-4">
              Diperbarui otomatis setiap {REFRESH_MS / 1000} detik · SnapHub
            </motion.p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveSesi;
