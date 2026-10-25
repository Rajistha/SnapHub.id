import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import usePolling from '../lib/usePolling';
import { queueBaseUrl, tokenFromSlug } from '../lib/appUrls';

// Halaman QR besar untuk ditampilkan di tablet/monitor meja masuk photobooth.
const QueueQr = () => {
  const { slug } = useParams();
  const token = tokenFromSlug(slug);
  const [event, setEvent] = useState(null);
  const [gate, setGate] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const refresh = useCallback(async () => {
    const [stateRes, gateRes] = await Promise.all([
      supabase.rpc('get_queue_state', { p_token: token }),
      supabase.rpc('queue_current_gate', { p_token: token }),
    ]);
    if (stateRes.data?.event) setEvent(stateRes.data.event);
    else if (stateRes.data === null) setInvalid(true);

    if (gateRes.data) setGate(gateRes.data);
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  usePolling(refresh, 2500, !invalid);

  // Realtime subscription via websocket
  useEffect(() => {
    const eventId = event?.id;
    if (!eventId || invalid) return undefined;

    const channel = supabase
      .channel(`queue_qr_rt_${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_entries', filter: `event_id=eq.${eventId}` },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event?.id, invalid, refresh]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const guestUrl = `${queueBaseUrl()}/${gate || slug || ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=640x640&margin=0&data=${encodeURIComponent(guestUrl)}`;

  useEffect(() => {
    if (!guestUrl) return;
    let alive = true;
    QRCode.toDataURL(guestUrl, { width: 640, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
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
          <h1 className="text-2xl font-semibold">Link QR tidak valid</h1>
          <p className="text-zinc-400 mt-2">Buka ulang dari menu Antrian di aplikasi admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#08080a] text-white flex flex-col items-center justify-between p-3.5 sm:p-6 lg:p-8 select-none">
      <header className="w-full flex items-center justify-between gap-4 pb-2 sm:pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/icons.svg" alt="SnapHub" className="h-7 sm:h-9 w-auto" />
          <span className="text-sm sm:text-base font-bold text-zinc-300 truncate">{event?.name || 'SnapHub Photobooth'}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            QR Dinamis Aktif
          </span>
          <button
            onClick={toggleFullscreen}
            className="ui-btn ui-btn-icon border-white/15 hover:bg-white/10 h-8 w-8 sm:h-9 sm:w-9"
            aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
          >
            {fullscreen ? <FiMinimize2 size={15} /> : <FiMaximize2 size={15} />}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col items-center justify-center text-center py-2 sm:py-3 w-full max-w-4xl">
        <h1 className="text-[clamp(1.5rem,4vh,2.75rem)] font-extrabold tracking-tight text-white leading-tight">
          Ambil Nomor Antrian
        </h1>
        <p className="text-[clamp(0.85rem,2vh,1.15rem)] text-zinc-300 mt-1 max-w-lg leading-snug">
          Pindai QR dengan kamera HP, isi nama, lalu tunggu dipanggil santai tanpa antre berdiri.
        </p>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 my-2 sm:my-3 shadow-2xl shadow-rose-950/20">
          <img
            src={qrDataUrl || qrUrl}
            alt="QR code untuk mengambil nomor antrian"
            className="block w-[clamp(10rem,35vh,20rem)] h-[clamp(10rem,35vh,20rem)] object-contain rounded-xl"
          />
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-left max-w-2xl w-full">
          {[
            { num: '1', title: 'Pindai QR', desc: 'Gunakan kamera HP Anda' },
            { num: '2', title: 'Ambil Nomor', desc: '1-Tap instan tanpa repot' },
            { num: '3', title: 'HP Berbunyi', desc: 'Notifikasi saat giliran tiba' },
          ].map((step) => (
            <li key={step.num} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:py-2.5">
              <span className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full bg-[#D90429] text-white font-bold text-xs sm:text-sm flex items-center justify-center num shadow-sm">
                {step.num}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-xs sm:text-sm text-white leading-tight truncate">{step.title}</p>
                <p className="text-[10px] sm:text-[11px] text-zinc-400 leading-tight truncate mt-0.5">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>

      <footer className="w-full border-t border-white/10 pt-2 sm:pt-2.5 flex items-center justify-between gap-4 text-[11px] sm:text-xs text-zinc-400 shrink-0">
        <span>Capture Every Smile with SnapHub</span>
        <span className="font-medium">Powered by SnapHub.id</span>
      </footer>
    </div>
  );
};

export default QueueQr;
