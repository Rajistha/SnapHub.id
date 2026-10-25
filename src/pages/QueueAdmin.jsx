import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { SiWhatsapp } from 'react-icons/si';
import {
  FiArrowLeft, FiSun, FiMoon, FiSearch, FiChevronRight, FiCopy, FiExternalLink,
  FiTrash2, FiGrid, FiRefreshCw, FiPlay, FiCheck, FiSkipForward, FiVolume2, FiRotateCcw, FiShare2,
} from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import useAdminSession from '../lib/useAdminSession';
import usePolling from '../lib/usePolling';
import { playChime, unlockAudio } from '../lib/chime';
import { isActive, statusMeta, toWaNumber } from '../lib/queueStatus';
import {
  MONTHS, daysUntil, formatDate, getAdminUrl, newToken, queueDisplayUrl, queueGuestUrl, queueQrUrl, todayString,
} from '../lib/appUrls';
import AdminLogin from '../components/ui/AdminLogin';
import Modal from '../components/ui/Modal';

const QUEUE_COLUMNS = 'id,event_id,queue_number,seq_number,customer_name,customer_phone,status,called_count,called_at,created_at';

const sortBySeq = (rows) => [...rows].sort((a, b) => a.seq_number - b.seq_number);

const TABS = [
  { id: 'active', label: 'Antrean' },
  { id: 'completed', label: 'Selesai' },
  { id: 'all', label: 'Semua' },
];

