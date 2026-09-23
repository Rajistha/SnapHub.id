import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiPlus, FiMinus, FiTrash2, FiEdit2, FiSave, FiX, FiArrowLeft, FiSun, FiMoon } from 'react-icons/fi';

const VOUCHER_PRICE = 30000;
const NO_VOUCHER_PRICE = 35000;
const PRINT_PRICE = 10000;
const SWIPE_DELETE_WIDTH = 72;

const formatRp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(n || 0)}`;

const sessionPrice = (session) => {
  const base = session.no_voucher ? NO_VOUCHER_PRICE : VOUCHER_PRICE;
  return base + (session.prints || 0) * PRINT_PRICE;
};

const eventTotal = (event) => (event.sessions || []).reduce((sum, s) => sum + sessionPrice(s), 0);

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
  const [showEventForm, setShowEventForm] = useState(true);
  const [newEvent, setNewEvent] = useState({ name: '', date: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', eventId: null, sessionId: null });

  const [noVoucher, setNoVoucher] = useState(false);
  const [prints, setPrints] = useState(0);

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

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
        .from('photo_session_events')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEvents(data || []);
      if (data && data.length > 0 && !selectedEventId) {
        setSelectedEventId(data[0].id);
        setShowEventForm(false);
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data sesi foto');
    } finally {
      setLoading(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.name.trim()) {
      toast.error('Nama event wajib diisi');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('photo_session_events')
        .insert({ name: newEvent.name.trim(), date: newEvent.date || null, notes: '', sessions: [] })
        .select()
        .single();
      if (error) throw error;
      setEvents([data, ...events]);
      setSelectedEventId(data.id);
      setNewEvent({ name: '', date: '' });
      toast.success('Event ditambahkan');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menambah event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const { error } = await supabase.from('photo_session_events').delete().eq('id', eventId);
      if (error) throw error;
      const updated = events.filter((e) => e.id !== eventId);
      setEvents(updated);
      if (selectedEventId === eventId) {
        setSelectedEventId(updated.length > 0 ? updated[0].id : null);
      }
      toast.success('Event dihapus');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus event');
    } finally {
      setDeleteModal({ isOpen: false, type: '', eventId: null, sessionId: null });
    }
  };

  const persistSessions = async (event, updatedSessions) => {
    try {
      const { error } = await supabase
        .from('photo_session_events')
        .update({ sessions: updatedSessions })
        .eq('id', event.id);
      if (error) throw error;
      setEvents(events.map((ev) => (ev.id === event.id ? { ...ev, sessions: updatedSessions } : ev)));
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

  const startEditNotes = () => {
    setNotesDraft(selectedEvent?.notes || '');
    setIsEditingNotes(true);
  };

  const saveNotes = async () => {
    if (!selectedEvent) return;
    try {
      const { error } = await supabase
        .from('photo_session_events')
        .update({ notes: notesDraft })
        .eq('id', selectedEvent.id);
      if (error) throw error;
      setEvents(events.map((ev) => (ev.id === selectedEvent.id ? { ...ev, notes: notesDraft } : ev)));
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

      <div className="max-w-5xl mx-auto px-5 py-6 md:px-8 md:py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--admin-text-main)] font-heading">Catat Sesi Foto</h2>
            <p className="text-[var(--admin-text-muted)] text-xs">Catatan internal — tidak tampil di website</p>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors p-2 rounded-lg hover:bg-[var(--admin-hover-bg)]"
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Events List */}
            <div className="lg:col-span-1 space-y-3">
              {showEventForm ? (
                <form
                  onSubmit={(e) => {
                    handleAddEvent(e);
                    setShowEventForm(false);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Nama event baru"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    autoFocus
                    className="flex-1 min-w-0 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-lg px-3 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                  />
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-32 shrink-0 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-lg px-2 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                  />
                  <button type="submit" className="shrink-0 p-2 rounded-lg bg-[var(--admin-accent)] text-white hover:opacity-90 transition-opacity" title="Tambah event">
                    <FiPlus size={16} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowEventForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors text-sm"
                >
                  <FiPlus size={14} /> Tambah Event
                </button>
              )}

              <div className="space-y-1.5">
                {events.length === 0 && (
                  <p className="text-center text-[var(--admin-text-muted)] text-sm py-6">
                    Belum ada event.
                  </p>
                )}
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => {
                      setSelectedEventId(ev.id);
                      setShowEventForm(false);
                    }}
                    className={`w-full text-left px-3.5 py-3 rounded-lg transition-colors ${
                      selectedEventId === ev.id
                        ? 'bg-[var(--admin-accent-bg)]'
                        : 'hover:bg-[var(--admin-hover-bg)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium truncate ${selectedEventId === ev.id ? 'text-[var(--admin-accent)]' : 'text-[var(--admin-text-main)]'}`}>
                        {ev.name}
                      </p>
                      <span className="text-xs font-semibold text-[var(--admin-text-muted)] shrink-0">{formatRp(eventTotal(ev))}</span>
                    </div>
                    <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                      {ev.date || 'Tanpa tanggal'} · {(ev.sessions || []).length} sesi
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Detail */}
            <div className="lg:col-span-2">
              {!selectedEvent ? (
                <div className="h-full flex items-center justify-center text-[var(--admin-text-muted)] text-sm border border-dashed border-[var(--admin-border)] rounded-2xl p-10">
                  Pilih atau tambahkan event untuk mulai mencatat sesi foto.
                </div>
              ) : (
                <div className="border border-[var(--admin-border)] rounded-2xl divide-y divide-[var(--admin-border-subtle)] overflow-hidden">
                  {/* Header */}
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[var(--admin-text-main)]">{selectedEvent.name}</h3>
                      <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">{selectedEvent.date || 'Tanpa tanggal'}</p>
                    </div>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, type: 'event', eventId: selectedEvent.id, sessionId: null })}
                      className="text-[var(--admin-text-muted)] hover:text-red-500 transition-colors"
                      title="Hapus event"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  {/* Notes */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Catatan</h4>
                      {!isEditingNotes ? (
                        <button onClick={startEditNotes} className="text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] transition-colors">
                          <FiEdit2 size={13} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button onClick={saveNotes} className="text-green-500 hover:text-green-400">
                            <FiSave size={13} />
                          </button>
                          <button onClick={() => setIsEditingNotes(false)} className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]">
                            <FiX size={13} />
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
                        {selectedEvent.notes ? selectedEvent.notes : 'Belum ada catatan.'}
                      </p>
                    )}
                  </div>

                  {/* Add Session */}
                  <div className="p-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)] mb-3">Catat Sesi</h4>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--admin-text-main)]">
                        <input
                          type="checkbox"
                          checked={noVoucher}
                          onChange={(e) => setNoVoucher(e.target.checked)}
                          className="w-4 h-4 accent-[var(--admin-accent)]"
                        />
                        Tanpa voucher ({formatRp(NO_VOUCHER_PRICE)})
                      </label>

                      <div className="flex items-center gap-2 text-sm text-[var(--admin-text-main)]">
                        Print
                        <div className="flex items-center border border-[var(--admin-border)] rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setPrints((p) => Math.max(0, p - 1))}
                            className="w-7 h-7 flex items-center justify-center text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                          >
                            <FiMinus size={12} />
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums">{prints}</span>
                          <button
                            type="button"
                            onClick={() => setPrints((p) => p + 1)}
                            className="w-7 h-7 flex items-center justify-center text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                          >
                            <FiPlus size={12} />
                          </button>
                        </div>
                        <span className="text-xs text-[var(--admin-text-muted)]">(+{formatRp(PRINT_PRICE)}/prt)</span>
                      </div>

                      <span className="text-sm font-bold text-[var(--admin-accent)] ml-auto">
                        {formatRp((noVoucher ? NO_VOUCHER_PRICE : VOUCHER_PRICE) + (Number(prints) || 0) * PRINT_PRICE)}
                      </span>

                      <button onClick={handleAddSession} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
                        <FiPlus size={14} /> Tambah
                      </button>
                    </div>
                  </div>

                  {/* Sessions List */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                        Sesi ({(selectedEvent.sessions || []).length})
                      </h4>
                      <span className="text-sm font-bold text-[var(--admin-accent)]">
                        {formatRp(eventTotal(selectedEvent))}
                      </span>
                    </div>

                    {(selectedEvent.sessions || []).length === 0 ? (
                      <p className="text-sm text-[var(--admin-text-muted)] text-center py-6">Belum ada sesi tercatat.</p>
                    ) : (
                      <div className={`divide-y divide-[var(--admin-border-subtle)] ${(selectedEvent.sessions || []).length > 5 ? 'max-h-[275px] overflow-y-auto pr-1' : ''}`}>
                        {[...selectedEvent.sessions].reverse().map((s, idx) => (
                          <SwipeableSessionRow
                            key={s.id}
                            onDelete={() => handleDeleteSession(s.id)}
                          >
                            <div className="flex items-center justify-between gap-3 py-2.5 group">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs text-[var(--admin-text-muted)] w-5 shrink-0">
                                  {selectedEvent.sessions.length - idx}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm text-[var(--admin-text-main)]">
                                    {s.no_voucher ? 'Tanpa voucher' : 'Pakai voucher'}
                                    {s.prints > 0 && ` · ${s.prints} print`}
                                  </p>
                                  <p className="text-xs text-[var(--admin-text-muted)]">
                                    {new Date(s.created_at).toLocaleString('id-ID')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-semibold text-[var(--admin-text-main)]">{formatRp(sessionPrice(s))}</span>
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, type: 'session', eventId: selectedEvent.id, sessionId: s.id })}
                                  className="hidden sm:block text-[var(--admin-text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <FiTrash2 size={13} />
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
              {deleteModal.type === 'event' ? 'Hapus Event?' : 'Hapus Sesi?'}
            </h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-6">
              {deleteModal.type === 'event'
                ? 'Semua sesi dan catatan pada event ini akan terhapus permanen.'
                : 'Sesi ini akan terhapus permanen.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, type: '', eventId: null, sessionId: null })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors font-medium text-sm"
              >
                Batal
              </button>
              <button
                onClick={() =>
                  deleteModal.type === 'event'
                    ? handleDeleteEvent(deleteModal.eventId)
                    : handleDeleteSession(deleteModal.sessionId)
                }
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
