import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { FiVolume2, FiMaximize2, FiMinimize2, FiUsers, FiClock } from 'react-icons/fi';

// Audio chime for TV
const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.18); // E5
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.36); // G5
    osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.54); // C6

    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.6);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.6);
  } catch {}
};

const QueueDisplay = () => {
  const { slug } = useParams();
  const token = slug?.split('-').pop();

  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const previousServingRef = useRef(null);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Event
  useEffect(() => {
    fetchEvent();
  }, [slug]);

  const fetchEvent = async () => {
    try {
      if (token) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_queue_event', { p_token: token });
        if (rpcData && !rpcErr) {
          setEvent(rpcData);
          return;
        }
      }
      let query = supabase.from('financial_events').select('id, name, date, share_token');
      if (token && token.length >= 8) {
        query = query.eq('share_token', token);
      }
      const { data } = await query.maybeSingle();
      if (data) setEvent(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Realtime subscription & Auto Refresh
  useEffect(() => {
    if (!event?.id) return;
    fetchQueues(event.id);

    // Auto-refresh setiap 3 detik (layar TV selalu sinkron)
    const timer = setInterval(() => {
      fetchQueues(event.id);
    }, 3000);

    const channel = supabase
      .channel(`display_queue_${event.id}`)
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
      const { data } = await supabase
        .from('event_queues')
        .select('*')
        .eq('event_id', eventId)
        .order('seq_number', { ascending: true });

      if (data) {
        setQueues(data);
        const serving = data.find(q => q.status === 'called' || q.status === 'serving');
        if (serving && serving.id !== previousServingRef.current) {
          playChime();
          previousServingRef.current = serving.id;
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const activeServing = queues.find(q => q.status === 'called' || q.status === 'serving');
  const upNextList = queues.filter(q => q.status === 'waiting').slice(0, 3);
  const totalWaiting = queues.filter(q => q.status === 'waiting').length;

  // QR Code URL for guests
  const guestQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    `https://queue.snaphub.my.id/${slug || ''}`
  )}&color=ffffff&bgcolor=121214`;

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden relative font-sans">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D90429]/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />

      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-white/10 pb-6 relative z-10">
        <div className="flex items-center gap-4">
          <img src="/icons.svg" alt="SnapHub" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-heading text-white">
              {event?.name || 'SnapHub Photobooth'}
            </h1>
            <p className="text-xs text-zinc-400 uppercase tracking-widest font-mono">
              Live Queue Board
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-2xl font-mono font-bold text-white tabular-nums">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="block text-[11px] text-zinc-400 font-medium">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main Grid Display */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 py-8 items-stretch relative z-10">
        {/* BIG NOW SERVING CARD (2 COLS) */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#121214] to-[#18181b] border-2 border-white/15 rounded-3xl p-8 sm:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D90429]/20 border border-[#D90429]/40 text-[#E79EA7] font-bold text-xs uppercase tracking-widest">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D90429] animate-ping" />
              Now Serving / Sedang Difoto
            </span>

            <span className="text-xs font-mono text-zinc-400">
              Total Antre: <strong className="text-white text-sm">{totalWaiting}</strong>
            </span>
          </div>

          <div className="my-auto py-8 text-center">
            <AnimatePresence mode="wait">
              {activeServing ? (
                <motion.div
                  key={activeServing.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.4 }}
                >
                  <p className="text-[120px] sm:text-[160px] md:text-[200px] font-extrabold font-mono text-white tracking-tighter leading-none select-text drop-shadow-[0_0_50px_rgba(217,4,41,0.3)]">
                    {activeServing.queue_number}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#E79EA7] font-heading mt-4">
                    {activeServing.customer_name}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">Silakan menuju photobooth</p>
                </motion.div>
              ) : (
                <div className="py-16 text-center text-zinc-500">
                  <FiUsers size={64} className="mx-auto mb-4 opacity-40" />
                  <p className="text-2xl font-bold font-heading text-zinc-400">Photobooth Siap</p>
                  <p className="text-sm text-zinc-400 mt-1">Menunggu nomor antrian berikutnya...</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-white/10 pt-4 flex items-center justify-between text-xs text-zinc-400">
            <span>SnapHub Experience</span>
            <span className="flex items-center gap-1.5">
              <FiVolume2 /> Audio Panggilan Aktif
            </span>
          </div>
        </div>

        {/* SIDEBAR: UP NEXT + QR CODE */}
        <div className="flex flex-col gap-6 justify-between">
          {/* UP NEXT LIST */}
          <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 flex-1 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                <FiClock /> Antrian Berikutnya (Up Next)
              </h3>

              {upNextList.length === 0 ? (
                <p className="text-xs text-zinc-400 py-6 text-center">Belum ada antrian berikutnya.</p>
              ) : (
                <div className="space-y-3">
                  {upNextList.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-semibold uppercase">
                          Giliran ke-{idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {item.customer_name}
                        </span>
                      </div>
                      <span className="text-2xl font-bold font-mono text-amber-400">
                        {item.queue_number}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 text-center mt-4">
              Mohon bersiap jika nomor Anda mendekati urutan teratas.
            </p>
          </div>

          {/* QR CODE CARD */}
          <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 flex items-center gap-4 shadow-xl">
            <div className="bg-white p-2 rounded-2xl shrink-0 shadow-md">
              <img
                src={guestQrUrl}
                alt="Scan Antrian"
                className="w-24 h-24 object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-white block uppercase tracking-wider">
                Scan QR Disini
              </span>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                Ambil tiket digital langsung dari smartphone Anda tanpa perlu berdiri mengantre.
              </p>
              <span className="text-[10px] text-[#E79EA7] font-mono mt-2 block font-semibold">
                queue.snaphub.my.id
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 pt-4 flex items-center justify-between text-xs text-zinc-400 relative z-10">
        <span>Capture Every Smile with SnapHub</span>
        <span>Powered by SnapHub.id</span>
      </footer>
    </div>
  );
};

export default QueueDisplay;
