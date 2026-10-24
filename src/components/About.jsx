import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { FiCamera, FiZap, FiPrinter, FiSmartphone, FiArrowRight } from 'react-icons/fi';
import aboutImg from '../assets/about_image.webp';

const FEATURES = [
  {
    icon: <FiCamera />,
    label: 'Kamera & Lighting Studio',
    desc: 'Hasil jernih standar profesional',
  },
  {
    icon: <FiPrinter />,
    label: 'Cetak Instan di Lokasi',
    desc: 'Cepat jadi, langsung dibawa pulang',
  },
  {
    icon: <FiSmartphone />,
    label: 'File Digital di Link Bio',
    desc: 'Sekali klik di bio, langsung unduh',
  },
  {
    icon: <FiZap />,
    label: 'Sesi Foto Tanpa Batas',
    desc: 'Bebas foto sepuasnya selama acara',
  },
];

const fadeUp = { hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };

const About = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="about" className="section-pad bg-[#0B0B0B] relative overflow-hidden">
      {/* Ambient */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #D90429, transparent)', filter: 'blur(100px)' }}
      />

      <div className="wrap" ref={ref}>
        <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

          {/* ── Left: Image ── */}
          <motion.div
            initial={{ opacity: 0, x: -48 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Decorative frame offset */}
            <div
              className="absolute inset-0 rounded-[22px] border border-[#D90429]/25 translate-x-3 translate-y-3 pointer-events-none z-0"
            />

            {/* Main image */}
            <div className="relative z-10 rounded-[20px] overflow-hidden" style={{ height: '500px' }}>
              <img
                src={aboutImg}
                alt="Tim SnapHub photobooth Malang"
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {/* Bottom fade */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0B0B0B]/70 to-transparent" />
            </div>

            {/* Stat: Events */}
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.9 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.5, duration: 0.45 }}
              className="absolute bottom-5 right-4 z-20 bg-[#111]/90 border border-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-2xl"
            >
              <div className="text-[2rem] font-black text-white font-heading leading-none">100+</div>
              <div className="text-gray-400 text-[0.72rem] mt-1 font-medium uppercase tracking-widest">Events Handled</div>
            </motion.div>

            {/* Stat: Rating */}
            <motion.div
              initial={{ opacity: 0, y: -18, scale: 0.9 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.65, duration: 0.45 }}
              className="absolute top-5 left-4 z-20 bg-[#111]/90 border border-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3"
            >
              <div className="text-[1.6rem] font-black text-[#D90429] font-heading leading-none">4.9</div>
              <div>
                <div className="text-yellow-400 text-[0.7rem] leading-none">★★★★★</div>
                <div className="text-gray-400 text-[0.68rem] mt-0.5 uppercase tracking-wider">Rating Klien</div>
              </div>
            </motion.div>
          </motion.div>

          {/* ── Right: Content ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="flex flex-col"
          >
            {/* Eyebrow */}
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-5">
              <div className="w-8 h-[2px] bg-[#D90429] rounded flex-shrink-0" />
              <span className="text-eyebrow">About SnapHub</span>
            </motion.div>

            {/* Heading */}
            <motion.h2 variants={fadeUp} className="text-section-title text-white mb-6 leading-[1.15]">
              Crafting <span className="text-[#D90429]">Timeless</span> Moments
            </motion.h2>

            {/* Body */}
            <motion.p variants={fadeUp} className="text-gray-400 text-[0.95rem] leading-[1.85] mb-3">
              SnapHub hadir untuk memastikan setiap momen kebersamaan di acara Anda terekam dengan sempurna. Kami menyediakan layanan photobooth profesional di Malang dan sekitarnya — mulai dari setup booth yang estetik, pencahayaan studio, cetak foto instan, hingga kemudahan akses file digital langsung melalui link bio.
            </motion.p>
            <motion.p variants={fadeUp} className="text-gray-400 text-[0.95rem] leading-[1.85] mb-8">
              Mulai dari pernikahan, wisuda, gathering perusahaan, hingga pesta perayaan — tim berpengalaman kami siap menghadirkan keceriaan dan pengalaman photobooth yang berkesan bagi setiap tamu undangan.
            </motion.p>

            {/* Feature List */}
            <motion.div variants={stagger} className="space-y-3 mb-8">
              {FEATURES.map((f) => (
                <motion.div
                  key={f.label}
                  variants={fadeUp}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#D90429]/10 border border-[#D90429]/20 flex items-center justify-center text-[#D90429] flex-shrink-0 group-hover:bg-[#D90429]/20 transition-colors duration-200">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold leading-tight">{f.label}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{f.desc}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div variants={fadeUp}>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#D90429] hover:text-white transition-colors duration-200 group"
              >
                Konsultasikan acara Anda
                <FiArrowRight className="group-hover:translate-x-1 transition-transform duration-200" />
              </a>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default About;
