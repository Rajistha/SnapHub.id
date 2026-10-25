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
  usePolling(refresh, 3000, !invalid);

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
    <div className="min-h-screen bg-[#08080a] text-white flex flex-col items-center justify-between p-6 sm:p-10 select-none">
      <header className="w-full flex items-center justify-between gap-4">
        <img src="/icons.svg" alt="SnapHub" className="h-9 w-auto" />
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            QR Dinamis Aktif
          </span>
          <button onClick={toggleFullscreen} className="ui-btn ui-btn-icon border-white/15 hover:bg-white/10" aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}>
            {fullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center text-center py-8">
        <p className="text-lg text-zinc-400">{event?.name || 'SnapHub Photobooth'}</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2">Ambil nomor antrian</h1>
        <p className="text-lg sm:text-xl text-zinc-300 mt-3">Pindai QR dengan kamera HP, isi nama, lalu tunggu dipanggil.</p>

        <div className="bg-white rounded-3xl p-5 mt-8 shadow-2xl">
          <img
            src={qrDataUrl || qrUrl}
            alt="QR code untuk mengambil nomor antrian"
            width="640"
            height="640"
            className="block w-[min(72vw,60vh,28rem)] h-auto aspect-square rounded-xl"
          />
        </div>

        <ol className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl w-full">
          {['Pindai QR', 'Isi nama panggilan', 'HP berbunyi saat giliran Anda'].map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
              <span className="w-8 h-8 shrink-0 rounded-full bg-[#D90429] text-white font-semibold flex items-center justify-center num">{i + 1}</span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </main>

      <footer className="w-full border-t border-white/10 pt-4 flex items-center justify-between gap-4 text-sm text-zinc-400">
        <span>Capture Every Smile with SnapHub</span>
        <span>Powered by SnapHub.id</span>
      </footer>
    </div>
  );
};

export default QueueQr;
