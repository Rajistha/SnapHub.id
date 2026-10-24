import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiPrinter, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { queueBaseUrl, tokenFromSlug } from '../lib/appUrls';

// Halaman QR besar untuk ditampilkan di tablet/monitor atau dicetak sebagai standing banner.
const QueueQr = () => {
  const { slug } = useParams();
  const token = tokenFromSlug(slug);
  const [event, setEvent] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc('get_queue_state', { p_token: token }).then(({ data }) => {
      if (!active) return;
      if (data?.event) setEvent(data.event);
      else if (data === null) setInvalid(true);
    });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const guestUrl = `${queueBaseUrl()}/${slug || ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=640x640&margin=0&data=${encodeURIComponent(guestUrl)}`;

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
    <div className="min-h-screen bg-[#08080a] text-white flex flex-col items-center justify-between p-6 sm:p-10 print:bg-white print:text-black">
      <header className="w-full flex items-center justify-between gap-4 print:hidden">
        <img src="/icons.svg" alt="SnapHub" className="h-9 w-auto" />
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="ui-btn border-white/15 hover:bg-white/10"><FiPrinter size={15} /> Cetak</button>
          <button onClick={toggleFullscreen} className="ui-btn ui-btn-icon border-white/15 hover:bg-white/10" aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}>
            {fullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center text-center py-8">
        <p className="text-lg text-zinc-400 print:text-zinc-600">{event?.name || 'SnapHub Photobooth'}</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2">Ambil nomor antrian</h1>
        <p className="text-lg sm:text-xl text-zinc-300 mt-3 print:text-zinc-700">Pindai QR dengan kamera HP, isi nama, lalu tunggu dipanggil.</p>

        <div className="bg-white rounded-3xl p-5 mt-8 shadow-2xl print:shadow-none print:border print:border-zinc-300">
          <img
            src={qrUrl}
            alt="QR code untuk mengambil nomor antrian"
            width="640"
            height="640"
            className="block w-[min(72vw,60vh,28rem)] h-auto aspect-square"
          />
        </div>

        <ol className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl w-full">
          {['Pindai QR', 'Isi nama & WhatsApp', 'HP berbunyi saat giliran Anda'].map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 print:border-zinc-300">
              <span className="w-8 h-8 shrink-0 rounded-full bg-[#D90429] text-white font-semibold flex items-center justify-center num">{i + 1}</span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </main>

      <footer className="w-full border-t border-white/10 pt-4 flex items-center justify-between gap-4 text-sm text-zinc-400 print:border-zinc-300">
        <span>Capture Every Smile with SnapHub</span>
        <span>Powered by SnapHub.id</span>
      </footer>
    </div>
  );
};

export default QueueQr;
