import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiClock, FiUsers, FiCheckCircle, FiAlertCircle, 
  FiBell, FiVolume2, FiShare2, FiRefreshCw, FiChevronRight,
  FiCheck, FiX, FiRotateCcw, FiVolumeX
} from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';

// ============================================================================
// AUDIO & HAPTIC ENGINE (Mobile Safari & Android Chrome Optimized)
// ============================================================================

let globalAudioCtx = null;
let isAudioUnlocked = false;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!globalAudioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  return globalAudioCtx;
};

// Unlock AudioContext on ANY user gesture (touch, click, keydown)
const unlockAudio = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        isAudioUnlocked = true;
      }).catch(() => {});
    } else if (ctx.state === 'running') {
      isAudioUnlocked = true;
    }

    // Play a microscopic silent buffer to initialize iOS audio hardware pipeline
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {}
};

// Rich professional multi-tone chime (Airport & Executive Lounge Style)
const playAlertSound = (volume = 0.9) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;

    const playNote = (freq, startTime, duration = 0.45, gainVal = 0.85) => {
      const osc = ctx.createOscillator();
      const oscHarmonic = ctx.createOscillator();
      const gain = ctx.createGain();
      const gainHarmonic = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      oscHarmonic.type = 'sine';
      oscHarmonic.frequency.setValueAtTime(freq * 2, startTime); // Harmonic overtone

      gain.gain.setValueAtTime(gainVal * volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      gainHarmonic.gain.setValueAtTime(gainVal * volume * 0.35, startTime);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);

      osc.connect(gain);
      oscHarmonic.connect(gainHarmonic);
      gain.connect(ctx.destination);
      gainHarmonic.connect(ctx.destination);

      osc.start(startTime);
      oscHarmonic.start(startTime);
      osc.stop(startTime + duration);
      oscHarmonic.stop(startTime + duration);
    };

    // Ascending 4-tone sequence: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
    playNote(523.25, t + 0.00, 0.45, 0.85);
    playNote(659.25, t + 0.22, 0.45, 0.85);
    playNote(783.99, t + 0.44, 0.45, 0.85);
    playNote(1046.50, t + 0.66, 0.95, 0.95);

    // Subtle echo response: G5 -> C6
    playNote(783.99, t + 1.25, 0.35, 0.65);
    playNote(1046.50, t + 1.48, 0.85, 0.85);
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
};

const triggerHaptic = () => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([400, 180, 400, 180, 700]);
    } catch {}
  }
};

