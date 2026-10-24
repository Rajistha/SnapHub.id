import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { FiArrowLeft, FiSun, FiMoon, FiExternalLink, FiLink } from 'react-icons/fi';
import AdminLinks from '../components/AdminLinks';

const getAdminUrl = () => {
  if (typeof window === 'undefined') return '/admin';
  const host = window.location.hostname;
  if (host.includes('snaphub.my.id')) {
    return 'https://snaphub.my.id/admin';
  }
  return '/admin';
};

const getBioUrl = () => {
  if (typeof window === 'undefined') return '/links';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return '/links';
  }
  return 'https://link.snaphub.my.id';
};

const ManageLinks = () => {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('adminTheme') || 'dark');

  useEffect(() => {
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  useEffect(() => {
    const robotsMeta = document.querySelector('meta[name="robots"]');
    const previousContent = robotsMeta?.getAttribute('content');
    robotsMeta?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previousContent) robotsMeta?.setAttribute('content', previousContent);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Login berhasil!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-10 h-10 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-5 relative overflow-hidden">
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D90429]/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="glass-dark border border-white/10 p-8 rounded-3xl w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <img src="/icons.svg" alt="SnapHub Logo" className="h-10 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold font-heading">Manage Links</h1>
            <p className="text-gray-400 text-sm mt-1">Login untuk mengelola Bio Links & Linktree.</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D90429] transition-colors"
                placeholder="admin@snaphub.id"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D90429] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full mt-4 flex justify-center py-3">
              Login
            </button>
          </form>
          <div className="mt-6 text-center">
            <a href={getAdminUrl()} className="text-gray-500 hover:text-white text-sm transition-colors flex items-center justify-center gap-2">
              <FiArrowLeft /> Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] transition-colors duration-300" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[var(--admin-surface)]/90 backdrop-blur-md border-b border-[var(--admin-border)] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href={getAdminUrl()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--admin-border)] text-xs font-medium text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
            title="Kembali ke Dashboard Utama"
          >
            <FiArrowLeft size={14} />
            <span className="hidden sm:inline">Admin</span>
          </a>
          <div className="h-4 w-px bg-[var(--admin-border)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D90429]/15 text-[#D90429] flex items-center justify-center text-sm font-bold">
              <FiLink />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--admin-text-main)] leading-none">Links</h2>
              <span className="text-[10px] text-[var(--admin-text-muted)] font-mono">app.snaphub.my.id/links</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={getBioUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--admin-accent-bg)] text-[var(--admin-accent)] border border-[var(--admin-accent)]/20 hover:border-[var(--admin-accent)]/40 text-xs font-semibold transition-colors"
          >
            <FiExternalLink size={13} />
            <span className="hidden sm:inline">Buka Bio</span>
          </a>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
            title={theme === 'dark' ? 'Dark' : 'Light'}
          >
            {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <AdminLinks />
      </main>
    </div>
  );
};

export default ManageLinks;
