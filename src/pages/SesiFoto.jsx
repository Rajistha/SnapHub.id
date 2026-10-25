import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { VOUCHER_PRICE, NO_VOUCHER_PRICE, PRINT_PRICE, SHARING_SOURCE, SHARING_DESCRIPTION, sessionPrice, eventTotal, voucherCount, eventSharing, isPercentMode } from '../lib/photoSession';
import SwipeableSessionRow from '../components/SwipeableSessionRow';
import { FiPlus, FiMinus, FiSearch, FiTrash2, FiEdit2, FiSave, FiX, FiArrowLeft, FiSun, FiMoon, FiLink, FiCopy, FiChevronDown, FiChevronRight, FiEye, FiEyeOff, FiTag, FiSettings } from 'react-icons/fi';

const formatRp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(n || 0)}`;

const formatDate = (date) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanpa tanggal';

const slugify = (text) =>
  (text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const getAppBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return window.location.origin;
  }
  return 'https://app.snaphub.my.id';
};

const getAdminUrl = () => {
  if (typeof window === 'undefined') return '/admin';
  const host = window.location.hostname;
  if (host === 'app.snaphub.my.id' || host.startsWith('app.')) {
    return 'https://spanel.snaphub.my.id';
  }
  return '/admin';
};

const getLiveBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${window.location.origin}/live`;
  }
  return 'https://live.snaphub.my.id';
};

const liveUrl = (event) => {
  const slug = slugify(event.name);
  const tokenStr = slug ? `${slug}-${event.share_token}` : event.share_token;
  return `${getLiveBaseUrl()}/${tokenStr}`;
};

const financeUrl = () => {
  if (typeof window === 'undefined') return '/events';
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' ? '/admin/events' : 'https://spanel.snaphub.my.id/events';
};

const formatThousand = (val) => {
  if (val == null || val === '') return '';
  const num = String(val).replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(num);
};

