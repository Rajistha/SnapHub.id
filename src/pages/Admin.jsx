import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { 
  FiLogOut, FiArrowLeft, FiPieChart, FiCalendar, FiDollarSign, 
  FiMenu, FiX, FiChevronDown, FiSun, FiMoon, FiImage, FiStar, 
  FiBriefcase, FiCamera, FiTag, FiLink, FiCreditCard, FiBarChart2, FiTarget, FiUsers, FiScissors 
} from 'react-icons/fi';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Admin Sub-components
import AdminSchedule from '../components/AdminSchedule';
import AdminDashboard from '../components/AdminDashboard';
import AdminFinance from '../components/AdminFinance';
import AdminGallery from '../components/AdminGallery';
import AdminReviews from '../components/AdminReviews';
import AdminLogos from '../components/AdminLogos';
import AdminPricelist from '../components/AdminPricelist';
import AdminLinks from '../components/AdminLinks';

const Admin = () => {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    content: true,
    finance: true,
    app: true,
  });
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
  // Di spanel.snaphub.my.id path bersih (/schedule); di localhost tetap /admin/schedule.
  const onPanelHost = typeof window !== 'undefined' && window.location.hostname.startsWith('spanel.');
  const base = onPanelHost ? '' : '/admin';
  const rawParts = location.pathname.split('/').filter(Boolean);
  const pathParts = onPanelHost ? ['', ...rawParts] : rawParts; // indeks 1 = nama tab pada kedua mode
  let activeTab = 'dashboard';

  if (pathParts[1] === 'schedule') activeTab = 'schedule';
  else if (pathParts[1] === 'gallery') activeTab = 'gallery';
  else if (pathParts[1] === 'reviews') activeTab = 'reviews';
  else if (pathParts[1] === 'logos') activeTab = 'logos';
  else if (pathParts[1] === 'pricelist') activeTab = 'pricelist';
  else if (pathParts[1] === 'links') activeTab = 'links';
  else if (pathParts[1] === 'finance') {
    if (pathParts[2] === 'operational') activeTab = 'finance_operational';
    else if (pathParts[2] === 'recap') activeTab = 'finance_recap';
    else if (pathParts[2] === 'target') activeTab = 'finance_target';
    else activeTab = 'finance_events';
  } else if (pathParts[1]) {
    activeTab = pathParts[1];
  }

  const setActiveTab = (tabId) => {
    if (tabId === 'dashboard') navigate(`${base}/dashboard`);
    else if (tabId === 'schedule') navigate(`${base}/schedule`);
    else if (tabId === 'gallery') navigate(`${base}/gallery`);
    else if (tabId === 'reviews') navigate(`${base}/reviews`);
    else if (tabId === 'logos') navigate(`${base}/logos`);
    else if (tabId === 'pricelist') navigate(`${base}/pricelist`);
    else if (tabId === 'links') navigate(`${base}/links`);
    else if (tabId === 'finance_events') navigate(`${base}/finance/events`);
    else if (tabId === 'finance_operational') navigate(`${base}/finance/operational`);
    else if (tabId === 'finance_recap') navigate(`${base}/finance/recap`);
    else if (tabId === 'finance_target') navigate(`${base}/finance/target`);
    else navigate(`${base}/${tabId}`);
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
            <a
              href={isLocalhost ? '/' : 'https://snaphub.my.id'}
              className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center justify-center gap-2"
            >
              <FiArrowLeft /> Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  );

  // Admin Dashboard Layout - Dikelompokkan per Section Collapsible
  // Aturan: Semua penamaan judul section dan item tepat 1 kata dalam bahasa Inggris
  const NAV_SECTIONS = [
    {
      id: 'content',
      title: 'Content',
      items: [
        { id: 'gallery', label: 'Gallery', icon: <FiImage size={18} /> },
        { id: 'pricelist', label: 'Pricelist', icon: <FiTag size={18} /> },
        { id: 'logos', label: 'Logos', icon: <FiBriefcase size={18} /> },
        { id: 'reviews', label: 'Reviews', icon: <FiStar size={18} /> },
      ]
    },
    {
      id: 'finance',
      title: 'Finance',
      items: [
        { id: 'schedule', label: 'Schedule', icon: <FiCalendar size={18} /> },
        { id: 'finance_events', label: 'Events', icon: <FiDollarSign size={18} /> },
        { id: 'finance_operational', label: 'Operations', icon: <FiCreditCard size={18} /> },
        { id: 'finance_recap', label: 'Recap', icon: <FiBarChart2 size={18} /> },
        { id: 'finance_target', label: 'Target', icon: <FiTarget size={18} /> },
      ]
    },
    {
      id: 'app',
      title: 'Apps',
      items: [
        { 
          id: 'queue', 
          label: 'Queue', 
          icon: <FiUsers size={18} />, 
          isLink: true, 
          to: isLocalhost ? '/queue' : 'https://app.snaphub.my.id/queue',
          isExternal: !isLocalhost 
        },
        { 
          id: 'links', 
          label: 'Links', 
          icon: <FiLink size={18} />, 
          isLink: true, 
          to: isLocalhost ? '/admin/links' : 'https://app.snaphub.my.id/links',
          isExternal: !isLocalhost 
        },
        { 
          id: 'short', 
          label: 'Shortlink', 
          icon: <FiScissors size={18} />, 
          isLink: true, 
          to: isLocalhost ? '/short' : 'https://app.snaphub.my.id/short',
          isExternal: !isLocalhost 
        },
        { 
          id: 'sesi', 
          label: 'Sessions', 
          icon: <FiCamera size={18} />, 
          isLink: true, 
          to: isLocalhost ? '/sesi' : 'https://app.snaphub.my.id/sesi',
          isExternal: !isLocalhost 
        },
      ]
    }
  ];

  const handleAppNav = async (e, targetUrl) => {
    if (isLocalhost) return;
    e.preventDefault();
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token && currentSession?.refresh_token) {
        window.location.href = `${targetUrl}#access_token=${encodeURIComponent(currentSession.access_token)}&refresh_token=${encodeURIComponent(currentSession.refresh_token)}&token_type=bearer`;
        return;
      }
    } catch (err) {
      console.warn('SSO navigation handshake error:', err);
    }
    window.location.href = targetUrl;
  };

  const getActiveTabLabel = () => {
    if (activeTab === 'dashboard') return 'Dashboard';
    for (const section of NAV_SECTIONS) {
      const found = section.items.find(item => item.id === activeTab);
      if (found) return found.label;
    }
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] flex overflow-hidden transition-colors duration-300" data-theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      {/* Logout Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsLogoutModalOpen(false)}></div>
          <div className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
            <h3 className="text-xl font-bold text-[var(--admin-accent)] mb-2">Confirm Logout</h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-6">
              Are you sure you want to log out from the Admin session?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors font-medium text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsLogoutModalOpen(false);
                  handleLogout();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm border border-red-500 cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-64 bg-[var(--admin-sidebar-bg)] border-l border-[var(--admin-border)] transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 lg:sticky lg:top-0 h-[100dvh] max-h-[100dvh] transition-all duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none overscroll-contain`}>
        <div className="px-5 py-4 shrink-0 border-b border-[var(--admin-border-subtle)] flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setIsSidebarOpen(false);
            }}
            className="inline-block cursor-pointer"
            title="SnapHub Admin Dashboard"
          >
            <img src="/icons.svg" alt="SnapHub Logo" className="h-7 w-auto" />
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] cursor-pointer p-1">
            <FiX size={22} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 overscroll-contain">
          {/* Dashboard Standalone (tanpa section) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left text-sm cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)] font-medium border border-[var(--admin-accent)]/20'
                : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-hover-text)] hover:bg-[var(--admin-hover-bg)] border border-transparent'
            }`}
          >
            <FiPieChart size={18} />
            <span>Dashboard</span>
          </button>

          {/* Section Accordions */}
          {NAV_SECTIONS.map((section) => {
            const isOpen = openSections[section.id] !== false;
            const hasActiveItem = section.items.some(item => item.id === activeTab);

            return (
              <div key={section.id} className="space-y-1">
                {/* Section Header (Collapsible Accordion) */}
                <button
                  type="button"
                  onClick={() => setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer select-none rounded-lg group ${
                    hasActiveItem ? 'text-[var(--admin-accent)]' : 'text-[var(--admin-text-subtle)] hover:text-[var(--admin-text-main)]'
                  }`}
                >
                  <span>{section.title}</span>
                  <FiChevronDown
                    size={13}
                    className={`transition-transform duration-200 text-[var(--admin-text-subtle)] group-hover:text-[var(--admin-text-main)] ${
                      isOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {/* Section Items (Flat) */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[500px] opacity-100 space-y-1 mt-1' : 'max-h-0 opacity-0'
                  }`}
                >
                  {section.items.map((tab) => {
                    if (tab.isExternal) {
                      return (
                        <a
                          key={tab.id}
                          href={tab.to}
                          onClick={(e) => handleAppNav(e, tab.to)}
                          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all text-left text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-hover-text)] hover:bg-[var(--admin-hover-bg)] border border-transparent cursor-pointer"
                        >
                          {tab.icon}
                          <span>{tab.label}</span>
                        </a>
                      );
                    }

                    if (tab.isLink) {
                      return (
                        <Link
                          key={tab.id}
                          to={tab.to}
                          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all text-left text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-hover-text)] hover:bg-[var(--admin-hover-bg)] border border-transparent cursor-pointer"
                        >
                          {tab.icon}
                          <span>{tab.label}</span>
                        </Link>
                      );
                    }

                    const isActive = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all text-left text-sm cursor-pointer ${
                          isActive
                            ? 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)] font-medium border border-[var(--admin-accent)]/20'
                            : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-hover-text)] hover:bg-[var(--admin-hover-bg)] border border-transparent'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-3.5 shrink-0 border-t border-[var(--admin-border-subtle)] space-y-1.5 pb-[max(1rem,env(safe-area-inset-bottom,16px))]">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl transition-colors hover:bg-[var(--admin-hover-bg)] cursor-pointer">
            {/* Toggle Switch */}
            <div className={`relative w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${theme === 'dark' ? 'bg-[#3A2427]' : 'bg-[#E5E7EB]'}`}>
              <div className={`w-4 h-4 rounded-full transition-transform duration-300 ${theme === 'dark' ? 'bg-[#D28A94] translate-x-0' : 'bg-white translate-x-5 shadow-sm'}`} />
            </div>
            {/* Icon & Text */}
            <span className="flex items-center gap-2 text-xs font-semibold">
              {theme === 'dark' ? <FiMoon className="text-[#D28A94]" size={14} /> : <FiSun className="text-gray-500" size={14} />}
              <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </span>
          </button>
          <a
            href={isLocalHost ? '/' : 'https://snaphub.my.id'}
            target={isLocalHost ? '_self' : '_blank'}
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[var(--admin-hover-bg)] hover:border-[var(--admin-border)] border border-transparent text-[var(--admin-text-main)] px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold group cursor-pointer"
          >
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" /> Website
          </a>
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-[var(--admin-hover-bg)] hover:bg-red-500 hover:border-red-500 border border-transparent hover:text-white text-[var(--admin-text-main)] px-3.5 py-2.5 rounded-xl transition-colors text-xs font-semibold cursor-pointer"
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[100dvh] lg:h-screen overflow-hidden relative">

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
            {activeTab === 'pricelist' && <AdminPricelist />}
            {activeTab === 'links' && <AdminLinks />}
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
