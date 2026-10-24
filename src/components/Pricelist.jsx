import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { FiDownload, FiCheck, FiClock, FiPrinter, FiCamera, FiInfo } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { DEFAULT_PACKAGES, DEFAULT_TNC, mergePackages, formatRupiah, startFrom } from '../lib/pricelistDefaults';


const WA_URL = 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20booking%20photobooth!';

const WaIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const PACKAGE_ICONS = {
  softfile: <FiCamera size={18} />,
  limited: <FiPrinter size={18} />,
  unlimited: <FiPrinter size={18} />,
};


/* ─── Sub-component: single price row ─────────────────────── */
const PriceRow = ({ item, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.035, duration: 0.22 }}
    className="flex items-center justify-between py-3.5 border-b border-white/10 last:border-b-0"
  >
    <div className="flex items-center gap-2.5">
      <FiClock size={12} className="text-[#D90429] shrink-0 opacity-60" />
      <div className="leading-none">
        <span className="text-white text-[13px] font-medium">{item.label}</span>
        {item.sub && (
          <span className="text-gray-400 text-[11px] ml-1.5">({item.sub})</span>
        )}
      </div>
    </div>
    <span className="text-[#D90429] font-bold text-[13px] md:text-sm tabular-nums">
      {formatRupiah(item.price)}
    </span>
  </motion.div>
);

/* ─── Main Component ───────────────────────────────────────── */
const Pricelist = () => {
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [tnc, setTnc] = useState(DEFAULT_TNC);
  const [activeTab, setActiveTab] = useState(DEFAULT_PACKAGES[0].id);
  const [pdfUrl, setPdfUrl] = useState('/PriceGuideSnapHub.id.pdf');
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  useEffect(() => {
    let active = true;
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pricelist')
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.value) return;
        if (data.value.packages) setPackages(mergePackages(data.value.packages));
        if (Array.isArray(data.value.tnc) && data.value.tnc.length > 0) setTnc(data.value.tnc);
        if (data.value.pdfUrl) setPdfUrl(data.value.pdfUrl);
      });
    return () => {
      active = false;
    };
  }, []);

  const pkg = packages.find((p) => p.id === activeTab);

  return (
    <section id="pricelist" className="section-pad bg-[#0B0B0B] relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 20% 80%, rgba(217,4,41,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="wrap" ref={ref}>
        {/* ── Section Header ─────────────────── */}
        <div className="section-header">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="eyebrow-row"
          >
            <div className="eyebrow-line" />
            <span className="text-eyebrow">Transparent Pricing</span>
            <div className="eyebrow-line" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="text-section-title text-white mt-3 mb-4"
          >
            Our <span className="text-[#D90429]">Packages</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="section-desc"
          >
            Pilih paket yang sesuai dengan kebutuhan acaramu. Semua paket sudah
            termasuk setup profesional dan kru standby.
          </motion.p>
        </div>

        {/* ── Tab Switcher ───────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {packages.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveTab(p.id)}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border ${activeTab === p.id
                ? 'bg-[#D90429] text-white border-[#D90429] shadow-[0_0_24px_rgba(217,4,41,0.35)]'
                : 'bg-transparent text-gray-400 border-white/10 hover:border-white/25 hover:text-white'
                }`}
            >
              {p.label}
            </button>
          ))}
        </motion.div>

        {/* ── Package Content ────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28 }}
            className="max-w-5xl mx-auto"
          >
            {/* Package title row */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[#D90429]/15 border border-[#D90429]/25 flex items-center justify-center text-[#D90429] shrink-0">
                {PACKAGE_ICONS[pkg.id]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-bold text-white font-heading leading-none">{pkg.label}</h3>
                  {pkg.badge && (
                    <span className="text-[11px] font-semibold bg-[#D90429]/20 text-[#D90429] border border-[#D90429]/30 px-2.5 py-0.5 rounded-full leading-none">
                      {pkg.badge}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-1">{pkg.tagline}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Mulai dari</div>
                <div className="text-xl font-bold text-white">{formatRupiah(startFrom(pkg))}</div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-stretch">
              {/* LEFT — Features */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 md:p-7 flex flex-col">
                <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 mb-10 font-semibold">
                  Sudah Termasuk
                </p>
                <ul className="space-y-3 flex-1">
                  {pkg.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-[#D90429]/15 border border-[#D90429]/30 flex items-center justify-center shrink-0 mt-px">
                        <FiCheck size={8} className="text-[#D90429]" />
                      </div>
                      <span className="text-gray-400 text-[13px] leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
                {/* Additional time note */}
                {pkg.id === 'limited' && (
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      <span className="text-[#D90429] font-semibold">Tambah waktu</span>{' '}(tanpa print):{' '}
                      <span className="text-white font-medium">Rp 500.000 / jam</span>
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT — Price List */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 md:p-7">
                <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 mb-4 font-semibold">
                  Daftar Harga
                </p>
                <div>
                  {pkg.prices.map((item, i) => (
                    <PriceRow key={i} item={item} index={i} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Terms & Conditions ─────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="max-w-5xl mx-auto mt-8"
        >
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 md:p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap flex items-center gap-1.5">
                <FiInfo size={10} /> Syarat &amp; Ketentuan
              </h3>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
              {tnc.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[#D90429]/40 text-[10px] font-bold font-mono mt-0.5 shrink-0 tabular-nums w-4">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-gray-400 text-[12px] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── CTA Buttons ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10"
        >
          <motion.a
            href={pdfUrl || '/PriceGuideSnapHub.id.pdf'}
            download={pdfUrl?.startsWith('http') ? undefined : "PriceGuideSnapHub.pdf"}
            target={pdfUrl?.startsWith('http') ? "_blank" : undefined}
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="btn-outline w-[240px] justify-center"
          >
            <FiDownload className="flex-shrink-0" /> Download Pricelist
          </motion.a>

          <motion.a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(217,4,41,0.5)' }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary w-[240px] justify-center"
          >
            <WaIcon /> Book Now
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricelist;