const parseThousand = (val) => {
  if (val == null || val === '') return 0;
  return parseInt(String(val).replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Selisih hari dari hari ini (lokal) ke tanggal event yyyy-MM-dd.
const daysUntil = (date, todayStr) =>
  Math.round((new Date(`${date}T00:00:00`) - new Date(`${todayStr}T00:00:00`)) / 86400000);

const crewUrl = (event) => {
  const slug = slugify(event.name);
  return `${getAppBaseUrl()}/crew/${slug ? `${slug}-` : ''}${event.crew_token}`;
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
  const writeChain = useRef(Promise.resolve());
  const eventsRef = useRef([]);
  const pendingWrites = useRef(0);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', eventId: null, sessionId: null });

  const [noVoucher, setNoVoucher] = useState(false);
  const [prints, setPrints] = useState(0);

  const [shareDraft, setShareDraft] = useState('0');
  const [sharingOpen, setSharingOpen] = useState(false);
  const [hideTotal, setHideTotal] = useState(() => localStorage.getItem('sesiHideTotal') === '1');

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  // Per-Event MoU & Pricing State (Tiap event memiliki MoU terpisah)
  const getEventPricing = (eventOrId) => {
    if (!eventOrId) return { mode: 'voucher', voucherPrice: 30000, noVoucherPrice: 35000, sessionPrice: 45000, printPrice: 10000 };
    let vPrice = null;
    let nvPrice = null;
    let pPrice = null;
    let mode = 'voucher';
    let sPrice = null;

    if (typeof eventOrId === 'object') {
      vPrice = eventOrId.voucher_price;
      nvPrice = eventOrId.no_voucher_price;
      pPrice = eventOrId.print_price;
      mode = eventOrId.pricing_mode === 'percent' ? 'percent' : 'voucher';
      sPrice = eventOrId.session_price;
    } else {
      const ev = (eventsRef.current || []).find((e) => e.id === eventOrId);
      if (ev) {
        vPrice = ev.voucher_price;
        nvPrice = ev.no_voucher_price;
        pPrice = ev.print_price;
        mode = ev.pricing_mode === 'percent' ? 'percent' : 'voucher';
        sPrice = ev.session_price;
      }
    }

    if (vPrice == null) {
      try {
        const eventId = typeof eventOrId === 'object' ? eventOrId.id : eventOrId;
        const raw = localStorage.getItem(`snaphub_event_pricing_${eventId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          vPrice = parsed.voucherPrice;
          nvPrice = parsed.noVoucherPrice;
          pPrice = parsed.printPrice;
        }
      } catch {}
    }

    // Pemasukan adalah tarif kotor (bruto) sebelum dikurangi sharing profit.
    // Jika sebelumnya tersimpan < 30.000 karena salah potong sharing profit, pulihkan ke tarif kotor standar.
    const finalVoucher = (vPrice != null && vPrice >= 30000) ? vPrice : 30000;
    const finalNoVoucher = (nvPrice != null && nvPrice >= 35000) ? nvPrice : 35000;
    const finalPrint = (pPrice != null && pPrice > 0) ? pPrice : 10000;

    return { mode, voucherPrice: finalVoucher, noVoucherPrice: finalNoVoucher, sessionPrice: (sPrice != null && sPrice > 0) ? sPrice : 45000, printPrice: finalPrint };
  };

  const [eventPricing, setEventPricing] = useState({ mode: 'voucher', voucherPrice: 30000, noVoucherPrice: 35000, sessionPrice: 45000, printPrice: 10000 });
  const [isEventPriceModalOpen, setIsEventPriceModalOpen] = useState(false);
  const [draftVoucherPrice, setDraftVoucherPrice] = useState(30000);
  const [draftNoVoucherPrice, setDraftNoVoucherPrice] = useState(35000);
  const [draftPrintPrice, setDraftPrintPrice] = useState(10000);
  const [draftSharePerVoucher, setDraftSharePerVoucher] = useState(0);
  const [draftMode, setDraftMode] = useState('voucher');
  const [draftSessionPrice, setDraftSessionPrice] = useState(45000);
  const [draftSharePercent, setDraftSharePercent] = useState('15');

  useEffect(() => {
    if (selectedEventId) {
      const pricing = getEventPricing(selectedEventId);
      setEventPricing(pricing);
      supabase
        .from('settings')
        .select('value')
        .eq('key', `event_pricing_${selectedEventId}`)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.value) {
            try {
              const cloudPricing = JSON.parse(data.value);
              setEventPricing((prev) => ({ ...prev, ...cloudPricing }));
              localStorage.setItem(`snaphub_event_pricing_${selectedEventId}`, JSON.stringify(cloudPricing));
            } catch {}
          }
        });
    }
  }, [selectedEventId]);

  const openEventPriceModal = () => {
    if (!selectedEvent) return;
    const current = getEventPricing(selectedEvent);
    setDraftVoucherPrice(current.voucherPrice ?? 30000);
    setDraftNoVoucherPrice(current.noVoucherPrice ?? 35000);
    setDraftPrintPrice(current.printPrice ?? 10000);
    setDraftSharePerVoucher(selectedEvent.share_per_voucher != null && selectedEvent.share_per_voucher !== 0 ? selectedEvent.share_per_voucher : 5000);
    setDraftMode(selectedEvent.pricing_mode === 'percent' ? 'percent' : 'voucher');
    setDraftSessionPrice(selectedEvent.session_price || 45000);
    setDraftSharePercent(selectedEvent.pricing_mode === 'percent' && selectedEvent.share_percent != null ? String(Number(selectedEvent.share_percent)) : '15');
    setIsEventPriceModalOpen(true);
  };

  const handleSaveEventPriceModal = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    const vPrice = Math.max(0, parseInt(String(draftVoucherPrice).replace(/\./g, ''), 10) || 30000);
    const nvPrice = Math.max(0, parseInt(String(draftNoVoucherPrice).replace(/\./g, ''), 10) || 35000);
    const pPrice = Math.max(0, parseInt(String(draftPrintPrice).replace(/\./g, ''), 10) || 10000);
    const shareVal = Math.max(0, parseInt(String(draftSharePerVoucher).replace(/\./g, ''), 10) || 0);
    const mode = draftMode;
    const sPrice = Math.max(0, parseInt(String(draftSessionPrice).replace(/\./g, ''), 10) || 45000);
    const sharePct = Math.min(100, Math.max(0, String(draftSharePercent).trim() === '' ? 15 : Number(String(draftSharePercent).replace(',', '.')) || 0));

    const pricingObj = { mode, voucherPrice: vPrice, noVoucherPrice: nvPrice, sessionPrice: sPrice, printPrice: pPrice };
    setEventPricing(pricingObj);
    localStorage.setItem(`snaphub_event_pricing_${selectedEvent.id}`, JSON.stringify(pricingObj));

    // Hitung pemasukan kotor tanpa pengurangan sharing profit
    const grossIncome = eventTotal(selectedEvent, pricingObj);

    // Simpan ke cloud settings bila admin sedang login
    supabase
      .from('settings')
      .upsert({
        key: `event_pricing_${selectedEvent.id}`,
        value: JSON.stringify(pricingObj)
      })
      .then(() => {})
      .catch(() => {});

    // Update kolom tabel financial_events (pemasukan kotor, tanpa dipotong sharing)
    setShareDraft(String(shareVal));
    const fullPatch = {
      share_per_voucher: shareVal,
      voucher_price: vPrice,
      no_voucher_price: nvPrice,
      print_price: pPrice,
      pricing_mode: mode,
      session_price: sPrice,
      share_percent: sharePct,
      income: grossIncome,
      income_adjustment: 0
    };
    const ok = await updateEvent(selectedEvent.id, fullPatch, null);
    if (!ok) {
      if (mode === 'percent') {
        toast.error('Mode persentase butuh supabase/pricing_mode.sql dijalankan dulu');
        return;
      }
      await updateEvent(selectedEvent.id, { share_per_voucher: shareVal, income: grossIncome, income_adjustment: 0 }, 'Gagal menyimpan sharing profit event');
    }
    syncSharing(selectedEvent.id);

    toast.success(`Pricing untuk "${selectedEvent.name}" berhasil disimpan!`);
    setIsEventPriceModalOpen(false);
  };

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

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

  // Sesi bisa bertambah dari link crew; segarkan berkala dan saat tab kembali aktif,
  // selama tidak ada simpanan yang tertunda.
  useEffect(() => {
    if (!session) return undefined;
    const refresh = () => {
      if (pendingWrites.current > 0 || document.hidden) return;
      fetchEvents(true);
    };
    const timer = setInterval(refresh, 4000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [session]);

  const fetchEvents = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('financial_events')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      // Jawaban lama tidak boleh menimpa perubahan yang baru dicatat
      if (quiet && pendingWrites.current > 0) return;
      eventsRef.current = (data || []).map((ev) => ({ ...ev, sessions: ev.sessions || [] }));
      setEvents(eventsRef.current);
    } catch (error) {
      console.error(error);
      if (!quiet) toast.error('Gagal mengambil data sesi foto');
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
  const syncSharing = (eventId) => {
    syncChain.current = syncChain.current.then(async () => {
      try {
        // Hitung dari data terbaru saat giliran dijalankan, supaya hasil akhirnya selalu benar
        const latest = eventsRef.current.find((ev) => ev.id === eventId);
        if (!latest) return;
        const amount = eventSharing(latest);
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

  // Ubah daftar sesi: tampilan langsung berubah, lalu server menambah/menghapus SATU sesi secara atomik
  // (sama seperti link crew), sehingga catatan crew tidak pernah tertimpa. Server juga menghitung
  // ulang pemasukan dan sharing profit, lalu hasilnya dipakai sebagai data akhir.
  const mutateSessions = (eventId, updater, fn, args) => {
    const event = eventsRef.current.find((ev) => ev.id === eventId);
    if (!event) return;
    const sessions = updater(event.sessions || []);
    const income = eventTotal({ ...event, sessions }) + Number(event.income_adjustment || 0);
    eventsRef.current = eventsRef.current.map((ev) => (ev.id === eventId ? { ...ev, sessions, income } : ev));
    setEvents(eventsRef.current);

    pendingWrites.current += 1;
    writeChain.current = writeChain.current.then(async () => {
      try {
        const { data, error } = await supabase.rpc(fn, { p_event_id: eventId, ...args });
        if (error) throw error;
        // Pakai data server hanya bila ini perubahan terakhir yang menunggu
        if (data && pendingWrites.current === 1) {
          eventsRef.current = eventsRef.current.map((ev) =>
            ev.id === eventId ? { ...ev, sessions: data.sessions || [], income: data.income } : ev
          );
          setEvents(eventsRef.current);
        }
      } catch (error) {
        console.error(error);
        toast.error('Gagal menyimpan sesi, data dimuat ulang');
        fetchEvents(true);
      } finally {
        pendingWrites.current -= 1;
      }
    });
  };

  const handleAddSession = () => {
    if (!selectedEvent) return;
    const newSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      no_voucher: isPercentMode(selectedEvent) ? false : noVoucher,
      prints: Number(prints) || 0,
      created_at: new Date().toISOString(),
    };
    mutateSessions(selectedEvent.id, (sessions) => [...sessions, newSession], 'admin_add_session', {
      p_id: newSession.id,
      p_no_voucher: newSession.no_voucher,
      p_prints: newSession.prints,
    });
    setNoVoucher(false);
    setPrints(0);
    toast.success('Sesi dicatat');
  };

  const handleDeleteSession = (sessionId) => {
    if (!selectedEvent) return;
    mutateSessions(selectedEvent.id, (sessions) => sessions.filter((s) => s.id !== sessionId), 'admin_delete_session', { p_id: sessionId });
    setDeleteModal({ isOpen: false, type: '', eventId: null, sessionId: null });
  };

  const updateEvent = async (eventId, patch, errorMessage) => {
    try {
      const { error } = await supabase.from('financial_events').update(patch).eq('id', eventId);
      if (error) throw error;
      eventsRef.current = eventsRef.current.map((ev) => (ev.id === eventId ? { ...ev, ...patch } : ev));
      setEvents(eventsRef.current);
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
      syncSharing(selectedEvent.id);
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

  const copyCrewLink = async (event) => {
    try {
      await navigator.clipboard.writeText(crewUrl(event));
      toast.success('Link crew disalin');
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  const enableCrewLink = async () => {
    if (!selectedEvent) return;
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    if (await updateEvent(selectedEvent.id, { crew_token: token }, 'Gagal membuat link crew')) {
      copyCrewLink({ ...selectedEvent, crew_token: token });
    }
  };

  const disableCrewLink = async () => {
    if (!selectedEvent) return;
    if (await updateEvent(selectedEvent.id, { crew_token: null }, 'Gagal menonaktifkan link crew')) {
      toast.success('Link crew dinonaktifkan');
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
            <a href={getAdminUrl()} className="text-gray-500 hover:text-white text-sm transition-colors flex items-center justify-center gap-2">
              <FiArrowLeft /> Kembali ke Admin
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] transition-colors duration-300" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
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
              <a
                href={getAdminUrl()}
                className="shrink-0 p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                title="Kembali ke Admin"
              >
                <FiArrowLeft size={16} />
              </a>
            )}
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-[var(--admin-text-main)] font-heading leading-tight">Catat Sesi Foto</h2>

            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedEvent && (
              <button
                type="button"
                onClick={openEventPriceModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] hover:bg-[var(--admin-hover-bg)] hover:border-[#D90429]/40 text-xs font-bold text-[var(--admin-text-main)] shadow-sm transition-all cursor-pointer"
                title="Atur Pricing & Sharing Profit Event Ini"
              >
                <FiTag size={13} className="text-[#D90429] shrink-0" />
                <span>Pricing</span>
              </button>
            )}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="shrink-0 border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors p-2 rounded-lg hover:bg-[var(--admin-hover-bg)]"
              title={theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
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
                          className="w-full flex items-center gap-3.5 text-left px-3 py-3 rounded-xl hover:bg-[var(--admin-hover-bg)] active:scale-[0.99] transition"
                        >
                          <div
                            className={`w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center leading-none ${
                              group.dim
                                ? 'bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)]'
                                : 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)]'
                            }`}
                          >
                            <span className="text-base font-bold tabular-nums">{ev.date ? Number(ev.date.slice(8, 10)) : '–'}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide mt-1">{ev.date ? MONTHS[Number(ev.date.slice(5, 7)) - 1] : ''}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${group.dim ? 'text-[var(--admin-text-muted)]' : 'text-[var(--admin-text-main)]'}`}>
                              {ev.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-[var(--admin-text-muted)]">
                              <span className="tabular-nums">{(ev.sessions || []).length} sesi</span>
                              {!group.dim && ev.date && (() => {
                                const d = daysUntil(ev.date, todayStr);
                                return (
                                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${d === 0 ? 'bg-green-500/15 text-green-500' : 'bg-[var(--admin-hover-bg)]'}`}>
                                    {d === 0 ? 'Hari ini' : `${d} hari lagi`}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className={`text-sm font-semibold tabular-nums ${(ev.sessions || []).length === 0 ? 'text-[var(--admin-text-muted)] font-normal' : 'text-[var(--admin-text-main)]'}`}>
                              {formatRp(eventTotal(ev, getEventPricing(ev.id)))}
                            </span>
                            <FiChevronRight size={16} className="text-[var(--admin-text-muted)]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}

              <a
                href={financeUrl()}
                className="block text-center text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] transition-colors pt-1"
              >
                Event baru ditambahkan lewat Keuangan Event →
              </a>
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
                      <a
                        href={financeUrl()}
                        className="shrink-0 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] transition-colors"
                      >
                        Buka Keuangan →
                      </a>
                    </div>


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
                          {hideTotal ? 'Rp ••••••' : formatRp(eventTotal(selectedEvent, eventPricing))}
                        </p>
                      </div>
                      {isPercentMode(selectedEvent) ? (
                        <>
                          <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Sesi</p>
                            <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{(selectedEvent.sessions || []).length}</p>
                          </div>
                          <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Sharing</p>
                            <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{Number(selectedEvent.share_percent || 0)}%</p>
                          </div>
                        </>
                      ) : (
                        <>
                      <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Voucher</p>
                        <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{(selectedEvent.sessions || []).filter((s) => !s.no_voucher).length}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Non-voucher</p>
                        <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{(selectedEvent.sessions || []).filter((s) => s.no_voucher).length}</p>
                      </div>
                        </>
                      )}
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
                    <div className="mt-4 space-y-4">
                    {(() => {
                      const vouchers = voucherCount(selectedEvent);
                      const sharing = eventSharing(selectedEvent);
                      const profit = eventTotal(selectedEvent, eventPricing) - sharing;
                      const isLoss = profit < 0;
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--admin-hover-bg)] text-xs">
                            <span className="text-[var(--admin-text-muted)]">Kesepakatan MoU:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--admin-text-main)] tabular-nums">
                                {isPercentMode(selectedEvent) ? `${Number(selectedEvent.share_percent || 0)}% dari pemasukan` : `${formatRp(selectedEvent.share_per_voucher || 0)} / voucher`}
                              </span>
                              <button
                                type="button"
                                onClick={openEventPriceModal}
                                className="text-[11px] text-[#D90429] hover:underline font-semibold cursor-pointer"
                              >
                                (Ubah)
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-[var(--admin-hover-bg)] px-3 py-3">
                              <p className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Sharing customer</p>
                              <p className="text-sm sm:text-base font-bold text-[var(--admin-text-main)] mt-1 tabular-nums">{formatRp(sharing)}</p>
                              <p className="text-[11px] text-[var(--admin-text-muted)] mt-0.5">{isPercentMode(selectedEvent) ? `${Number(selectedEvent.share_percent || 0)}% × ${formatRp(eventTotal(selectedEvent, eventPricing))}` : `${vouchers} voucher`}</p>
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
                        </div>
                      );
                    })()}

                    <div className="mt-5 pt-4 border-t border-[var(--admin-border-subtle)]">

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

                    <div className="mt-5 pt-4 border-t border-[var(--admin-border-subtle)]">

                      {selectedEvent.crew_token ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] pl-3 pr-1 py-1">
                            <span className="flex-1 min-w-0 truncate text-xs text-[var(--admin-text-muted)]">{crewUrl(selectedEvent)}</span>
                            <button
                              onClick={() => copyCrewLink(selectedEvent)}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--admin-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                              <FiCopy size={12} /> Salin
                            </button>
                          </div>
                          <button
                            onClick={disableCrewLink}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-500/30 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <FiX size={14} /> Nonaktifkan link crew
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={enableCrewLink}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
                        >
                          <FiLink size={14} /> Buat & salin link crew
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
                      {!isPercentMode(selectedEvent) && (
                      <div>
                        <p className="text-xs text-[var(--admin-text-muted)] mb-2">Tipe</p>
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--admin-hover-bg)]">
                          {[
                            { value: false, label: 'Voucher', price: eventPricing.voucherPrice },
                            { value: true, label: 'Non-voucher', price: eventPricing.noVoucherPrice },
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
                      )}

                      <div>
                        <p className="text-xs text-[var(--admin-text-muted)] mb-2">Print (+{formatRp(eventPricing.printPrice)}/print)</p>
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
                          {formatRp((isPercentMode(selectedEvent) ? eventPricing.sessionPrice : noVoucher ? eventPricing.noVoucherPrice : eventPricing.voucherPrice) + (Number(prints) || 0) * eventPricing.printPrice)}
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
                                    {!isPercentMode(selectedEvent) && (
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
                                <span className="text-sm font-semibold text-[var(--admin-text-main)] tabular-nums">{formatRp(sessionPrice(s, eventPricing))}</span>
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

      {/* POP UP PENGATURAN TARIF MOU EVENT */}
      {isEventPriceModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 pb-16 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setIsEventPriceModalOpen(false); }}>
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl px-5 pt-5 sm:px-7 sm:pt-7 max-w-md w-full max-h-[calc(100dvh-5rem)] sm:max-h-[90dvh] overflow-hidden shadow-2xl relative flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D90429]/15 text-[#D90429] flex items-center justify-center text-sm font-bold">
                  <FiTag />
                </div>
                <div className="min-w-0 pr-2">
                  <h3 className="text-base font-bold text-[var(--admin-text-main)] font-heading leading-tight truncate">
                    Pricing
                  </h3>
                  <p className="text-xs text-[#D90429] font-medium mt-0.5 truncate">
                    {selectedEvent.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEventPriceModalOpen(false)}
                className="p-2 rounded-xl text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer shrink-0"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEventPriceModal} className="flex flex-col min-h-0 flex-1">
            <div className="flex flex-col gap-3 overflow-y-auto min-h-0 flex-1 pb-3">
              {/* Mode tarif event */}
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">Mode Tarif</label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--admin-hover-bg)]" role="group" aria-label="Mode tarif">
                  {[{ v: 'voucher', label: 'Voucher' }, { v: 'percent', label: 'Persentase' }].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setDraftMode(o.v)}
                      aria-pressed={draftMode === o.v}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                        draftMode === o.v ? 'bg-[var(--admin-accent)] text-[#1a0a0d] shadow-sm' : 'text-[var(--admin-text-main)]/70 hover:bg-[var(--admin-surface)]'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <span className="hidden sm:block text-[10.5px] text-[var(--admin-text-muted)] mt-1">
                  {draftMode === 'voucher'
                    ? 'Tarif voucher dan non-voucher, sharing profit dalam Rp per voucher.'
                    : 'Satu tarif per sesi (tanpa voucher), sharing profit berupa persentase dari pemasukan sesi.'}
                </span>
              </div>

              {draftMode === 'voucher' ? (
              <>
              {/* Harga Sesi Voucher */}
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                  Harga Sesi (Voucher)
                </label>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] px-3 focus-within:border-[#D90429]">
                  <span className="text-xs font-semibold text-[var(--admin-text-muted)]">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatThousand(draftVoucherPrice)}
                    onChange={(e) => setDraftVoucherPrice(parseThousand(e.target.value))}
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums font-semibold"
                    placeholder="30.000"
                    required
                  />
                </div>
                <span className="hidden sm:block text-[10.5px] text-[var(--admin-text-muted)] mt-1">
                  Tarif dasar per sesi untuk tamu yang memakai kupon/voucher.
                </span>
              </div>

              {/* Harga Sesi Non-Voucher */}
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                  Harga Sesi (Non-Voucher / Reguler)
                </label>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] px-3 focus-within:border-[#D90429]">
                  <span className="text-xs font-semibold text-[var(--admin-text-muted)]">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatThousand(draftNoVoucherPrice)}
                    onChange={(e) => setDraftNoVoucherPrice(parseThousand(e.target.value))}
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums font-semibold"
                    placeholder="35.000"
                    required
                  />
                </div>
                <span className="hidden sm:block text-[10.5px] text-[var(--admin-text-muted)] mt-1">
                  Tarif untuk tamu umum tanpa kupon/voucher.
                </span>
              </div>

              </>
              ) : (
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">Harga Sesi</label>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] px-3 focus-within:border-[#D90429]">
                  <span className="text-xs font-semibold text-[var(--admin-text-muted)]">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatThousand(draftSessionPrice)}
                    onChange={(e) => setDraftSessionPrice(parseThousand(e.target.value))}
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums font-semibold"
                    placeholder="30.000"
                    required
                  />
                </div>
                <span className="hidden sm:block text-[10.5px] text-[var(--admin-text-muted)] mt-1">Satu tarif untuk semua sesi.</span>
              </div>
              )}

              {/* Harga Print Tambahan */}
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                  Harga Print Tambahan (per Lembar)
                </label>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] px-3 focus-within:border-[#D90429]">
                  <span className="text-xs font-semibold text-[var(--admin-text-muted)]">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatThousand(draftPrintPrice)}
                    onChange={(e) => setDraftPrintPrice(parseThousand(e.target.value))}
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums font-semibold"
                    placeholder="10.000"
                    required
                  />
                </div>
                <span className="hidden sm:block text-[10.5px] text-[var(--admin-text-muted)] mt-1">
                  Biaya cetak ekstra per lembar. Default: 10.000.
                </span>
              </div>

              {/* Harga Sharing Profit per Voucher */}
              {draftMode === 'voucher' ? (
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                  Sharing Profit per Voucher
                </label>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] px-3 focus-within:border-[#D90429]">
                  <span className="text-xs font-semibold text-[var(--admin-text-muted)]">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatThousand(draftSharePerVoucher)}
                    onChange={(e) => setDraftSharePerVoucher(parseThousand(e.target.value))}
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums font-semibold"
                    placeholder="5.000"
                  />
                </div>
                <span className="hidden sm:block text-[10.5px] text-[var(--admin-text-muted)] mt-1">
                  Nominal bagi hasil per voucher dengan pihak penyelenggara event ini. Default: 5.000.
                </span>
              </div>
              ) : (
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">Sharing Profit (%)</label>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] px-3 focus-within:border-[#D90429]">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftSharePercent}
                    onChange={(e) => setDraftSharePercent(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-full min-w-0 bg-transparent py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums font-semibold"
                    placeholder="15"
                  />
                  <span className="text-xs font-semibold text-[var(--admin-text-muted)]">%</span>
                </div>
                <span className="hidden sm:block text-[10.5px] text-[var(--admin-text-muted)] mt-1">Persentase × total pemasukan sesi (0–100).</span>
              </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setDraftPrintPrice(10000);
                  if (draftMode === 'percent') {
                    setDraftSessionPrice(45000);
                    setDraftSharePercent('15');
                  } else {
                    setDraftVoucherPrice(30000);
                    setDraftNoVoucherPrice(35000);
                    setDraftSharePerVoucher(5000);
                  }
                }}
                className="text-center text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors cursor-pointer py-1"
              >
                {draftMode === 'percent' ? 'Reset standar (Rp 45.000 · 15%)' : 'Reset standar (Sharing Rp 5.000)'}
              </button>

            </div>

              <div className="shrink-0 -mx-5 sm:-mx-7 px-5 sm:px-7 pt-3 pb-4 border-t border-[var(--admin-border)] grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventPriceModalOpen(false)}
                  className="px-3 py-2.5 rounded-xl border border-[var(--admin-border)] text-sm font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="col-span-2 px-4 py-2.5 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white text-sm font-bold transition-all shadow-md shadow-[#D90429]/25 cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SesiFoto;
