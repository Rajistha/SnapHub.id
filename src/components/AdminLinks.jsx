import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FiPlus, FiTrash2, FiEdit2, FiEye, FiEyeOff, FiUpload, FiSearch, FiCheck,
  FiLink, FiCamera, FiCalendar, FiTag, FiStar, FiGlobe, FiShare2, FiSettings,
  FiImage, FiFolder,
} from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { DEFAULT_LINKTREE_PROFILE, DEFAULT_LINKS } from '../lib/linktreeDefaults';
import { removeUnusedFiles } from '../lib/storageCleanup';
import Modal from './ui/Modal';

const PRESET_ICONS = [
  { id: 'camera', label: 'Kamera', Icon: FiCamera },
  { id: 'calendar', label: 'Jadwal', Icon: FiCalendar },
  { id: 'image', label: 'Galeri', Icon: FiImage },
  { id: 'ticket', label: 'Pricelist', Icon: FiTag },
  { id: 'star', label: 'Unggulan', Icon: FiStar },
  { id: 'globe', label: 'Website', Icon: FiGlobe },
  { id: 'whatsapp', label: 'WhatsApp', Icon: FiShare2 },
  { id: 'link', label: 'Tautan', Icon: FiLink },
];

const SOCIALS = [
  { platform: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/62…' },
  { platform: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { platform: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { platform: 'website', label: 'Website (opsional)', placeholder: 'https://snaphub.my.id' },
];

const ALLOWED_IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

const EMPTY_FORM = {
  title: '', subtitle: '', url: '', badge: '', isHighlighted: false, openNewTab: true, isActive: true,
  logoUrl: '', clientLogoId: '', icon: 'camera', sectionId: '',
};

const isHeader = (item) => item.type === 'header';

// Url valid: http(s), mailto, tel, atau path internal. Tolak javascript:/data:.
const isValidUrl = (value) => {
  const v = value.trim();
  return v.startsWith('/') || v.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(v);
};

// Pindahkan satu item (link) atau satu blok section (header + link di bawahnya) naik/turun.
const moveItem = (list, id, dir) => {
  const idx = list.findIndex((l) => l.id === id);
  if (idx === -1) return list;
  const blockEnd = (start) => {
    let end = start + 1;
    while (end < list.length && !isHeader(list[end])) end += 1;
    return end;
  };
  const copy = [...list];

  if (!isHeader(list[idx])) {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return list;
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    return copy;
  }

  const headers = list.map((l, i) => (isHeader(l) ? i : -1)).filter((i) => i >= 0);
  const pos = headers.indexOf(idx);
  const neighbour = headers[pos + dir];
  if (neighbour === undefined) return list;
  const [aStart, aEnd] = dir < 0 ? [neighbour, blockEnd(neighbour)] : [idx, blockEnd(idx)];
  const [bStart, bEnd] = dir < 0 ? [idx, blockEnd(idx)] : [neighbour, blockEnd(neighbour)];
  return [...list.slice(0, aStart), ...list.slice(bStart, bEnd), ...list.slice(aStart, aEnd), ...list.slice(bEnd)];
};

const Field = ({ id, label, hint, children }) => (
  <div>
    <label htmlFor={id} className="ui-label">{label}</label>
    {children}
    {hint && <p className="ui-hint">{hint}</p>}
  </div>
);

const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="flex items-start gap-3 cursor-pointer py-1">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 accent-[var(--admin-primary)]" />
    <span className="text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="block text-[var(--admin-text-muted)]">{hint}</span>}
    </span>
  </label>
);

const AdminLinks = () => {
  const [profile, setProfile] = useState(DEFAULT_LINKTREE_PROFILE);
  const [links, setLinks] = useState(DEFAULT_LINKS);
  const [clicks, setClicks] = useState({});
  const [clientLogos, setClientLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(null);
  const [linkModal, setLinkModal] = useState(null); // { id|null }
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [logoTab, setLogoTab] = useState('client');
  const [logoSearch, setLogoSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sectionModal, setSectionModal] = useState(null); // { id|null }
  const [sectionForm, setSectionForm] = useState({ title: '', sectionType: 'normal', defaultOpen: true, isActive: true });
  const [toDelete, setToDelete] = useState(null);
  const fileInputRef = useRef(null);

  // Drag & drop urutan (mouse di seluruh baris, sentuhan lewat gagang)
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const touchIdRef = useRef(null);

  /* ── Muat data ─────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, logos, clickRows] = await Promise.all([
        supabase.from('site_settings').select('value').eq('key', 'linktree').maybeSingle(),
        supabase.from('client_logos').select('id, client_name, logo_url').order('created_at', { ascending: false }),
        supabase.from('link_clicks').select('link_id, clicks'),
      ]);

      const value = settings.data?.value;
      if (value?.profile) {
        const raw = value.profile;
        const current = Array.isArray(raw.socials) ? raw.socials : [];
        const merged = DEFAULT_LINKTREE_PROFILE.socials.map((def) => current.find((s) => s.platform === def.platform) || def);
        const extra = current.filter((s) => !DEFAULT_LINKTREE_PROFILE.socials.some((def) => def.platform === s.platform));
        setProfile({ ...DEFAULT_LINKTREE_PROFILE, ...raw, socials: [...merged, ...extra], concierge: { ...DEFAULT_LINKTREE_PROFILE.concierge, ...(raw.concierge || {}) } });
      }
      if (Array.isArray(value?.links) && value.links.length > 0) setLinks(value.links);
      if (logos.data) setClientLogos(logos.data);
      if (clickRows.data) setClicks(Object.fromEntries(clickRows.data.map((r) => [r.link_id, Number(r.clicks)])));
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat sebagian data link');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Peringatan bila meninggalkan halaman dengan perubahan yang belum disimpan.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = (nextLinks, nextProfile) => {
    if (nextLinks) setLinks(nextLinks);
    if (nextProfile) setProfile(nextProfile);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Hitungan klik disimpan di tabel terpisah; buang sisa field lama agar tidak menimpa.
      const cleanLinks = links.map(({ clicks: _legacy, ...rest }) => rest);
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'linktree', value: { profile, links: cleanLinks, updated_at: new Date().toISOString() } }, { onConflict: 'key' });
      if (error) throw error;
      try {
        localStorage.removeItem('snaphub_linktree_cache_v1');
      } catch {
        /* abaikan */
      }
      setDirty(false);
      toast.success('Tersimpan. Halaman bio sudah diperbarui.');
      // Hapus logo upload yang sudah tidak dipakai link/profil mana pun (abaikan yang baru <10 menit / sedang di form)
      removeUnusedFiles('client-logos', {
        prefix: 'linktree_logo_',
        inUse: [JSON.stringify({ profile, links: cleanLinks }), form.logoUrl],
        minAgeMs: 10 * 60 * 1000,
      });
    } catch (err) {
      console.error(err);
      toast.error(`Gagal menyimpan: ${err.message || 'cek koneksi internet'}`);
    } finally {
      setSaving(false);
    }
  };

  const reorder = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const from = links.findIndex((l) => l.id === fromId);
    const to = links.findIndex((l) => l.id === toId);
    if (from === -1 || to === -1) return;
    const next = [...links];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    edit(next);
  };

  const endDrag = () => {
    touchIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
  };

  const onDragStart = (e, id) => {
    if (e.target.closest('button, input, select, textarea, a')) {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const onTouchMove = (e) => {
    if (!touchIdRef.current) return;
    const touch = e.touches[0];
    const overId = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-link-id]')?.getAttribute('data-link-id');
    if (overId && overId !== touchIdRef.current) setDragOverId(overId);
  };

  const onTouchEnd = () => {
    reorder(touchIdRef.current, dragOverId);
    endDrag();
  };

  // Gagang juga bisa dioperasikan keyboard: panah atas/bawah memindahkan item.
  const onHandleKey = (e, id) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    edit(moveItem(links, id, e.key === 'ArrowUp' ? -1 : 1));
  };

  const discard = async () => {
    setDirty(false);
    await load();
  };

  /* ── Turunan ───────────────────────────────────────────── */
  const sections = useMemo(() => links.filter(isHeader), [links]);

  // Setiap link milik section terdekat di atasnya (sama seperti tampilan publik).
  const rows = useMemo(() => {
    let currentId = '';
    return links.map((item) => {
      if (isHeader(item)) currentId = item.id;
      return { item, sectionId: isHeader(item) ? item.id : currentId };
    });
  }, [links]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(({ item, sectionId }) => {
      if (sectionFilter !== 'all' && sectionId !== sectionFilter) return false;
      if (!needle) return true;
      return [item.title, item.subtitle, item.url].some((v) => (v || '').toLowerCase().includes(needle));
    });
  }, [rows, search, sectionFilter]);

  const linkItems = links.filter((l) => !isHeader(l));
  const activeCount = linkItems.filter((l) => l.isActive !== false).length;
  const totalClicks = Object.values(clicks).reduce((a, b) => a + b, 0);

  /* ── Link ──────────────────────────────────────────────── */
  const openLinkModal = (link = null) => {
    setFormError('');
    setLogoSearch('');
    if (link) {
      const owner = rows.find((r) => r.item.id === link.id)?.sectionId || '';
      setForm({
        title: link.title || '', subtitle: link.subtitle || '', url: link.url || '', badge: link.badge || '',
        isHighlighted: !!link.isHighlighted, openNewTab: link.openNewTab !== false, isActive: link.isActive !== false,
        logoUrl: link.logoUrl || '', clientLogoId: link.clientLogoId || '', icon: link.icon || 'camera', sectionId: owner,
      });
      setLogoTab(link.clientLogoId ? 'client' : link.logoUrl ? 'url' : 'icon');
      setLinkModal({ id: link.id });
    } else {
      setForm({ ...EMPTY_FORM, sectionId: sectionFilter !== 'all' ? sectionFilter : sections[0]?.id || '' });
      setLogoTab('client');
      setLinkModal({ id: null });
    }
  };

  const submitLink = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setFormError('Judul wajib diisi.');
    if (!form.url.trim()) return setFormError('URL tujuan wajib diisi.');
    if (!isValidUrl(form.url)) return setFormError('URL harus diawali https://, http://, mailto:, tel:, atau / untuk halaman internal.');
    if (form.logoUrl && !/^https?:\/\//i.test(form.logoUrl)) return setFormError('URL gambar harus diawali https://');

    const fields = {
      title: form.title.trim(), subtitle: form.subtitle.trim(), url: form.url.trim(), badge: form.badge.trim().toUpperCase().slice(0, 16),
      isHighlighted: form.isHighlighted, openNewTab: form.openNewTab, isActive: form.isActive,
      logoUrl: logoTab === 'icon' ? '' : form.logoUrl, clientLogoId: logoTab === 'client' ? form.clientLogoId : '', icon: form.icon,
    };

    if (linkModal.id) {
      edit(links.map((l) => (l.id === linkModal.id ? { ...l, ...fields } : l)));
    } else {
      const created = { id: `link_${Date.now()}`, ...fields };
      // Masuk di akhir section yang dipilih; tanpa section = paling atas.
      let insertAt = 0;
      const headerIdx = links.findIndex((l) => l.id === form.sectionId);
      if (headerIdx !== -1) {
        insertAt = headerIdx + 1;
        while (insertAt < links.length && !isHeader(links[insertAt])) insertAt += 1;
      }
      edit([...links.slice(0, insertAt), created, ...links.slice(insertAt)]);
    }
    setLinkModal(null);
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    const ext = ALLOWED_IMAGE_TYPES[file.type];
    if (!ext) return toast.error('Format harus PNG, JPG, WebP, atau GIF');
    if (file.size > 2 * 1024 * 1024) return toast.error('Ukuran logo maksimal 2MB');

    setUploading(true);
    try {
      const name = `linktree_logo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error } = await supabase.storage.from('client-logos').upload(name, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('client-logos').getPublicUrl(name);
      setForm((f) => ({ ...f, logoUrl: data.publicUrl, clientLogoId: '' }));
      toast.success('Logo diunggah');
    } catch (err) {
      console.error(err);
      toast.error(`Gagal mengunggah: ${err.message || 'cek koneksi'}`);
    } finally {
      setUploading(false);
    }
  };

  const resetClicks = async (id) => {
    const { error } = await supabase.from('link_clicks').delete().eq('link_id', id);
    if (error) return toast.error('Gagal mereset klik');
    setClicks((prev) => ({ ...prev, [id]: 0 }));
    toast.success('Hitungan klik direset');
  };

  /* ── Section ───────────────────────────────────────────── */
  const openSectionModal = (section = null) => {
    setSectionForm(
      section
        ? { title: section.title || '', sectionType: section.sectionType || 'normal', defaultOpen: section.defaultOpen !== false, isActive: section.isActive !== false }
        : { title: '', sectionType: 'normal', defaultOpen: true, isActive: true }
    );
    setSectionModal({ id: section?.id || null });
  };

  const submitSection = (e) => {
    e.preventDefault();
    if (!sectionForm.title.trim()) return toast.error('Judul section wajib diisi');
    const fields = { ...sectionForm, title: sectionForm.title.trim() };
    if (sectionModal.id) edit(links.map((l) => (l.id === sectionModal.id ? { ...l, ...fields } : l)));
    else edit([...links, { id: `header_${Date.now()}`, type: 'header', ...fields }]);
    setSectionModal(null);
  };

  const confirmDelete = () => {
    const target = toDelete;
    setToDelete(null);
    if (!target) return;
    // Menghapus section tidak menghapus link-nya; link ikut section di atasnya.
    edit(links.filter((l) => l.id !== target.id));
    if (!isHeader(target)) supabase.from('link_clicks').delete().eq('link_id', target.id).then(() => {}, () => {});
  };

  const toggleActive = (id) => edit(links.map((l) => (l.id === id ? { ...l, isActive: l.isActive === false } : l)));

  /* ── Profil ────────────────────────────────────────────── */
  const openProfile = () => {
    setProfileDraft(structuredClone(profile));
    setProfileOpen(true);
  };

  const socialValue = (platform) => profileDraft?.socials?.find((s) => s.platform === platform)?.url || '';
  const setSocial = (platform, label, url) =>
    setProfileDraft((p) => {
      const list = p.socials || [];
      return { ...p, socials: list.some((s) => s.platform === platform) ? list.map((s) => (s.platform === platform ? { ...s, url } : s)) : [...list, { platform, label, url }] };
    });
  const setConcierge = (patch) => setProfileDraft((p) => ({ ...p, concierge: { ...DEFAULT_LINKTREE_PROFILE.concierge, ...p.concierge, ...patch } }));

  const submitProfile = (e) => {
    e.preventDefault();
    const bad = (profileDraft.socials || []).find((s) => s.url?.trim() && !isValidUrl(s.url));
    if (bad) return toast.error(`URL ${bad.label || bad.platform} tidak valid`);
    if (profileDraft.concierge?.buttonUrl && !isValidUrl(profileDraft.concierge.buttonUrl)) return toast.error('URL tombol konsultasi tidak valid');
    edit(null, profileDraft);
    setProfileOpen(false);
  };

  const iconButton = 'ui-btn ui-btn-sm ui-btn-icon';

  return (
    <div className="space-y-5 pb-28">
      {/* Toolbar */}
      <div className="ui-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Daftar tautan</h2>
          <p className="text-sm text-[var(--admin-text-muted)] num">
            {linkItems.length} link · {activeCount} aktif · {totalClicks.toLocaleString('id-ID')} klik
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openProfile} className="ui-btn"><FiSettings size={14} /> Profil &amp; bio</button>
          <button onClick={() => openSectionModal()} className="ui-btn"><FiFolder size={14} /> Section baru</button>
          <button onClick={() => openLinkModal()} className="ui-btn ui-btn-primary"><FiPlus size={15} /> Tambah link</button>
        </div>
      </div>

      {/* Cari & filter section */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={15} aria-hidden="true" />
          <input type="search" aria-label="Cari link" placeholder="Cari judul atau URL" value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input pl-10" />
        </div>
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter section">
          <button className="ui-tab" aria-pressed={sectionFilter === 'all'} onClick={() => setSectionFilter('all')}>Semua</button>
          {sections.map((s) => (
            <button key={s.id} className="ui-tab" aria-pressed={sectionFilter === s.id} onClick={() => setSectionFilter(s.id)}>{s.title}</button>
          ))}
        </div>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="py-20 flex justify-center"><div className="w-8 h-8 border-[3px] border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="Memuat" /></div>
      ) : visibleRows.length === 0 ? (
        <div className="ui-card border-dashed p-10 text-center">
          <p className="font-medium">{search ? 'Tidak ada link yang cocok' : 'Belum ada link'}</p>
          {!search && <button onClick={() => openLinkModal()} className="ui-btn ui-btn-primary mt-4"><FiPlus size={15} /> Tambah link pertama</button>}
        </div>
      ) : (
        <ul className="ui-card divide-y divide-[var(--admin-border)] overflow-hidden">
          {visibleRows.map(({ item, sectionId }) => {
            const header = isHeader(item);
            const nested = !header && !!sectionId;
            const inactive = item.isActive === false;
            const Icon = PRESET_ICONS.find((p) => p.id === item.icon)?.Icon || FiLink;
            return (
              <li
                key={item.id}
                data-link-id={item.id}
                draggable
                onDragStart={(e) => onDragStart(e, item.id)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverId !== item.id) setDragOverId(item.id); }}
                onDragLeave={() => dragOverId === item.id && setDragOverId(null)}
                onDrop={(e) => { e.preventDefault(); reorder(draggedId, item.id); endDrag(); }}
                onDragEnd={endDrag}
                className={`relative p-3 sm:p-4 flex items-center gap-3 transition-colors ${nested ? 'pl-8 sm:pl-12' : ''} ${header ? 'bg-[var(--admin-hover-bg)]' : ''} ${inactive ? 'opacity-60' : ''} ${draggedId === item.id ? 'opacity-30' : ''} ${dragOverId === item.id && draggedId !== item.id ? 'outline outline-2 -outline-offset-2 outline-[var(--admin-primary)] bg-[var(--admin-hover-bg)]' : ''}`}
              >
                {nested && <span aria-hidden="true" className="absolute left-4 sm:left-6 top-0 bottom-0 w-px bg-[var(--admin-border)]" />}
                <button
                  type="button"
                  className="p-1.5 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] cursor-grab active:cursor-grabbing touch-none select-none shrink-0 rounded-lg hover:bg-[var(--admin-hover-bg)]"
                  aria-label={`Pindahkan ${item.title}. Tahan dan geser, atau gunakan panah atas dan bawah.`}
                  title="Tahan & geser untuk memindahkan urutan"
                  onKeyDown={(e) => onHandleKey(e, item.id)}
                  onTouchStart={() => { touchIdRef.current = item.id; setDraggedId(item.id); }}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor" aria-hidden="true">
                    <circle cx="4" cy="3" r="1.6" /><circle cx="10" cy="3" r="1.6" />
                    <circle cx="4" cy="9" r="1.6" /><circle cx="10" cy="9" r="1.6" />
                    <circle cx="4" cy="15" r="1.6" /><circle cx="10" cy="15" r="1.6" />
                  </svg>
                </button>

                {header ? (
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--admin-text-muted)]">Section · {item.sectionType === 'dropdown' ? 'dropdown' : 'biasa'}</p>
                    <p className="font-semibold truncate">{item.title}</p>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 shrink-0 rounded-lg bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] flex items-center justify-center overflow-hidden">
                      {item.logoUrl ? <img src={item.logoUrl} alt="" loading="lazy" className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <Icon size={18} className="text-[var(--admin-text-muted)]" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {item.title}
                        {item.isHighlighted && <span className="ui-tag ml-2 align-middle">Unggulan</span>}
                        {item.badge && <span className="ui-tag ml-2 align-middle">{item.badge}</span>}
                      </p>
                      <p className="text-sm text-[var(--admin-text-muted)] truncate">
                        <span className="font-mono">{item.url}</span> · <span className="num">{clicks[item.id] || 0} klik</span>
                      </p>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(item.id)} className={iconButton} aria-pressed={!inactive} aria-label={inactive ? `Aktifkan ${item.title}` : `Nonaktifkan ${item.title}`} title={inactive ? 'Nonaktif' : 'Aktif'}>
                    {inactive ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                  <button onClick={() => (header ? openSectionModal(item) : openLinkModal(item))} className={iconButton} aria-label={`Edit ${item.title}`}><FiEdit2 size={14} /></button>
                  <button onClick={() => setToDelete(item)} className={`${iconButton} ui-btn-ghost`} aria-label={`Hapus ${item.title}`}><FiTrash2 size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Bilah simpan: perubahan baru tayang setelah disimpan */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]" role="region" aria-label="Perubahan belum disimpan">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Ada perubahan yang belum disimpan</p>
            <div className="flex gap-2">
              <button onClick={discard} disabled={saving} className="ui-btn ui-btn-sm">Buang</button>
              <button onClick={save} disabled={saving} className="ui-btn ui-btn-sm ui-btn-primary">{saving ? 'Menyimpan…' : 'Simpan & tayangkan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal link ── */}
      {linkModal && (
        <Modal
          title={linkModal.id ? 'Edit link' : 'Tambah link'}
          size="lg"
          onClose={() => setLinkModal(null)}
          footer={
            <>
              {linkModal.id && <button type="button" onClick={() => resetClicks(linkModal.id)} className="ui-btn ui-btn-ghost sm:mr-auto">Reset klik ({clicks[linkModal.id] || 0})</button>}
              <button type="button" onClick={() => setLinkModal(null)} className="ui-btn">Batal</button>
              <button type="submit" form="link-form" className="ui-btn ui-btn-primary">{linkModal.id ? 'Simpan' : 'Tambahkan'}</button>
            </>
          }
        >
          <form id="link-form" onSubmit={submitLink} className="space-y-4" noValidate>
            <Field id="l-title" label="Judul">
              <input id="l-title" className="ui-input" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Wisuda UB Periode VII · Softfile" />
            </Field>
            <Field id="l-sub" label="Deskripsi singkat (opsional)">
              <input id="l-sub" className="ui-input" value={form.subtitle} maxLength={120} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </Field>
            <Field id="l-url" label="URL tujuan" hint="Contoh: https://drive.google.com/…, https://wa.me/62…, atau /live/nama-event">
              <input id="l-url" className="ui-input font-mono" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!linkModal.id && (
                <Field id="l-section" label="Masuk ke section">
                  <select id="l-section" className="ui-input" value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
                    <option value="">Paling atas (tanpa section)</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </Field>
              )}
              <Field id="l-badge" label="Label kecil (opsional)" hint="Contoh: BARU, PROMO">
                <input id="l-badge" className="ui-input" value={form.badge} maxLength={16} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
              </Field>
            </div>

            {/* Logo */}
            <fieldset className="rounded-xl border border-[var(--admin-border)] p-4 space-y-3">
              <legend className="px-1 text-sm font-semibold">Logo atau ikon</legend>
              <div className="flex gap-1 overflow-x-auto" role="tablist">
                {[['client', `Client logo (${clientLogos.length})`], ['upload', 'Unggah'], ['url', 'URL gambar'], ['icon', 'Ikon']].map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={logoTab === id} onClick={() => setLogoTab(id)} className="ui-tab">{label}</button>
                ))}
              </div>

              {logoTab === 'client' && (
                clientLogos.length === 0 ? (
                  <p className="text-sm text-[var(--admin-text-muted)]">Belum ada client logo. Tambahkan di menu Client Logos.</p>
                ) : (
                  <>
                    <input type="search" aria-label="Cari client logo" placeholder="Cari client logo" className="ui-input" value={logoSearch} onChange={(e) => setLogoSearch(e.target.value)} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {clientLogos.filter((c) => (c.client_name || '').toLowerCase().includes(logoSearch.toLowerCase())).map((c) => {
                        const selected = form.clientLogoId === c.id;
                        return (
                          <button key={c.id} type="button" onClick={() => setForm((f) => ({ ...f, clientLogoId: c.id, logoUrl: c.logo_url, title: f.title.trim() ? f.title : c.client_name }))} aria-pressed={selected}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-left ${selected ? 'border-[var(--admin-primary)] bg-[var(--admin-hover-bg)]' : 'border-[var(--admin-border)] hover:bg-[var(--admin-hover-bg)]'}`}>
                            <img src={c.logo_url} alt="" loading="lazy" className="w-8 h-8 object-contain shrink-0" />
                            <span className="text-sm truncate flex-1">{c.client_name}</span>
                            {selected && <FiCheck size={14} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )
              )}

              {logoTab === 'upload' && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} className="sr-only" id="l-file" />
                  <label htmlFor="l-file" className="ui-btn w-full border-dashed cursor-pointer"><FiUpload size={15} /> {uploading ? 'Mengunggah…' : 'Pilih gambar (PNG, JPG, WebP, GIF · maks 2MB)'}</label>
                  {form.logoUrl && <img src={form.logoUrl} alt="Pratinjau logo" className="mt-3 w-16 h-16 object-contain rounded-lg border border-[var(--admin-border)]" />}
                </div>
              )}

              {logoTab === 'url' && (
                <input type="url" aria-label="URL gambar" className="ui-input" placeholder="https://domain.com/logo.png" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value, clientLogoId: '' })} />
              )}

              {logoTab === 'icon' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_ICONS.map(({ id, label, Icon }) => (
                    <button key={id} type="button" aria-pressed={form.icon === id} onClick={() => setForm({ ...form, icon: id, logoUrl: '', clientLogoId: '' })}
                      className={`ui-btn ${form.icon === id ? 'border-[var(--admin-primary)] bg-[var(--admin-hover-bg)]' : ''}`}><Icon size={15} /> {label}</button>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="border-t border-[var(--admin-border)] pt-3">
              <Toggle checked={form.isHighlighted} onChange={(v) => setForm({ ...form, isHighlighted: v })} label="Link unggulan" hint="Tampil sebagai kartu putih yang menonjol." />
              <Toggle checked={form.openNewTab} onChange={(v) => setForm({ ...form, openNewTab: v })} label="Buka di tab baru" />
              <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Tampilkan di halaman publik" />
            </div>

            {formError && <p role="alert" className="text-sm text-[var(--admin-danger)]">{formError}</p>}
          </form>
        </Modal>
      )}

      {/* ── Modal section ── */}
      {sectionModal && (
        <Modal
          title={sectionModal.id ? 'Edit section' : 'Section baru'}
          description="Section mengelompokkan link di bawahnya pada halaman bio."
          onClose={() => setSectionModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setSectionModal(null)} className="ui-btn">Batal</button>
              <button type="submit" form="section-form" className="ui-btn ui-btn-primary">{sectionModal.id ? 'Simpan' : 'Tambahkan'}</button>
            </>
          }
        >
          <form id="section-form" onSubmit={submitSection} className="space-y-4">
            <Field id="s-title" label="Judul section">
              <input id="s-title" className="ui-input" value={sectionForm.title} maxLength={60} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="Event & Kegiatan" />
            </Field>
            <fieldset>
              <legend className="ui-label">Tampilan</legend>
              <div className="grid grid-cols-2 gap-2">
                {[['normal', 'Biasa', 'Link selalu terlihat.'], ['dropdown', 'Dropdown', 'Pengunjung buka-tutup.']].map(([value, label, hint]) => (
                  <button key={value} type="button" aria-pressed={sectionForm.sectionType === value} onClick={() => setSectionForm({ ...sectionForm, sectionType: value })}
                    className={`text-left p-3 rounded-xl border ${sectionForm.sectionType === value ? 'border-[var(--admin-primary)] bg-[var(--admin-hover-bg)]' : 'border-[var(--admin-border)] hover:bg-[var(--admin-hover-bg)]'}`}>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-sm text-[var(--admin-text-muted)]">{hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {sectionForm.sectionType === 'dropdown' && <Toggle checked={sectionForm.defaultOpen} onChange={(v) => setSectionForm({ ...sectionForm, defaultOpen: v })} label="Terbuka saat halaman dimuat" />}
            <Toggle checked={sectionForm.isActive} onChange={(v) => setSectionForm({ ...sectionForm, isActive: v })} label="Tampilkan di halaman publik" />
          </form>
        </Modal>
      )}

      {/* ── Modal profil ── */}
      {profileOpen && profileDraft && (
        <Modal
          title="Profil & bio"
          description="Tampilan bagian atas halaman link.snaphub.my.id."
          size="lg"
          onClose={() => setProfileOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setProfileOpen(false)} className="ui-btn">Batal</button>
              <button type="submit" form="profile-form" className="ui-btn ui-btn-primary">Terapkan</button>
            </>
          }
        >
          <form id="profile-form" onSubmit={submitProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="p-name" label="Nama brand">
                <input id="p-name" required className="ui-input" value={profileDraft.name} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} />
              </Field>
              <Field id="p-handle" label="Handle">
                <input id="p-handle" className="ui-input" value={profileDraft.handle || ''} onChange={(e) => setProfileDraft({ ...profileDraft, handle: e.target.value })} placeholder="@snaphub.id" />
              </Field>
            </div>
            <Field id="p-bio" label="Bio">
              <textarea id="p-bio" rows={2} className="ui-input resize-none" value={profileDraft.bio || ''} onChange={(e) => setProfileDraft({ ...profileDraft, bio: e.target.value })} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SOCIALS.map((s) => (
                <Field key={s.platform} id={`p-${s.platform}`} label={s.label}>
                  <input id={`p-${s.platform}`} className="ui-input" inputMode="url" value={socialValue(s.platform)} onChange={(e) => setSocial(s.platform, s.label, e.target.value)} placeholder={s.placeholder} />
                </Field>
              ))}
            </div>

            <div className="border-t border-[var(--admin-border)] pt-4 space-y-3">
              <Toggle checked={profileDraft.concierge?.show !== false} onChange={(v) => setConcierge({ show: v })} label="Tampilkan kotak konsultasi di bawah daftar link" />
              {profileDraft.concierge?.show !== false && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field id="c-title" label="Judul"><input id="c-title" className="ui-input" value={profileDraft.concierge?.title ?? ''} onChange={(e) => setConcierge({ title: e.target.value })} /></Field>
                  <Field id="c-btn" label="Teks tombol"><input id="c-btn" className="ui-input" value={profileDraft.concierge?.buttonText ?? ''} onChange={(e) => setConcierge({ buttonText: e.target.value })} /></Field>
                  <Field id="c-sub" label="Deskripsi"><input id="c-sub" className="ui-input" value={profileDraft.concierge?.subtitle ?? ''} onChange={(e) => setConcierge({ subtitle: e.target.value })} /></Field>
                  <Field id="c-url" label="URL tombol"><input id="c-url" className="ui-input" inputMode="url" value={profileDraft.concierge?.buttonUrl ?? ''} onChange={(e) => setConcierge({ buttonUrl: e.target.value })} /></Field>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title={isHeader(toDelete) ? 'Hapus section?' : 'Hapus link?'}
          description={isHeader(toDelete) ? `Section “${toDelete.title}” dihapus. Link di dalamnya tetap ada dan ikut section di atasnya.` : `“${toDelete.title}” akan hilang dari halaman bio setelah Anda menyimpan.`}
          size="sm"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button onClick={() => setToDelete(null)} className="ui-btn">Batal</button>
              <button onClick={confirmDelete} className="ui-btn ui-btn-solid-danger">Hapus</button>
            </>
          }
        />
      )}
    </div>
  );
};

export default AdminLinks;
