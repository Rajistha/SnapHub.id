import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { FiBell, FiCheck, FiVolume2, FiRotateCcw, FiNavigation, FiCamera, FiArrowRight } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import usePolling from '../lib/usePolling';
import { playChime, speak, spokenNumber, unlockAudio, vibrate } from '../lib/chime';
import { ACTIVE_STATUSES, estimateMinutes, formatEstimate, statusMeta } from '../lib/queueStatus';
import { tokenFromSlug } from '../lib/appUrls';

const ticketStorageKey = (token) => `snaphub_ticket_${token}`;
const stateStorageKey = (token) => `snaphub_state_${token}`;

const readTicketId = (token) => {
  try {
    return localStorage.getItem(ticketStorageKey(token)) || null;
  } catch {
    return null;
  }
};

const writeTicketId = (token, id) => {
  try {
    if (id) localStorage.setItem(ticketStorageKey(token), id);
    else localStorage.removeItem(ticketStorageKey(token));
  } catch {}
};

const readCachedState = (token) => {
  try {
    if (!token) return null;
    const raw = sessionStorage.getItem(stateStorageKey(token)) || localStorage.getItem(stateStorageKey(token));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCachedState = (token, data) => {
  try {
    if (!token) return;
    if (data) {
      const serialized = JSON.stringify(data);
      sessionStorage.setItem(stateStorageKey(token), serialized);
      localStorage.setItem(stateStorageKey(token), serialized);
    } else {
      sessionStorage.removeItem(stateStorageKey(token));
      localStorage.removeItem(stateStorageKey(token));
    }
  } catch {}
};

const FINISHED = ['completed', 'skipped', 'cancelled'];

const Stat = ({ label, value, sub, highlight }) => {
  const isWord = typeof value === 'string' && /[a-zA-Z]{3,}/.test(value);
  return (
    <div
      className={`rounded-2xl px-1.5 py-[clamp(0.4rem,1.1vh,0.7rem)] text-center border overflow-hidden flex flex-col justify-center min-w-0 ${
        highlight ? 'bg-[#D90429]/15 border-[#D90429]/50' : 'bg-white/[0.05] border-white/10'
      }`}
    >
      <dt className="text-[10px] uppercase tracking-wider text-zinc-400 leading-tight truncate">{label}</dt>
      <dd
        className={`font-bold leading-tight mt-1 truncate ${
          isWord
            ? 'text-[clamp(0.68rem,1.7vh,0.8rem)] font-sans uppercase font-extrabold tracking-tight text-rose-200'
            : 'text-[clamp(1rem,2.8vh,1.3rem)] font-mono num'
        }`}
      >
        {value}
      </dd>
      {sub && <p className="text-[10px] text-zinc-400 leading-tight mt-0.5 truncate">{sub}</p>}
    </div>
  );
};

const QueueGuest = () => {
  const { slug } = useParams();
  const token = tokenFromSlug(slug);

  const [ticketId, setTicketId] = useState(() => readTicketId(token));
  const [state, setState] = useState(() => readCachedState(token));
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const refreshRef = useRef();
  const lastAlertRef = useRef(null);
  const inFlightRef = useRef(false);
  const releaseTicketRef = useRef();
  const isReleasedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!token || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const currentTicketId = isReleasedRef.current ? null : (ticketId || readTicketId(token));
      const { data, error } = await supabase.rpc('get_queue_state', {
        p_token: token,
        p_ticket_id: currentTicketId || null,
      });
      if (error) return;
      if (!data) {
        setInvalid(true);
        return;
      }
      setState(data);
      writeCachedState(token, data);

      if (data.ticket?.id) {
        if (!isReleasedRef.current && data.ticket.id !== ticketId) {
          setTicketId(data.ticket.id);
          writeTicketId(token, data.ticket.id);
        }
      } else if (currentTicketId && !isReleasedRef.current) {
        // Tiket sudah tidak ada di database (misal dihapus admin)
        setTicketId(null);
        writeTicketId(token, null);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [token, ticketId]);

  refreshRef.current = refresh;

  // Konsumsi preload fetch dari index.html atau muat data awal
  useEffect(() => {
    if (!token) {
      setInvalid(true);
      return undefined;
    }
    let alive = true;

    const preload = window.__queuePreload;
    if (preload && preload.token === token) {
      window.__queuePreload = null;
      preload.promise
        .then((data) => {
          if (!alive) return;
          if (!data) {
            refresh();
            return;
          }
          setState(data);
          writeCachedState(token, data);
          if (data.ticket?.id && !isReleasedRef.current) {
            setTicketId(data.ticket.id);
            writeTicketId(token, data.ticket.id);
          } else if (preload.ticketId && !data.ticket && !isReleasedRef.current) {
            setTicketId(null);
            writeTicketId(token, null);
          }
        })
        .catch(() => {
          if (alive) refreshRef.current?.();
        });
      return () => {
        alive = false;
      };
    }

    refresh();
    return () => {
      alive = false;
    };
  }, [token]);

  const ticket = state?.ticket || null;
  const board = useMemo(() => state?.board || [], [state]);
  const myTurn = !!ticket && ACTIVE_STATUSES.includes(ticket.status);

  // Polling dipercepat (1.5s - 3s)
  const waiting = useMemo(() => board.filter((q) => q.status === 'waiting'), [board]);
  const position = ticket?.status === 'waiting' ? waiting.findIndex((q) => q.id === ticket.id) + 1 : 0;
  const ahead = Math.max(0, position - 1);
  const interval = !ticket ? 3000 : myTurn || (position > 0 && position <= 3) ? 1500 : 2500;
  usePolling(refresh, interval, !invalid);

  // Realtime subscription via websocket
  useEffect(() => {
    const eventId = state?.event?.id;
    if (!eventId || invalid) return undefined;

    const channel = supabase
      .channel(`queue_guest_rt_${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_queues', filter: `event_id=eq.${eventId}` },
        () => {
          refreshRef.current?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state?.event?.id, invalid]);

  // Peringatan saat status 'called'
  useEffect(() => {
    if (ticket?.status !== 'called') {
      if (ticket) setCallOpen(false);
      return;
    }
    const key = `${ticket.called_count}_${ticket.called_at}`;
    if (lastAlertRef.current === key) return;
    lastAlertRef.current = key;
    setCallOpen(true);
  }, [ticket]);

  useEffect(() => {
    if (!callOpen) return undefined;
    const ring = () => {
      playChime(1);
      vibrate();
      speak(`Nomor antrian ${spokenNumber(ticket?.queue_number)}, silakan menuju photobooth.`);
    };
    ring();
    const id = setInterval(ring, 4000);
    return () => clearInterval(id);
  }, [callOpen, ticket?.queue_number]);

  // Jaga layar tetap menyala selama menunggu
  const liveTicket = !!ticket && !FINISHED.includes(ticket.status);
  const finished = !!ticket && FINISHED.includes(ticket.status);

  // Hitung mundur 30 detik saat selesai untuk menutup otomatis
  useEffect(() => {
    if (!finished || isReleasedRef.current) {
      setCountdown(30);
      return undefined;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          releaseTicketRef.current?.(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (!liveTicket || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {}
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

  const takeTicket = async (e) => {
    e?.preventDefault?.();
    unlockAudio();
    if (submitting || !token) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('take_queue_ticket', {
        p_token: token,
        p_name: '',
        p_phone: '',
      });

      if (error || !data) {
        console.error('Gagal mengambil tiket:', error);
        toast.error(
          error?.message?.includes('Terlalu banyak')
            ? 'Sedang ramai, coba lagi sebentar.'
            : error?.message || 'Gagal mengambil nomor. Coba lagi.'
        );
        return;
      }

      isReleasedRef.current = false;
      const newId = data.id;
      setTicketId(newId);
      writeTicketId(token, newId);

      if (data.state) {
        setState(data.state);
        writeCachedState(token, data.state);
      } else {
        setState((prev) => {
          const next = { ...(prev || {}), ticket: data };
          writeCachedState(token, next);
          return next;
        });
        refresh();
      }
      toast.success(data.existing ? `Anda sudah memegang antrian ${data.queue_number}.` : 'Nomor antrian berhasil diambil');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmHeading = async () => {
    setCallOpen(false);
    if (!ticket) return;
    setState((prev) => {
      const next = { ...prev, ticket: { ...prev.ticket, status: 'heading' } };
      writeCachedState(token, next);
      return next;
    });
    const { error } = await supabase.rpc('queue_confirm_heading', { p_ticket_id: ticket.id });
    if (error) toast.error('Konfirmasi belum terkirim. Temui kru di booth.');
    else toast.success('Kru sudah tahu Anda menuju booth.');
  };

  const releaseTicket = async (cancelOnServer) => {
    isReleasedRef.current = true;
    const currentTicket = state?.ticket;
    const currentTicketId = currentTicket?.id || ticketId;

    if (cancelOnServer && currentTicketId && currentTicket?.status === 'waiting') {
      await supabase.rpc('queue_leave', { p_ticket_id: currentTicketId }).catch(() => {});
    }

    writeTicketId(token, null);
    setTicketId(null);
    setState((prev) => (prev ? { ...prev, ticket: null } : null));
    writeCachedState(token, null);
    setLeaveOpen(false);
    setCallOpen(false);
    lastAlertRef.current = null;
    setCountdown(30);

    const { data } = await supabase.rpc('get_queue_state', { p_token: token, p_ticket_id: null });
    if (data) {
      setState(data);
      writeCachedState(token, data);
    }

    if (cancelOnServer) {
      toast.success('Nomor antrian berhasil dibatalkan');
    }
  };
  releaseTicketRef.current = releaseTicket;

  const testSound = async () => {
    try {
      await unlockAudio();
      await playChime(1);
      vibrate([100, 50, 100]);
      toast.success('Notifikasi audio aktif! (Pastikan HP tidak dalam mode hening)');
    } catch (err) {
      console.warn('testSound error:', err);
      toast.error('Gagal memutar audio');
    }
  };

  if (invalid) {
    return (
      <div data-theme="dark" className="min-h-[100dvh] flex items-center justify-center bg-[#0b0b0c] text-white p-6 text-center">
        <div className="max-w-xs">
          <img src="/icons.svg" alt="SnapHub" className="h-7 w-auto mx-auto mb-5" />
          <h1 className="text-xl font-bold">Link antrian tidak valid</h1>
          <p className="text-sm text-zinc-400 mt-2">Pindai QR code terbaru yang tampil di layar booth SnapHub.</p>
        </div>
      </div>
    );
  }

  // Tampilan loading awal sebelum data pertama diterima
  if (!state) {
    return (
      <div data-theme="dark" className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0b0b0c] text-white gap-3.5 p-6 text-center">
        <div className="w-8 h-8 border-[3px] border-[#D90429] border-t-transparent rounded-full animate-spin" role="status" aria-label="Menghubungkan ke antrian" />
        <p className="text-sm text-zinc-400 font-medium">Menghubungkan ke antrian…</p>
      </div>
    );
  }

  const active = board.find((q) => ACTIVE_STATUSES.includes(q.status));
  const aheadForNew = waiting.length + (active ? 1 : 0);
  const aheadForMe = ahead + (active ? 1 : 0);

  const cardCls = 'rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b1b1f] to-[#121214] p-[clamp(0.9rem,2.4vh,1.25rem)] shadow-[0_10px_40px_rgba(0,0,0,0.5)]';
  const hideOnShort = '[@media(max-height:800px)_and_(max-width:1023px)]:hidden';

  return (
    <div data-theme="dark" className="relative min-h-[100dvh] h-[100dvh] overflow-y-auto overscroll-contain bg-[#0b0b0c] text-white flex flex-col">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1c1c1f', color: '#fff', border: '1px solid #2a2a2e' } }} />

      {/* Cahaya latar */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] lg:left-1/3 lg:w-[44rem] lg:h-[44rem] rounded-full bg-[#D90429]/25 blur-[110px]" />

      <header className={`relative shrink-0 px-5 lg:px-12 pt-[max(0.9rem,env(safe-area-inset-top))] lg:pt-8 flex items-center justify-between ${ticket ? 'pb-1 sm:pb-3' : ''}`}>
        <img src="/icons.svg" alt="SnapHub" className="h-6 lg:h-8 w-auto" />
        <button onClick={testSound} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10" aria-label="Tes suara dan getar">
          <FiVolume2 size={13} /> Tes suara
        </button>
      </header>

      <div className={`relative flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col justify-center gap-5 py-4 pb-[max(3rem,env(safe-area-inset-bottom))] lg:py-0 lg:flex-row lg:items-center lg:justify-center lg:gap-20 lg:px-12 ${ticket ? 'mt-4 sm:mt-8 pt-3 sm:pt-6' : ''}`}>
        {/* ── Hero: nama acara + status ── */}
        <section className={`relative flex-none lg:flex-1 min-h-0 flex flex-col items-center justify-center text-center px-5 lg:px-0 lg:items-start lg:text-left lg:justify-center gap-[clamp(0.4rem,1.5vh,1rem)] lg:gap-6 ${ticket ? 'mt-2 sm:mt-4' : ''}`} aria-live="polite">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D90429]/40 bg-[#D90429]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" /></span>
            Antrian photobooth
          </span>

          <h1 className="max-w-sm lg:max-w-xl text-[clamp(1.35rem,4.4vh,2rem)] lg:text-[clamp(2.4rem,4.2vw,3.75rem)] font-extrabold leading-[1.1] tracking-tight line-clamp-3 break-words bg-gradient-to-b from-white to-rose-200 bg-clip-text text-transparent">
            {state?.event?.name || 'SnapHub Photobooth'}
          </h1>
          <div className="h-1 w-12 rounded-full bg-[#D90429]" aria-hidden="true" />

          {!ticket ? (
            <dl className="grid grid-cols-3 gap-2.5 lg:gap-4 w-full max-w-sm lg:max-w-md">
              <Stat label="Giliran" value={active ? active.queue_number : '–'} />
              <Stat label="Menunggu" value={`${waiting.length}`} sub="orang" />
              <Stat label="Estimasi" value={aheadForNew === 0 ? 'Langsung' : formatEstimate(estimateMinutes(aheadForNew)).replace('± ', '')} highlight />
            </dl>
          ) : (
            <div
              className={`w-full max-w-sm lg:max-w-md rounded-3xl border bg-white/[0.04] backdrop-blur px-5 py-[clamp(0.8rem,2.2vh,1.4rem)] lg:py-8 lg:text-center mt-2 sm:mt-4 transition-all duration-300 ${myTurn ? 'border-emerald-400/70 shadow-[0_0_40px_rgba(52,211,153,0.2)]' : 'border-white/10'}`}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Nomor antrian Anda</p>
              <p className="font-extrabold font-mono tracking-tight leading-none my-[clamp(0.15rem,0.8vh,0.5rem)] num" style={{ fontSize: 'clamp(3.4rem, 13vh, 6rem)' }}>{ticket.queue_number}</p>
              {ticket.customer_name && ticket.customer_name !== 'Tamu' ? (
                <p className="text-sm font-medium text-zinc-200 truncate">{ticket.customer_name}</p>
              ) : null}
              <div className="mt-[clamp(0.5rem,1.4vh,0.9rem)]">
                {myTurn ? (
                  <p className="inline-flex items-center gap-2 rounded-full bg-emerald-400 text-black font-semibold text-sm px-4 py-1.5">
                    {ticket.status === 'serving'
                      ? <><FiCamera size={15} /> Sedang difoto</>
                      : ticket.status === 'heading'
                        ? <><FiNavigation size={15} /> Menuju booth</>
                        : <><FiBell size={15} /> Giliran Anda sekarang</>}
                  </p>
                ) : finished ? (
                  <p className="text-sm font-medium text-zinc-300">
                    {ticket.status === 'completed' ? 'Sesi foto selesai. Terima kasih!' : ticket.status === 'skipped' ? 'Nomor Anda dilewati. Temui kru bila masih ingin berfoto.' : 'Nomor ini sudah dibatalkan.'}
                  </p>
                ) : position > 0 && position <= 2 ? (
                  <p className="inline-flex rounded-full border border-amber-300/50 bg-amber-300/10 text-amber-200 font-medium text-sm px-4 py-1.5">Segera merapat ke booth</p>
                ) : (
                  <p className="text-sm text-zinc-400">Menunggu giliran</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Kartu aksi (Ambil nomor / Info tiket) ── */}
        <div className={`relative shrink-0 px-4 lg:px-0 lg:w-[27rem] ${ticket ? 'mt-1 sm:mt-3 lg:mt-0' : ''}`}>
          {!ticket ? (
            <section className={cardCls}>
              <div className="text-center sm:text-left">
                <h2 className="text-[clamp(1.15rem,3vh,1.45rem)] font-bold text-white">Ambil nomor antrian</h2>
                <p className={`text-xs text-zinc-400 mt-1 leading-relaxed ${hideOnShort}`}>
                  Tidak perlu berdiri menunggu. HP Anda berbunyi saat giliran tiba.
                </p>
              </div>

              <div className="mt-5 sm:mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={takeTicket}
                  disabled={submitting}
                  className="ui-btn ui-btn-primary ui-btn-lg w-full py-4 text-base font-bold shadow-lg shadow-[#D90429]/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menerbitkan tiket...</span>
                    </>
                  ) : (
                    <>
                      <span>Ambil Nomor Sekarang</span>
                      <FiArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </section>
          ) : (
            <section className={cardCls}>
              <dl className={`grid gap-2.5 ${ticket.status === 'waiting' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                <Stat label="Giliran" value={active ? active.queue_number : '–'} sub={active ? statusMeta(active.status).label : undefined} />
                {ticket.status === 'waiting' && (
                  <>
                    <Stat label="Di depan Anda" value={`${ahead}`} sub="orang" />
                    <Stat label="Estimasi" value={aheadForMe === 0 ? 'Langsung' : formatEstimate(estimateMinutes(aheadForMe)).replace('± ', '')} highlight />
                  </>
                )}
              </dl>

              <p className={`mt-[clamp(0.6rem,1.6vh,1rem)] text-xs text-center text-zinc-400 ${hideOnShort}`}>
                {myTurn
                  ? 'Tunjukkan nomor ini ke kru di booth.'
                  : finished
                    ? ''
                    : 'Estimasi hanya perkiraan. Biarkan halaman ini terbuka, HP akan berbunyi saat giliran Anda.'}
              </p>

              <div className="mt-[clamp(0.5rem,1.4vh,0.9rem)] flex justify-center">
                {finished ? (
                  <div className="w-full flex flex-col items-center gap-2">
                    <button onClick={() => releaseTicket(false)} className="ui-btn ui-btn-primary ui-btn-lg w-full shadow-lg shadow-[#D90429]/30">
                      Selesai {countdown > 0 ? `(${countdown}s)` : ''}
                    </button>
                    <p className="text-[11px] text-zinc-400 text-center">
                      Halaman ditutup otomatis dalam <span className="font-mono font-semibold text-white num">{countdown}</span> detik
                    </p>
                  </div>
                ) : ticket.status === 'waiting' ? (
                  <button onClick={() => setLeaveOpen(true)} className="ui-btn ui-btn-sm ui-btn-ghost text-zinc-400">
                    <FiRotateCcw size={14} /> Batalkan nomor
                  </button>
                ) : null}
              </div>
            </section>
          )}
          <p className="mt-3 text-center text-[11px] text-zinc-500 font-medium tracking-wide">Powered by SnapHub.id</p>
        </div>
      </div>

      {callOpen && ticket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85" role="alertdialog" aria-modal="true" aria-label="Giliran Anda">
          <div className="w-full max-w-sm rounded-2xl bg-[#141416] border-2 border-emerald-400 p-7 text-center shadow-2xl">
            <FiBell size={30} className="mx-auto text-emerald-400" aria-hidden="true" />
            <h2 className="text-2xl font-bold mt-3">Giliran Anda tiba</h2>
            <p className="text-6xl font-bold font-mono my-4 num">{ticket.queue_number}</p>
            <p className="text-sm text-zinc-300 mb-6">Silakan menuju booth dan tunjukkan nomor ini ke kru SnapHub.</p>
            <button autoFocus onClick={confirmHeading} className="ui-btn ui-btn-ok ui-btn-lg w-full">
              <FiCheck size={18} /> Saya menuju booth
            </button>
          </div>
        </div>
      )}

      {leaveOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-24" role="alertdialog" aria-modal="true" aria-label="Batalkan nomor">
          <div className="absolute inset-0 bg-black/75" onClick={() => setLeaveOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b1b1f] to-[#121214] p-6 text-center shadow-2xl">
            <h2 className="text-lg font-bold">Batalkan nomor ini?</h2>
            <p className="text-sm text-zinc-400 mt-2">
              Nomor <span className="font-mono font-semibold text-white">{ticket?.queue_number}</span> akan dilepas dan Anda keluar dari antrian.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" autoFocus onClick={() => setLeaveOpen(false)} className="ui-btn ui-btn-lg text-white border-white/20 hover:bg-white/10">Tidak</button>
              <button type="button" onClick={() => releaseTicket(true)} className="ui-btn ui-btn-lg ui-btn-solid-danger">Ya, batalkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueGuest;
