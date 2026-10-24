import React, { useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Link } from 'react-scroll';
import { FiInstagram, FiArrowUp, FiMapPin, FiPhone, FiClock } from 'react-icons/fi';

const QUICK_LINKS = [
  { label: 'Home', to: 'home' },
  { label: 'Features', to: 'features' },
  { label: 'Pricelist', to: 'pricelist' },
  { label: 'Calculator', to: 'calculator' },
  { label: 'Location', to: 'maps' },
];

const SOCIALS = [
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://instagram.com/snaphub.id',
    hoverClass: 'hover:bg-gradient-to-tr hover:from-yellow-400 hover:via-pink-500 hover:to-purple-500 hover:border-transparent hover:text-white',
    icon: <FiInstagram size={20} />,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    href: 'https://tiktok.com/@snaphub.id',
    hoverClass: 'hover:bg-white hover:text-black hover:border-white',
    icon: (
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.16 8.16 0 004.77 1.52V6.78a4.85 4.85 0 01-1-.09z" />
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: 'https://wa.me/6285190643459',
    hoverClass: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366]',
    icon: (
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

const Footer = () => {
  const footerRef = useRef(null);
  const isInView = useInView(footerRef, { margin: "0px" });

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <footer ref={footerRef} className="bg-[#050505] relative pt-16 pb-8 border-t border-white/[0.04]">
      {/* ── Ambient Background Elements ──────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-gradient-to-r from-transparent via-[#D90429]/40 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#D90429]/[0.03] blur-[100px] rounded-full" />
      </div>

      {/* ── Floating Back to Top Button ──────────────── */}
      <AnimatePresence>
        {isInView && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            className="fixed bottom-37 right-5 md:bottom-[10rem] md:right-8 z-[100]"
          >
            <motion.button
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(217,4,41,0.5)' }}
              whileTap={{ scale: 0.9 }}
              onClick={scrollToTop}
              className="flex items-center justify-center w-12 h-12 bg-[#D90429] text-white rounded-full shadow-2xl cursor-pointer"
            >
              <FiArrowUp size={22} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="wrap relative z-10">

        {/* ── Main Grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-16 mb-16">

          {/* Brand Column */}
          <div className="md:col-span-5 lg:col-span-4 flex flex-col items-center md:items-start text-center md:text-left">
            <Link to="home" smooth={true} duration={800} className="inline-block mb-5 cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
              <img
                src="/icons.svg"
                alt="SnapHub Logo"
                className="h-10 w-auto"
              />
            </Link>

            <p className="text-gray-400 text-[15px] leading-relaxed mb-8 max-w-sm">
              Premium photobooth services based in Malang. We capture smiles, print memories, and make your events unforgettable.
            </p>

            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <motion.a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-11 h-11 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-400 transition-all duration-300 ${s.hoverClass}`}
                >
                  {s.icon}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Spacer for large screens */}
          <div className="hidden lg:block lg:col-span-1" />

          {/* Quick Links */}
          <div className="md:col-span-3 lg:col-span-3 flex flex-col items-center md:items-start text-center md:text-left relative">
            <h4 className="text-white font-semibold text-base mb-6 tracking-wider uppercase font-heading">
              Quick Links
            </h4>
            <ul className="flex flex-col gap-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    spy={true}
                    smooth={true}
                    offset={-72}
                    duration={800}
                    className="text-gray-400 hover:text-white text-[15px] cursor-pointer transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D90429] opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.label}
                  </Link>
                </li>
              ))}
                <li>
                  <a
                    href="/links"
                    className="text-gray-400 hover:text-[#E79EA7] text-[15px] cursor-pointer transition-colors duration-300 flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D90429] opacity-0 group-hover:opacity-100 transition-opacity" />
                    Bio Links (Linktree)
                  </a>
                </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="md:col-span-4 lg:col-span-4 flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="text-white font-semibold text-base mb-6 tracking-wider uppercase font-heading">
              Contact Us
            </h4>
            <ul className="flex flex-col gap-4 text-[15px] text-gray-400">
              <li className="flex items-center gap-3">
                <FiMapPin className="text-[#D90429] shrink-0" size={18} />
                <span>Malang, Jawa Timur, Indonesia</span>
              </li>
              <li className="flex items-center gap-3">
                <FiPhone className="text-[#D90429] shrink-0" size={18} />
                <a href="tel:+6285190643459" className="hover:text-white transition-colors">+62 851-9064-3459</a>
              </li>
              <li className="flex items-center gap-3">
                <FiClock className="text-[#D90429] shrink-0" size={18} />
                <span>Senin – Minggu (07:00 - 22:00)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Bottom Bar ─────────────────────────────── */}
        <div className="pt-8 pb-4 border-t border-white/10 flex flex-col items-center justify-center gap-5 mt-6">


          <p className="text-gray-400 text-[13px] text-center">
            &copy; {new Date().getFullYear()} SnapHub.id. All rights reserved. Made with ♥ by{' '}
            <a
              href="https://instagram.com/pujarajisthaa_aw"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline hover:text-white transition-colors"
            >
              Puja Rajistha
            </a>.
          </p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
