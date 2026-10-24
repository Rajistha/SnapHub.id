import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  FiShare2, FiCopy, FiCheck, FiArrowRight, FiExternalLink, 
  FiCamera, FiCalendar, FiImage, FiTag, FiStar, FiGlobe, 
  FiArrowLeft, FiX, FiChevronDown
} from 'react-icons/fi';
import { SiWhatsapp, SiInstagram, SiTiktok } from 'react-icons/si';
import toast, { Toaster } from 'react-hot-toast';
import { DEFAULT_LINKTREE_PROFILE, DEFAULT_LINKS } from '../lib/linktreeDefaults';

const ICONS_MAP = {
  camera: <FiCamera size={19} />,
  calendar: <FiCalendar size={19} />,
  image: <FiImage size={19} />,
  ticket: <FiTag size={19} />,
  star: <FiStar size={19} />,
  globe: <FiGlobe size={19} />,
  whatsapp: <SiWhatsapp size={19} />,
  link: <FiExternalLink size={19} />
};

const Linktree = () => {
  const [profile, setProfile] = useState(DEFAULT_LINKTREE_PROFILE);
  const [links, setLinks] = useState(DEFAULT_LINKS);
  const [loading, setLoading] = useState(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Keep openSections state synced with loaded links
    setOpenSections(prev => {
      const updated = { ...prev };
      links.forEach(l => {
        if (l.type === 'header' && l.sectionType === 'dropdown') {
          if (updated[l.id] === undefined) {
            updated[l.id] = l.defaultOpen !== false;
          }
        }
      });
      return updated;
    });
  }, [links]);

  const toggleSection = (id) => {
    setOpenSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    if (profile?.name) {
      document.title = `${profile.name} • Official Links`;
    }
  }, [profile?.name]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'linktree')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error loading linktree:', error);
      }

      if (data?.value) {
        if (data.value.profile) {
          setProfile(prev => ({
            ...prev,
            ...data.value.profile,
            concierge: {
              ...prev.concierge,
              ...(data.value.profile.concierge || {})
            }
          }));
        }
        if (Array.isArray(data.value.links) && data.value.links.length > 0) {
          setLinks(data.value.links);
        }
      }
    } catch (err) {
      console.warn('Supabase linktree fetch error, using fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClickLink = (link) => {
    try {
      supabase.rpc('increment_link_clicks', { p_link_id: link.id }).then().catch(() => {});
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, clicks: (l.clicks || 0) + 1 } : l));
    } catch {
      // safe fallback
    }
  };

  // URL resmi untuk share & QR Code (otomatis canonical ke link.snaphub.my.id di produksi)
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname.includes('localhost');
  const shareUrl = isLocalhost ? window.location.href : 'https://link.snaphub.my.id';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&bgcolor=111113&color=ffffff&margin=12&data=${encodeURIComponent(shareUrl)}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile.name,
          text: profile.bio,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.log('Share error:', err);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Tautan disalin ke clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Gagal menyalin tautan');
    }
  };

  // Group active links into sections
  const activeLinks = links.filter(l => l.isActive !== false);

  // Group items into sections defined by 'header' items
  const groupedSections = [];
  let currentGroup = {
    header: null,
    links: []
  };

  activeLinks.forEach((item) => {
    if (item.type === 'header') {
      currentGroup = {
        header: item,
        links: []
      };
      groupedSections.push(currentGroup);
    } else {
      if (!groupedSections.includes(currentGroup)) {
        groupedSections.push(currentGroup);
      }
      currentGroup.links.push(item);
    }
  });

  const renderLinkCard = (item) => {
    const isExternal = item.url?.startsWith('http');
    const isHighlighted = !!item.isHighlighted;

    return (
      <a
        key={item.id}
        href={item.url}
        target={item.openNewTab !== false ? '_blank' : '_self'}
        rel="noopener noreferrer"
        onClick={() => handleClickLink(item)}
        className={`group relative w-full flex items-center justify-between p-3.5 rounded-2xl transition-transform duration-200 cursor-pointer overflow-hidden backdrop-blur-md ${
          isHighlighted
            ? 'bg-zinc-900/80 hover:bg-zinc-800/85 border border-white/25 hover:border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/10'
            : 'bg-zinc-950/65 hover:bg-zinc-900/80 border border-white/[0.08] hover:border-white/[0.18] shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
        } hover:-translate-y-0.5`}
      >
        {/* Highlighted Specular Top Reflection (Monochromatic White Glass) */}
        {isHighlighted && (
          <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
        )}

        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Activity Logo Container */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-white/10 to-white/[0.02] p-[1px] shrink-0 shadow-sm">
            <div className="w-full h-full rounded-xl bg-[#111114] flex items-center justify-center p-2 overflow-hidden">
              {item.logoUrl ? (
                <img
                  src={item.logoUrl}
                  alt={item.title}
                  className="w-full h-full object-contain filter group-hover:brightness-110 transition-opacity"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-zinc-400 group-hover:text-white transition-colors">
                  {ICONS_MAP[item.icon] || <FiCamera size={19} />}
                </div>
              )}
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-[13.5px] transition-colors truncate tracking-tight ${
                isHighlighted ? 'text-white' : 'text-zinc-200 group-hover:text-white'
              }`}>
                {item.title}
              </span>

              {item.badge && (
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase ${
                  isHighlighted
                    ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                    : 'bg-white/[0.08] text-zinc-300 border border-white/[0.08]'
                }`}>
                  {item.badge}
                </span>
              )}
            </div>

            {item.subtitle && (
              <p className={`text-[11.5px] transition-colors line-clamp-1 mt-0.5 font-normal ${
                isHighlighted ? 'text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-300'
              }`}>
                {item.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Action Button */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ml-2 group-hover:translate-x-0.5 ${
            isHighlighted
              ? 'bg-white text-black shadow-md font-bold'
              : 'bg-white/[0.03] border border-white/[0.06] group-hover:border-white/20 group-hover:bg-white/[0.08] text-zinc-500 group-hover:text-white'
          }`}
        >
          {isExternal ? (
            <FiExternalLink size={12} />
          ) : (
            <FiArrowRight size={12} />
          )}
        </div>
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between font-sans selection:bg-white/20 selection:text-white relative overflow-hidden">
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#f4f4f5', border: '1px solid #27272a', fontSize: '13px' } }} />

      {/* ── High-Performance Ambient Aurora Blur Background (Zero Frame Drops, 120 FPS) ── */}
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden z-0"
        style={{ contain: 'strict' }}
      >
        {/* 1. Multi-stop Aurora Mesh Radial Gradients (Single GPU-cached layer, 0 repaint cost) */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% -8%, rgba(225, 29, 72, 0.32) 0%, rgba(190, 18, 60, 0.18) 25%, transparent 55%),
              radial-gradient(circle at 92% 16%, rgba(147, 51, 234, 0.28) 0%, rgba(99, 102, 241, 0.14) 30%, transparent 60%),
              radial-gradient(circle at 6% 42%, rgba(251, 113, 133, 0.22) 0%, rgba(225, 29, 72, 0.10) 30%, transparent 55%),
              radial-gradient(circle at 92% 68%, rgba(79, 70, 229, 0.25) 0%, rgba(124, 58, 237, 0.12) 30%, transparent 58%),
              radial-gradient(ellipse at 50% 102%, rgba(225, 29, 72, 0.26) 0%, rgba(79, 70, 229, 0.12) 35%, transparent 60%)
            `
          }}
        />

        {/* 2. Soft Center Stage Ambient Bloom (Hardware accelerated static diffusion) */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[450px] rounded-full pointer-events-none opacity-80"
          style={{
            background: 'radial-gradient(ellipse, rgba(225, 29, 72, 0.24) 0%, rgba(147, 51, 234, 0.12) 50%, transparent 75%)',
            transform: 'translateZ(0)',
            filter: 'blur(50px)',
          }}
        />

        {/* 3. Cinematic Studio Vignette */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 35%, transparent 30%, rgba(9, 9, 11, 0.45) 70%, #09090b 100%)'
          }}
        />

        {/* 4. Subtle Micro-Film Texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="w-full max-w-md mx-auto px-5 pt-5 pb-3 flex items-center justify-between relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-all backdrop-blur-md"
        >
          <FiArrowLeft size={13} />
          <span>Website Utama</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsQrModalOpen(true)}
            title="Scan QR Code"
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-all backdrop-blur-md cursor-pointer"
          >
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 2h3v3h-3v-3zm3 3h3v3h-3v-3zm-5-3h2v5h-2v-5zm7 2h1v3h-1v-3z" />
            </svg>
          </button>

          <button
            onClick={handleShare}
            title="Bagikan Halaman"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-all backdrop-blur-md cursor-pointer"
          >
            {copied ? <FiCheck className="text-emerald-400" size={13} /> : <FiShare2 size={13} />}
            <span>{copied ? 'Tersalin' : 'Bagikan'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Bio Content ── */}
      <main className="w-full max-w-md mx-auto px-5 py-2 flex-1 flex flex-col items-center relative z-10">
        
        {/* Profile Card */}
        <div className="flex flex-col items-center text-center w-full mb-5 pt-2">
          
          {/* Avatar (BULAT / ROUND CIRCLE) */}
          <div className="relative mb-3.5">
            {/* Subtle Soft Halo */}
            <div className="absolute -inset-1 rounded-full bg-white/[0.06] blur-md opacity-50 -z-10" />
            
            <div className="w-24 h-24 rounded-full bg-gradient-to-b from-white/20 via-white/5 to-transparent p-[1px] shadow-2xl shadow-black/80">
              <div className="w-full h-full rounded-full bg-[#111113] p-3 flex items-center justify-center overflow-hidden">
                <img
                  src={profile.avatarUrl || '/icons.svg'}
                  alt={profile.name}
                  className="w-full h-full object-contain"
                  onError={(e) => { e.target.src = '/icons.svg'; }}
                />
              </div>
            </div>

            {profile.verified && (
              <div 
                title="Akun Resmi Terverifikasi"
                className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#D90429] border-2 border-[#09090b] flex items-center justify-center text-white shadow-md"
              >
                <FiCheck size={10} strokeWidth={3} />
              </div>
            )}
          </div>

          {/* Profile Name & Tagline */}
          <h1 className="text-xl font-bold font-heading tracking-tight text-white flex items-center gap-1.5">
            {profile.name}
          </h1>

          {profile.handle && (
            <p className="text-[11px] font-mono tracking-wider text-zinc-400 mt-0.5">
              {profile.handle}
            </p>
          )}

          {profile.bio && (
            <p className="text-xs text-zinc-400 mt-2 max-w-xs leading-relaxed font-normal">
              {profile.bio}
            </p>
          )}

          {/* Social Icons (DIPISAH - SEPARATE INDIVIDUAL CIRCULAR BUTTONS) */}
          <div className="flex items-center justify-center gap-2.5 mt-4">
            {profile.socials?.map((social) => {
              if (!social.url) return null;
              return (
                <a
                  key={social.platform}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition-all shadow-sm"
                  title={social.label}
                >
                  {social.platform === 'instagram' && <SiInstagram size={15} />}
                  {social.platform === 'tiktok' && <SiTiktok size={14} />}
                  {social.platform === 'whatsapp' && <SiWhatsapp size={15} />}
                  {social.platform === 'website' && <FiGlobe size={15} />}
                </a>
              );
            })}
          </div>
        </div>

        {/* Links & Sections rendered in exact admin order */}
        <div className="w-full space-y-3 mt-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              Memuat daftar tautan...
            </div>
          ) : activeLinks.length === 0 ? (
            <div className="border border-white/5 rounded-2xl p-8 text-center text-xs text-zinc-500">
              Belum ada tautan yang aktif.
            </div>
          ) : (
            groupedSections.map((group, groupIdx) => {
              // 1. Links without header
              if (!group.header) {
                return (
                  <div key={`group-${groupIdx}`} className="space-y-2.5">
                    {group.links.map(link => renderLinkCard(link))}
                  </div>
                );
              }

              const isDropdown = group.header.sectionType === 'dropdown';
              const isOpen = isDropdown 
                ? (openSections[group.header.id] ?? (group.header.defaultOpen !== false)) 
                : true;

              // 2. Dropdown / Accordion Section Header
              if (isDropdown) {
                return (
                  <div key={group.header.id} className="pt-2">
                    {/* Dropdown Section Header (Same look as normal header, with toggle chevron arrow) */}
                    <button
                      type="button"
                      onClick={() => toggleSection(group.header.id)}
                      className="w-full pt-3 pb-2 flex items-center gap-3 cursor-pointer text-left group select-none"
                    >
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 group-hover:text-zinc-200 transition-colors font-mono">
                        {group.header.title}
                      </span>
                      <div className="h-[1px] flex-1 bg-white/[0.08] group-hover:bg-white/[0.15] transition-colors" />
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="text-zinc-500 group-hover:text-zinc-300 transition-colors flex items-center justify-center shrink-0"
                      >
                        <FiChevronDown size={14} />
                      </motion.div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key={`content-${group.header.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden space-y-2.5"
                        >
                          {group.links.length === 0 ? (
                            <div className="p-3 text-center text-[11px] text-zinc-500 rounded-xl bg-white/[0.015] border border-white/[0.04]">
                              Belum ada tautan di bagian ini
                            </div>
                          ) : (
                            group.links.map(link => renderLinkCard(link))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              // 3. Normal / Static Divider Section Header
              return (
                <div key={group.header.id} className="pt-2">
                  <div className="pt-3 pb-2 flex items-center gap-3">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 font-mono">
                      {group.header.title}
                    </span>
                    <div className="h-[1px] flex-1 bg-white/[0.08]" />
                  </div>

                  <div className="space-y-2.5">
                    {group.links.map(link => renderLinkCard(link))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Concierge & Inquiries (Studio Concierge Style) */}
        {profile?.concierge?.show !== false && (
          <div className="w-full mt-7 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-3 backdrop-blur-sm">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-zinc-200 block">
                {profile?.concierge?.title || 'Konsultasi & Reservasi Acara'}
              </span>
              {(profile?.concierge?.subtitle ?? 'Pernikahan, wisuda, gathering, & custom booth.') && (
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                  {profile?.concierge?.subtitle ?? 'Pernikahan, wisuda, gathering, & custom booth.'}
                </p>
              )}
            </div>
            <a
              href={profile?.concierge?.buttonUrl || 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20tanya%20paket%20photobooth.'}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <span>{profile?.concierge?.buttonText || 'Hubungi WA'}</span>
              <FiArrowRight size={12} />
            </a>
          </div>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="w-full py-6 text-center text-xs text-zinc-400 relative z-10">
        <Link to="/" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
          <img src="/icons.svg" alt="SnapHub" className="h-3.5 w-3.5 opacity-60 hover:opacity-100 transition-opacity" />
          <span className="font-medium text-zinc-300 hover:text-white text-xs">SnapHub.id</span>
        </Link>
        <p className="text-[10.5px] text-zinc-400 mt-1">
          snap it. share it. snap hub.
        </p>
      </footer>

      {/* ── QR Code Modal ── */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121215] border border-white/10 rounded-3xl p-6 max-w-xs w-full text-center relative shadow-2xl"
            >
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
              >
                <FiX size={16} />
              </button>

              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                <img src="/icons.svg" alt="SnapHub" className="w-5 h-5 opacity-90" />
              </div>

              <h3 className="text-base font-semibold text-white">QR Code Bio</h3>
              <p className="text-xs text-zinc-400 mt-1 mb-1">
                Pindai kamera untuk membuka tautan resmi
              </p>
              <p className="text-[11px] font-mono text-zinc-300 mb-4">
                link.snaphub.my.id
              </p>

              <div className="bg-[#18181b] p-3 rounded-2xl border border-white/10 inline-block mb-4 shadow-inner">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-44 h-44 rounded-xl mx-auto"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="flex-1 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FiCopy size={13} />
                  <span>{copied ? 'Tersalin' : 'Salin URL'}</span>
                </button>
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-xs font-medium cursor-pointer transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Linktree;