const QueueAdmin = () => {
  const { session, loading: authLoading, theme, toggleTheme } = useAdminSession();

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [queues, setQueues] = useState([]);
  const [loadingQueues, setLoadingQueues] = useState(false);
  const [tab, setTab] = useState('active');
  const [queueSearch, setQueueSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoSession, setAutoSession] = useState(true);

  const [shareOpen, setShareOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const tokenRequested = useRef(new Set());

  /* ── Event ─────────────────────────────────────────────── */
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    const { data, error } = await supabase
      .from('financial_events')
      .select('id,name,date,queue_token')
      .order('date', { ascending: false });
    if (error) toast.error('Gagal mengambil daftar event');
    setEvents(data || []);
    setLoadingEvents(false);
  }, []);

  useEffect(() => {
    if (session) fetchEvents();
  }, [session, fetchEvents]);

  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedEventId) || null, [events, selectedEventId]);

  const patchEvent = (id, patch) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  // Token antrian dibuat sekali per event (terpisah dari link live).
  useEffect(() => {
    if (!selectedEvent || selectedEvent.queue_token || tokenRequested.current.has(selectedEvent.id)) return;
    tokenRequested.current.add(selectedEvent.id);
    const token = newToken();
    supabase
      .from('financial_events')
      .update({ queue_token: token })
      .eq('id', selectedEvent.id)
      .then(({ error }) => {
        if (error) {
          toast.error('Gagal membuat link antrian');
          return;
        }
        patchEvent(selectedEvent.id, { queue_token: token });
      });
  }, [selectedEvent]);

  /* ── Antrian: realtime menggabungkan perubahan langsung ke state, polling hanya cadangan ── */
  const fetchQueues = useCallback(async (eventId, showSpinner = false) => {
    if (showSpinner) setLoadingQueues(true);
    const { data, error } = await supabase
      .from('event_queues')
      .select(QUEUE_COLUMNS)
      .eq('event_id', eventId)
      .order('seq_number', { ascending: true });
    if (!error && data) setQueues(data);
    if (showSpinner) setLoadingQueues(false);
  }, []);

  useEffect(() => {
    if (!selectedEventId) return undefined;
    setQueues([]);
    fetchQueues(selectedEventId, true);

    const channel = supabase
      .channel(`admin_queue_${selectedEventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_queues', filter: `event_id=eq.${selectedEventId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setQueues((prev) => prev.filter((q) => q.id !== payload.old.id));
            return;
          }
          const row = payload.new;
          setQueues((prev) =>
            sortBySeq(prev.some((q) => q.id === row.id) ? prev.map((q) => (q.id === row.id ? { ...q, ...row } : q)) : [...prev, row])
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, fetchQueues]);

  // Cadangan bila koneksi realtime terputus; jarang dan berhenti saat tab tersembunyi.
  usePolling(() => selectedEventId && fetchQueues(selectedEventId), 20000, !!selectedEventId);

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

  /* ── Aksi ──────────────────────────────────────────────── */
  const run = async (fn, errorMessage) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast.error(errorMessage);
    } finally {
      setBusy(false);
    }
  };

  const callNext = () =>
    run(async () => {
      unlockAudio();
      const { data, error } = await supabase.rpc('admin_queue_call_next', {
        p_event_id: selectedEventId,
        p_auto_session: autoSession,
      });
      if (error) throw error;
      await fetchQueues(selectedEventId);
      if (!data) {
        toast('Tidak ada tamu yang menunggu');
        return;
      }
      playChime(0.5);
      toast.success(`Memanggil ${data.queue_number} · ${data.customer_name}`);
    }, 'Gagal memanggil antrian');

  const complete = (item) =>
    run(async () => {
      const { error } = await supabase.rpc('admin_queue_complete', { p_id: item.id, p_auto_session: autoSession });
      if (error) throw error;
      await fetchQueues(selectedEventId);
      toast.success(autoSession ? `${item.queue_number} selesai, sesi foto dicatat` : `${item.queue_number} selesai`);
    }, 'Gagal menyelesaikan antrian');

  const updateRow = (item, patch, okMessage, errorMessage) =>
    run(async () => {
      const { error } = await supabase.from('event_queues').update(patch).eq('id', item.id);
      if (error) throw error;
      setQueues((prev) => prev.map((q) => (q.id === item.id ? { ...q, ...patch } : q)));
      if (okMessage) toast.success(okMessage);
    }, errorMessage);

  const recall = (item) => {
    unlockAudio();
    playChime(0.5);
    return updateRow(
      item,
      { called_at: new Date().toISOString(), called_count: (item.called_count || 0) + 1 },
      `Memanggil ulang ${item.queue_number}`,
      'Gagal memanggil ulang'
    );
  };

  const skip = (item) => updateRow(item, { status: 'skipped' }, `${item.queue_number} dilewati`, 'Gagal melewati antrian');
  const requeue = (item) => updateRow(item, { status: 'waiting' }, `${item.queue_number} kembali ke antrean`, 'Gagal mengembalikan antrian');

  const remove = (item) =>
    run(async () => {
      const { error } = await supabase.from('event_queues').delete().eq('id', item.id);
      if (error) throw error;
      setQueues((prev) => prev.filter((q) => q.id !== item.id));
      toast.success('Antrian dihapus');
    }, 'Gagal menghapus antrian');

  const regenerateToken = () =>
    run(async () => {
      const token = newToken();
      const { error } = await supabase.from('financial_events').update({ queue_token: token }).eq('id', selectedEvent.id);
      if (error) throw error;
      patchEvent(selectedEvent.id, { queue_token: token });
      toast.success('Link baru dibuat. QR lama tidak berlaku lagi.');
    }, 'Gagal membuat link baru');

  const copy = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('Gagal menyalin');
    }
  };

  const waLink = (item) => {
    const lines = [
      `Halo Kak ${item.customer_name},`,
      '',
      `Nomor antrian photobooth Kakak: *${item.queue_number}*${selectedEvent?.name ? ` (${selectedEvent.name})` : ''}.`,
      isActive(item)
        ? 'Sekarang giliran Kakak. Silakan menuju booth dan tunjukkan pesan ini ke kru kami.'
        : 'Giliran Kakak sebentar lagi. Mohon bersiap dan mendekat ke area booth.',
      '',
      'Terima kasih,',
      'Tim SnapHub',
    ];
    return `https://wa.me/${toWaNumber(item.customer_phone)}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  /* ── Daftar event ──────────────────────────────────────── */
  const todayStr = todayString();
  const eventGroups = useMemo(() => {
    const needle = eventSearch.trim().toLowerCase();
    const filtered = events.filter((ev) => (ev.name || '').toLowerCase().includes(needle));
    return [
      { key: 'upcoming', title: 'Akan datang', dim: false, list: filtered.filter((e) => (e.date || '') >= todayStr).sort((a, b) => (a.date || '').localeCompare(b.date || '')) },
      { key: 'past', title: 'Sudah lewat', dim: true, list: filtered.filter((e) => (e.date || '') < todayStr).sort((a, b) => (b.date || '').localeCompare(a.date || '')) },
    ];
  }, [events, eventSearch, todayStr]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#050505]"><div className="w-8 h-8 border-[3px] border-[#D90429] border-t-transparent rounded-full animate-spin" role="status" aria-label="Memuat" /></div>;
  }
  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <AdminLogin title="Kelola Antrian" subtitle="Masuk untuk memanggil dan mengatur antrian photobooth." />
      </>
    );
  }

  const guestUrl = queueGuestUrl(selectedEvent);
  const displayUrl = queueDisplayUrl(selectedEvent);
  const qrPageUrl = queueQrUrl(selectedEvent);

  const themeToggle = (
    <button onClick={toggleTheme} className="ui-btn ui-btn-icon" aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}>
      {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)]" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#222', color: '#fff' } }} />

      {/* ── Pilih event ── */}
      {!selectedEvent && (
        <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
          <header className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <a href={getAdminUrl()} className="ui-btn ui-btn-icon" aria-label="Kembali ke Admin"><FiArrowLeft size={16} /></a>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold leading-tight">Antrian</h1>

              </div>
            </div>
            {themeToggle}
          </header>

          <div className="relative mb-5">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={15} aria-hidden="true" />
            <input type="search" aria-label="Cari event" placeholder="Cari event" value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} className="ui-input pl-10" />
          </div>

          {loadingEvents ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-[3px] border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="Memuat" /></div>
          ) : events.length === 0 ? (
            <p className="text-center text-[var(--admin-text-muted)] py-16">Belum ada event. Tambahkan lewat menu Keuangan Event.</p>
          ) : (
            eventGroups.map((group) =>
              group.list.length === 0 ? null : (
                <section key={group.key} className="mb-6">
                  <h2 className="text-sm font-semibold text-[var(--admin-text-muted)] mb-2 px-1">{group.title} · {group.list.length}</h2>
                  <ul className="ui-card divide-y divide-[var(--admin-border)] overflow-hidden">
                    {group.list.map((ev) => {
                      const d = ev.date && !group.dim ? daysUntil(ev.date, todayStr) : null;
                      return (
                        <li key={ev.id}>
                          <button onClick={() => setSelectedEventId(ev.id)} className="w-full flex items-center gap-4 text-left px-4 py-3.5 hover:bg-[var(--admin-hover-bg)] transition-colors">
                            <div className="w-11 shrink-0 text-center leading-none">
                              <div className="text-lg font-semibold num">{ev.date ? Number(ev.date.slice(8, 10)) : '–'}</div>
                              <div className="text-xs text-[var(--admin-text-muted)] mt-1">{ev.date ? MONTHS[Number(ev.date.slice(5, 7)) - 1] : ''}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`font-medium truncate ${group.dim ? 'text-[var(--admin-text-muted)]' : ''}`}>{ev.name}</p>
                              {d !== null && (
                                <p className="text-sm text-[var(--admin-text-muted)]">{d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari lagi`}</p>
                              )}
                            </div>
                            <FiChevronRight className="text-[var(--admin-text-muted)] shrink-0" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )
            )
          )}
        </div>
      )}

      {/* ── Kontrol antrian ── */}
      {selectedEvent && (
        <div>
          <header className="sticky top-0 z-30 bg-[var(--admin-bg)]/95 backdrop-blur border-b border-[var(--admin-border)]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setSelectedEventId(null)} className="ui-btn ui-btn-icon" aria-label="Kembali ke daftar event"><FiArrowLeft size={16} /></button>
                <div className="min-w-0">
                  <h1 className="font-semibold leading-tight truncate">{selectedEvent.name}</h1>
                  <p className="text-sm text-[var(--admin-text-muted)]">{formatDate(selectedEvent.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShareOpen(true)} className="ui-btn" disabled={!guestUrl}>
                  <FiShare2 size={15} /> <span className="hidden sm:inline">Bagikan</span>
                </button>
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
                {themeToggle}
              </div>
            </div>
          </header>

          <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Sedang dilayani */}
              <section className="ui-card p-5 sm:p-6 lg:col-span-3" aria-live="polite">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-sm font-semibold text-[var(--admin-text-muted)]">Sedang dilayani</h2>
                  {active && <span className="ui-status" data-tone="live">{statusMeta(active.status).label}</span>}
                </div>

                {active ? (
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                    <div className="min-w-0">
                      <p className="text-6xl font-bold font-mono tracking-tight num leading-none">{active.queue_number}</p>
                      <p className="text-lg font-medium mt-3 truncate">{active.customer_name}</p>
                      <p className="text-sm text-[var(--admin-text-muted)] mt-1">
                        Dipanggil {active.called_count || 1}×
                        {active.customer_phone && (
                          <>
                            {' · '}
                            <a href={waLink(active)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--admin-text-main)] underline underline-offset-2">
                              <SiWhatsapp size={13} aria-hidden="true" /> Kirim pesan
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:w-52 shrink-0">
                      <button onClick={() => complete(active)} disabled={busy} className="ui-btn ui-btn-ok ui-btn-lg">
                        <FiCheck size={18} /> Selesai
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => recall(active)} disabled={busy} className="ui-btn ui-btn-sm"><FiVolume2 size={14} /> Panggil lagi</button>
                        <button onClick={() => skip(active)} disabled={busy} className="ui-btn ui-btn-sm"><FiSkipForward size={14} /> Lewati</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8">
                    <p className="font-medium">Belum ada tamu yang dipanggil</p>

                  </div>
                )}
              </section>

              {/* Berikutnya */}
              <section className="ui-card p-5 sm:p-6 lg:col-span-2 flex flex-col">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-sm font-semibold text-[var(--admin-text-muted)]">Berikutnya</h2>
                  <span className="text-sm text-[var(--admin-text-muted)] num">{waiting.length} menunggu</span>
                </div>

                {waiting[0] ? (
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{waiting[0].customer_name}</p>
                      <p className="text-sm text-[var(--admin-text-muted)] font-mono">{waiting[0].customer_phone || 'Tanpa nomor'}</p>
                    </div>
                    <p className="text-3xl font-bold font-mono num">{waiting[0].queue_number}</p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--admin-text-muted)] mb-4">Tidak ada tamu yang menunggu.</p>
                )}

                <div className="mt-auto space-y-3">
                  <button onClick={callNext} disabled={busy || waiting.length === 0} className="ui-btn ui-btn-primary ui-btn-lg w-full">
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
                  <button onClick={() => fetchQueues(selectedEventId, true)} className="ui-btn ui-btn-icon shrink-0" aria-label="Muat ulang">
                    <FiRefreshCw size={15} className={loadingQueues ? 'animate-spin' : ''} />
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
                        <span className="w-14 shrink-0 font-mono font-semibold num">{item.queue_number}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.customer_name}</p>
                          <p className="text-sm text-[var(--admin-text-muted)] truncate">
                            <span className="font-mono">{item.customer_phone || '–'}</span>
                            {' · '}
                            {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
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
        </div>
      )}

      {shareOpen && selectedEvent && (
        <Modal
          title="Bagikan antrian"
          description={selectedEvent.name}
          onClose={() => setShareOpen(false)}
          footer={
            <>
              <button onClick={() => copy(displayUrl, 'Link layar TV disalin')} className="ui-btn"><FiCopy size={14} /> Salin link TV</button>
              <button onClick={() => copy(guestUrl, 'Link tiket tamu disalin')} className="ui-btn ui-btn-primary"><FiCopy size={14} /> Salin link tamu</button>
            </>
          }
        >
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guestUrl)}`} alt="QR code untuk mengambil nomor antrian" width="192" height="192" className="w-48 h-48" />
            </div>
          </div>

          <button
            onClick={() => setConfirmRegen(true)}
            className="mt-4 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] underline underline-offset-2 mx-auto block"
          >
            Buat ulang link (cabut akses lama)
          </button>
        </Modal>
      )}

      {confirmRegen && (
        <Modal
          title="Buat ulang link antrian?"
          description="QR dan link yang sudah dibagikan langsung tidak berlaku. Tiket tamu yang sudah diambil tetap aman."
          size="sm"
          onClose={() => setConfirmRegen(false)}
          footer={
            <>
              <button onClick={() => setConfirmRegen(false)} className="ui-btn">Batal</button>
              <button onClick={() => { setConfirmRegen(false); regenerateToken(); }} className="ui-btn ui-btn-primary">Buat ulang</button>
            </>
          }
        />
      )}

      {toDelete && (
        <Modal
          title="Hapus antrian?"
          description={`${toDelete.queue_number} · ${toDelete.customer_name} akan dihapus permanen.`}
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

export default QueueAdmin;
