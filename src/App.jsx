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
const ManageShortLinks = lazy(() => import('./pages/ManageShortLinks'));
const ShortRedirect = lazy(() => import('./pages/ShortRedirect'));
const QueueQr = lazy(() => import('./pages/QueueQr'));
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

// <Navigate> hanya untuk rute internal; pindah ke domain lain harus lewat location.
function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <PageLoader />;
}

// Deteksi apakah sedang diakses dari subdomain dashboard admin (spanel.snaphub.my.id)
const isPanelSubdomain = typeof window !== 'undefined' && window.location.hostname.startsWith('spanel.');

const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Alamat /admin lama di domain utama dipindahkan ke spanel.snaphub.my.id tanpa awalan /admin.
const stripAdmin = (pathname) => pathname.replace(/^\/admin/, '') || '/';

function AdminRedirect() {
  const { pathname, search, hash } = useLocation();
  return <ExternalRedirect to={`https://spanel.snaphub.my.id${stripAdmin(pathname)}${search}${hash}`} />;
}

// Bookmark lama spanel.snaphub.my.id/admin/... diarahkan ke path bersih.
function PanelLegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${stripAdmin(pathname)}${search}${hash}`} replace />;
}

// Dashboard admin tidak boleh diindeks mesin pencari.
function NoIndex() {
  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    const previous = robots?.getAttribute('content');
    robots?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previous) robots?.setAttribute('content', previous);
    };
  }, []);
  return null;
}

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
      {isPanelSubdomain && <NoIndex />}
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* 0. Subdomain spanel.snaphub.my.id: dashboard admin */}
        {isPanelSubdomain && (
          <>
            <Route path="/admin/*" element={<PanelLegacyRedirect />} />
            <Route path="/" element={<Admin />} />
            <Route path="/*" element={<Admin />} />
          </>
        )}

        {/* 1. Subdomain queue.snaphub.my.id: tiket tamu & TV display booth */}
        {isQueueSubdomain && (
          <>
            <Route path="/:slug/qr" element={<QueueQr />} />
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
            <Route path="/" element={<ExternalRedirect to="https://snaphub.my.id" />} />
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
            <Route path="/short" element={<ManageShortLinks />} />
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
        {isLocalHost ? (
          <>
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/admin/links" element={<ManageLinks />} />
          </>
        ) : (
          <Route path="/admin/*" element={<AdminRedirect />} />
        )}
        <Route path="/queue/:slug/qr" element={<QueueQr />} />
        <Route path="/queue/:slug/display" element={<QueueDisplay />} />
        <Route path="/queue/:slug" element={<QueueGuest />} />
        <Route path="/queue" element={<QueueAdmin />} />
        <Route path="/short" element={<ManageShortLinks />} />
        <Route path="/links" element={<Linktree />} />
        <Route path="/linktree" element={<Navigate to="/links" replace />} />
        <Route path="/bio" element={<Navigate to="/links" replace />} />
        <Route path="/sesi" element={<SesiFoto />} />
        <Route path="/sesi-foto" element={<Navigate to="/sesi" replace />} />
        <Route path="/live/:slug" element={<LiveSesi />} />
        <Route path="/crew/:slug" element={<CrewSesi />} />
        {/* Shortlink: snaphub.my.id/<slug>. Rute statis di atas selalu diprioritaskan. */}
        <Route path="/:slug" element={<ShortRedirect />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
