import { useEffect, useRef } from 'react';

// Menjalankan fn tiap `interval` ms HANYA saat tab terlihat, dan langsung sekali saat tab kembali aktif.
// Tab yang tersembunyi tidak lagi menembak jaringan sama sekali (hemat baterai & kuota di HP tamu).
export default function usePolling(fn, interval, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;

    const tick = () => {
      if (!document.hidden) fnRef.current();
    };
    const start = () => {
      if (timer == null) timer = setInterval(tick, interval);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fnRef.current();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [interval, enabled]);
}
