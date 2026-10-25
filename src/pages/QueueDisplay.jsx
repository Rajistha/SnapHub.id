import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useParams } from 'react-router-dom';
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
      <p className="text-3xl font-semibold font-mono num">{now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
      <p className="text-sm text-zinc-400">{now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
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
  usePolling(refresh, 3000, !invalid);

  const board = useMemo(() => state?.board || [], [state]);
  const active = useMemo(() => board.find((q) => ACTIVE_STATUSES.includes(q.status)) || null, [board]);
  const waiting = useMemo(() => board.filter((q) => q.status === 'waiting'), [board]);

  // Bunyi saat nomor baru dipanggil atau dipanggil ulang.
  const callKey = active ? `${active.id}_${active.called_count}_${active.called_at}` : null;
  useEffect(() => {
    if (!callKey || callKey === lastCallRef.current) return;
    const firstLoad = lastCallRef.current === null;
    lastCallRef.current = callKey;
    if (soundOn && !firstLoad && active) announceQueue(active.queue_number, active.name);
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
        playChime(0.6);
        setTimeout(() => speak('Suara panggilan aktif'), 1800);
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
    <div className="min-h-screen bg-[#08080a] text-white flex flex-col p-6 sm:p-10 select-none">
      <header className="flex items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div className="flex items-center gap-4 min-w-0">
          <img src="/icons.svg" alt="" className="h-10 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">{state?.event?.name || 'SnapHub Photobooth'}</h1>
            <p className="text-sm text-zinc-400">Antrian photobooth</p>
          </div>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <Clock />
          <div className="flex gap-2">
            <button onClick={toggleSound} className="ui-btn ui-btn-icon border-white/15 text-white hover:bg-white/10" aria-label={soundOn ? 'Matikan suara panggilan' : 'Aktifkan suara panggilan'} aria-pressed={soundOn}>
              {soundOn ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
            </button>
            <button onClick={toggleFullscreen} className="ui-btn ui-btn-icon border-white/15 text-white hover:bg-white/10" aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}>
              {fullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 py-6">
        <section className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#111114] p-8 sm:p-12 flex flex-col" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-300">{active?.status === 'serving' ? 'Sedang difoto' : heading ? 'Tamu sedang menuju booth' : 'Sekarang giliran'}</h2>
            <p className="text-lg text-zinc-400 num">{waiting.length} menunggu</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            {active ? (
              <>
                <p className="font-bold font-mono leading-none tracking-tight num" style={{ fontSize: 'clamp(6rem, 17vw, 14rem)' }}>{active.queue_number}</p>
                <p className="text-3xl font-medium mt-6 text-zinc-100">{active.name}</p>
                <p className={`mt-5 inline-flex items-center gap-3 rounded-full px-8 py-3 text-2xl sm:text-3xl font-bold ${
                  active.status === 'serving' ? 'bg-emerald-400 text-black' : heading ? 'bg-sky-400 text-black' : 'bg-[#D90429] text-white'
                }`}>
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-current" />
                  </span>
                  {active.status === 'serving' ? 'Sesi foto sedang berlangsung' : heading ? 'Menuju photobooth' : 'Silakan menuju photobooth'}
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl font-semibold text-zinc-300">Photobooth siap</p>
                <p className="text-lg text-zinc-400 mt-2">Menunggu nomor berikutnya</p>
              </>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-3xl border border-white/10 bg-[#111114] p-6 flex-1">
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Berikutnya</h2>
            {waiting.length === 0 ? (
              <p className="text-zinc-400">Belum ada antrian.</p>
            ) : (
              <ol className="space-y-3">
                {waiting.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-5 py-4">
                    <span className="text-lg font-medium truncate">{item.name}</span>
                    <span className="text-3xl font-bold font-mono num">{item.queue_number}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#111114] p-6 flex items-center gap-5">
            <div className="bg-white rounded-xl p-1.5 shrink-0">
              <img src={qrUrl} alt="QR untuk mengambil nomor antrian" width="176" height="176" className="w-36 h-36 xl:w-44 xl:h-44" />
            </div>
            <div>
              <p className="text-lg font-semibold">Ambil nomor lewat HP</p>
              <p className="text-sm text-zinc-400 mt-1">Pindai QR ini, isi nama, lalu santai sampai dipanggil.</p>
            </div>
          </section>
        </aside>
      </main>

      <footer className="border-t border-white/10 pt-4 flex items-center justify-between gap-4 text-sm text-zinc-400">
        <span>Capture Every Smile with SnapHub</span>
        {offline && <span className="text-amber-300" role="status">Menyambung ulang…</span>}
        <span>Powered by SnapHub.id</span>
      </footer>
    </div>
  );
};

export default QueueDisplay;
