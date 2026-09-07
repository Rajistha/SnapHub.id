import React, { useState, useEffect } from 'react';
import { Link } from 'react-scroll';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';

const navLinks = [
  { label: 'Home', to: 'home' },
  { label: 'About', to: 'about' },
  { label: 'Features', to: 'features' },
  { label: 'Gallery', to: 'gallery' },
  { label: 'Pricelist', to: 'pricelist' },
  { label: 'Schedule', to: 'availability' },
  { label: 'Location', to: 'maps' },
  { label: 'Contact', to: 'contact' },
];

const WA_URL = 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20booking%20photobooth!';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      <header>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed z-50 transition-all duration-500 max-w-6xl w-[92%] left-1/2 -translate-x-1/2 rounded-full border shadow-2xl ${scrolled
          ? 'top-4 bg-black/30 backdrop-blur-[24px] border-white/[0.15] shadow-black/80'
          : 'top-6 bg-white/[0.05] backdrop-blur-xl border-white/20 shadow-black/40'
          }`}
      >
        <div className="px-5 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">

            {/* ── Logo ───────────────────────────────────── */}
            <motion.div
              whileHover={{ scale: 1.04 }}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <img
                src="/icons.svg"
                alt="SnapHub Logo"
                className="h-10 w-auto flex-shrink-0"
                style={{ md: { height: '3rem' }, height: '2.5rem' }}
              />
            </motion.div>

            {/* ── Desktop Nav ─────────────────────────────── */}
            <ul className="hidden lg:flex items-center gap-7 xl:gap-9">
              {navLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    spy={true}
                    smooth={true}
                    offset={0}
                    duration={650}
                    onSetActive={() => setActiveSection(link.to)}
                    className={`nav-link ${activeSection === link.to ? 'text-white' : ''}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* ── Book Now ────────────────────────────────── */}
            <div className="hidden lg:flex items-center gap-3">
              <motion.a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.04, boxShadow: '0 0 28px rgba(217,4,41,0.5)' }}
                whileTap={{ scale: 0.96 }}
                className="btn-primary text-sm px-5 py-2.5"
              >
                Book Now
              </motion.a>
            </div>

            {/* ── Mobile Toggle ───────────────────────────── */}
            <motion.button
              className="lg:hidden flex items-center justify-center w-10 h-10 text-white rounded-lg glass border border-white/10"
              onClick={() => setMenuOpen(!menuOpen)}
              whileTap={{ scale: 0.9 }}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuOpen
                  ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><FiX size={20} /></motion.span>
                  : <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><FiMenu size={20} /></motion.span>
                }
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.nav>
      </header>

      {/* ── Mobile Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70"
              onClick={() => setMenuOpen(false)}
            />
            {/* Panel */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 z-50 h-full w-72 glass-dark flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/[0.07]" style={{ padding: '0.8rem' }}>
                <img
                  src="/icons.svg"
                  alt="SnapHub Logo"
                  className="h-8 w-auto"
                />
                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close menu"
                >
                  <FiX size={30} />
                </button>
              </div>

              {/* Links */}
              <nav className="flex overflow-y-auto flex flex-col">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                  >
                    <Link
                      to={link.to}
                      spy={true}
                      smooth={true}
                      offset={0}
                      duration={650}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between border-b border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.05] transition-all duration-200 text-sm font-medium cursor-pointer group"
                      style={{ paddingTop: '0.8rem', paddingBottom: '0.8rem', paddingLeft: '0.8rem', paddingRight: '0.8rem' }}

                    >
                      {link.label}
                      <span className="text-[#D90429] opacity-0 group-hover:opacity-100 transition-opacity">›</span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* CTA */}
              <div className="border-t border-white/[0.07]" style={{ padding: '1.5rem' }}>
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary w-full text-center justify-center"
                >
                  Book Now via WhatsApp
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
