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
        {/* Jika diakses via subdomain, root ('/') langsung membuka halaman terkait */}
        <Route
          path="/"
          element={
            isLinkSubdomain ? <Linktree /> :
            isAppSubdomain ? <SesiFoto /> :
            <Home />
          }
        />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/links" element={<Linktree />} />
        <Route path="/linktree" element={<Navigate to="/links" replace />} />
        <Route path="/bio" element={<Navigate to="/links" replace />} />
        <Route path="/sesi" element={<SesiFoto />} />
        <Route path="/sesi-foto" element={<Navigate to="/sesi" replace />} />
        <Route path="/live/:slug" element={<LiveSesi />} />
        <Route path="/crew/:slug" element={<CrewSesi />} />
        {/* Fallback subdomain: jika ada path tak dikenal di subdomain link atau app */}
        {isLinkSubdomain && <Route path="*" element={<Linktree />} />}
        {isAppSubdomain && <Route path="*" element={<SesiFoto />} />}
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
