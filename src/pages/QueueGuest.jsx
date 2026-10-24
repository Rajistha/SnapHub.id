import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiClock, FiUsers, FiCheckCircle, FiAlertCircle, 
  FiBell, FiVolume2, FiShare2, FiRefreshCw, FiExternalLink, FiChevronRight 
} from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';

// Web Audio API beep/chime generator
const playAlertSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.3); // D6

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch {
    // Audio might be blocked without user interaction
  }
};

const triggerHaptic = () => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([300, 150, 300, 150, 400]);
    } catch {}
  }
};

const slugify = (text) =>
  (text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const QueueGuest = () => {
  const { slug } = useParams();
  const token = slug?.split('-').pop();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myTicket, setMyTicket] = useState(null);
  const [allQueues, setAllQueues] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Form input
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const previousStatusRef = useRef(null);

  // 1. Fetch Event Info
  useEffect(() => {
    fetchEvent();
  }, [slug]);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      // Cari event berdasarkan token atau slug
      let query = supabase.from('financial_events').select('id, name, date, share_token');
      if (token && token.length >= 8) {
        query = query.eq('share_token', token);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (!data) {
        // Fallback coba ambil event terbaru bila tidak ditemukan
        const { data: latest } = await supabase.from('financial_events').select('id, name, date, share_token').order('date', { ascending: false }).limit(1).maybeSingle();
        setEvent(latest || null);
      } else {
        setEvent(data);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Queues & Restore Ticket from LocalStorage
  useEffect(() => {
    if (!event?.id) return;

    fetchQueues(event.id);

    // Cek tiket lokal yang tersimpan
    const savedTicketId = localStorage.getItem(`snaphub_ticket_${event.id}`);
    if (savedTicketId) {
      fetchTicketById(savedTicketId);
    }

    // Subscribe ke Supabase Realtime
    const channel = supabase
      .channel(`queue_${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_queues', filter: `event_id=eq.${event.id}` },
        () => {
          fetchQueues(event.id);
          if (savedTicketId) {
            fetchTicketById(savedTicketId);
          }
        }
      )
      .subscribe();

    return () => {
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

        // Cek jika status baru saja berubah menjadi called/serving
        if (
          (data.status === 'called' || data.status === 'serving') &&
          previousStatusRef.current !== 'called' &&
          previousStatusRef.current !== 'serving'
        ) {
          playAlertSound();
          triggerHaptic();
          toast.success('GILIRAN ANDA SEKARANG! Silakan menuju photobooth!', { duration: 6000, icon: '🎉' });
        }
        previousStatusRef.current = data.status;
      }
    } catch (err) {
      console.warn('Gagal membaca tiket:', err);
    }
  };

  // 3. Handle Ambil Tiket
  const handleTakeTicket = async (e) => {
    e.preventDefault();
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
      // Format nomor telepon
      let cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

      // Coba lewat RPC take_queue_ticket
      const { data, error } = await supabase.rpc('take_queue_ticket', {
        p_event_id: event.id,
        p_name: name.trim(),
        p_phone: cleanPhone
      });

      if (error) {
        // Fallback manual insert jika fungsi RPC belum di-execute di SQL editor
        const currentCount = allQueues.length;
        const nextSeq = currentCount + 1;
        const queueCode = 'A-' + String(nextSeq).padStart(2, '0');

        const { data: fallbackData, error: fbError } = await supabase
          .from('event_queues')
          .insert([{
            event_id: event.id,
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
        localStorage.setItem(`snaphub_ticket_${event.id}`, fallbackData.id);
      } else {
        setMyTicket(data);
        localStorage.setItem(`snaphub_ticket_${event.id}`, data.id);
      }

      toast.success('Nomor antrian berhasil diambil!');
    } catch (err) {
      console.error('Gagal mengambil tiket:', err);
      toast.error('Gagal mengambil nomor antrian. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveQueue = () => {
    if (window.confirm('Yakin ingin melepas tiket ini dan mengambil nomor baru?')) {
      if (event?.id) {
        localStorage.removeItem(`snaphub_ticket_${event.id}`);
      }
      setMyTicket(null);
      setName('');
      setPhone('');
    }
  };

  // Kalkulasi Status Antrian
  const waitingList = allQueues.filter(q => q.status === 'waiting');
  const activeServing = allQueues.find(q => q.status === 'called' || q.status === 'serving');

  let queuePosition = 0;
  if (myTicket && myTicket.status === 'waiting') {
    queuePosition = waitingList.findIndex(q => q.id === myTicket.id) + 1;
  }
  const estimatedWaitMinutes = queuePosition * 2; // asumsi 2 menit per sesi

  const isMyTurn = myTicket && (myTicket.status === 'called' || myTicket.status === 'serving');
  const isNear = queuePosition > 0 && queuePosition <= 2;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B]">
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

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
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
            {/* Glow accent */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#D90429]/15 blur-3xl pointer-events-none rounded-full" />

            <div className="text-center mb-6">
              <span className="inline-flex p-3 rounded-2xl bg-[#D90429]/10 text-[#D90429] mb-3">
                <FiUsers size={24} />
              </span>
              <h2 className="text-xl font-bold font-heading text-white">Ambil Nomor Antrian</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Dapatkan nomor antrian photobooth langsung dari HP Anda. Santai dan nikmati acara tanpa harus berdiri menunggu!
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
                  Untuk menerima notifikasi saat giliran Anda sudah dekat.
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
                ? 'bg-gradient-to-b from-emerald-950/60 to-[#121214] border-emerald-500 shadow-emerald-500/20 animate-pulse'
                : isNear
                ? 'bg-gradient-to-b from-amber-950/40 to-[#121214] border-amber-500/60'
                : 'bg-[#121214] border-white/15'
            }`}
          >
            {/* Status Banner */}
            <div className="text-center mb-5">
              {isMyTurn ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-wider mb-3 shadow-lg shadow-emerald-500/30">
                  <FiBell className="animate-bounce" /> Giliran Anda Sekarang!
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
                  <FiCheckCircle /> Sesi Foto Anda Telah Selesai!
                </div>
              )}
            </div>

            {/* Instruction Callout */}
            <div className="text-center text-xs text-zinc-400 mb-6">
              {isMyTurn ? (
                <p className="text-emerald-300 font-semibold text-sm">
                  Silakan langsung menuju ke photobooth sekarang dan tunjukkan nomor ini ke kru kami!
                </p>
              ) : isNear ? (
                <p className="text-amber-200 font-medium">
                  Tinggal {queuePosition - 1} antrian lagi di depan Anda. Silakan mulai mendekat ke area photobooth agar tidak terlewat.
                </p>
              ) : (
                <p>
                  Halaman ini akan otomatis bergetar dan berganti saat giliran Anda tiba. Anda bebas menikmati hidangan atau bersosialisasi!
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleLeaveQueue}
                className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Ganti Tiket
              </button>
              <button
                onClick={() => {
                  playAlertSound();
                  toast.success('Suara pemanggil aktif!');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Tes Suara Alarm"
              >
                <FiVolume2 size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 p-4 text-center text-xs text-zinc-400 bg-black/30">
        Powered by <strong className="text-white">SnapHub.id</strong> — Instant Photobooth Experience
      </footer>
    </div>
  );
};

export default QueueGuest;
