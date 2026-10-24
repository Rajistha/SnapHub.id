import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
const Home = lazy(() => import('./pages/Home'));
const Admin = lazy(() => import('./pages/Admin'));
const SesiFoto = lazy(() => import('./pages/SesiFoto'));
const LiveSesi = lazy(() => import('./pages/LiveSesi'));
const CrewSesi = lazy(() => import('./pages/CrewSesi'));
const Linktree = lazy(() => import('./pages/Linktree'));
const ManageLinks = lazy(() => import('./pages/ManageLinks'));
const QueueGuest = lazy(() => import('./pages/QueueGuest'));
const QueueDisplay = lazy(() => import('./pages/QueueDisplay'));
const QueueAdmin = lazy(() => import('./pages/QueueAdmin'));
import ErrorBoundary from './components/ErrorBoundary';

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B]">
    <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
  </div>
);

// Deteksi apakah sedang diakses dari subdomain link (e.g. link.snaphub.my.id)
const isLinkSubdomain = typeof window !== 'undefined' && (
  window.location.hostname === 'link.snaphub.my.id' ||
  window.location.hostname.startsWith('link.')
);

// Deteksi apakah sedang diakses dari subdomain app (e.g. app.snaphub.my.id)
const isAppSubdomain = typeof window !== 'undefined' && (
  window.location.hostname === 'app.snaphub.my.id' ||
  window.location.hostname.startsWith('app.')
);

// Deteksi apakah sedang diakses dari subdomain live (e.g. live.snaphub.my.id)
const isLiveSubdomain = typeof window !== 'undefined' && (
  window.location.hostname === 'live.snaphub.my.id' ||
  window.location.hostname.startsWith('live.')
);

// Deteksi apakah sedang diakses dari subdomain queue (e.g. queue.snaphub.my.id)
const isQueueSubdomain = typeof window !== 'undefined' && (
  window.location.hostname === 'queue.snaphub.my.id' ||
  window.location.hostname.startsWith('queue.')
);

// Scroll ke elemen #hash saat navigasi (fix React Router tidak handle hash anchor)
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Delay kecil agar element sudah di-render (terutama lazy-loaded page)
    const id = hash.replace('#', '');
    const tryScroll = (attempt = 0) => {
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      } else if (attempt < 10) {
        setTimeout(() => tryScroll(attempt + 1), 100);
      }
    };
    tryScroll();
  }, [pathname, hash]);
  return null;
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
      <ScrollToHash />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* 1. Subdomain queue.snaphub.my.id: tiket tamu & TV display booth */}
        {isQueueSubdomain && (
          <>
            <Route path="/:slug/display" element={<QueueDisplay />} />
            <Route path="/display" element={<QueueDisplay />} />
            <Route path="/:slug" element={<QueueGuest />} />
            <Route path="/" element={<QueueGuest />} />
            <Route path="*" element={<QueueGuest />} />
          </>
        )}

        {/* 2. Subdomain live.snaphub.my.id: customer live view tanpa /live */}
        {isLiveSubdomain && (
          <>
            <Route path="/:slug" element={<LiveSesi />} />
            <Route path="/live/:slug" element={<LiveSesi />} />
            <Route path="/" element={<Navigate to="https://snaphub.my.id" replace />} />
            <Route path="*" element={<LiveSesi />} />
          </>
        )}

        {/* 3. Subdomain link.snaphub.my.id: Bio / Linktree publik untuk pengunjung */}
        {isLinkSubdomain && (
          <>
            <Route path="/" element={<Linktree />} />
            <Route path="*" element={<Linktree />} />
          </>
        )}

        {/* 4. Subdomain app.snaphub.my.id: Aplikasi internal (Kelola Link, Sesi Foto, & Antrian) */}
        {isAppSubdomain && (
          <>
            <Route path="/queue" element={<QueueAdmin />} />
            <Route path="/links" element={<ManageLinks />} />
            <Route path="/admin/links" element={<ManageLinks />} />
            <Route path="/kelola" element={<ManageLinks />} />
            <Route path="/linktree" element={<ManageLinks />} />
            <Route path="/sesi" element={<SesiFoto />} />
            <Route path="/sesi-foto" element={<Navigate to="/sesi" replace />} />
            <Route path="/live/:slug" element={<LiveSesi />} />
            <Route path="/crew/:slug" element={<CrewSesi />} />
            <Route path="/" element={<SesiFoto />} />
            <Route path="*" element={<SesiFoto />} />
          </>
        )}

        {/* 5. Domain Utama snaphub.my.id & Localhost */}
        <Route path="/" element={<Home />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/admin/links" element={<ManageLinks />} />
        <Route path="/queue/:slug/display" element={<QueueDisplay />} />
        <Route path="/queue/:slug" element={<QueueGuest />} />
        <Route path="/queue" element={<QueueAdmin />} />
        <Route path="/links" element={<Linktree />} />
        <Route path="/linktree" element={<Navigate to="/links" replace />} />
        <Route path="/bio" element={<Navigate to="/links" replace />} />
        <Route path="/sesi" element={<SesiFoto />} />
        <Route path="/sesi-foto" element={<Navigate to="/sesi" replace />} />
        <Route path="/live/:slug" element={<LiveSesi />} />
        <Route path="/crew/:slug" element={<CrewSesi />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
