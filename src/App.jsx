import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Jika diakses via link.snaphub.my.id, root ('/') langsung membuka halaman Linktree */}
        <Route path="/" element={isLinkSubdomain ? <Linktree /> : <Home />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/links" element={<Linktree />} />
        <Route path="/linktree" element={<Navigate to="/links" replace />} />
        <Route path="/bio" element={<Navigate to="/links" replace />} />
        <Route path="/sesi" element={<SesiFoto />} />
        <Route path="/sesi-foto" element={<Navigate to="/sesi" replace />} />
        <Route path="/live/:slug" element={<LiveSesi />} />
        <Route path="/crew/:slug" element={<CrewSesi />} />
        {/* Fallback subdomain: jika ada path tak dikenal di subdomain link, tetap ke Linktree */}
        {isLinkSubdomain && <Route path="*" element={<Linktree />} />}
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
