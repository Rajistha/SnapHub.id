import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
const Home = lazy(() => import('./pages/Home'));
const Admin = lazy(() => import('./pages/Admin'));
const SesiFoto = lazy(() => import('./pages/SesiFoto'));
const LiveSesi = lazy(() => import('./pages/LiveSesi'));
const CrewSesi = lazy(() => import('./pages/CrewSesi'));
import ErrorBoundary from './components/ErrorBoundary';

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B]">
    <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <Router>
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/*" element={<Admin />} />
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
