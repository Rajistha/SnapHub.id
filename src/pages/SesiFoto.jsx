import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { VOUCHER_PRICE, NO_VOUCHER_PRICE, PRINT_PRICE, SHARING_SOURCE, SHARING_DESCRIPTION, sessionPrice, eventTotal, voucherCount, eventSharing } from '../lib/photoSession';
import { FiPlus, FiMinus, FiSearch, FiTrash2, FiEdit2, FiSave, FiX, FiArrowLeft, FiSun, FiMoon, FiLink, FiCopy, FiChevronDown, FiEye, FiEyeOff } from 'react-icons/fi';

const SWIPE_DELETE_WIDTH = 72;

const formatRp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(n || 0)}`;

const formatDate = (date) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanpa tanggal';

const slugify = (text) =>
  (text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const liveUrl = (event) => {
  const slug = slugify(event.name);
  return `${window.location.origin}/live/${slug ? `${slug}-` : ''}${event.share_token}`;
};

const SwipeableSessionRow = ({ children, onDelete }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const baseXRef = useRef(0);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    baseXRef.current = dragX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    const delta = e.touches[0].clientX - startXRef.current;
    const next = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH, baseXRef.current + delta));
    setDragX(next);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragX((x) => (x < -SWIPE_DELETE_WIDTH / 2 ? -SWIPE_DELETE_WIDTH : 0));
  };

  return (
    <div className="relative overflow-hidden">
      <div style={{ width: SWIPE_DELETE_WIDTH }} className="absolute inset-y-0 right-0 flex items-center justify-center">
        <button
          onClick={() => {
            onDelete();
            setDragX(0);
          }}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          <FiTrash2 size={16} />
        </button>
      </div>
      <div
        className="bg-[var(--admin-bg)] touch-pan-y"
        style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 200ms ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

const SesiFoto = () => {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [theme, setTheme] = useState(localStorage.getItem('adminTheme') || 'dark');

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventSearch, setEventSearch] = useState('');
  const syncChain = useRef(Promise.resolve());
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', eventId: null, sessionId: null });

  const [noVoucher, setNoVoucher] = useState(false);
  const [prints, setPrints] = useState(0);

  const [shareDraft, setShareDraft] = useState('0');
  const [sharingOpen, setSharingOpen] = useState(false);
  const [hideTotal, setHideTotal] = useState(() => localStorage.getItem('sesiHideTotal') === '1');

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    localStorage.setItem('sesiHideTotal', hideTotal ? '1' : '0');
  }, [hideTotal]);

  useEffect(() => {
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  useEffect(() => {
    const robotsMeta = document.querySelector('meta[name="robots"]');
    const previousContent = robotsMeta?.getAttribute('content');
    robotsMeta?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previousContent) robotsMeta?.setAttribute('content', previousContent);
    };
  }, []);

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

  useEffect(() => {
    if (session) fetchEvents();
  }, [session]);

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

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('financial_events')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      setEvents((data || []).map((ev) => ({ ...ev, sessions: ev.sessions || [] })));
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data sesi foto');
    } finally {
      setLoading(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const filteredEvents = events.filter((ev) => ev.name.toLowerCase().includes(eventSearch.toLowerCase()));
  const todayStr = new Date().toLocaleDateString('en-CA'); // yyyy-MM-dd, zona waktu lokal
  const upcomingEvents = filteredEvents
    .filter((ev) => (ev.date || '') >= todayStr)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const pastEvents = filteredEvents
    .filter((ev) => (ev.date || '') < todayStr)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const shareDirty = selectedEvent
    ? (parseInt(shareDraft, 10) || 0) !== (selectedEvent.share_per_voucher || 0)
    : false;

  useEffect(() => {
    setShareDraft(String(selectedEvent?.share_per_voucher || 0));
  }, [selectedEventId]);

  // Sinkronkan baris pengeluaran "Sharing profit" di keuangan event (satu baris per event).
  const syncSharing = (eventId, amount) => {
    syncChain.current = syncChain.current.then(async () => {
      try {
        const { data: existing, error } = await supabase
          .from('transactions')
          .select('id')
          .eq('event_id', eventId)
          .eq('auto_source', SHARING_SOURCE)
          .maybeSingle();
        if (error) throw error;
        if (existing) {
          const { error: updateError } = await supabase.from('transactions').update({ amount }).eq('id', existing.id);
          if (updateError) throw updateError;
        } else if (amount > 0) {
          const { error: insertError } = await supabase.from('transactions').insert([{
            date: new Date().toISOString().split('T')[0],
            type: 'event_expense',
            description: SHARING_DESCRIPTION,
            amount,
            event_id: eventId,
            auto_source: SHARING_SOURCE,
          }]);
          if (insertError) throw insertError;
        }
      } catch (error) {
        console.error(error);
        toast.error('Gagal menyinkronkan sharing profit ke keuangan');
      }
    });
  };

  const persistSessions = async (event, updatedSessions) => {
    const next = { ...event, sessions: updatedSessions };
    // Pemasukan keuangan = total sesi + penyesuaian manual (jika pernah diedit di Keuangan Event)
    const income = eventTotal(next) + Number(event.income_adjustment || 0);
    try {
      const { error } = await supabase
        .from('financial_events')
        .update({ sessions: updatedSessions, income })
        .eq('id', event.id);
      if (error) throw error;
      setEvents((prev) => prev.map((ev) => (ev.id === event.id ? { ...ev, sessions: updatedSessions, income } : ev)));
      syncSharing(event.id, eventSharing(next));
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan sesi');
    }
  };

  const handleAddSession = () => {
    if (!selectedEvent) return;
    const newSession = {
      id: Date.now().toString(),
      no_voucher: noVoucher,
      prints: Number(prints) || 0,
      created_at: new Date().toISOString(),
    };
    const updatedSessions = [...(selectedEvent.sessions || []), newSession];
    persistSessions(selectedEvent, updatedSessions);
    setNoVoucher(false);
    setPrints(0);
    toast.success('Sesi dicatat');
  };

  const handleDeleteSession = (sessionId) => {
    if (!selectedEvent) return;
    const updatedSessions = (selectedEvent.sessions || []).filter((s) => s.id !== sessionId);
    persistSessions(selectedEvent, updatedSessions);
    setDeleteModal({ isOpen: false, type: '', eventId: null, sessionId: null });
  };

  const updateEvent = async (eventId, patch, errorMessage) => {
    try {
      const { error } = await supabase.from('financial_events').update(patch).eq('id', eventId);
      if (error) throw error;
      setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, ...patch } : ev)));
      return true;
    } catch (error) {
      console.error(error);
      toast.error(errorMessage);
      return false;
    }
  };

  const saveShare = async () => {
    if (!selectedEvent) return;
    const value = Math.max(0, parseInt(shareDraft, 10) || 0);
    setShareDraft(String(value));
    if (value === (selectedEvent.share_per_voucher || 0)) return;
    if (await updateEvent(selectedEvent.id, { share_per_voucher: value }, 'Gagal menyimpan sharing profit')) {
      syncSharing(selectedEvent.id, voucherCount(selectedEvent) * value);
      toast.success('Sharing profit disimpan, pengeluaran di keuangan diperbarui');
    }
  };

  const copyLiveLink = async (event) => {
    try {
      await navigator.clipboard.writeText(liveUrl(event));
      toast.success('Link disalin');
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  const enableLiveLink = async () => {
    if (!selectedEvent) return;
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    if (await updateEvent(selectedEvent.id, { share_token: token }, 'Gagal membuat link live')) {
      copyLiveLink({ ...selectedEvent, share_token: token });
    }
  };

  const disableLiveLink = async () => {
    if (!selectedEvent) return;
    if (await updateEvent(selectedEvent.id, { share_token: null }, 'Gagal menonaktifkan link')) {
      toast.success('Link live dinonaktifkan');
    }
  };

  const startEditNotes = () => {
    setNotesDraft(selectedEvent?.session_notes || '');
    setIsEditingNotes(true);
  };

  const saveNotes = async () => {
    if (!selectedEvent) return;
    try {
      const { error } = await supabase
        .from('financial_events')
        .update({ session_notes: notesDraft })
        .eq('id', selectedEvent.id);
      if (error) throw error;
      setEvents(events.map((ev) => (ev.id === selectedEvent.id ? { ...ev, session_notes: notesDraft } : ev)));
      setIsEditingNotes(false);
      toast.success('Catatan disimpan');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan catatan');
    }
  };

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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D90429]/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="glass-dark border border-white/10 p-8 rounded-3xl w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <img src="/icons.svg" alt="SnapHub Logo" className="h-10 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold font-heading">Catat Sesi Foto</h1>
            <p className="text-gray-400 text-sm mt-1">Login untuk mengakses halaman internal ini.</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D90429] transition-colors"
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D90429] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full mt-4 flex justify-center py-3">
              Login
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link to="/admin" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center justify-center gap-2">
              <FiArrowLeft /> Kembali ke Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] transition-colors duration-300" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {selectedEvent ? (
              <button
                onClick={() => {
                  setSelectedEventId(null);
                  setIsEditingNotes(false);
                }}
                className="shrink-0 p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                title="Kembali ke daftar event"
              >
                <FiArrowLeft size={16} />
              </button>
            ) : (
              <Link
                to="/admin"
                className="shrink-0 p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                title="Kembali ke Admin"
              >
                <FiArrowLeft size={16} />
              </Link>
            )}
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-[var(--admin-text-main)] font-heading leading-tight">Catat Sesi Foto</h2>
              <p className="text-[var(--admin-text-muted)] text-xs mt-0.5">Catatan internal — tidak tampil di website</p>
            </div>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="shrink-0 border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors p-2 rounded-lg hover:bg-[var(--admin-hover-bg)]"
            title={theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          >
            {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {/* Events List */}
            {!selectedEvent && (
            <aside className="border border-[var(--admin-border)] rounded-2xl p-3 space-y-3">
              <h3 className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                Pilih Event ({events.length})
              </h3>

              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={14} />
                <input
                  type="text"
                  placeholder="Cari event..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                />
              </div>

              {filteredEvents.length === 0 && (
                <p className="text-center text-[var(--admin-text-muted)] text-sm py-6">
                  {events.length === 0 ? 'Belum ada event.' : 'Event tidak ditemukan.'}
                </p>
              )}

              {[
                { key: 'upcoming', title: 'Akan Datang', list: upcomingEvents, dim: false },
                { key: 'past', title: 'Sudah Lewat', list: pastEvents, dim: true },
              ].map((group) =>
                group.list.length === 0 ? null : (
                  <div key={group.key}>
                    <div className="flex items-center gap-3 px-1 mb-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-text-muted)]">
                        {group.title} ({group.list.length})
                      </h4>
                      <div className="h-px flex-1 bg-[var(--admin-border-subtle)]" />
                    </div>
                    <div className="space-y-1">
                      {group.list.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEventId(ev.id)}
                          className="w-full text-left px-3.5 py-3 rounded-xl border-l-2 border-transparent hover:bg-[var(--admin-hover-bg)] transition-colors"
                        >
                          <p className={`text-sm font-semibold truncate ${group.dim ? 'text-[var(--admin-text-muted)]' : 'text-[var(--admin-text-main)]'}`}>
                            {ev.name}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-xs text-[var(--admin-text-muted)] truncate">
                              {formatDate(ev.date)} · {(ev.sessions || []).length} sesi
                            </p>
                            <span className="text-xs font-semibold text-[var(--admin-text-main)] shrink-0 tabular-nums">{formatRp(eventTotal(ev))}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}

              <Link
                to="/admin/finance/events"
                className="block text-center text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] transition-colors pt-1"
              >
                Event baru ditambahkan lewat Keuangan Event →
              </Link>
            </aside>
            )}

            {/* Event Detail */}
            {selectedEvent && (
            <div className="min-w-0">
              {(
                <div className="space-y-5">
                  {/* Header + Stats */}
                  <div className="border border-[var(--admin-border)] rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-[var(--admin-text-main)] truncate">{selectedEvent.name}</h3>
                        <p className="text-xs text-[var(--admin-text-muted)] mt-1">{formatDate(selectedEvent.date)}</p>
                      </div>
                      <Link
                        to="/admin/finance/events"
                        className="shrink-0 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] transition-colors"
                      >
                        Buka Keuangan →
                      </Link>
                    </div>
                    <p className="text-[11px] text-[var(--admin-text-muted)] mt-3">
                      Pemasukan dan sharing profit otomatis tercatat di Keuangan Event.
                    </p>

                    <div className="grid grid-cols-3 gap-3 mt-5">
                      <div className="rounded-xl bg-[var(--admin-accent-bg)] px-3 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Total</p>
                          <button
                            type="button"
                            onClick={() => setHideTotal((h) => !h)}
                            className="p-0.5 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors"
                            title={hideTotal ? 'Tampilkan total' : 'Sembunyikan total'}
                          >
                            {hideTotal ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                          </button>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-[var(--admin-accent)] mt-1 tabular-nums">
                          {hideTotal ? 'Rp ••••••' : formatRp(eventTotal(selectedEvent))}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Voucher</p>
                        <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{(selectedEvent.sessions || []).filter((s) => !s.no_voucher).length}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Non-voucher</p>
                        <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{(selectedEvent.sessions || []).filter((s) => s.no_voucher).length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sharing Profit */}
                  <div className="border border-[var(--admin-border)] rounded-2xl p-5">
                    <button
                      type="button"
                      onClick={() => setSharingOpen((o) => !o)}
                      aria-expanded={sharingOpen}
                      className="w-full flex items-center justify-between gap-3 text-left"
                    >
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Sharing Profit</h4>
                      <FiChevronDown
                        size={16}
                        className={`shrink-0 text-[var(--admin-text-muted)] transition-transform ${sharingOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {sharingOpen && (
                    <div className="mt-4">
                    <label className="block text-xs text-[var(--admin-text-muted)] mb-2">Kesepakatan per voucher terpakai</label>
                    <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] px-3">
                      <span className="text-sm text-[var(--admin-text-muted)]">Rp</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="500"
                        value={shareDraft}
                        onChange={(e) => setShareDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveShare()}
                        className="flex-1 min-w-0 bg-transparent py-3 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        onClick={saveShare}
                        disabled={!shareDirty}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 my-1.5 rounded-lg bg-[var(--admin-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FiSave size={12} /> Simpan
                      </button>
                    </div>

                    {(() => {
                      const vouchers = voucherCount(selectedEvent);
                      const sharing = eventSharing(selectedEvent);
                      const profit = eventTotal(selectedEvent) - sharing;
                      const isLoss = profit < 0;
                      return (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Sharing customer</p>
                            <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{formatRp(sharing)}</p>
                            <p className="text-[11px] text-[var(--admin-text-muted)] mt-0.5">{vouchers} voucher</p>
                          </div>
                          <div className={`rounded-xl px-3 py-3 ${isLoss ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                            <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                              Estimasi {isLoss ? 'rugi' : 'untung'}
                            </p>
                            <p className={`text-sm sm:text-base font-bold mt-1 tabular-nums ${isLoss ? 'text-red-500' : 'text-green-500'}`}>
                              {isLoss ? '-' : ''}{formatRp(Math.abs(profit))}
                            </p>
                            <p className="text-[11px] text-[var(--admin-text-muted)] mt-0.5">Total − sharing</p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-5 pt-4 border-t border-[var(--admin-border-subtle)]">
                      <p className="text-xs text-[var(--admin-text-muted)] mb-2">Link live untuk customer</p>
                      {selectedEvent.share_token ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] pl-3 pr-1 py-1">
                            <span className="flex-1 min-w-0 truncate text-xs text-[var(--admin-text-muted)]">{liveUrl(selectedEvent)}</span>
                            <button
                              onClick={() => copyLiveLink(selectedEvent)}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--admin-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                              <FiCopy size={12} /> Salin
                            </button>
                          </div>
                          <button
                            onClick={disableLiveLink}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-500/30 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <FiX size={14} /> Nonaktifkan link
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={enableLiveLink}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                        >
                          <FiLink size={14} /> Buat & salin link live
                        </button>
                      )}
                    </div>
                    </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="border border-[var(--admin-border)] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Catatan</h4>
                      {!isEditingNotes ? (
                        <button onClick={startEditNotes} className="p-1.5 rounded-md text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] hover:bg-[var(--admin-hover-bg)] transition-colors" title="Edit catatan">
                          <FiEdit2 size={14} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={saveNotes} className="p-1.5 rounded-md text-green-500 hover:bg-green-500/10" title="Simpan">
                            <FiSave size={14} />
                          </button>
                          <button onClick={() => setIsEditingNotes(false)} className="p-1.5 rounded-md text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)]" title="Batal">
                            <FiX size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditingNotes ? (
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        rows={3}
                        placeholder="Catatan khusus untuk event ini..."
                        className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-3 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] resize-none"
                      />
                    ) : (
                      <p className="text-sm text-[var(--admin-text-muted)] whitespace-pre-wrap">
                        {selectedEvent.session_notes ? selectedEvent.session_notes : 'Belum ada catatan.'}
                      </p>
                    )}
                  </div>

                  {/* Add Session */}
                  <div className="border border-[var(--admin-border)] rounded-2xl p-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)] mb-4">Catat Sesi</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-[var(--admin-text-muted)] mb-2">Tipe</p>
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--admin-hover-bg)]">
                          {[
                            { value: false, label: 'Voucher', price: VOUCHER_PRICE },
                            { value: true, label: 'Non-voucher', price: NO_VOUCHER_PRICE },
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => setNoVoucher(opt.value)}
                              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                                noVoucher === opt.value
                                  ? 'bg-[var(--admin-accent)] text-[#1a0a0d] shadow-sm'
                                  : 'text-[var(--admin-text-main)]/70 hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)]'
                              }`}
                            >
                              <span className="block font-semibold">{opt.label}</span>
                              <span className="block text-[11px] opacity-90 tabular-nums">{formatRp(opt.price)}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-[var(--admin-text-muted)] mb-2">Print (+{formatRp(PRINT_PRICE)}/print)</p>
                        <div className="flex items-center justify-between rounded-xl bg-[var(--admin-hover-bg)] p-1">
                          <button
                            type="button"
                            onClick={() => setPrints((p) => Math.max(0, p - 1))}
                            className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)] transition-colors"
                          >
                            <FiMinus size={16} />
                          </button>
                          <span className="text-lg font-semibold tabular-nums text-[var(--admin-text-main)]">{prints}</span>
                          <button
                            type="button"
                            onClick={() => setPrints((p) => p + 1)}
                            className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)] transition-colors"
                          >
                            <FiPlus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-[var(--admin-border-subtle)]">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Harga sesi</p>
                        <p className="text-lg font-bold text-[var(--admin-accent)] tabular-nums">
                          {formatRp((noVoucher ? NO_VOUCHER_PRICE : VOUCHER_PRICE) + (Number(prints) || 0) * PRINT_PRICE)}
                        </p>
                      </div>
                      <button onClick={handleAddSession} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-1.5">
                        <FiPlus size={14} /> Tambah Sesi
                      </button>
                    </div>
                  </div>

                  {/* Sessions List */}
                  <div className="border border-[var(--admin-border)] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                        Riwayat Sesi ({(selectedEvent.sessions || []).length})
                      </h4>
                    </div>

                    {(selectedEvent.sessions || []).length === 0 ? (
                      <p className="text-sm text-[var(--admin-text-muted)] text-center py-8">Belum ada sesi tercatat.</p>
                    ) : (
                      <div className={`divide-y divide-[var(--admin-border-subtle)] ${(selectedEvent.sessions || []).length > 5 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}>
                        {[...selectedEvent.sessions].reverse().map((s, idx) => (
                          <SwipeableSessionRow
                            key={s.id}
                            onDelete={() => setDeleteModal({ isOpen: true, type: 'session', eventId: selectedEvent.id, sessionId: s.id })}
                          >
                            <div className="flex items-center justify-between gap-3 py-3 group">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-[var(--admin-hover-bg)] text-xs font-semibold text-[var(--admin-text-muted)] tabular-nums">
                                  {selectedEvent.sessions.length - idx}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                      s.no_voucher
                                        ? 'bg-amber-500/15 text-amber-500'
                                        : 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)]'
                                    }`}>
                                      {s.no_voucher ? 'Non-voucher' : 'Voucher'}
                                    </span>
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
                                <span className="text-sm font-semibold text-[var(--admin-text-main)] tabular-nums">{formatRp(sessionPrice(s))}</span>
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, type: 'session', eventId: selectedEvent.id, sessionId: s.id })}
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
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </div>

      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, type: '', eventId: null, sessionId: null })}
          />
          <div className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-red-400 mb-2">
              Hapus Sesi?
            </h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-6">
              Sesi ini akan terhapus permanen dan pemasukan di keuangan ikut berkurang.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, type: '', eventId: null, sessionId: null })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors font-medium text-sm"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteSession(deleteModal.sessionId)}
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

export default SesiFoto;
