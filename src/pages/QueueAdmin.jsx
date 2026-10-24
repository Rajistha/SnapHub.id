import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FiArrowLeft, FiSun, FiMoon, FiUsers, FiClock, 
  FiPhone, FiCheck, FiX, FiRefreshCw, FiExternalLink, 
  FiVolume2, FiCopy, FiShare2, FiTrash2, FiPlay, 
  FiSkipForward, FiCheckCircle, FiSearch, FiChevronRight,
  FiCalendar, FiTv, FiSmartphone, FiNavigation
} from 'react-icons/fi';
import { SiWhatsapp } from 'react-icons/si';
import toast, { Toaster } from 'react-hot-toast';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const daysUntil = (date, todayStr) =>
  Math.round((new Date(`${date}T00:00:00`) - new Date(`${todayStr}T00:00:00`)) / 86400000);

const formatDate = (date) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanpa tanggal';

const slugify = (text) =>
  (text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const getAdminUrl = () => {
  if (typeof window === 'undefined') return '/admin';
  const host = window.location.hostname;
  if (host.includes('snaphub.my.id')) {
    return 'https://snaphub.my.id/admin';
  }
  return '/admin';
};

const playChimeSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.25); // A5

    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
  } catch {}
};

const QueueAdmin = () => {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('adminTheme') || 'dark');

  // Event State
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventSearch, setEventSearch] = useState('');

  // Queue State
  const [queues, setQueues] = useState([]);
  const [loadingQueues, setLoadingQueues] = useState(false);
  const [activeTab, setActiveTab] = useState('waiting'); // 'waiting' | 'completed' | 'all'
  const [actionLoading, setActionLoading] = useState(false);
  const [autoAddSession, setAutoAddSession] = useState(true);
  const [queueSearch, setQueueSearch] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [queueToDelete, setQueueToDelete] = useState(null);

  useEffect(() => {
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  // Auth Check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Events
  useEffect(() => {
    if (session) {
      fetchEvents();
    }
  }, [session]);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('financial_events')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil daftar event');
    } finally {
      setLoadingEvents(false);
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;

  // Pastikan event memiliki token live/antrian
  useEffect(() => {
    if (selectedEvent && !selectedEvent.share_token) {
      const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
      supabase
        .from('financial_events')
        .update({ share_token: newToken })
        .eq('id', selectedEvent.id)
        .then(() => {
          setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, share_token: newToken } : e));
        });
    }
  }, [selectedEvent?.id, selectedEvent?.share_token]);

  // Realtime Queues Subscription & Auto Refresh
  useEffect(() => {
    if (!selectedEventId) return;

    fetchQueues(selectedEventId, true);

    // 1. Polling fallback setiap 3 detik agar pasti selalu update otomatis
    const timer = setInterval(() => {
      fetchQueues(selectedEventId, false);
    }, 3000);

    // 2. Realtime Supabase Channel
    const channel = supabase
      .channel(`admin_queue_${selectedEventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_queues' },
        (payload) => {
          if (
            !payload.new ||
            String(payload.new.event_id) === String(selectedEventId) ||
            String(payload.old?.event_id) === String(selectedEventId)
          ) {
            fetchQueues(selectedEventId, false);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [selectedEventId]);

  const fetchQueues = async (eventId, showLoading = true) => {
    if (showLoading) setLoadingQueues(true);
    try {
      const { data, error } = await supabase
        .from('event_queues')
        .select('*')
        .eq('event_id', eventId)
        .order('seq_number', { ascending: true });

      if (error) throw error;
      setQueues(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoadingQueues(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Login berhasil!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Queue Actions
  const handleCallNext = async () => {
    const nextItem = queues.find(q => q.status === 'waiting');
    if (!nextItem) {
      toast.error('Tidak ada antrian yang menunggu');
      return;
    }

    setActionLoading(true);
    try {
      // 1. Selesaikan item yang sedang aktif dipanggil bila ada
      const currentServing = queues.find(q => q.status === 'called' || q.status === 'heading' || q.status === 'serving');
      if (currentServing) {
        await handleComplete(currentServing, false);
      }

      // 2. Set next item ke status called
      const { error } = await supabase
        .from('event_queues')
        .update({
          status: 'called',
          called_at: new Date().toISOString(),
          called_count: (nextItem.called_count || 0) + 1
        })
        .eq('id', nextItem.id);

      if (error) throw error;
      playChimeSound();
      toast.success(`Memanggil nomor ${nextItem.queue_number} (${nextItem.customer_name})!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memanggil antrian');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecall = async (item) => {
    try {
      const { error } = await supabase
        .from('event_queues')
        .update({
          called_at: new Date().toISOString(),
          called_count: (item.called_count || 0) + 1
        })
        .eq('id', item.id);

      if (error) throw error;
      playChimeSound();
      toast.success(`Panggil ulang nomor ${item.queue_number}!`);
    } catch {
      toast.error('Gagal panggil ulang');
    }
  };

  const handleSkip = async (item) => {
    try {
      const { error } = await supabase
        .from('event_queues')
        .update({ status: 'skipped' })
        .eq('id', item.id);

      if (error) throw error;
      toast('Antrian dilewati');
    } catch {
      toast.error('Gagal melewati antrian');
    }
  };

  const handleComplete = async (item, notify = true) => {
    setActionLoading(true);
    try {
      // 1. Update status antrian ke completed
      const { error } = await supabase
        .from('event_queues')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) throw error;

      // 2. Jika opsi otomatis catat sesi foto aktif, panggil admin_add_session
      if (autoAddSession && selectedEventId) {
        try {
          const sessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
          await supabase.rpc('admin_add_session', {
            p_event_id: selectedEventId,
            p_id: sessionId,
            p_no_voucher: false,
            p_prints: 0
          });
        } catch (rpcErr) {
          console.warn('Gagal menambah sesi via RPC:', rpcErr);
        }
      }

      if (notify) {
        toast.success(`Sesi antrian ${item.queue_number} selesai & dicatat ke laporan!`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyelesaikan antrian');
    } finally {
      setActionLoading(false);
    }
  };

  const executeDelete = async (id) => {
    try {
      const { error } = await supabase.from('event_queues').delete().eq('id', id);
      if (error) throw error;
      toast.success('Antrian dihapus');
    } catch {
      toast.error('Gagal menghapus antrian');
    }
  };

  // WhatsApp Reminder Link
  const getWaReminderUrl = (item) => {
    let phone = (item.customer_phone || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);

    const eventNameLine = selectedEvent?.name ? `Acara: ${selectedEvent.name}\n` : '';
    const statusNotice = (item.status === 'called' || item.status === 'serving')
      ? 'Saat ini nomor antrian Anda sedang dipanggil. Silakan langsung menuju ke booth photobooth dan tunjukkan pesan ini kepada kru kami.'
      : 'Giliran sesi foto Anda akan segera tiba. Mohon kesediaannya untuk bersiap dan mendekat ke area photobooth.';

    const msg = 
`Yth. Kak ${item.customer_name},

Pemberitahuan Antrian Photobooth SnapHub
${eventNameLine}Nomor Antrian: *${item.queue_number}*

${statusNotice}

Terima kasih atas kerja samanya.
Tim SnapHub Photobooth`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  // URLs
  const guestToken = selectedEvent?.share_token || selectedEvent?.id || '';
  const guestUrl = selectedEvent && guestToken
    ? `https://queue.snaphub.my.id/${slugify(selectedEvent.name)}-${guestToken}`
    : '';
  const displayUrl = selectedEvent && guestToken
    ? `https://queue.snaphub.my.id/${slugify(selectedEvent.name)}-${guestToken}/display`
    : '';

  const activeServing = queues.find(q => q.status === 'called' || q.status === 'heading' || q.status === 'serving');
  const waitingList = queues.filter(q => q.status === 'waiting');
  const completedList = queues.filter(q => q.status === 'completed');

  // Event list filtering (matching SesiFoto.jsx logic)
  const filteredEvents = events.filter((ev) =>
    (ev.name || '').toLowerCase().includes(eventSearch.toLowerCase())
  );
  const todayStr = new Date().toLocaleDateString('en-CA');
  const upcomingEvents = filteredEvents
    .filter((ev) => (ev.date || '') >= todayStr)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const pastEvents = filteredEvents
    .filter((ev) => (ev.date || '') < todayStr)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-10 h-10 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-5 relative overflow-hidden">
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
        <div className="glass-dark border border-white/10 p-8 rounded-3xl w-full max-w-sm relative z-10 shadow-2xl">
          <div className="text-center mb-8">
            <img src="/icons.svg" alt="SnapHub Logo" className="h-10 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold font-heading">Queue Manager</h1>
            <p className="text-gray-400 text-xs mt-1">Login untuk mengelola antrian photobooth</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D90429] transition-colors text-sm"
                placeholder="admin@snaphub.id"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D90429] transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full mt-4 flex justify-center py-3 text-sm font-bold">
              Login
            </button>
          </form>
          <div className="mt-6 text-center">
            <a href={getAdminUrl()} className="text-gray-500 hover:text-white text-xs transition-colors flex items-center justify-center gap-2">
              <FiArrowLeft /> Kembali ke Admin
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] transition-colors duration-300" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#222', color: '#fff' } }} />

      {/* VIEW 1: EVENT SELECTION VIEW (MATCHING SESI FOTO) */}
      {!selectedEvent && (
        <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <a
                href={getAdminUrl()}
                className="shrink-0 p-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                title="Kembali ke Admin"
              >
                <FiArrowLeft size={16} />
              </a>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[var(--admin-text-main)] font-heading leading-tight">
                  Kelola Antrian
                </h2>
                <p className="text-[var(--admin-text-muted)] text-xs mt-0.5">
                  Sistem antrian photobooth & display TV live
                </p>
              </div>
            </div>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="shrink-0 border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors p-2.5 rounded-xl hover:bg-[var(--admin-hover-bg)]"
              title={theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
            </button>
          </div>

          {loadingEvents ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="border border-[var(--admin-border)] bg-[var(--admin-surface)] rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                  Pilih Event ({events.length})
                </h3>
                <span className="text-[11px] text-[var(--admin-text-muted)]">
                  Klik event untuk membuka antrian
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={15} />
                <input
                  type="text"
                  placeholder="Cari event..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--admin-text-main)] placeholder-[var(--admin-text-muted)] focus:outline-none focus:border-[#D90429] transition-colors"
                />
              </div>

              {filteredEvents.length === 0 && (
                <div className="text-center py-12 text-[var(--admin-text-muted)]">
                  <FiUsers size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {events.length === 0 ? 'Belum ada event tersedia.' : 'Event tidak ditemukan.'}
                  </p>
                </div>
              )}

              {/* Upcoming and Past Event Groups */}
              {[
                { key: 'upcoming', title: 'Akan Datang', list: upcomingEvents, dim: false },
                { key: 'past', title: 'Sudah Lewat', list: pastEvents, dim: true },
              ].map((group) =>
                group.list.length === 0 ? null : (
                  <div key={group.key} className="space-y-2 pt-1">
                    <div className="flex items-center gap-3 px-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                        {group.title} ({group.list.length})
                      </h4>
                      <div className="h-px flex-1 bg-[var(--admin-border-subtle)]" />
                    </div>

                    <div className="space-y-1.5">
                      {group.list.map((ev) => {
                        const d = ev.date ? daysUntil(ev.date, todayStr) : null;
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setSelectedEventId(ev.id)}
                            className="w-full flex items-center gap-3.5 text-left p-3 rounded-xl border border-transparent hover:border-[var(--admin-border)] hover:bg-[var(--admin-hover-bg)] active:scale-[0.99] transition-all group cursor-pointer"
                          >
                            {/* Date Badge */}
                            <div
                              className={`w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center leading-none transition-colors ${
                                group.dim
                                  ? 'bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)]'
                                  : 'bg-[#D90429]/10 text-[#D90429] group-hover:bg-[#D90429] group-hover:text-white'
                              }`}
                            >
                              <span className="text-base font-bold tabular-nums">
                                {ev.date ? Number(ev.date.slice(8, 10)) : '–'}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider mt-1">
                                {ev.date ? MONTHS[Number(ev.date.slice(5, 7)) - 1] : ''}
                              </span>
                            </div>

                            {/* Event Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${group.dim ? 'text-[var(--admin-text-muted)]' : 'text-[var(--admin-text-main)]'}`}>
                                {ev.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-[var(--admin-text-muted)]">
                                <span>{formatDate(ev.date)}</span>
                                {!group.dim && d !== null && (
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    d === 0 
                                      ? 'bg-emerald-500/15 text-emerald-400' 
                                      : d === 1 
                                      ? 'bg-amber-500/15 text-amber-400'
                                      : 'bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)]'
                                  }`}>
                                    {d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari lagi`}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Icon */}
                            <div className="shrink-0 flex items-center gap-1 text-[var(--admin-text-muted)] group-hover:text-[var(--admin-text-main)] group-hover:translate-x-0.5 transition-all">
                              <span className="text-xs font-medium hidden sm:inline">Pilih</span>
                              <FiChevronRight size={16} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ACTIVE QUEUE CONTROLLER (WHEN EVENT IS SELECTED) */}
      {selectedEvent && (
        <div className="min-h-screen">
          {/* Top Navbar */}
          <header className="sticky top-0 z-40 bg-[var(--admin-surface)]/95 backdrop-blur-md border-b border-[var(--admin-border)] px-4 sm:px-6 py-3.5">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSelectedEventId(null)}
                  className="shrink-0 p-2 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                  title="Kembali ke Daftar Event"
                >
                  <FiArrowLeft size={16} />
                </button>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] font-heading leading-tight truncate">
                    {selectedEvent.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--admin-text-muted)]">
                    <span>{formatDate(selectedEvent.date)}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      Antrian Aktif
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* External links */}
                <button
                  onClick={() => setShowQrModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 text-xs font-bold transition-colors cursor-pointer"
                  title="Tampilkan QR Code Antrian Tamu"
                >
                  <FiShare2 size={13} />
                  <span className="hidden sm:inline">QR Code</span>
                </button>

                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-colors"
                  title="Buka Layar Display TV Booth"
                >
                  <FiTv size={13} />
                  <span className="hidden sm:inline">Display TV</span>
                </a>

                <a
                  href={guestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D90429]/10 border border-[#D90429]/25 text-[#D90429] hover:bg-[#D90429]/20 text-xs font-bold transition-colors"
                  title="Buka Halaman Ambil Tiket Tamu"
                >
                  <FiSmartphone size={13} />
                  <span className="hidden sm:inline">Tiket Tamu</span>
                </a>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(guestUrl);
                    toast.success('Link tiket tamu disalin!');
                  }}
                  className="p-2 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                  title="Salin Link Tamu"
                >
                  <FiCopy size={15} />
                </button>

                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                  title={theme === 'dark' ? 'Dark' : 'Light'}
                >
                  {theme === 'dark' ? <FiMoon size={15} /> : <FiSun size={15} />}
                </button>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
            {/* CONTROLLER BENTO GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* CURRENTLY SERVING (SEDANG BERFOTO) */}
              <div className="lg:col-span-7 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {activeServing?.status === 'heading' ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-cyan-400 text-[11px] font-bold uppercase tracking-wider animate-pulse">
                        <FiNavigation size={12} />
                        Tamu Sedang Menuju ke Booth
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D90429]/15 text-[#D90429] text-[11px] font-bold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-[#D90429] animate-ping" />
                        Sedang Berfoto Saat Ini
                      </span>
                    )}

                    <label className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoAddSession}
                        onChange={(e) => setAutoAddSession(e.target.checked)}
                        className="rounded accent-[#D90429] cursor-pointer"
                      />
                      <span>Otomatis +1 sesi foto saat selesai</span>
                    </label>
                  </div>

                  {/* Active Serving Content */}
                  {activeServing ? (
                    <div className="pt-2 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl sm:text-6xl font-extrabold font-mono text-[var(--admin-text-main)] tracking-tight">
                            {activeServing.queue_number}
                          </span>
                          {activeServing.status === 'heading' ? (
                            <span className="text-xs font-bold text-cyan-400 uppercase px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/35 flex items-center gap-1.5 shadow-sm">
                              <FiNavigation size={11} /> OTW Booth
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#D90429] uppercase px-2 py-0.5 rounded-md bg-[#D90429]/10">
                              Giliran
                            </span>
                          )}
                        </div>

                        <h4 className="text-lg sm:text-xl font-bold text-[var(--admin-text-main)] font-heading mt-2">
                          {activeServing.customer_name}
                        </h4>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--admin-text-muted)]">
                          {activeServing.customer_phone ? (
                            <a
                              href={getWaReminderUrl(activeServing)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline font-mono"
                            >
                              <SiWhatsapp size={13} />
                              {activeServing.customer_phone}
                            </a>
                          ) : (
                            <span className="text-zinc-500 font-mono">Tanpa WhatsApp</span>
                          )}
                          <span>•</span>
                          <span>Dipanggil {activeServing.called_count || 1}x</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
                        <button
                          onClick={() => handleComplete(activeServing)}
                          disabled={actionLoading}
                          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                        >
                          <FiCheckCircle size={16} />
                          Selesai Sesi Foto
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRecall(activeServing)}
                            className="flex-1 px-3 py-2 rounded-xl border border-[var(--admin-border)] hover:bg-[var(--admin-hover-bg)] text-xs font-semibold text-[var(--admin-text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FiVolume2 size={14} />
                            Panggil Ulang
                          </button>
                          <button
                            onClick={() => handleSkip(activeServing)}
                            className="px-3 py-2 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 text-xs font-semibold text-amber-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FiSkipForward size={14} />
                            Lewati
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-[var(--admin-text-muted)]">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--admin-hover-bg)] flex items-center justify-center mx-auto mb-3 text-[var(--admin-text-muted)]">
                        <FiUsers size={28} className="opacity-40" />
                      </div>
                      <p className="text-sm font-bold text-[var(--admin-text-main)]">Belum Ada Nomor yang Dipanggil</p>
                      <p className="text-xs text-[var(--admin-text-muted)] mt-1 max-w-xs mx-auto">
                        Klik tombol <strong>Panggil Nomor Berikutnya</strong> di sebelah kanan untuk memulai sesi tamu.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CALL NEXT CONTROLLER (ANTRIAN BERIKUTNYA) */}
              <div className="lg:col-span-5 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
                      Antrian Berikutnya
                    </span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      {waitingList.length} Menunggu
                    </span>
                  </div>

                  {waitingList.length > 0 ? (
                    <div className="bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-xl p-3.5 mb-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-[var(--admin-text-muted)] uppercase font-bold tracking-wider">
                            Siap Dipanggil
                          </span>
                          <p className="text-sm font-bold text-[var(--admin-text-main)] truncate mt-0.5">
                            {waitingList[0].customer_name}
                          </p>
                          <span className="text-xs text-zinc-400 font-mono">
                            {waitingList[0].customer_phone || '-'}
                          </span>
                        </div>
                        <span className="text-3xl font-extrabold font-mono text-amber-400 shrink-0">
                          {waitingList[0].queue_number}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-[var(--admin-text-muted)] bg-[var(--admin-hover-bg)] rounded-xl border border-[var(--admin-border)]">
                      Semua antrian telah dipanggil atau belum ada tamu baru.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleCallNext}
                    disabled={waitingList.length === 0 || actionLoading}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#D90429] hover:bg-[#b00320] disabled:opacity-40 text-white font-extrabold text-sm tracking-wide shadow-lg shadow-[#D90429]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <FiPlay size={16} />
                    <span>Panggil Nomor Berikutnya ({waitingList.length})</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1 border-t border-[var(--admin-border)]">
                    <div className="p-2 rounded-lg bg-[var(--admin-hover-bg)]">
                      <span className="text-[10px] text-[var(--admin-text-muted)] block uppercase font-semibold">Total Selesai</span>
                      <strong className="text-base text-emerald-400">{completedList.length}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--admin-hover-bg)]">
                      <span className="text-[10px] text-[var(--admin-text-muted)] block uppercase font-semibold">Total Antrian</span>
                      <strong className="text-base text-[var(--admin-text-main)]">{queues.length}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* QUEUE LIST TABLE */}
            <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              {/* Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--admin-border)] pb-4">
                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setActiveTab('waiting')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      activeTab === 'waiting'
                        ? 'bg-[#D90429] text-white shadow-sm'
                        : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] bg-[var(--admin-hover-bg)]'
                    }`}
                  >
                    Menunggu ({waitingList.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      activeTab === 'completed'
                        ? 'bg-[#D90429] text-white shadow-sm'
                        : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] bg-[var(--admin-hover-bg)]'
                    }`}
                  >
                    Selesai ({completedList.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      activeTab === 'all'
                        ? 'bg-[#D90429] text-white shadow-sm'
                        : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] bg-[var(--admin-hover-bg)]'
                    }`}
                  >
                    Semua ({queues.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={13} />
                    <input
                      type="text"
                      placeholder="Cari nama / nomor..."
                      value={queueSearch}
                      onChange={(e) => setQueueSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-xl text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    />
                  </div>
                  <button
                    onClick={() => fetchQueues(selectedEventId)}
                    className="p-2 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer shrink-0"
                    title="Segarkan Antrian"
                  >
                    <FiRefreshCw size={14} className={loadingQueues ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-[var(--admin-text-muted)] uppercase tracking-wider font-semibold">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Tamu</th>
                      <th className="py-2.5 px-3">WhatsApp</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Waktu Ambil</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border-subtle)]">
                    {queues
                      .filter((q) => {
                        if (activeTab === 'waiting') return q.status === 'waiting' || q.status === 'called' || q.status === 'heading' || q.status === 'serving';
                        if (activeTab === 'completed') return q.status === 'completed';
                        return true;
                      })
                      .filter((q) => {
                        if (!queueSearch) return true;
                        const s = queueSearch.toLowerCase();
                        return (
                          (q.customer_name || '').toLowerCase().includes(s) ||
                          (q.queue_number || '').toLowerCase().includes(s) ||
                          (q.customer_phone || '').includes(s)
                        );
                      })
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-[var(--admin-hover-bg)] transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-sm text-[var(--admin-text-main)]">
                            {item.queue_number}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[var(--admin-text-main)]">
                            {item.customer_name}
                          </td>
                          <td className="py-3 px-3 font-mono text-[var(--admin-text-muted)]">
                            {item.customer_phone || '-'}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status === 'heading'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                                : item.status === 'called' || item.status === 'serving'
                                ? 'bg-[#D90429]/20 text-[#D90429] border border-[#D90429]/30'
                                : item.status === 'waiting'
                                ? 'bg-amber-500/15 text-amber-400'
                                : item.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-zinc-500/20 text-zinc-400'
                            }`}>
                              {item.status === 'heading' && <FiNavigation size={10} />}
                              {item.status === 'heading' ? 'Menuju Booth' : item.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[var(--admin-text-muted)]">
                            {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.customer_phone && (
                                <a
                                  href={getWaReminderUrl(item)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                  title="Kirim Notifikasi WA"
                                >
                                  <SiWhatsapp size={13} />
                                </a>
                              )}
                              <button
                                onClick={() => setQueueToDelete(item)}
                                className="p-1.5 rounded-lg border border-[var(--admin-border)] text-zinc-500 hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer"
                                title="Hapus Antrian"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {queues.length === 0 && (
                  <div className="text-center py-12 text-[var(--admin-text-muted)]">
                    <p className="text-sm font-semibold">Belum ada tamu yang mengambil tiket</p>
                    <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                      Tampilkan QR Code pada tamu atau buka display TV agar tamu dapat memindai tiket antrian.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* QR CODE MODAL FOR GUESTS */}
          {showQrModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative text-center space-y-5">
                <button
                  onClick={() => setShowQrModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-xl text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                >
                  <FiX size={18} />
                </button>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#D90429] bg-[#D90429]/10 px-2.5 py-1 rounded-full">
                    QR Code Antrian Tamu
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--admin-text-main)] font-heading mt-2 line-clamp-2">
                    {selectedEvent.name}
                  </h3>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                    Arahkan kamera HP tamu ke QR Code di bawah untuk mengambil nomor tiket antrian secara mandiri.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guestUrl)}&color=000000&bgcolor=ffffff`}
                    alt="QR Code Antrian"
                    className="w-48 h-48 object-contain"
                  />
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(guestUrl);
                      toast.success('Link antrian tamu disalin!');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] text-xs font-bold text-[var(--admin-text-main)] hover:border-[#D90429]/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FiCopy size={14} />
                    <span>Salin Link Tiket Tamu</span>
                  </button>

                  <a
                    href={guestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-[#D90429]/20"
                  >
                    <FiExternalLink size={14} />
                    <span>Buka Halaman Tamu</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS ANTRIAN (In-App Modal) */}
      {queueToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--admin-card-bg)] border border-[var(--admin-border)] rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="inline-flex p-3 rounded-2xl bg-red-500/10 text-red-400 mb-3">
              <FiTrash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-[var(--admin-text-main)]">Hapus Antrian?</h3>
            <p className="text-xs text-[var(--admin-text-muted)] mt-2">
              Yakin ingin menghapus antrian nomor <strong className="text-[var(--admin-text-main)] font-mono">{queueToDelete.queue_number}</strong> ({queueToDelete.customer_name})?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setQueueToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-[var(--admin-border)] text-xs font-semibold text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = queueToDelete.id;
                  setQueueToDelete(null);
                  executeDelete(id);
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueAdmin;