const slugify = (text) =>
  (text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ============================================================================
// COMPONENT
// ============================================================================

const QueueGuest = () => {
  const { slug } = useParams();
  const token = slug?.split('-').pop();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myTicket, setMyTicket] = useState(null);
  const [allQueues, setAllQueues] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Modals (Replacing browser popups)
  const [showCallModal, setShowCallModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Form input
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const lastAlertKeyRef = useRef(null);

  // 1. Attach user interaction listeners to unlock AudioContext on mobile
  useEffect(() => {
    const handleGesture = () => unlockAudio();
    window.addEventListener('touchstart', handleGesture, { passive: true });
    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('click', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // 2. Fetch Event Info with smart matching (avoids falling back to wrong event)
  useEffect(() => {
    fetchEvent();
  }, [slug]);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      // 1. Coba lewat RPC get_queue_event
      if (token) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_queue_event', { p_token: token });
        if (rpcData && !rpcErr) {
          setEvent(rpcData);
          setLoading(false);
          return;
        }
      }

      // 2. Query langsung tabel financial_events by share_token
      if (token && token.length >= 8) {
        const { data, error } = await supabase
          .from('financial_events')
          .select('id, name, date, share_token')
          .eq('share_token', token)
          .maybeSingle();

        if (data && !error) {
          setEvent(data);
          setLoading(false);
          return;
        }
      }

      // 3. Smart slug matching (mencocokkan kata kunci slug jika token berubah)
      if (slug) {
        const cleanSlug = slug.replace(/-[a-f0-9]{8,}$/i, '');
        const words = cleanSlug.split('-').filter(w => w.length > 2);
        
        let matchQuery = supabase.from('financial_events').select('id, name, date, share_token');
        if (words.length > 0) {
          const firstWord = words[0];
          matchQuery = matchQuery.ilike('name', `%${firstWord}%`);
        }
        const { data: matches } = await matchQuery.limit(5);
        if (matches && matches.length > 0) {
          // Cari yang slug-nya paling mendekati
          const best = matches.find(m => slugify(m.name).includes(words[0])) || matches[0];
          setEvent(best);
          setLoading(false);
          return;
        }
      }

      // 4. Fallback jika hanya ada 1 event
      const { data: latest } = await supabase
        .from('financial_events')
        .select('id, name, date, share_token')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      setEvent(latest || null);
    } catch (err) {
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Queues & Restore Ticket from LocalStorage
  useEffect(() => {
    if (!event?.id) return;

    fetchQueues(event.id);

    // Cek tiket lokal yang tersimpan
    const savedTicketId = localStorage.getItem(`snaphub_ticket_${event.id}`);
    if (savedTicketId) {
      fetchTicketById(savedTicketId);
    }

    // Auto-refresh setiap 3 detik (sinkronisasi otomatis berkala)
    const timer = setInterval(() => {
      fetchQueues(event.id);
      const currentTicketId = localStorage.getItem(`snaphub_ticket_${event.id}`);
      if (currentTicketId) {
        fetchTicketById(currentTicketId);
      }
    }, 3000);

    // Subscribe ke Supabase Realtime (update seketika)
    const channel = supabase
      .channel(`guest_queue_${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_queues' },
        (payload) => {
          if (
            !payload.new ||
            String(payload.new.event_id) === String(event.id) ||
            String(payload.old?.event_id) === String(event.id)
          ) {
            fetchQueues(event.id);
            const currentTicketId = localStorage.getItem(`snaphub_ticket_${event.id}`);
            if (currentTicketId) {
              fetchTicketById(currentTicketId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [event?.id]);

  const fetchQueues = async (eventId) => {
    try {
      const { data, error } = await supabase
        .from('event_queues')
        .select('*')
        .eq('event_id', eventId)
        .order('seq_number', { ascending: true });

      if (error) throw error;
      setAllQueues(data || []);
    } catch (err) {
      console.warn('Gagal memuat daftar antrian:', err);
    }
  };

  const fetchTicketById = async (ticketId) => {
    try {
      const { data, error } = await supabase
        .from('event_queues')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setMyTicket(data);

        // Kunci alert unik: mendeteksi panggilan pertama dan pemanggilan ulang (recall)
        const alertKey = `${data.status}_${data.called_count || 1}_${data.called_at || ''}`;

        if (
          (data.status === 'called' || data.status === 'serving') &&
          lastAlertKeyRef.current !== alertKey
        ) {
          lastAlertKeyRef.current = alertKey;
          setShowCallModal(true);
          playAlertSound();
          triggerHaptic();
          toast.success('Giliran Anda tiba! Silakan segera menuju photobooth.', { duration: 6000 });
        }
      }
    } catch (err) {
      console.warn('Gagal membaca tiket:', err);
    }
  };

  // 4. Looping alert sound & haptic while In-App Call Modal is open
  useEffect(() => {
    if (!showCallModal) return;

    playAlertSound();
    triggerHaptic();

    const interval = setInterval(() => {
      playAlertSound();
      triggerHaptic();
    }, 3500);

    return () => clearInterval(interval);
  }, [showCallModal]);

  // 5. Handle Ambil Tiket
  const handleTakeTicket = async (e) => {
    e.preventDefault();
    unlockAudio(); // Pastikan audio terbuka oleh gestur tombol ini

    if (!name.trim()) {
      toast.error('Silakan isi nama panggilan Anda');
      return;
    }
    if (!phone.trim()) {
      toast.error('Silakan isi nomor WhatsApp Anda');
      return;
    }

    setSubmitting(true);
    try {
      let cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

      // Coba lewat RPC take_queue_ticket
      const { data, error } = await supabase.rpc('take_queue_ticket', {
        p_event_id: event?.id || null,
        p_name: name.trim(),
        p_phone: cleanPhone,
        p_token: token || null
      });

      if (error) {
        const targetEventId = event?.id;
        if (!targetEventId) {
          throw new Error(error.message || 'Event belum termuat atau link antrian tidak valid');
        }

        const currentCount = allQueues.length;
        const nextSeq = currentCount + 1;
        const queueCode = 'A-' + String(nextSeq).padStart(2, '0');

        const { data: fallbackData, error: fbError } = await supabase
          .from('event_queues')
          .insert([{
            event_id: targetEventId,
            queue_number: queueCode,
            seq_number: nextSeq,
            customer_name: name.trim(),
            customer_phone: cleanPhone,
            status: 'waiting'
          }])
          .select()
          .single();

        if (fbError) throw fbError;
        setMyTicket(fallbackData);
        localStorage.setItem(`snaphub_ticket_${targetEventId}`, fallbackData.id);
      } else {
        setMyTicket(data);
        if (data.event_id && !event?.id) {
          setEvent((prev) => ({ ...(prev || {}), id: data.event_id }));
        }
        localStorage.setItem(`snaphub_ticket_${data.event_id || event?.id}`, data.id);
      }

      toast.success('Nomor antrian berhasil diambil!');
    } catch (err) {
      console.error('Gagal mengambil tiket:', err);
      toast.error('Gagal mengambil nomor antrian. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Konfirmasi ganti tiket via in-app modal (bukan window.confirm)
  const confirmLeaveQueue = () => {
    if (event?.id) {
      localStorage.removeItem(`snaphub_ticket_${event.id}`);
    }
    setMyTicket(null);
    setName('');
    setPhone('');
    setShowLeaveModal(false);
    setShowCallModal(false);
    lastAlertKeyRef.current = null;
    toast.success('Nomor antrian telah dilepas.');
  };

  // Tes Suara
  const handleTestSound = () => {
    unlockAudio();
    playAlertSound();
    triggerHaptic();
    toast.success('Suara notifikasi aktif dan berfungsi normal.');
  };

  // Kalkulasi Status Antrian
  const waitingList = allQueues.filter(q => q.status === 'waiting');
  const activeServing = allQueues.find(q => q.status === 'called' || q.status === 'serving');

  let queuePosition = 0;
  if (myTicket && myTicket.status === 'waiting') {
    queuePosition = waitingList.findIndex(q => q.id === myTicket.id) + 1;
  }
  const estimatedWaitMinutes = queuePosition * 2;

  const isMyTurn = myTicket && (myTicket.status === 'called' || myTicket.status === 'serving');
  const isNear = queuePosition > 0 && queuePosition <= 2;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070708]">
        <div className="w-9 h-9 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col justify-between selection:bg-[#D90429] selection:text-white">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1c1917', color: '#fff', border: '1px solid #333' } }} />

      {/* Header */}
      <header className="border-b border-white/10 px-5 py-4 flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img src="/icons.svg" alt="SnapHub" className="h-7 w-auto" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white font-heading">
              {event?.name || 'SnapHub Photobooth'}
            </h1>
            <p className="text-[10px] text-zinc-400 font-mono">Live Queue System</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestSound}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-zinc-300 transition-colors cursor-pointer"
            title="Tes Suara Notifikasi"
          >
            <FiVolume2 size={13} className="text-[#E79EA7]" />
            <span className="hidden sm:inline">Tes Suara</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {!myTicket ? (
          /* FORM AMBIL TIKET */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#121214] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#D90429]/15 blur-3xl pointer-events-none rounded-full" />

            <div className="text-center mb-6">
              <span className="inline-flex p-3 rounded-2xl bg-[#D90429]/10 text-[#D90429] mb-3">
                <FiUsers size={24} />
              </span>
              <h2 className="text-xl font-bold font-heading text-white">Ambil Nomor Antrian</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Dapatkan nomor antrian photobooth langsung dari smartphone Anda. Santai dan nikmati acara tanpa harus berdiri menunggu.
              </p>
            </div>

            {/* Quick Status Bar */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Sedang Difoto</span>
                <span className="text-base font-bold text-[#E79EA7] font-mono">
                  {activeServing ? activeServing.queue_number : 'Menunggu Kru'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Total Antre</span>
                <span className="text-base font-bold text-white font-mono">
                  {waitingList.length} orang
                </span>
              </div>
            </div>

            <form onSubmit={handleTakeTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Nama Panggilan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rina & Teman"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D90429] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Nomor WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D90429] transition-colors"
                />
                <span className="text-[10px] text-zinc-400 block mt-1">
                  Untuk menerima notifikasi pengingat saat giliran Anda sudah dekat.
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#D90429]/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {submitting ? 'Memproses Tiket...' : 'Ambil Nomor Antrian'}
                <FiChevronRight />
              </button>
            </form>
          </motion.div>
        ) : (
          /* TIKET AKTIF SAYA */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`border rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-500 ${
              isMyTurn
                ? 'bg-gradient-to-b from-emerald-950/60 to-[#121214] border-emerald-500/80 shadow-emerald-500/20'
                : isNear
                ? 'bg-gradient-to-b from-amber-950/40 to-[#121214] border-amber-500/60'
                : 'bg-[#121214] border-white/15'
            }`}
          >
            {/* Status Banner */}
            <div className="text-center mb-5">
              {isMyTurn ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-wider mb-3 shadow-lg shadow-emerald-500/30">
                  <FiBell className="animate-bounce" /> Giliran Anda Sekarang
                </div>
              ) : isNear ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wider mb-3">
                  <FiAlertCircle /> Segera Merapat ke Booth
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-medium mb-3">
                  <FiClock /> Menunggu Giliran
                </span>
              )}

              <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">Nomor Tiket Anda</p>
              <h2 className="text-6xl sm:text-7xl font-extrabold font-mono text-white tracking-tight my-2">
                {myTicket.queue_number}
              </h2>
              <p className="text-sm font-semibold text-[#E79EA7]">{myTicket.customer_name}</p>
            </div>

            {/* Status Box */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Sedang Difoto Saat Ini</span>
                <span className="font-mono font-bold text-white text-sm">
                  {activeServing ? activeServing.queue_number : '-'}
                </span>
              </div>

              {myTicket.status === 'waiting' && (
                <>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Antrian di Depan Anda</span>
                    <span className="font-bold text-amber-400 font-mono text-sm">
                      {Math.max(0, queuePosition - 1)} orang
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Estimasi Menunggu</span>
                    <span className="font-semibold text-zinc-200">
                      ~{estimatedWaitMinutes} menit
                    </span>
                  </div>
                </>
              )}

              {myTicket.status === 'completed' && (
                <div className="text-center py-2 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <FiCheckCircle /> Sesi Foto Anda Telah Selesai
                </div>
              )}
            </div>

            {/* Instruction Callout */}
            <div className="text-center text-xs text-zinc-400 mb-6">
              {isMyTurn ? (
                <p className="text-emerald-300 font-semibold text-sm">
                  Silakan langsung menuju ke photobooth sekarang dan tunjukkan nomor ini ke kru kami.
                </p>
              ) : isNear ? (
                <p className="text-amber-200 font-medium">
                  Tinggal {queuePosition - 1} antrian lagi di depan Anda. Silakan mulai mendekat ke area photobooth agar tidak terlewat.
                </p>
              ) : (
                <p>
                  Halaman ini akan berbunyi dan bergetar saat giliran Anda tiba. Pastikan volume HP aktif dan nikmati waktu Anda.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveModal(true)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FiRotateCcw size={13} /> Ganti Tiket
              </button>
              <button
                onClick={handleTestSound}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Tes Suara Notifikasi"
              >
                <FiVolume2 size={14} className="text-[#E79EA7]" />
                <span>Tes Suara</span>
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 p-4 text-center text-xs text-zinc-400 bg-black/30">
        Powered by <strong className="text-white">SnapHub.id</strong> — Instant Photobooth Experience
      </footer>

      {/* ======================================================================
          IN-APP POPUP MODAL: GILIRAN ANDA DIPANGGIL (Menggantikan Browser Popup)
          ====================================================================== */}
      <AnimatePresence>
        {showCallModal && myTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[#121214] border-2 border-emerald-500 rounded-3xl max-w-sm w-full p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(16,185,129,0.3)] relative overflow-hidden"
            >
              {/* Pulsing ambient circle */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />

              <div className="inline-flex p-4 rounded-full bg-emerald-500/20 text-emerald-400 mb-4 ring-8 ring-emerald-500/10 animate-bounce">
                <FiBell size={36} />
              </div>

              <span className="block text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">
                Panggilan Antrian
              </span>
              <h2 className="text-2xl font-black font-heading text-white">
                Giliran Anda Telah Tiba!
              </h2>

              <div className="my-5 p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                  Nomor Antrian Anda
                </p>
                <p className="text-5xl sm:text-6xl font-extrabold font-mono text-white tracking-tight">
                  {myTicket.queue_number}
                </p>
                <p className="text-sm font-semibold text-[#E79EA7] mt-1">
                  {myTicket.customer_name}
                </p>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                Silakan langsung menuju ke booth photobooth dan tunjukkan nomor antrian ini kepada kru SnapHub.
              </p>

              <button
                onClick={() => setShowCallModal(false)}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <FiCheck size={18} />
                Saya Menuju ke Booth
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================================
          IN-APP POPUP MODAL: KONFIRMASI GANTI TIKET (Menggantikan window.confirm)
          ====================================================================== */}
      <AnimatePresence>
        {showLeaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121214] border border-white/15 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative"
            >
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 mb-3">
                <FiAlertCircle size={28} />
              </div>

              <h3 className="text-lg font-bold font-heading text-white">
                Ganti Nomor Antrian?
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Nomor antrian Anda saat ini (<strong className="text-white font-mono">{myTicket?.queue_number}</strong>) akan dilepas dari perangkat ini dan Anda dapat mengambil antrian baru.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveQueue}
                  className="flex-1 py-2.5 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FiRotateCcw size={13} />
                  Ya, Ganti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QueueGuest;
