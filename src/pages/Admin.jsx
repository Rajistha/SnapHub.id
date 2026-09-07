import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { FiLogOut, FiArrowLeft, FiPieChart, FiCalendar, FiDollarSign, FiMenu, FiX, FiChevronDown, FiSun, FiMoon, FiImage, FiStar, FiBriefcase } from 'react-icons/fi';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Admin Sub-components
import AdminSchedule from '../components/AdminSchedule';
import AdminDashboard from '../components/AdminDashboard';
import AdminFinance from '../components/AdminFinance';
import AdminGallery from '../components/AdminGallery';
import AdminReviews from '../components/AdminReviews';
import AdminLogos from '../components/AdminLogos';

const Admin = () => {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
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

  // Derive activeTab from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  let activeTab = 'dashboard';

  if (pathParts[1] === 'schedule') activeTab = 'schedule';
  else if (pathParts[1] === 'gallery') activeTab = 'gallery';
  else if (pathParts[1] === 'reviews') activeTab = 'reviews';
  else if (pathParts[1] === 'logos') activeTab = 'logos';
  else if (pathParts[1] === 'finance') {
    if (pathParts[2] === 'recap') activeTab = 'finance_recap';
    else if (pathParts[2] === 'target') activeTab = 'finance_target';
    else activeTab = 'finance_events';
  } else if (pathParts[1]) {
    activeTab = pathParts[1];
  }

  const setActiveTab = (tabId) => {
    if (tabId === 'dashboard') navigate('/admin/dashboard');
    else if (tabId === 'schedule') navigate('/admin/schedule');
    else if (tabId === 'gallery') navigate('/admin/gallery');
    else if (tabId === 'reviews') navigate('/admin/reviews');
    else if (tabId === 'logos') navigate('/admin/logos');
    else if (tabId === 'finance_events') navigate('/admin/finance/events');
    else if (tabId === 'finance_recap') navigate('/admin/finance/recap');
    else if (tabId === 'finance_target') navigate('/admin/finance/target');
    else navigate(`/admin/${tabId}`);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Login berhasil!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout berhasil');
  };

  // --- RENDERING VIEWS ---

  if (loading) {
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

        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D90429]/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="glass-dark border border-white/10 p-8 rounded-3xl w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <img src="/icons.svg" alt="SnapHub Logo" className="h-10 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold font-heading">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Login untuk mengakses panel admin.</p>
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4 flex justify-center py-3"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center justify-center gap-2">
              <FiArrowLeft /> Kembali ke Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard Layout
  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: <FiPieChart size={20} /> },
    { id: 'gallery', label: 'Galeri', icon: <FiImage size={20} /> },
    { id: 'schedule', label: 'Jadwal', icon: <FiCalendar size={20} /> },
    { id: 'reviews', label: 'Reviews', icon: <FiStar size={20} /> },
    { id: 'logos', label: 'Client Logos', icon: <FiBriefcase size={20} /> },
    {
      id: 'finance',
      label: 'Event & Keuangan',
      icon: <FiDollarSign size={20} />,
      subTabs: [
        { id: 'finance_events', label: 'Keuangan Event' },
        { id: 'finance_operational', label: 'Pengeluaran Operasional' },
        { id: 'finance_recap', label: 'Rekapitulasi Event' },
        { id: 'finance_target', label: 'Target & Pencapaian' },
      ]
    },
  ];

  const getActiveTabLabel = () => {
    for (const tab of TABS) {
      if (tab.id === activeTab) return tab.label;
      if (tab.subTabs) {
        const sub = tab.subTabs.find(s => s.id === activeTab);
        if (sub) return sub.label;
      }
    }
    return 'Admin Panel';
  };

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] flex overflow-hidden transition-colors duration-300" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      {/* Logout Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLogoutModalOpen(false)}></div>
          <div className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
            <h3 className="text-xl font-bold text-[var(--admin-accent)] mb-2">Konfirmasi Logout</h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-6">
              Apakah Anda yakin ingin keluar dari sesi Admin?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors font-medium text-sm cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  setIsLogoutModalOpen(false);
                  handleLogout();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm border border-red-500 cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-64 bg-[var(--admin-sidebar-bg)] border-l border-[var(--admin-border)] transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 transition-all duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none`}>
        <div className="p-6 border-b border-[var(--admin-border-subtle)] flex justify-between items-center">
          <Link to="/" className="inline-block">
            <img src="/icons.svg" alt="SnapHub Logo" className="h-8" />
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]">
            <FiX size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {TABS.map(tab => (
            <div key={tab.id}>
              <button
                onClick={() => {
                  if (tab.subTabs) {
                    setIsFinanceOpen(!isFinanceOpen);
                    if (!tab.subTabs.find(sub => sub.id === activeTab)) {
                      setActiveTab(tab.subTabs[0].id);
                    }
                  } else {
                    setActiveTab(tab.id);
                    setIsSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left ${activeTab === tab.id || (tab.subTabs && tab.subTabs.some(sub => sub.id === activeTab)) ? 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)] font-medium border border-[var(--admin-accent)]/20' : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-hover-text)] hover:bg-[var(--admin-hover-bg)] border border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  {tab.icon}
                  {tab.label}
                </div>
                {tab.subTabs && (
                  <FiChevronDown className={`transition-transform duration-200 ${isFinanceOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {tab.subTabs && (
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isFinanceOpen ? 'max-h-64 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-4 pl-4 border-l border-[var(--admin-border-subtle)] space-y-1">
                    {tab.subTabs.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setActiveTab(sub.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${activeTab === sub.id ? 'text-[var(--admin-accent)] bg-[var(--admin-accent-bg)]' : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-hover-text)] hover:bg-[var(--admin-hover-bg)]'}`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--admin-border-subtle)] space-y-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-[var(--admin-hover-bg)] cursor-pointer">
            {/* Toggle Switch */}
            <div className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-1 ${theme === 'dark' ? 'bg-[#3A2427]' : 'bg-[#E5E7EB]'}`}>
              <div className={`w-4 h-4 rounded-full transition-transform duration-300 ${theme === 'dark' ? 'bg-[#D28A94] translate-x-0' : 'bg-white translate-x-5 shadow-sm'}`} />
            </div>
            {/* Icon & Text */}
            <span className="flex items-center gap-2 text-sm font-semibold">
              {theme === 'dark' ? <FiMoon className="text-[#D28A94]" size={16} /> : <FiSun className="text-gray-500" size={16} />}
              <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </span>
          </button>
          <Link to="/" className="w-full flex items-center justify-center gap-2 bg-[var(--admin-hover-bg)] hover:border-[var(--admin-border)] border border-transparent text-[var(--admin-text-main)] px-4 py-3 rounded-xl transition-all text-sm font-medium group">
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" /> Kembali ke Website
          </Link>
          <button onClick={() => setIsLogoutModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-[var(--admin-hover-bg)] hover:bg-red-500 hover:border-red-500 border border-transparent hover:text-white text-[var(--admin-text-main)] px-4 py-3 rounded-xl transition-colors text-sm font-medium cursor-pointer">
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Background Ambient */}
        {theme === 'dark' && (
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D90429]/5 blur-[120px] rounded-full pointer-events-none -z-10" />
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">

            <div className="mb-8 flex items-center gap-4 pt-2 lg:pt-0">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] bg-[var(--admin-surface)] p-2 rounded-lg border border-[var(--admin-border)]">
                <FiMenu size={24} />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-[var(--admin-text-main)] font-heading">
                  {getActiveTabLabel()}
                </h2>
                <p className="text-[var(--admin-text-muted)] text-sm mt-1">Manage your business operations</p>
              </div>
            </div>

            {/* Content Area */}
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'schedule' && <AdminSchedule />}
            {activeTab === 'gallery' && <AdminGallery />}
            {activeTab === 'reviews' && <AdminReviews />}
            {activeTab === 'logos' && <AdminLogos />}
            {activeTab === 'finance_events' && <AdminFinance activeSubTab="events" />}
            {activeTab === 'finance_operational' && <AdminFinance activeSubTab="operational" />}
            {activeTab === 'finance_recap' && <AdminFinance activeSubTab="recap" />}
            {activeTab === 'finance_target' && <AdminFinance activeSubTab="target" />}

          </div>
        </div>
      </main>

    </div>
  );
};

export default Admin;
