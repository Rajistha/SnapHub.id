import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Halaman redirect sengaja ringan: memakai fetch langsung (tanpa supabase-js) agar pengalihan cepat.
const ShortRedirect = () => {
  const { slug } = useParams();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_short_link`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((url) => {
        if (!active) return;
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) window.location.replace(url);
        else setNotFound(true);
      })
      .catch(() => active && setNotFound(true));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    const previous = robots?.getAttribute('content');
    robots?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previous) robots?.setAttribute('content', previous);
    };
  }, []);

  return (
    <div data-theme="dark" className="min-h-screen flex items-center justify-center bg-[#0b0b0c] text-white p-6 text-center">
      {notFound ? (
        <div className="max-w-xs">
          <img src="/icons.svg" alt="" className="h-9 mx-auto mb-5" />
          <h1 className="text-xl font-semibold">Link tidak ditemukan</h1>
          <p className="text-sm text-zinc-400 mt-2">Link ini salah ketik, sudah dinonaktifkan, atau sudah dihapus.</p>
          <a href="/" className="ui-btn mt-6 border-white/15 hover:bg-white/10">Ke beranda SnapHub</a>
        </div>
      ) : (
        <div className="w-8 h-8 border-[3px] border-[#D90429] border-t-transparent rounded-full animate-spin" role="status" aria-label="Mengalihkan" />
      )}
    </div>
  );
};

export default ShortRedirect;
