import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  FiCamera, FiPrinter, FiDownloadCloud,
  FiLayout, FiUsers,
  FiArrowUpRight, FiCheckCircle
} from 'react-icons/fi';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const Features = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section id="features" className="section-pad bg-[#0B0B0B] relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #D90429, transparent)', filter: 'blur(120px)' }}
      />

      <div className="wrap relative z-10" ref={ref}>
        {/* ── Header ── */}
        <div className="section-header">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="eyebrow-row"
          >
            <div className="eyebrow-line" />
            <span className="text-eyebrow">WHY CHOOSE US</span>
            <div className="eyebrow-line" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 22 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-section-title text-white mt-3 mb-4"
          >
            Everything You <span className="text-[#D90429]">Need</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="section-desc"
          >
            Layanan photobooth berstandar profesional untuk mengabadikan momen berharga Anda secara sempurna.
          </motion.p>
        </div>

        {/* ── Modern Bento Grid ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {/* ── Card 1: Hero Instant Print (Span 2 on lg) ── */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="lg:col-span-2 group relative rounded-2xl bg-gradient-to-br from-[#161616] via-[#121212] to-[#0E0E0E] border border-white/[0.08] hover:border-[#D90429]/40 p-7 sm:p-9 transition-all duration-300 overflow-hidden flex flex-col justify-between"
          >
            {/* Subtle glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#D90429]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#D90429]/15 transition-all duration-500" />

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#D90429]/10 border border-[#D90429]/25 text-[#D90429] flex items-center justify-center text-xl shadow-[0_0_20px_rgba(217,4,41,0.15)] group-hover:bg-[#D90429] group-hover:text-white transition-all duration-300">
                  <FiPrinter />
                </div>
                <span className="text-[11px] font-medium tracking-wide text-zinc-400 bg-white/[0.04] border border-white/[0.08] px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ultra-Fast Lab Print
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white font-heading mb-3">
                Instant Print & Unlimited Photos
              </h3>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-xl mb-6">
                Sesi foto tanpa batas kuota selama durasi acara. Setiap jepretan langsung dicetak dalam hitungan detik dengan kualitas foto tahan pudar yang siap dibawa pulang seluruh tamu.
              </p>
            </div>

            {/* Visual strip preview */}
            <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <FiCheckCircle className="text-[#D90429]" size={14} /> Cetak 10-15 Detik
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <FiCheckCircle className="text-[#D90429]" size={14} /> Kertas Foto Glossy Premium
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <FiCheckCircle className="text-[#D90429]" size={14} /> Bebas Foto Sepuasnya
              </span>
            </div>
          </motion.div>

          {/* ── Card 2: Digital Copies via Bio Link (Span 1 on lg) ── */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="group relative rounded-2xl bg-gradient-to-br from-[#161616] via-[#121212] to-[#0E0E0E] border border-white/[0.08] hover:border-[#D90429]/40 p-7 sm:p-9 transition-all duration-300 overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-[#D90429]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#D90429]/20 transition-all duration-500" />

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#D90429]/10 border border-[#D90429]/25 text-[#D90429] flex items-center justify-center text-xl shadow-[0_0_20px_rgba(217,4,41,0.15)] group-hover:bg-[#D90429] group-hover:text-white transition-all duration-300">
                  <FiDownloadCloud />
                </div>
                <span className="text-[11px] font-medium tracking-wide text-[#D90429] bg-[#D90429]/10 border border-[#D90429]/25 px-2.5 py-0.5 rounded-full">
                  Link di Bio
                </span>
              </div>

              <h3 className="text-xl font-bold text-white font-heading mb-2.5">
                Digital Copies Sekali Klik
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Tamu cukup sekali klik tautan di bio untuk langsung mengunduh seluruh file foto & video resolusi penuh ke HP masing-masing.
              </p>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono text-zinc-300">link.snaphub.my.id</span>
              <span className="text-[#D90429] group-hover:translate-x-1 transition-transform duration-200">
                <FiArrowUpRight size={16} />
              </span>
            </div>
          </motion.div>

          {/* ── Card 3: Studio Quality Lighting & Camera ── */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="group relative rounded-2xl bg-[#141414] hover:bg-[#181818] border border-white/[0.07] hover:border-white/20 p-6 sm:p-7 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#D90429] flex items-center justify-center text-lg mb-4 group-hover:bg-[#D90429] group-hover:text-white transition-colors duration-200">
                <FiCamera />
              </div>
              <h4 className="text-white font-bold text-[1.05rem] font-heading mb-2">
                Studio Camera & Lighting
              </h4>
              <p className="text-gray-400 text-xs sm:text-[0.84rem] leading-relaxed">
                Didukung kamera profesional dan pencahayaan studio terkalibrasi untuk hasil potret yang jernih dan tajam di setiap venue.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">DSLR / Mirrorless Studio Rig</span>
            </div>
          </motion.div>

          {/* ── Card 4: Custom Frame Template ── */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="group relative rounded-2xl bg-[#141414] hover:bg-[#181818] border border-white/[0.07] hover:border-white/20 p-6 sm:p-7 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#D90429] flex items-center justify-center text-lg mb-4 group-hover:bg-[#D90429] group-hover:text-white transition-colors duration-200">
                <FiLayout />
              </div>
              <h4 className="text-white font-bold text-[1.05rem] font-heading mb-2">
                Custom Frame Template
              </h4>
              <p className="text-gray-400 text-xs sm:text-[0.84rem] leading-relaxed">
                Desain bingkai foto eksklusif yang disesuaikan secara personal dengan tema, palet warna, dan logo acara Anda.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">Wedding • Wisuda • Corporate</span>
            </div>
          </motion.div>

          {/* ── Card 5: Professional Crew & Punctual Setup ── */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="group relative rounded-2xl bg-[#141414] hover:bg-[#181818] border border-white/[0.07] hover:border-white/20 p-6 sm:p-7 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#D90429] flex items-center justify-center text-lg mb-4 group-hover:bg-[#D90429] group-hover:text-white transition-colors duration-200">
                <FiUsers />
              </div>
              <h4 className="text-white font-bold text-[1.05rem] font-heading mb-2">
                Professional Crew & On-Time Setup
              </h4>
              <p className="text-gray-400 text-xs sm:text-[0.84rem] leading-relaxed">
                Kru kami hadir lebih awal untuk persiapan menyeluruh dan selalu sigap mendampingi tamu agar seluruh sesi berjalan lancar.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <span className="text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">Full On-Site Assistance</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
