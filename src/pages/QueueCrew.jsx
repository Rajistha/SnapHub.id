import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { SiWhatsapp } from 'react-icons/si';
import {
  FiSun, FiMoon, FiSearch, FiExternalLink, FiTrash2, FiRefreshCw,
  FiPlay, FiCheck, FiSkipForward, FiVolume2, FiRotateCcw, FiCamera, FiPlus, FiGrid
} from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import usePolling from '../lib/usePolling';
import { playChime, unlockAudio } from '../lib/chime';
import { isActive, statusMeta, toWaNumber } from '../lib/queueStatus';
import { formatRupiah } from '../lib/pricelistDefaults';
import { formatDate, queueDisplayUrl, queueQrUrl, tokenFromSlug } from '../lib/appUrls';
import Modal from '../components/ui/Modal';

const sortBySeq = (rows) => [...rows].sort((a, b) => a.seq_number - b.seq_number);

const TABS = [
  { id: 'active', label: 'Antrean' },
  { id: 'completed', label: 'Selesai' },
  { id: 'all', label: 'Semua' },
];

const QueueCrew = () => {
  const { slug } = useParams();
  const token = tokenFromSlug(slug);

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('snaphub_crew_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('snaphub_crew_theme', next);
      } catch {}
      return next;
    });
  };

  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [tab, setTab] = useState('active');
  const [queueSearch, setQueueSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoSession, setAutoSession] = useState(true);

  const [nextChoiceOpen, setNextChoiceOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const isCallingRef = useRef(false);

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    const prev = robots?.getAttribute('content');
    robots?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (prev) robots?.setAttribute('content', prev);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc('get_crew_queue_data', { p_token: token });
    if (error || !data) {
      if (!event) setInvalid(true);
      return;
    }
    setInvalid(false);
    setEvent(data.event);
    setQueues(data.queues || []);
    setLoading(false);
  }, [token, event]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  usePolling(refresh, 8000, !invalid && !!token);

  // Realtime subscription via websocket
  useEffect(() => {
    const eventId = event?.id;
    if (!eventId || invalid) return undefined;

    const channel = supabase
      .channel(`crew_queue_rt_${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_queues', filter: `event_id=eq.${eventId}` },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event?.id, invalid, refresh]);

  const active = useMemo(() => queues.find(isActive) || null, [queues]);
  const waiting = useMemo(() => queues.filter((q) => q.status === 'waiting'), [queues]);
  const completedCount = useMemo(() => queues.filter((q) => q.status === 'completed').length, [queues]);

  const visibleQueues = useMemo(() => {
    const needle = queueSearch.trim().toLowerCase();
    return queues.filter((q) => {
      if (tab === 'active' && !(q.status === 'waiting' || isActive(q))) return false;
      if (tab === 'completed' && q.status !== 'completed') return false;
      if (!needle) return true;
      return (
        (q.customer_name || '').toLowerCase().includes(needle) ||
        (q.queue_number || '').toLowerCase().includes(needle) ||
        (q.customer_phone || '').includes(needle)
      );
    });
  }, [queues, tab, queueSearch]);

  const run = async (fn, errorMessage) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast.error(errorMessage || 'Gagal memproses aksi');
    } finally {
      setBusy(false);
    }
  };

  const requestCallNext = async () => {
    if (isCallingRef.current || busy) return;
    isCallingRef.current = true;
    setBusy(true);

    try {
      if (waiting.length === 0) {
        toast('Tidak ada tamu yang menunggu');
        isCallingRef.current = false;
        setBusy(false);
        return;
      }
      if (active) {
        setNextChoiceOpen(true);
        setBusy(false);
      } else {
        await callNext('complete');
      }
    } catch {
      isCallingRef.current = false;
      setBusy(false);
    }
  };

  const callNext = (currentAction = 'complete') =>
    run(async () => {
      unlockAudio();
      try {
        const { data, error } = await supabase.rpc('crew_queue_call_next', {
          p_token: token,
          p_auto_session: autoSession,
          p_current_action: currentAction,
        });
        if (error) throw error;
        await refresh();
        if (!data) {
          toast('Tidak ada tamu yang menunggu');
          return;
        }
        playChime(0.8);
        toast.success(`Memanggil ${data.queue_number}`);
      } finally {
        setTimeout(() => {
          isCallingRef.current = false;
        }, 800);
      }
    }, 'Gagal memanggil antrian');

  const complete = (item) =>
    run(async () => {
      const { error } = await supabase.rpc('crew_queue_complete', {
        p_token: token,
        p_id: item.id,
        p_auto_session: autoSession,
      });
      if (error) throw error;
      await refresh();
      toast.success(autoSession ? `${item.queue_number} selesai, sesi foto dicatat` : `${item.queue_number} selesai`);
    }, 'Gagal menyelesaikan antrian');

  const startServing = (item) =>
    run(async () => {
      const { error } = await supabase.rpc('crew_queue_start', { p_token: token, p_id: item.id });
      if (error) throw error;
      setQueues((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: 'serving' } : q)));
      toast.success(`${item.queue_number} mulai difoto`);
    }, 'Gagal memulai sesi foto');

  const recall = (item) =>
    run(async () => {
      unlockAudio();
      const { error } = await supabase.rpc('crew_queue_recall', { p_token: token, p_id: item.id });
      if (error) throw error;
      playChime(0.8);
      await refresh();
      toast.success(`Memanggil ulang ${item.queue_number}`);
    }, 'Gagal memanggil ulang');

  const skip = (item) =>
    run(async () => {
      const { error } = await supabase.rpc('crew_queue_skip', { p_token: token, p_id: item.id });
      if (error) throw error;
      await refresh();
      toast.success(`${item.queue_number} dilewati`);
    }, 'Gagal melewati antrian');

  const requeue = (item) =>
    run(async () => {
      const { error } = await supabase.rpc('crew_queue_requeue', { p_token: token, p_id: item.id });
      if (error) throw error;
      await refresh();
      toast.success(`${item.queue_number} kembali ke antrean`);
    }, 'Gagal mengembalikan antrian');

  const changePrints = async (item, delta) => {
    const next = Math.min(50, Math.max(0, (item.prints || 0) + delta));
    if (next === (item.prints || 0)) return;
    setQueues((prev) => prev.map((q) => (q.id === item.id ? { ...q, prints: next } : q)));
    const { error } = await supabase.rpc('crew_queue_update_item', {
      p_token: token,
      p_id: item.id,
      p_prints: next,
    });
    if (error) {
      await refresh();
      toast.error('Gagal menyimpan jumlah print');
    }
  };

  const setNoVoucher = async (item, value) => {
    if (!!item.no_voucher === value) return;
    setQueues((prev) => prev.map((q) => (q.id === item.id ? { ...q, no_voucher: value } : q)));
    const { error } = await supabase.rpc('crew_queue_update_item', {
      p_token: token,
      p_id: item.id,
      p_no_voucher: value,
    });
    if (error) {
      await refresh();
      toast.error('Gagal menyimpan status voucher');
    }
  };

  const handleAddManual = async (e) => {
    e?.preventDefault?.();
    setAddingGuest(true);
    try {
      const { data, error } = await supabase.rpc('crew_queue_add_manual', {
        p_token: token,
        p_name: '',
        p_phone: '',
      });
      if (error) throw error;
      toast.success(`Nomor ${data.queue_number} berhasil diterbitkan`);
      setAddOpen(false);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menambah antrian: ' + (err.message || 'Error'));
    } finally {
      setAddingGuest(false);
    }
  };

  const remove = (item) =>
    run(async () => {
      const { error } = await supabase.rpc('crew_queue_remove', { p_token: token, p_id: item.id });
      if (error) throw error;
      setQueues((prev) => prev.filter((q) => q.id !== item.id));
      toast.success('Antrian dihapus');
    }, 'Gagal menghapus antrian');

  const percentMode = event?.pricing_mode === 'percent';
  const priceOf = (item) => {
    const voucher = event?.voucher_price ?? 30000;
    const noVoucher = event?.no_voucher_price ?? 35000;
    const printPrice = event?.print_price ?? 10000;
    const base = percentMode ? (event?.session_price ?? 45000) : item.no_voucher ? noVoucher : voucher;
    const prints = item.prints || 0;
    return { base, printPrice, prints, total: base + prints * printPrice };
  };

  const waLink = (item) => {
    const lines = [
      `Halo Kak ${item.customer_name || 'Tamu'},`,
      '',
      `Nomor antrian photobooth Kakak: *${item.queue_number}*${event?.name ? ` (${event.name})` : ''}.`,
      isActive(item)
        ? 'Sekarang giliran Kakak. Silakan menuju booth dan tunjukkan pesan ini ke kru kami.'
        : 'Giliran Kakak sebentar lagi. Mohon bersiap dan mendekat ke area booth.',
      '',
      'Terima kasih,',
      'Tim SnapHub',
    ];
    return `https://wa.me/${toWaNumber(item.customer_phone)}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  if (invalid) {
    return (
      <div data-theme={theme} className="min-h-screen flex items-center justify-center bg-[var(--admin-bg)] text-[var(--admin-text-main)] p-6 text-center">
        <div className="max-w-xs">
          <img src="/icons.svg" alt="SnapHub" className="h-8 w-auto mx-auto mb-4" />
          <h1 className="text-xl font-bold">Link Kru Tidak Valid</h1>
          <p className="text-sm text-[var(--admin-text-muted)] mt-2">
            Link akses kru antrian tidak ditemukan atau sudah dicabut oleh Admin.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !event) {
    return (
      <div data-theme={theme} className="min-h-screen flex flex-col items-center justify-center bg-[var(--admin-bg)] text-[var(--admin-text-main)] gap-3.5 p-6">
        <div className="w-8 h-8 border-[3px] border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--admin-text-muted)] font-medium">Memuat kontrol antrian kru…</p>
      </div>
    );
  }

  const displayUrl = queueDisplayUrl(event);
  const qrPageUrl = queueQrUrl(event);

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)]" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#222', color: '#fff' } }} />

      {/* ── Header Kru ── */}
      <header className="sticky top-0 z-30 bg-[var(--admin-bg)]/95 backdrop-blur border-b border-[var(--admin-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img src="/icons.svg" alt="SnapHub" className="h-6 sm:h-7 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold leading-tight truncate text-sm sm:text-base">{event?.name}</h1>
                <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Mode Kru
                </span>
              </div>
              <p className="text-xs text-[var(--admin-text-muted)]">{formatDate(event?.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {qrPageUrl && (
              <a href={qrPageUrl} target="_blank" rel="noopener noreferrer" className="ui-btn" title="Buka Halaman QR Booth">
                <FiGrid size={15} /> <span className="hidden sm:inline">QR Booth</span>
              </a>
            )}
            {displayUrl && (
              <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="ui-btn" title="Buka Layar TV">
                <FiExternalLink size={15} /> <span className="hidden sm:inline">Layar TV</span>
              </a>
            )}
            <button onClick={toggleTheme} className="ui-btn ui-btn-icon" aria-label="Ganti tema">
              {theme === 'dark' ? <FiMoon size={15} /> : <FiSun size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Konten Kontrol Antrian ── */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-[max(3rem,env(safe-area-inset-bottom))] space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Card: Sedang Dilayani */}
          <section className="ui-card p-4 sm:p-6 lg:col-span-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text-muted)]">Sedang dilayani</h2>
              {active && <span className="ui-status" data-tone="live">{statusMeta(active.status).label}</span>}
            </div>

            {active ? (
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-5xl sm:text-6xl font-bold font-mono tracking-tight num leading-none">{active.queue_number}</p>
                    {active.customer_name && active.customer_name !== 'Tamu' ? (
                      <p className="text-base sm:text-lg font-medium mt-2 truncate">{active.customer_name}</p>
                    ) : null}
                    <p className="text-xs sm:text-sm text-[var(--admin-text-muted)] mt-0.5">
                      Dipanggil {active.called_count || 1}×
                      {active.customer_phone && (
                        <>
                          {' · '}
                          <a href={waLink(active)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--admin-text-main)] underline underline-offset-2">
                            <SiWhatsapp size={12} aria-hidden="true" /> Kirim pesan
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  {(() => {
                    const price = priceOf(active);
                    return (
                      <div className="rounded-2xl bg-[var(--admin-accent-bg)] border border-[var(--admin-accent)]/30 px-3 py-2 text-right min-w-[7.5rem]" aria-live="polite">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-text-muted)]">Total bayar</p>
                        <p className="text-xl sm:text-2xl font-bold num text-[var(--admin-accent)] leading-tight">{formatRupiah(price.total)}</p>
                        <p className="text-[10px] sm:text-xs text-[var(--admin-text-muted)] leading-tight mt-0.5">
                          {percentMode ? 'Sesi ' : ''}{formatRupiah(price.base)}
                          {price.prints > 0 && ` + ${price.prints}×${formatRupiah(price.printPrice).replace('Rp ', '')}`}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Print Tambahan & Opsi Voucher */}
                <div className="rounded-2xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] p-2.5 sm:p-3 flex items-center justify-between gap-2 overflow-x-auto">
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="text-[11px] sm:text-xs font-semibold text-[var(--admin-text-muted)] whitespace-nowrap">Print tambahan</span>
                    <div className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-bg)] p-0.5">
                      <button
                        type="button"
                        onClick={() => changePrints(active, -1)}
                        disabled={(active.prints || 0) <= 0}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold hover:bg-[var(--admin-hover-bg)] disabled:opacity-30"
                        aria-label="Kurangi cetak"
                      >
                        –
                      </button>
                      <span className="w-6 sm:w-8 text-center font-mono font-bold num text-xs sm:text-sm">{active.prints || 0}</span>
                      <button
                        type="button"
                        onClick={() => changePrints(active, 1)}
                        disabled={(active.prints || 0) >= 50}
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold hover:bg-[var(--admin-hover-bg)] disabled:opacity-30"
                        aria-label="Tambah cetak"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {!percentMode && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs cursor-pointer select-none shrink-0 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={!!active.no_voucher}
                        onChange={(e) => setNoVoucher(active, e.target.checked)}
                        className="rounded border-[var(--admin-border)] w-3.5 h-3.5 accent-[#D90429]"
                      />
                      <span>Tanpa voucher (+Rp 5.000)</span>
                    </label>
                  )}
                </div>

                {/* Tombol Aksi Tamu Aktif */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-1">
                  {active.status !== 'serving' ? (
                    <button onClick={() => startServing(active)} disabled={busy} className="ui-btn ui-btn-primary px-1.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                      <FiCamera size={14} className="shrink-0" /> <span>Mulai Foto</span>
                    </button>
                  ) : (
                    <button onClick={() => complete(active)} disabled={busy} className="ui-btn ui-btn-primary px-1.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                      <FiCheck size={14} className="shrink-0" /> <span>Selesai</span>
                    </button>
                  )}
                  <button onClick={() => recall(active)} disabled={busy} className="ui-btn px-1.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                    <span>Panggil Ulang</span>
                  </button>
                  <button onClick={() => skip(active)} disabled={busy} className="ui-btn px-1.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                    <FiSkipForward size={14} className="shrink-0" /> <span>Lewati</span>
                  </button>
                  {active.status !== 'serving' && (
                    <button onClick={() => complete(active)} disabled={busy} className="ui-btn ui-btn-ghost text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-1.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap">
                      <FiCheck size={14} className="shrink-0" /> <span>Selesai</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-base font-semibold">Tidak ada tamu yang sedang aktif</p>
                <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                  Tekan tombol di bawah untuk memanggil antrian berikutnya.
                </p>
              </div>
            )}
          </section>

          {/* Card: Tombol Panggil Berikutnya */}
          <section className="ui-card p-4 sm:p-6 lg:col-span-2 flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--admin-text-muted)]">Aksi Cepat</h2>
              <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                {waiting.length} tamu sedang menunggu giliran.
              </p>
            </div>

            <button
              onClick={requestCallNext}
              disabled={busy || waiting.length === 0}
              className="ui-btn ui-btn-primary ui-btn-lg w-full py-4 text-base font-bold shadow-lg shadow-[#D90429]/25 flex items-center justify-center gap-2"
            >
              <FiPlay size={18} /> Panggil Berikutnya {waiting.length > 0 ? `(${waiting[0].queue_number})` : ''}
            </button>

            <label className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)] select-none">
              <input
                type="checkbox"
                checked={autoSession}
                onChange={(e) => setAutoSession(e.target.checked)}
                className="rounded border-[var(--admin-border)]"
              />
              <span>Otomatis catat sesi foto saat selesai</span>
            </label>
          </section>
        </div>

        {/* ── Daftar Semua Antrean ── */}
        <section className="ui-card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0.5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      tab === t.id ? 'bg-[var(--admin-primary)] text-white shadow-sm' : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]'
                    }`}
                  >
                    {t.label}
                    {t.id === 'active' && waiting.length > 0 && ` (${waiting.length})`}
                    {t.id === 'completed' && completedCount > 0 && ` (${completedCount})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-48">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={13} />
                <input
                  type="search"
                  placeholder="Cari..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="ui-input pl-8 py-1.5 text-xs w-full"
                />
              </div>
              <button onClick={() => setAddOpen(true)} className="ui-btn ui-btn-primary shrink-0 gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap">
                <FiPlus size={14} /> <span>Tambah Manual</span>
              </button>
            </div>
          </div>

          {visibleQueues.length === 0 ? (
            <p className="text-center text-xs text-[var(--admin-text-muted)] py-10">Tidak ada antrian pada tab ini.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--admin-border-subtle)] text-[var(--admin-text-muted)] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Nomor</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Print</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border-subtle)]">
                  {visibleQueues.map((item) => {
                    const activeRow = isActive(item);
                    return (
                      <tr key={item.id} className={activeRow ? 'bg-[var(--admin-hover-bg)] font-medium' : ''}>
                        <td className="py-2.5 px-3 font-mono font-bold num text-sm text-[var(--admin-text-main)]">
                          {item.queue_number}
                          {item.customer_name && item.customer_name !== 'Tamu' ? (
                            <span className="block font-sans text-xs font-normal text-[var(--admin-text-muted)] truncate">{item.customer_name}</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="ui-status text-[11px]" data-tone={statusMeta(item.status).tone}>
                            {statusMeta(item.status).label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono num">{item.prints || 0}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            {item.status === 'waiting' && (
                              <button onClick={() => startServing(item)} className="ui-btn ui-btn-sm" title="Mulai layani nomor ini">
                                Panggil
                              </button>
                            )}
                            {item.status === 'skipped' && (
                              <button onClick={() => requeue(item)} className="ui-btn ui-btn-sm" title="Kembalikan ke antrean">
                                <FiRotateCcw size={12} />
                              </button>
                            )}
                            <button onClick={() => setToDelete(item)} className="ui-btn ui-btn-sm ui-btn-icon text-rose-400 hover:bg-rose-500/10" title="Hapus antrian">
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── Modal Panggil Berikutnya (Pilih Nasib Tamu Aktif) ── */}
      {nextChoiceOpen && active && (
        <Modal
          title={`Selesaikan nomor ${active.queue_number}?`}
          description="Masih ada tamu aktif di booth. Pilih nasib tamu tersebut sebelum memanggil nomor berikutnya."
          onClose={() => setNextChoiceOpen(false)}
          footer={
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setNextChoiceOpen(false);
                  callNext('skip');
                }}
                className="ui-btn w-full sm:w-auto"
              >
                Tidak datang (lewati)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setNextChoiceOpen(false);
                  callNext('complete');
                }}
                className="ui-btn ui-btn-primary w-full sm:w-auto"
              >
                Selesai & lanjut
              </button>
            </>
          }
        />
      )}

      {/* ── Modal Tambah Antrian Manual ── */}
      {addOpen && (
        <Modal
          title="Tambah antrian manual"
          description="Untuk tamu walk-in atau tanpa HP."
          size="sm"
          onClose={() => setAddOpen(false)}
          footer={
            <div className="w-full flex justify-end gap-2">
              <button
                type="button"
                disabled={addingGuest}
                onClick={handleAddManual}
                className="ui-btn ui-btn-primary w-full"
              >
                {addingGuest ? 'Menerbitkan…' : `Terbitkan Nomor A-${String((queues.reduce((max, q) => Math.max(max, q.seq_number || 0), 0) || 0) + 1).padStart(2, '0')}`}
              </button>
            </div>
          }
        />
      )}

      {/* ── Modal Hapus ── */}
      {toDelete && (
        <Modal
          title="Hapus antrian?"
          description={`${toDelete.queue_number} akan dihapus permanen.`}
          size="sm"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button onClick={() => setToDelete(null)} className="ui-btn">Batal</button>
              <button onClick={() => { const item = toDelete; setToDelete(null); remove(item); }} className="ui-btn ui-btn-solid-danger">Hapus</button>
            </>
          }
        />
      )}
    </div>
  );
};

export default QueueCrew;
