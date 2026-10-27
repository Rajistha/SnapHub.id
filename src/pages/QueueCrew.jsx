import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { SiWhatsapp } from 'react-icons/si';
import {
  FiSun, FiMoon, FiSearch, FiExternalLink, FiTrash2, FiRefreshCw,
  FiPlay, FiCheck, FiSkipForward, FiVolume2, FiRotateCcw, FiCamera, FiPlus, FiGrid, FiArrowLeft, FiShare2, FiCopy
} from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import usePolling from '../lib/usePolling';
import { playChime, unlockAudio } from '../lib/chime';
import { isActive, statusMeta, toWaNumber } from '../lib/queueStatus';
import { formatRupiah } from '../lib/pricelistDefaults';
import { formatDate, queueDisplayUrl, queueQrUrl, queueGuestUrl, tokenFromSlug } from '../lib/appUrls';
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
  const [shareOpen, setShareOpen] = useState(false);
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

  const guestUrl = queueGuestUrl(event);
  const displayUrl = queueDisplayUrl(event);
  const qrPageUrl = queueQrUrl(event);

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)]" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#222', color: '#fff' } }} />

      {/* ── Header Kru ── */}
      <header className="sticky top-0 z-30 bg-[var(--admin-bg)]/95 backdrop-blur border-b border-[var(--admin-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => window.history.back()} className="ui-btn ui-btn-icon" aria-label="Kembali"><FiArrowLeft size={16} /></button>
            <div className="min-w-0">
              <h1 className="font-semibold leading-tight truncate">{event?.name || 'Mode Kru Antrian'}</h1>
              <p className="text-sm text-[var(--admin-text-muted)]">{formatDate(event?.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {guestUrl && (
              <button onClick={() => setShareOpen(true)} className="ui-btn" disabled={!guestUrl}>
                <FiShare2 size={15} /> <span className="hidden sm:inline">Bagikan</span>
              </button>
            )}
            {qrPageUrl && (
              <a href={qrPageUrl} target="_blank" rel="noopener noreferrer" className="ui-btn">
                <FiGrid size={15} /> <span className="hidden sm:inline">Halaman QR</span>
              </a>
            )}
            {displayUrl && (
              <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="ui-btn">
                <FiExternalLink size={15} /> <span className="hidden sm:inline">Layar TV</span>
              </a>
            )}
            <button onClick={toggleTheme} className="ui-btn ui-btn-icon" aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}>
              {theme === 'dark' ? <FiMoon size={15} /> : <FiSun size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Konten Kontrol Antrian ── */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-[max(3rem,env(safe-area-inset-bottom))] space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Sedang dilayani */}
          <section className="ui-card p-4 sm:p-6 lg:col-span-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text-muted)]">Sedang dilayani</h2>
              {active && <span className="ui-status" data-tone="live">{statusMeta(active.status).label}</span>}
            </div>

            {active ? (
              <div className="flex flex-col gap-3 sm:gap-4">
                {/* Identitas tamu + total bayar */}
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

                {/* Voucher + print */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {!percentMode && (
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--admin-border)] p-1" role="group" aria-label="Voucher">
                    {[{ v: false, label: 'Pakai voucher' }, { v: true, label: 'Tanpa voucher' }].map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => setNoVoucher(active, o.v)}
                        aria-pressed={!!active.no_voucher === o.v}
                        className={`rounded-lg min-h-10 px-2 text-sm font-semibold transition-colors ${
                          !!active.no_voucher === o.v
                            ? 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)] border border-[var(--admin-accent)]/30'
                            : 'text-[var(--admin-text-muted)] hover:bg-[var(--admin-hover-bg)] border border-transparent'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  )}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--admin-border)] pl-3 pr-1 py-1">
                    <span className="text-sm text-[var(--admin-text-muted)]">Print tambahan</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => changePrints(active, -1)} disabled={!active.prints} className="ui-btn ui-btn-icon min-h-10 min-w-10 text-lg" aria-label="Kurangi print">−</button>
                      <span className="w-6 text-center text-base font-semibold num" aria-live="polite">{active.prints || 0}</span>
                      <button type="button" onClick={() => changePrints(active, 1)} className="ui-btn ui-btn-icon min-h-10 min-w-10 text-lg" aria-label="Tambah print">+</button>
                    </div>
                  </div>
                </div>

                {/* Aksi */}
                {active.status === 'serving' ? (
                  <button onClick={() => complete(active)} disabled={busy} className="ui-btn ui-btn-ok ui-btn-lg w-full">
                    <FiCheck size={18} /> Selesai
                  </button>
                ) : (
                  <button onClick={() => startServing(active)} disabled={busy} className="ui-btn ui-btn-ok ui-btn-lg w-full">
                    <FiCamera size={18} /> Mulai foto
                  </button>
                )}
                <div className={`grid gap-2 ${active.status === 'serving' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {active.status !== 'serving' && (
                    <button onClick={() => recall(active)} disabled={busy} className="ui-btn min-h-11"><FiVolume2 size={15} /> Panggil lagi</button>
                  )}
                  <button onClick={() => skip(active)} disabled={busy} className="ui-btn min-h-11"><FiSkipForward size={15} /> Lewati</button>
                </div>
                {active.status !== 'serving' && (
                  <button onClick={() => complete(active)} disabled={busy} className="text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] underline underline-offset-2 mx-auto py-1">
                    Langsung tandai selesai
                  </button>
                )}
              </div>
            ) : (
              <div className="py-8">
                <p className="font-medium">Belum ada tamu yang dipanggil</p>
              </div>
            )}
          </section>

          {/* Berikutnya */}
          <section className="ui-card p-4 sm:p-6 lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text-muted)]">Berikutnya</h2>
              <span className="text-sm text-[var(--admin-text-muted)] num">{waiting.length} menunggu</span>
            </div>

            {waiting[0] ? (
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                  {waiting[0].customer_name && waiting[0].customer_name !== 'Tamu' ? (
                    <p className="font-medium truncate">{waiting[0].customer_name}</p>
                  ) : (
                    <p className="font-semibold text-sm text-[var(--admin-text-main)]">Antrian berikutnya</p>
                  )}
                  <p className="text-sm text-[var(--admin-text-muted)] font-mono">{waiting[0].customer_phone || ''}</p>
                </div>
                <p className="text-3xl font-bold font-mono num">{waiting[0].queue_number}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--admin-text-muted)] mb-4">Tidak ada tamu yang menunggu.</p>
            )}

            <div className="mt-auto space-y-3">
              <button type="button" onClick={requestCallNext} disabled={busy || waiting.length === 0} className="ui-btn ui-btn-primary ui-btn-lg w-full min-h-12">
                <FiPlay size={16} /> Panggil berikutnya
              </button>
              <label className="flex items-start gap-2.5 text-sm text-[var(--admin-text-muted)] cursor-pointer">
                <input type="checkbox" checked={autoSession} onChange={(e) => setAutoSession(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--admin-primary)]" />
                <span>Catat +1 sesi foto otomatis saat tamu selesai</span>
              </label>
            </div>
          </section>
        </div>

        {/* Daftar antrian */}
        <section className="ui-card">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--admin-border)]">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter antrian">
              {TABS.map((t) => {
                const count = t.id === 'active' ? waiting.length + (active ? 1 : 0) : t.id === 'completed' ? completedCount : queues.length;
                return (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="ui-tab">
                    {t.label} <span className="num opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={14} aria-hidden="true" />
                <input type="search" aria-label="Cari nama, nomor, atau WhatsApp" placeholder="Cari tamu" value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)} className="ui-input pl-9" />
              </div>
              <button onClick={() => refresh()} className="ui-btn ui-btn-icon shrink-0" aria-label="Muat ulang">
                <FiRefreshCw size={15} className={busy ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setAddOpen(true)} className="ui-btn ui-btn-primary shrink-0 gap-1.5" aria-label="Tambah manual">
                <FiPlus size={15} /> <span className="hidden sm:inline">Tambah</span>
              </button>
            </div>
          </div>

          {visibleQueues.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="font-medium">{queues.length === 0 ? 'Belum ada tamu yang mengambil tiket' : 'Tidak ada hasil'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {visibleQueues.map((item) => {
                const meta = statusMeta(item.status);
                return (
                  <li key={item.id} className="px-4 py-3 flex items-center gap-3 sm:gap-4">
                    <span className="w-14 shrink-0 font-mono font-bold text-lg num">{item.queue_number}</span>
                    <div className="min-w-0 flex-1">
                      {item.customer_name && item.customer_name !== 'Tamu' ? (
                        <p className="font-medium truncate">{item.customer_name}</p>
                      ) : null}
                      <p className="text-sm text-[var(--admin-text-muted)] truncate">
                        <span className="sm:hidden font-semibold text-[var(--admin-text-main)]">{meta.label} · </span>
                        {item.customer_phone ? <span className="font-mono">{item.customer_phone} · </span> : null}
                        {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        {!percentMode && item.no_voucher && ' · tanpa voucher'}
                        {item.prints > 0 && ` · +${item.prints} print`}
                      </p>
                    </div>
                    <span className="ui-status hidden sm:inline-flex" data-tone={meta.tone}>{meta.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {(item.status === 'skipped' || item.status === 'cancelled') && (
                        <button onClick={() => requeue(item)} className="ui-btn ui-btn-sm ui-btn-icon" aria-label={`Kembalikan ${item.queue_number} ke antrean`} title="Kembalikan ke antrean"><FiRotateCcw size={14} /></button>
                      )}
                      {item.customer_phone && (
                        <a href={waLink(item)} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-sm ui-btn-icon" aria-label={`Kirim WhatsApp ke ${item.customer_name}`} title="Kirim WhatsApp"><SiWhatsapp size={14} /></a>
                      )}
                      <button onClick={() => setToDelete(item)} className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" aria-label={`Hapus ${item.queue_number}`} title="Hapus"><FiTrash2 size={14} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* ── Modal Bagikan ── */}
      {shareOpen && event && (
        <Modal
          title="Tampilan Antrian & QR"
          description={event.name}
          onClose={() => setShareOpen(false)}
          footer={<button onClick={() => setShareOpen(false)} className="ui-btn">Tutup</button>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="ui-card p-4 hover:border-white/20 transition-all flex flex-col items-center text-center gap-2 group">
                <FiExternalLink className="text-[var(--admin-accent)] group-hover:scale-110 transition-transform" size={20} />
                <span className="text-sm font-semibold">Buka Layar TV</span>
                <span className="text-xs text-[var(--admin-text-muted)]">Tampilan nomor antrian live</span>
              </a>
              <a href={qrPageUrl} target="_blank" rel="noopener noreferrer" className="ui-card p-4 hover:border-white/20 transition-all flex flex-col items-center text-center gap-2 group">
                <FiGrid className="text-[var(--admin-accent)] group-hover:scale-110 transition-transform" size={20} />
                <span className="text-sm font-semibold">Halaman QR Tamu</span>
                <span className="text-xs text-[var(--admin-text-muted)]">Tampilkan di tablet untuk discan</span>
              </a>
            </div>
            <div className="pt-2 border-t border-[var(--admin-border)] flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--admin-text-muted)] truncate">{guestUrl}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(guestUrl);
                    toast.success('Link antrean disalin!');
                  } catch {
                    toast.error('Gagal menyalin link');
                  }
                }}
                className="ui-btn ui-btn-sm shrink-0"
              >
                <FiCopy size={13} /> Salin link
              </button>
            </div>
          </div>
        </Modal>
      )}

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
