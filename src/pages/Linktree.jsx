import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiShare2, FiCopy, FiCheck, FiArrowRight, FiExternalLink, FiCamera, FiCalendar,
  FiImage, FiTag, FiStar, FiGlobe, FiChevronDown, FiGrid,
} from 'react-icons/fi';
import { SiWhatsapp, SiInstagram, SiTiktok } from 'react-icons/si';
import { supabase } from '../lib/supabase';
import { DEFAULT_LINKTREE_PROFILE, DEFAULT_LINKS } from '../lib/linktreeDefaults';
import { safeUrl } from '../lib/appUrls';
import Modal from '../components/ui/Modal';

const ICONS = {
  camera: FiCamera, calendar: FiCalendar, image: FiImage, ticket: FiTag,
  star: FiStar, globe: FiGlobe, whatsapp: SiWhatsapp, link: FiExternalLink,
};

const CACHE_KEY = 'snaphub_linktree_cache_v1';

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return null;
  }
};

const mergeProfile = (base, incoming) => ({
  ...base,
  ...incoming,
  concierge: { ...base.concierge, ...(incoming?.concierge || {}) },
});

const isLinkHost = () => typeof window !== 'undefined' && window.location.hostname.startsWith('link.');

// Di subdomain link., path relatif ("/#pricelist", "/live/x") harus mengarah ke situs utama.
const resolveHref = (url) => {
  const safe = safeUrl(url);
  return safe.startsWith('/') && isLinkHost() ? `https://snaphub.my.id${safe}` : safe;
};

// keepalive agar hitungan klik tetap terkirim walau halaman langsung berpindah.
const trackClick = (linkId) => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return;
  try {
    fetch(`${base}/rest/v1/rpc/track_link_click`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_link_id: linkId }),
    }).catch(() => {});
  } catch {
    /* pelacakan opsional */
  }
};

const LinkCard = ({ item }) => {
  const href = resolveHref(item.url);
  const external = /^https?:/i.test(href);
  const Icon = ICONS[item.icon] || FiCamera;
  const featured = !!item.isHighlighted;
  const newTab = item.openNewTab !== false || external;

  return (
    <a
      href={href}
      target={newTab ? '_blank' : '_self'}
      rel="noopener noreferrer"
      onClick={() => trackClick(item.id)}
      className={`group flex items-center gap-3.5 rounded-2xl p-3.5 min-h-[64px] border transition-all duration-200 active:scale-[0.99] ${
        featured
          ? 'bg-white text-zinc-950 border-white hover:bg-zinc-200'
          : 'bg-gradient-to-b from-[#1b1b1f] to-[#121214] border-white/10 hover:border-white/20 hover:from-[#222227] hover:to-[#17171a] shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
      }`}
    >
      <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center overflow-hidden ${featured ? 'bg-zinc-950/5' : 'bg-white/[0.06]'}`}>
        {item.logoUrl ? (
          <img src={item.logoUrl} alt="" loading="lazy" decoding="async" width="44" height="44" className="w-full h-full object-contain p-1.5" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <Icon size={19} aria-hidden="true" className={featured ? 'text-zinc-800' : 'text-zinc-300'} />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-[15px] leading-snug truncate">{item.title}</span>
          {item.badge && (
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${featured ? 'bg-zinc-950 text-white' : 'bg-white/10 text-zinc-200'}`}>{item.badge}</span>
          )}
        </span>
        {item.subtitle && <span className={`block text-sm leading-snug mt-0.5 truncate ${featured ? 'text-zinc-600' : 'text-zinc-400'}`}>{item.subtitle}</span>}
      </span>

      {external ? <FiExternalLink size={16} aria-hidden="true" className="shrink-0 opacity-60" /> : <FiArrowRight size={16} aria-hidden="true" className="shrink-0 opacity-60" />}
      {newTab && <span className="sr-only">(membuka tab baru)</span>}
    </a>
  );
};

const SectionTitle = ({ children }) => <span className="text-sm font-semibold text-zinc-400">{children}</span>;

