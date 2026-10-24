import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { FiBell, FiCheck, FiVolume2, FiRotateCcw, FiNavigation } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import usePolling from '../lib/usePolling';
import { playChime, unlockAudio, vibrate } from '../lib/chime';
import { ACTIVE_STATUSES } from '../lib/queueStatus';
import { tokenFromSlug } from '../lib/appUrls';
import Modal from '../components/ui/Modal';

const storageKey = (token) => `snaphub_ticket_${token}`;
const readStored = (token) => {
  try {
    return localStorage.getItem(storageKey(token));
  } catch {
    return null;
  }
};
const writeStored = (token, id) => {
  try {
    if (id) localStorage.setItem(storageKey(token), id);
    else localStorage.removeItem(storageKey(token));
  } catch {
    /* penyimpanan diblokir: tiket tetap jalan selama halaman terbuka */
  }
};

const normalizePhone = (value) => {
  let digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits;
};

const FINISHED = ['completed', 'skipped', 'cancelled'];

const QueueGuest = () => {
  const { slug } = useParams();
  const token = tokenFromSlug(slug);

  const [state, setState] = useState(null); // { event, board, completed_count, ticket }
  const [status, setStatus] = useState('loading'); // loading | ready | invalid
  const [ticketId, setTicketId] = useState(() => readStored(token));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const lastAlertRef = useRef(null);
  const ticketIdRef = useRef(ticketId);
  ticketIdRef.current = ticketId;

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_queue_state', { p_token: token, p_ticket_id: ticketId });
    if (error) return; // koneksi sesaat putus: pertahankan tampilan terakhir
    if (ticketIdRef.current !== ticketId) return; // jawaban usang setelah tiket dilepas/diganti
    if (!data) {
      setStatus('invalid');
      return;
    }
    setState(data);
    setStatus('ready');
  }, [token, ticketId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ticket = state?.ticket || null;
  const board = useMemo(() => state?.board || [], [state]);
  const myTurn = !!ticket && ACTIVE_STATUSES.includes(ticket.status);

  // Lebih sering saat giliran sudah dekat atau sedang dipanggil, santai saat masih lama.
  const waiting = useMemo(() => board.filter((q) => q.status === 'waiting'), [board]);
  const position = ticket?.status === 'waiting' ? waiting.findIndex((q) => q.id === ticket.id) + 1 : 0;
  const ahead = Math.max(0, position - 1);
  const interval = !ticket ? 5000 : myTurn || (position > 0 && position <= 3) ? 3000 : 6000;
  usePolling(refresh, interval, status === 'ready');

  // Tiket yang hilang dari server (mis. dihapus admin) dilepas dari perangkat.
  useEffect(() => {
    if (status === 'ready' && ticketId && !state?.ticket) {
      writeStored(token, null);
      setTicketId(null);
    }
  }, [status, ticketId, state, token]);

  // Peringatan saat dipanggil, termasuk panggilan ulang oleh admin.
  useEffect(() => {
    if (!ticket || ticket.status === 'heading') {
      if (ticket?.status === 'heading') setCallOpen(false);
      return;
    }
    if (ticket.status !== 'called' && ticket.status !== 'serving') return;
    const key = `${ticket.status}_${ticket.called_count}_${ticket.called_at}`;
    if (lastAlertRef.current === key) return;
    lastAlertRef.current = key;
    setCallOpen(true);
  }, [ticket]);

  useEffect(() => {
    if (!callOpen) return undefined;
    const ring = () => {
      playChime(0.9);
      vibrate();
    };
    ring();
    const id = setInterval(ring, 4000);
    return () => clearInterval(id);
  }, [callOpen]);

  // Jaga layar tetap menyala selama menunggu agar bunyi & getar tidak terlewat.
  const liveTicket = !!ticket && !FINISHED.includes(ticket.status);
  useEffect(() => {
    if (!liveTicket || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* tidak didukung / ditolak */
      }
    };
    const onVisible = () => {
      if (!document.hidden) acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [liveTicket]);

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Isi nama panggilan Anda.';
    const digits = normalizePhone(phone);
    if (digits.length < 9 || digits.length > 15) next.phone = 'Nomor WhatsApp tidak valid. Contoh: 08123456789';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const takeTicket = async (e) => {
    e.preventDefault();
    unlockAudio();
    if (!validate()) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc('take_queue_ticket', {
      p_token: token,
      p_name: name.trim(),
      p_phone: normalizePhone(phone),
    });
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message?.includes('Terlalu banyak') ? 'Sedang ramai, coba lagi sebentar.' : 'Gagal mengambil nomor. Coba lagi.');
      return;
    }
    writeStored(token, data.id);
    setTicketId(data.id);
    setState((prev) => ({ ...(prev || {}), ticket: data }));
    toast.success(data.existing ? `Nomor ${data.queue_number} sudah atas nama nomor ini.` : 'Nomor antrian berhasil diambil');
  };

  const confirmHeading = async () => {
    setCallOpen(false);
    if (!ticket) return;
    setState((prev) => ({ ...prev, ticket: { ...prev.ticket, status: 'heading' } }));
    const { error } = await supabase.rpc('queue_confirm_heading', { p_ticket_id: ticket.id });
    if (error) toast.error('Konfirmasi belum terkirim. Temui kru di booth.');
    else toast.success('Kru sudah tahu Anda menuju booth.');
  };

  const releaseTicket = async (cancelOnServer) => {
    if (cancelOnServer && ticket?.status === 'waiting') {
      await supabase.rpc('queue_leave', { p_ticket_id: ticket.id });
    }
    writeStored(token, null);
    setTicketId(null);
    setState((prev) => (prev ? { ...prev, ticket: null } : prev));
    setName('');
    setPhone('');
    setErrors({});
    setLeaveOpen(false);
    setCallOpen(false);
    lastAlertRef.current = null;
  };

  const testSound = () => {
    unlockAudio();
    playChime(0.9);
    vibrate();
    toast.success('Suara & getar aktif');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c]">
        <div className="w-8 h-8 border-[3px] border-[#D90429] border-t-transparent rounded-full animate-spin" role="status" aria-label="Memuat" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div data-theme="dark" className="min-h-screen flex items-center justify-center bg-[#0b0b0c] text-white p-6 text-center">
        <div className="max-w-xs">
          <h1 className="text-lg font-semibold">Link antrian tidak valid</h1>
          <p className="text-sm text-zinc-400 mt-2">Link mungkin sudah diganti atau kedaluwarsa. Pindai ulang QR di booth atau tanyakan kru SnapHub.</p>
        </div>
      </div>
    );
  }

  const active = board.find((q) => ACTIVE_STATUSES.includes(q.status));
  const finished = ticket && FINISHED.includes(ticket.status);

  const card = 'rounded-2xl border border-white/10 bg-[#141416]';

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0b0b0c] text-white flex flex-col">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1c1c1f', color: '#fff', border: '1px solid #2a2a2e' } }} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0b0c]/95 backdrop-blur px-5 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/icons.svg" alt="" className="h-7 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{state?.event?.name || 'SnapHub Photobooth'}</h1>
            <p className="text-xs text-zinc-400">Antrian photobooth</p>
          </div>
        </div>
        <button onClick={testSound} className="ui-btn ui-btn-sm shrink-0 text-zinc-200 border-white/15 hover:bg-white/10">
          <FiVolume2 size={14} /> Tes suara
        </button>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 flex flex-col justify-center">
        {!ticket ? (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${card} p-6`}>
            <h2 className="text-xl font-semibold">Ambil nomor antrian</h2>
            <p className="text-sm text-zinc-400 mt-1">Tidak perlu berdiri menunggu. HP Anda akan berbunyi saat giliran tiba.</p>

            <dl className="grid grid-cols-2 gap-4 my-5 py-4 border-y border-white/10">
              <div>
                <dt className="text-xs text-zinc-400">Sedang difoto</dt>
                <dd className="text-xl font-semibold font-mono mt-0.5">{active ? active.queue_number : '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Sedang antre</dt>
                <dd className="text-xl font-semibold mt-0.5 num">{waiting.length} <span className="text-sm font-normal text-zinc-400">orang</span></dd>
              </div>
            </dl>

            <form onSubmit={takeTicket} className="space-y-4" noValidate>
              <div>
                <label htmlFor="guest-name" className="block text-sm font-medium text-zinc-200 mb-1.5">Nama panggilan</label>
                <input
                  id="guest-name" name="nickname" type="text" autoComplete="nickname" maxLength={40}
                  value={name} onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name} aria-describedby={errors.name ? 'guest-name-err' : undefined}
                  placeholder="Contoh: Rina & teman"
                  className="ui-input bg-white/5 border-white/15 text-white"
                />
                {errors.name && <p id="guest-name-err" role="alert" className="text-sm text-red-400 mt-1.5">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="guest-phone" className="block text-sm font-medium text-zinc-200 mb-1.5">Nomor WhatsApp</label>
                <input
                  id="guest-phone" name="tel" type="tel" inputMode="tel" autoComplete="tel" maxLength={20}
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'guest-phone-err' : 'guest-phone-hint'}
                  placeholder="08123456789"
                  className="ui-input bg-white/5 border-white/15 text-white"
                />
                {errors.phone ? (
                  <p id="guest-phone-err" role="alert" className="text-sm text-red-400 mt-1.5">{errors.phone}</p>
                ) : (
                  <p id="guest-phone-hint" className="text-sm text-zinc-400 mt-1.5">Hanya dipakai kru untuk mengingatkan giliran Anda.</p>
                )}
              </div>
              <button type="submit" disabled={submitting} className="ui-btn ui-btn-primary ui-btn-lg w-full">
                {submitting ? 'Memproses…' : 'Ambil nomor'}
              </button>
            </form>
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`${card} p-6 text-center ${myTurn ? 'border-emerald-400/70' : ''}`}
            aria-live="polite"
          >
            <p className="text-sm text-zinc-400">Nomor antrian Anda</p>
            <p className="text-7xl font-bold font-mono tracking-tight my-2 num">{ticket.queue_number}</p>
            <p className="text-base font-medium text-zinc-200">{ticket.customer_name}</p>

            <div className="my-5">
              {myTurn ? (
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-400 text-black font-semibold text-sm px-4 py-2">
                  {ticket.status === 'heading' ? <><FiNavigation size={15} /> Menuju booth</> : <><FiBell size={15} /> Giliran Anda sekarang</>}
                </p>
              ) : finished ? (
                <p className="text-sm font-medium text-zinc-300">
                  {ticket.status === 'completed' ? 'Sesi foto Anda sudah selesai. Terima kasih!' : ticket.status === 'skipped' ? 'Nomor Anda dilewati. Temui kru bila masih ingin berfoto.' : 'Nomor ini sudah dibatalkan.'}
                </p>
              ) : position > 0 && position <= 2 ? (
                <p className="inline-flex rounded-full border border-amber-300/50 text-amber-200 font-medium text-sm px-4 py-2">Segera merapat ke booth</p>
              ) : (
                <p className="text-sm text-zinc-400">Menunggu giliran</p>
              )}
            </div>

            <dl className="text-left rounded-xl bg-white/5 divide-y divide-white/10 text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-zinc-400">Sedang difoto</dt>
                <dd className="font-mono font-semibold">{active ? active.queue_number : '–'}</dd>
              </div>
              {ticket.status === 'waiting' && (
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-zinc-400">Antrian di depan Anda</dt>
                  <dd className="font-semibold num">{ahead} orang</dd>
                </div>
              )}
            </dl>

            <p className="text-sm text-zinc-400 mt-5">
              {myTurn
                ? 'Tunjukkan nomor ini ke kru di booth.'
                : finished
                  ? ''
                  : 'Biarkan halaman ini terbuka. HP akan berbunyi dan bergetar saat giliran Anda.'}
            </p>

            <div className="mt-5">
              {finished ? (
                <button onClick={() => releaseTicket(false)} className="ui-btn w-full text-white border-white/20 hover:bg-white/10">Ambil nomor baru</button>
              ) : ticket.status === 'waiting' ? (
                <button onClick={() => setLeaveOpen(true)} className="ui-btn ui-btn-sm ui-btn-ghost text-zinc-400 mx-auto">
                  <FiRotateCcw size={14} /> Batalkan nomor
                </button>
              ) : null}
            </div>
          </motion.section>
        )}
      </main>

      <footer className="px-4 py-4 text-center text-xs text-zinc-500">SnapHub.id</footer>

      <AnimatePresence>
        {callOpen && ticket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85" role="alertdialog" aria-modal="true" aria-label="Giliran Anda">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl bg-[#141416] border-2 border-emerald-400 p-7 text-center"
            >
              <FiBell size={30} className="mx-auto text-emerald-400" aria-hidden="true" />
              <h2 className="text-2xl font-bold mt-3">Giliran Anda tiba</h2>
              <p className="text-6xl font-bold font-mono my-4 num">{ticket.queue_number}</p>
              <p className="text-sm text-zinc-300 mb-6">Silakan menuju booth dan tunjukkan nomor ini ke kru SnapHub.</p>
              <button autoFocus onClick={confirmHeading} className="ui-btn ui-btn-ok ui-btn-lg w-full">
                <FiCheck size={18} /> Saya menuju booth
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {leaveOpen && (
        <Modal
          title="Batalkan nomor ini?"
          description={`Nomor ${ticket?.queue_number} akan dilepas dan Anda keluar dari antrian.`}
          size="sm"
          onClose={() => setLeaveOpen(false)}
          footer={
            <>
              <button onClick={() => setLeaveOpen(false)} className="ui-btn">Tidak</button>
              <button onClick={() => releaseTicket(true)} className="ui-btn ui-btn-solid-danger">Ya, batalkan</button>
            </>
          }
        />
      )}
    </div>
  );
};

export default QueueGuest;
