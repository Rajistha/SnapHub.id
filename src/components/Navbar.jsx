import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-scroll';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiChevronDown } from 'react-icons/fi';

const navLinks = [
  { label: 'Home', to: 'home' },
  { label: 'Pricelist', to: 'pricelist' },
  { label: 'Schedule', to: 'availability' },
  { label: 'About', to: 'about' },
  { label: 'Features', to: 'features' },
  { label: 'Gallery', to: 'gallery' },
  { label: 'Location', to: 'maps' },
  { label: 'Contact', to: 'contact' },
];

const dropdownLinks = ['about', 'features', 'gallery', 'maps'];
const linkByKey = Object.fromEntries(navLinks.map((l) => [l.to, l]));

const WA_URL = 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20booking%20photobooth!';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

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
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 border-b ${scrolled
          ? 'bg-[#050505] border-white/10'
          : 'bg-transparent border-transparent'
          }`}
      >
        <nav className="max-w-6xl mx-auto px-5 md:px-8 flex items-center justify-between h-16 md:h-[72px]">
          {/* Logo */}
          <Link to="home" smooth={true} duration={650} className="flex items-center cursor-pointer select-none">
            <img src="/icons.svg" alt="SnapHub Logo" className="h-9 md:h-10 w-auto" />
          </Link>

          {/* Desktop links */}
          <ul className="hidden lg:flex items-center gap-8">
            {[linkByKey.home].map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  spy={true}
                  smooth={true}
                  offset={-72}
                  duration={650}
                  onSetActive={() => setActiveSection(link.to)}
                  className={`cursor-pointer text-sm py-1 border-b-2 transition-colors ${activeSection === link.to
                    ? 'text-white border-[#D90429]'
                    : 'text-gray-400 border-transparent hover:text-white'
                    }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {['pricelist', 'availability'].map((key) => {
              const link = linkByKey[key];
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    spy={true}
                    smooth={true}
                    offset={-72}
                    duration={650}
                    onSetActive={() => setActiveSection(link.to)}
                    className={`cursor-pointer text-sm py-1 border-b-2 transition-colors ${activeSection === link.to
                    ? 'text-white border-[#D90429]'
                    : 'text-gray-400 border-transparent hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}

            {/* Dropdown */}
            <li
              ref={dropdownRef}
              className="relative"
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                aria-expanded={dropdownOpen}
                className={`flex items-center gap-1 text-sm py-1 border-b-2 transition-colors ${dropdownLinks.includes(activeSection)
                  ? 'text-white border-[#D90429]'
                  : 'text-gray-400 border-transparent hover:text-white'
                  }`}
              >
                Jelajahi
                <FiChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* pt-3 bridges the gap so hover isn't lost; links stay mounted so scroll-spy keeps working */}
              <div className={`absolute left-0 top-full pt-3 ${dropdownOpen ? 'block' : 'hidden'}`}>
                <ul className="w-44 py-1.5 bg-[#0a0a0a] border border-white/10 rounded-md shadow-lg shadow-black/50">
                  {dropdownLinks.map((key) => {
                    const link = linkByKey[key];
                    return (
                      <li key={key}>
                        <Link
                          to={link.to}
                          spy={true}
                          smooth={true}
                          offset={-72}
                          duration={650}
                          onSetActive={() => setActiveSection(link.to)}
                          onClick={() => setDropdownOpen(false)}
                          className={`block cursor-pointer px-4 py-2 text-sm transition-colors ${activeSection === link.to
                            ? 'text-white bg-white/5'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>

            {['contact'].map((key) => {
              const link = linkByKey[key];
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    spy={true}
                    smooth={true}
                    offset={-72}
                    duration={650}
                    onSetActive={() => setActiveSection(link.to)}
                    className={`cursor-pointer text-sm py-1 border-b-2 transition-colors ${activeSection === link.to
                    ? 'text-white border-[#D90429]'
                    : 'text-gray-400 border-transparent hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Book Now */}
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-block text-sm font-semibold text-white bg-[#D90429] hover:bg-[#A50320] transition-colors px-5 py-2.5 rounded-md"
          >
            Book Now
          </a>

          {/* Mobile toggle */}
          <button
            className="lg:hidden flex items-center justify-center w-10 h-10 text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </nav>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed top-0 right-0 z-50 h-[100dvh] max-h-[100dvh] w-72 bg-[#0a0a0a] border-l border-white/10 flex flex-col overscroll-contain shadow-2xl"
            >
              <div className="flex items-center justify-between h-16 px-5 border-b border-white/10 shrink-0">
                <img src="/icons.svg" alt="SnapHub Logo" className="h-8 w-auto" />
                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
                  aria-label="Close menu"
                >
                  <FiX size={24} />
                </button>
              </div>

              <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col overscroll-contain">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    smooth={true}
                    offset={-72}
                    duration={650}
                    onClick={() => setMenuOpen(false)}
                    className={`px-5 py-3.5 border-b border-white/5 text-sm cursor-pointer transition-colors ${activeSection === link.to
                      ? 'text-white border-l-2 border-l-[#D90429]'
                      : 'text-gray-400 hover:text-white'
                      }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="p-5 border-t border-white/10 shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom,20px))]">
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-center text-sm font-semibold text-white bg-[#D90429] hover:bg-[#A50320] transition-colors px-5 py-3 rounded-md"
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