const Linktree = () => {
  const cached = useMemo(readCache, []);
  const [profile, setProfile] = useState(() => mergeProfile(DEFAULT_LINKTREE_PROFILE, cached?.profile));
  const [links, setLinks] = useState(() => (cached?.links?.length ? cached.links : null));
  const [loading, setLoading] = useState(!cached);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.from('site_settings').select('value').eq('key', 'linktree').maybeSingle();
        if (!active) return;
        const value = data?.value;
        if (value) {
          if (value.profile) setProfile(mergeProfile(DEFAULT_LINKTREE_PROFILE, value.profile));
          if (Array.isArray(value.links) && value.links.length > 0) setLinks(value.links);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ profile: value.profile, links: value.links }));
          } catch {
            /* cache opsional */
          }
        }
      } catch (err) {
        console.warn('Gagal memuat linktree, memakai data bawaan:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (profile?.name) document.title = `${profile.name} · Link resmi`;
  }, [profile?.name]);

  const sections = useMemo(() => {
    const source = (links || DEFAULT_LINKS).filter((l) => l.isActive !== false);
    const groups = [];
    let current = null;
    source.forEach((item) => {
      if (item.type === 'header') {
        current = { header: item, links: [] };
        groups.push(current);
      } else {
        if (!current) {
          current = { header: null, links: [] };
          groups.push(current);
        }
        current.links.push(item);
      }
    });
    return groups;
  }, [links]);

  const isOpen = (header) => openSections[header.id] ?? header.defaultOpen !== false;
  const toggle = (header) => setOpenSections((prev) => ({ ...prev, [header.id]: !isOpen(header) }));

  const shareUrl = typeof window !== 'undefined' && window.location.hostname.includes('localhost') ? window.location.href : 'https://link.snaphub.my.id';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(shareUrl)}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: profile.name, text: profile.bio, url: shareUrl });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  const socials = (profile.socials || []).filter((s) => s.url?.trim());
  const concierge = profile.concierge || {};
  const headerBtn = 'inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-full text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/10 border border-white/10 transition-colors';

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0b0b0c] text-zinc-100 flex flex-col relative overflow-hidden">
      {/* Cahaya latar identik halaman antrian */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] sm:w-[40rem] sm:h-[40rem] rounded-full bg-[#D90429]/25 blur-[110px]" />

      <header className="w-full max-w-md mx-auto px-5 pt-5 flex items-center justify-end gap-2 relative">
        <button onClick={() => setQrOpen(true)} className={headerBtn} aria-label="Tampilkan QR code"><FiGrid size={15} /> QR</button>
        <button onClick={share} className={headerBtn}>
          {copied ? <FiCheck size={15} className="text-emerald-400" /> : <FiShare2 size={15} />}
          <span aria-live="polite">{copied ? 'Tersalin' : 'Bagikan'}</span>
        </button>
      </header>

      <main className="w-full max-w-md mx-auto px-5 pt-4 pb-8 flex-1 relative">
        <section className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-[#141416] border border-white/15 p-3 flex items-center justify-center overflow-hidden">
              <img src={profile.avatarUrl || '/icons.svg'} alt={profile.name} width="96" height="96" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = '/icons.svg'; }} />
            </div>
            {profile.verified && (
              <span title="Akun resmi" className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#D90429] border-2 border-[#0b0b0c] flex items-center justify-center text-white">
                <FiCheck size={12} strokeWidth={3} aria-hidden="true" />
                <span className="sr-only">Akun resmi terverifikasi</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight font-heading">{profile.name}</h1>
          {profile.handle && <p className="text-sm text-zinc-400 mt-0.5">{profile.handle}</p>}
          {profile.bio && <p className="text-[15px] text-zinc-300 mt-3 max-w-xs leading-relaxed">{profile.bio}</p>}

          {socials.length > 0 && (
            <div className="flex items-center justify-center gap-2.5 mt-5">
              {socials.map((social) => (
                <a
                  key={social.platform}
                  href={resolveHref(social.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label || social.platform}
                  className="w-11 h-11 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-zinc-200 flex items-center justify-center transition-colors"
                >
                  {social.platform === 'instagram' && <SiInstagram size={17} />}
                  {social.platform === 'tiktok' && <SiTiktok size={16} />}
                  {social.platform === 'whatsapp' && <SiWhatsapp size={17} />}
                  {social.platform === 'website' && <FiGlobe size={17} />}
                </a>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          {loading ? (
            <div className="space-y-3" role="status" aria-label="Memuat tautan">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : sections.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-10">Belum ada tautan aktif.</p>
          ) : (
            sections.map((group, i) => {
              if (!group.header) {
                return <div key={`g-${i}`} className="space-y-2.5">{group.links.map((l) => <LinkCard key={l.id} item={l} />)}</div>;
              }
              const dropdown = group.header.sectionType === 'dropdown';
              const open = dropdown ? isOpen(group.header) : true;
              const panelId = `sec-${group.header.id}`;
              return (
                <section key={group.header.id}>
                  {dropdown ? (
                    <button type="button" onClick={() => toggle(group.header)} aria-expanded={open} aria-controls={panelId} className="w-full flex items-center gap-3 py-2 text-left">
                      <SectionTitle>{group.header.title}</SectionTitle>
                      <span className="h-px flex-1 bg-white/10" />
                      <FiChevronDown size={16} aria-hidden="true" className={`text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      <h2 className="contents"><SectionTitle>{group.header.title}</SectionTitle></h2>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  )}
                  <div id={panelId} className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden" inert={!open}>
                      <div className="space-y-2.5 pt-2">
                        {group.links.length === 0 ? <p className="text-sm text-zinc-500 py-3 text-center">Belum ada tautan di bagian ini.</p> : group.links.map((l) => <LinkCard key={l.id} item={l} />)}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>

        {concierge.show !== false && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b1b1f] to-[#121214] p-5 flex items-center justify-between gap-3 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">{concierge.title || 'Konsultasi & reservasi acara'}</h2>
              {concierge.subtitle && <p className="text-sm text-zinc-400 mt-0.5 leading-snug">{concierge.subtitle}</p>}
            </div>
            <a
              href={resolveHref(concierge.buttonUrl || 'https://wa.me/6285190643459')}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-sm font-semibold transition-colors"
            >
              {concierge.buttonText || 'Hubungi WA'} <FiArrowRight size={14} aria-hidden="true" />
            </a>
          </section>
        )}
      </main>

      <footer className="py-6 text-center text-sm text-zinc-500 relative">
        <Link to="/" className="inline-flex items-center gap-2 hover:text-zinc-200 transition-colors">
          <img src="/icons.svg" alt="" className="h-4 w-4 opacity-70" /> SnapHub.id
        </Link>
      </footer>

      {qrOpen && (
        <Modal
          title="QR code halaman ini"
          description="Pindai dengan kamera HP untuk membuka link resmi SnapHub."
          size="sm"
          onClose={() => setQrOpen(false)}
          footer={<button onClick={share} className="ui-btn ui-btn-primary"><FiCopy size={14} /> {copied ? 'Tersalin' : 'Salin link'}</button>}
        >
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl">
              <img src={qrUrl} alt="QR code link.snaphub.my.id" width="176" height="176" className="w-44 h-44" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Linktree;
