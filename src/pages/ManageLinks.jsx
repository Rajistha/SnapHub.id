import React from 'react';
import { Toaster } from 'react-hot-toast';
import { FiArrowLeft, FiSun, FiMoon, FiExternalLink } from 'react-icons/fi';
import useAdminSession from '../lib/useAdminSession';
import { getAdminUrl, getBioUrl } from '../lib/appUrls';
import AdminLinks from '../components/AdminLinks';
import AdminLogin from '../components/ui/AdminLogin';

const ManageLinks = () => {
  const { session, loading, theme, toggleTheme } = useAdminSession();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#050505]"><div className="w-8 h-8 border-[3px] border-[#D90429] border-t-transparent rounded-full animate-spin" role="status" aria-label="Memuat" /></div>;
  }
  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <AdminLogin title="Kelola Link" subtitle="Masuk untuk mengatur halaman bio dan link." />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)]" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#222', color: '#fff' } }} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10">
        <header className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <a href={getAdminUrl()} className="ui-btn ui-btn-icon" aria-label="Kembali ke Admin"><FiArrowLeft size={16} /></a>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight">Link &amp; bio</h1>
              <p className="text-sm text-[var(--admin-text-muted)]">Atur halaman link.snaphub.my.id.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={getBioUrl()} target="_blank" rel="noopener noreferrer" className="ui-btn">
              <FiExternalLink size={14} /> <span className="hidden sm:inline">Lihat halaman</span>
            </a>
            <button onClick={toggleTheme} className="ui-btn ui-btn-icon" aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}>
              {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
            </button>
          </div>
        </header>

        <AdminLinks />
      </main>
    </div>
  );
};

export default ManageLinks;
