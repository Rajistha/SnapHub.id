import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Home from './pages/Home';
import Admin from './pages/Admin';
import SesiFoto from './pages/SesiFoto';
import LiveSesi from './pages/LiveSesi';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <Router>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/sesi" element={<SesiFoto />} />
        <Route path="/sesi-foto" element={<Navigate to="/sesi" replace />} />
        <Route path="/live/:slug" element={<LiveSesi />} />
      </Routes>
      </ErrorBoundary>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
