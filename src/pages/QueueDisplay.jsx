import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { FiMaximize2, FiMinimize2, FiVolume2, FiVolumeX } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import usePolling from '../lib/usePolling';
import { announceQueue, playChime, speak, unlockAudio } from '../lib/chime';
import { ACTIVE_STATUSES } from '../lib/queueStatus';
import { queueBaseUrl, tokenFromSlug } from '../lib/appUrls';

// Jam dipisah agar detik berjalan tidak merender ulang seluruh layar TV.
const Clock = memo(function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right">
      <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono leading-tight num">
        {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-[10px] sm:text-xs text-zinc-400">
        {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
      </p>
    </div>
  );
});

const QueueDisplay = () => {
  const { slug } = useParams();
  const token = tokenFromSlug(slug);

  const [state, setState] = useState(null);
  const [gate, setGate] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [offline, setOffline] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const lastCallRef = useRef(null);

  const refresh = useCallback(async () => {
    const [stateRes, gateRes] = await Promise.all([
      supabase.rpc('get_queue_state', { p_token: token }),
      supabase.rpc('queue_current_gate', { p_token: token }),
    ]);
    if (stateRes.error) {
      setOffline(true);
      return;
    }
    setOffline(false);
    if (!stateRes.data) setInvalid(true);
    else setState(stateRes.data);

    if (gateRes.data) setGate(gateRes.data);
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  usePolling(refresh, 2500, !invalid);

  // Realtime subscription via websocket: saat giliran dipanggil/selesai, layar TV bereaksi dalam hitungan 50ms!
  useEffect(() => {
    const eventId = state?.event?.id;
    if (!eventId || invalid) return undefined;

    const channel = supabase
      .channel(`queue_display_rt_${eventId}`)
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
  }, [state?.event?.id, invalid, refresh]);

  const board = useMemo(() => state?.board || [], [state]);
  const active = useMemo(() => board.find((q) => ACTIVE_STATUSES.includes(q.status)) || null, [board]);
  const waiting = useMemo(() => board.filter((q) => q.status === 'waiting'), [board]);

  // Bunyi saat nomor baru dipanggil atau dipanggil ulang.
  const callKey = active ? `${active.id}_${active.called_count}_${active.called_at}` : null;
  const isInitialLoadDoneRef = useRef(false);

  // Tandai panggilan awal saat pertama kali data selesai dimuat dari server agar tidak berbunyi saat layar TV di-refresh
  useEffect(() => {
    if (state !== null && !isInitialLoadDoneRef.current) {
      isInitialLoadDoneRef.current = true;
      lastCallRef.current = callKey || '__INITIAL_IDLE__';
    }
  }, [state, callKey]);

  useEffect(() => {
    if (!isInitialLoadDoneRef.current) return;
    if (!callKey || callKey === lastCallRef.current) return;

    lastCallRef.current = callKey;
    if (soundOn && active) {
      announceQueue(active.queue_number, active.name);
    }
  }, [callKey, soundOn, active]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleSound = () => {
    unlockAudio();
    setSoundOn((on) => {
      if (!on) {
        playChime(0.7);
        setTimeout(() => speak('Suara panggilan aktif'), 1500);
      }
      return !on;
    });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const guestUrl = `${queueBaseUrl()}/${gate || slug || ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=8&data=${encodeURIComponent(guestUrl)}`;
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!guestUrl) return;
    let alive = true;
    QRCode.toDataURL(guestUrl, { width: 480, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [guestUrl]);

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a] text-white text-center p-8">
        <div>
          <h1 className="text-2xl font-semibold">Link layar tidak valid</h1>
          <p className="text-zinc-400 mt-2">Buka ulang dari menu Antrian di aplikasi admin.</p>
        </div>
      </div>
    );
  }

  const heading = active?.status === 'heading';

  return (
    <div className="h-[100dvh] max-h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#08080a] text-white flex flex-col p-3 sm:p-5 lg:p-6 select-none justify-between">
      {/* ── Header Layar TV ── */}
      <header className="flex items-center justify-between gap-4 pb-2.5 sm:pb-3.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img src="/icons.svg" alt="SnapHub" className="h-7 sm:h-9 lg:h-10 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl lg:text-2xl font-bold truncate tracking-tight">
              {state?.event?.name || 'SnapHub Photobooth'}
            </h1>
            <p className="text-[11px] sm:text-xs lg:text-sm text-zinc-400">Antrian Photobooth</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <Clock />
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={toggleSound}
              className="ui-btn ui-btn-icon border-white/15 text-white hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10"
              aria-label={soundOn ? 'Matikan suara panggilan' : 'Aktifkan suara panggilan'}
              aria-pressed={soundOn}
            >
              {soundOn ? <FiVolume2 size={16} /> : <FiVolumeX size={16} />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="ui-btn ui-btn-icon border-white/15 text-white hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10"
              aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
            >
              {fullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Konten Utama (Grid Auto-fit tanpa Scroll) ── */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 py-2.5 sm:py-3.5">
        {/* Kolom Kiri: Panggilan Aktif */}
        <section
          className="lg:col-span-7 xl:col-span-8 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#111114] p-4 sm:p-6 lg:p-7 flex flex-col justify-between shadow-[0_10px_40px_rgba(0,0,0,0.5)] min-h-0"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-4 shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
              {active?.status === 'serving' ? 'Sedang difoto' : heading ? 'Tamu menuju booth' : 'Sekarang giliran'}
            </span>
            <p className="text-xs sm:text-sm lg:text-base font-medium text-zinc-400 num bg-white/5 px-3 py-1 rounded-full border border-white/10">
              {waiting.length} antrian menunggu
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-1 min-h-0">
            {active ? (
              <>
                <p className="font-extrabold font-mono leading-none tracking-tight num text-[clamp(4.2rem,min(16vw,17vh),11rem)] text-white drop-shadow-[0_4px_30px_rgba(255,255,255,0.15)]">
                  {active.queue_number}
                </p>
                {active.name ? (
                  <p className="text-[clamp(1.15rem,3vh,2rem)] font-bold mt-1.5 sm:mt-3 text-zinc-100 truncate max-w-full">
                    {active.name}
                  </p>
                ) : null}
                <div className="mt-2.5 sm:mt-4">
                  <span
                    className={`inline-flex items-center gap-2 sm:gap-2.5 rounded-full px-5 sm:px-7 py-1.5 sm:py-2.5 text-[clamp(0.85rem,2vh,1.35rem)] font-extrabold tracking-wide uppercase shadow-lg ${
                      active.status === 'serving'
                        ? 'bg-emerald-400 text-black shadow-emerald-400/20'
                        : heading
                          ? 'bg-sky-400 text-black shadow-sky-400/20'
                          : 'bg-[#D90429] text-white shadow-[#D90429]/30'
                    }`}
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
                    </span>
                    {active.status === 'serving'
                      ? 'Sesi foto sedang berlangsung'
                      : heading
                        ? 'Menuju photobooth'
                        : 'Silakan menuju photobooth'}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-4">
                <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-300">Photobooth Siap</p>
                <p className="text-sm sm:text-base text-zinc-400 mt-2">Menunggu nomor antrian berikutnya dipanggil</p>
              </div>
            )}
          </div>
        </section>

        {/* Kolom Kanan: Antrian Berikutnya & QR Code */}
        <aside className="lg:col-span-5 xl:col-span-4 flex flex-col gap-2.5 sm:gap-3.5 min-h-0 justify-between">
          {/* Card Antrian Berikutnya */}
          <section className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#111114] p-3.5 sm:p-4 lg:p-5 flex-1 min-h-0 flex flex-col overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between pb-2 sm:pb-2.5 border-b border-white/10 shrink-0">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-300">Berikutnya</h2>
              <span className="text-[11px] sm:text-xs text-zinc-400">Siap-siap di booth</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pt-2.5 sm:pt-3 flex flex-col gap-2 sm:gap-2.5 no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {waiting.length === 0 ? (
                <p className="text-xs sm:text-sm text-zinc-400 text-center my-auto py-8">Belum ada antrian menunggu.</p>
              ) : (
                waiting.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/5 hover:bg-white/[0.07] px-3.5 sm:px-4 py-2 sm:py-2.5 border border-white/5 transition-colors shrink-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[10px] sm:text-xs font-semibold text-zinc-300">
                        {idx + 1}
                      </span>
                      {item.name ? (
                        <span className="text-sm sm:text-base font-semibold truncate text-zinc-200">{item.name}</span>
                      ) : (
                        <span className="text-xs sm:text-sm font-medium uppercase tracking-wider text-zinc-400">Antrian #{idx + 1}</span>
                      )}
                    </div>
                    <span className="text-lg sm:text-2xl font-black font-mono tracking-tight num text-rose-200">
                      {item.queue_number}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Card QR Code */}
          <section className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#111114] p-3.5 sm:p-5 shrink-0 flex items-center gap-4 sm:gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 shrink-0 shadow-xl">
              <img
                src={qrDataUrl || qrUrl}
                alt="QR untuk mengambil nomor antrian"
                className="w-[clamp(8.5rem,24vh,15rem)] h-[clamp(8.5rem,24vh,15rem)] rounded-xl sm:rounded-2xl object-contain block"
              />
            </div>
            <div className="min-w-0">
              <span className="inline-block text-xs sm:text-sm lg:text-base font-bold text-rose-400 uppercase tracking-wider mb-1">
                Scan HP
              </span>
              <p className="text-base sm:text-xl lg:text-2xl font-extrabold text-white leading-tight">
                Ambil nomor antrian
              </p>
              <p className="text-xs sm:text-sm lg:text-base text-zinc-400 mt-1.5 leading-snug">
                Pindai QR ini untuk ambil nomor antrian Anda di photobooth.
              </p>
            </div>
          </section>
        </aside>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 pt-2 sm:pt-2.5 flex items-center justify-between gap-4 text-[11px] sm:text-xs text-zinc-400 shrink-0">
        <span className="truncate">Capture Every Smile with SnapHub</span>
        {offline && (
          <span className="text-amber-300 font-medium" role="status">
            Menyambung ulang…
          </span>
        )}
        <span className="font-medium shrink-0">Powered by SnapHub.id</span>
      </footer>
    </div>
  );
};

export default QueueDisplay;
