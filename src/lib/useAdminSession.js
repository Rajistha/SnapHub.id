import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Sesi login admin + preferensi tema bersama untuk semua halaman internal.
export default function useAdminSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('adminTheme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('adminTheme', theme);
    } catch {
      /* penyimpanan diblokir: abaikan */
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Halaman internal tidak boleh diindeks mesin pencari.
  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    const previous = robots?.getAttribute('content');
    robots?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previous) robots?.setAttribute('content', previous);
    };
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { session, loading, theme, toggleTheme };
}
