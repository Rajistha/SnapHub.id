import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  FiPlus, FiTrash2, FiEdit2, 
  FiExternalLink, FiEye, FiEyeOff, FiSave, FiUpload, 
  FiImage, FiSearch, FiCheck, FiX, FiLink, FiCamera, 
  FiCalendar, FiTag, FiStar, FiGlobe, FiRefreshCw,
  FiShare2, FiSettings, FiSliders, FiChevronDown, FiFolder, FiList
} from 'react-icons/fi';
import { DEFAULT_LINKTREE_PROFILE, DEFAULT_LINKS, LINK_CATEGORIES } from '../lib/linktreeDefaults';

// Preset icon list for links without image logo
const PRESET_ICONS = [
  { id: 'camera', label: 'Kamera', icon: <FiCamera /> },
  { id: 'calendar', label: 'Jadwal', icon: <FiCalendar /> },
  { id: 'image', label: 'Galeri', icon: <FiImage /> },
  { id: 'ticket', label: 'Pricelist', icon: <FiTag /> },
  { id: 'star', label: 'Unggulan', icon: <FiStar /> },
  { id: 'globe', label: 'Website', icon: <FiGlobe /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <FiShare2 /> },
  { id: 'link', label: 'Tautan', icon: <FiLink /> }
];

const AdminLinks = () => {
  // State
  const [profile, setProfile] = useState(DEFAULT_LINKTREE_PROFILE);
  const [links, setLinks] = useState(DEFAULT_LINKS);
  const [clientLogos, setClientLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Section / Header State
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [formSectionTitle, setFormSectionTitle] = useState('');
  const [formSectionActive, setFormSectionActive] = useState(true);
  const [formSectionType, setFormSectionType] = useState('normal'); // 'normal' | 'dropdown'
  const [formSectionDefaultOpen, setFormSectionDefaultOpen] = useState(true);

  // Drag and Drop State
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const touchItemIdRef = useRef(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCategory, setFormCategory] = useState('Event & Kegiatan');
  const [formBadge, setFormBadge] = useState('');
  const [formIsHighlighted, setFormIsHighlighted] = useState(false);
  const [formIsOpenNewTab, setFormIsOpenNewTab] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);

  // Logo selection mode: 'client_logo' | 'upload' | 'url' | 'icon'
  const [logoTab, setLogoTab] = useState('client_logo');
  const [selectedLogoUrl, setSelectedLogoUrl] = useState('');
  const [selectedClientLogoId, setSelectedClientLogoId] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('camera');
  const [clientLogoSearch, setClientLogoSearch] = useState('');
  const fileInputRef = useRef(null);

  // Load data from Supabase
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch site_settings with key 'linktree'
      const { data: settingsData, error: settingsError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'linktree')
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.warn('Gagal load linktree settings:', settingsError);
      }

      if (settingsData?.value) {
        if (settingsData.value.profile) {
          const rawProfile = settingsData.value.profile;
          const currentSocials = Array.isArray(rawProfile.socials) ? rawProfile.socials : [];
          // Pastikan semua platform bawaan (whatsapp, instagram, tiktok, website) ada
          const mergedSocials = DEFAULT_LINKTREE_PROFILE.socials.map(def => {
            const found = currentSocials.find(s => s.platform === def.platform);
            return found || def;
          });
          const extra = currentSocials.filter(s => !DEFAULT_LINKTREE_PROFILE.socials.some(def => def.platform === s.platform));

          setProfile({
            ...DEFAULT_LINKTREE_PROFILE,
            ...rawProfile,
            socials: [...mergedSocials, ...extra],
            concierge: {
              ...DEFAULT_LINKTREE_PROFILE.concierge,
              ...(rawProfile.concierge || {})
            }
          });
        }
        if (Array.isArray(settingsData.value.links) && settingsData.value.links.length > 0) {
          setLinks(settingsData.value.links);
        }
      }

      // 2. Fetch Client Logos from client_logos table
      const { data: logosData, error: logosError } = await supabase
        .from('client_logos')
        .select('id, client_name, logo_url, instagram_url')
        .order('created_at', { ascending: false });

      if (logosError) {
        console.warn('Gagal load client logos:', logosError);
      } else if (logosData) {
        setClientLogos(logosData);
      }
    } catch (err) {
      console.error('Error fetching admin links data:', err);
      toast.error('Gagal memuat beberapa data linktree');
    } finally {
      setLoading(false);
    }
  };

  // Save current profile & links to Supabase
  const persistChanges = async (newLinks = links, newProfile = profile) => {
    setSaving(true);
    try {
      const payload = {
        key: 'linktree',
        value: {
          profile: newProfile,
          links: newLinks,
          updated_at: new Date().toISOString()
        }
      };

      const { error } = await supabase
        .from('site_settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) throw error;
      toast.success('Perubahan berhasil disimpan ke website!');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Gagal menyimpan: ' + (err.message || 'Cek koneksi internet'));
    } finally {
      setSaving(false);
    }
  };

  // Reordering links via Drag & Drop
  const handleDragStart = (e, id) => {
    if (e.target.closest('button, input, select, textarea, a')) {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = (e, id) => {
    if (dragOverId === id) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const fromIndex = links.findIndex(l => l.id === draggedId);
    const toIndex = links.findIndex(l => l.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...links];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      setLinks(updated);
      persistChanges(updated, profile);
      toast.success('Urutan tautan berhasil dipindahkan!');
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Touch drag support for mobile devices
  const handleTouchStart = (e, id) => {
    touchItemIdRef.current = id;
    setDraggedId(id);
  };

  const handleTouchMove = (e) => {
    if (!touchItemIdRef.current) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemContainer = targetEl?.closest('[data-link-id]');
    if (itemContainer) {
      const overId = itemContainer.getAttribute('data-link-id');
      if (overId && overId !== touchItemIdRef.current) {
        setDragOverId(overId);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchItemIdRef.current && dragOverId && touchItemIdRef.current !== dragOverId) {
      const fromIndex = links.findIndex(l => l.id === touchItemIdRef.current);
      const toIndex = links.findIndex(l => l.id === dragOverId);
      if (fromIndex !== -1 && toIndex !== -1) {
        const updated = [...links];
        const [movedItem] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, movedItem);
        setLinks(updated);
        persistChanges(updated, profile);
        toast.success('Urutan tautan berhasil dipindahkan!');
      }
    }
    touchItemIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
  };

  // Toggle active status directly
  const toggleActive = (id) => {
    const updated = links.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l);
    setLinks(updated);
    persistChanges(updated, profile);
    const linkObj = links.find(l => l.id === id);
    toast.success(`Link "${linkObj?.title}" ${!linkObj?.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
  };

  // Reset click count
  const resetClicks = (id) => {
    const updated = links.map(l => l.id === id ? { ...l, clicks: 0 } : l);
    setLinks(updated);
    persistChanges(updated, profile);
    toast.success('Jumlah klik di-reset');
  };

  // Delete Link
  const handleDeleteLink = (id) => {
    const updated = links.filter(l => l.id !== id);
    setLinks(updated);
    persistChanges(updated, profile);
    setDeleteConfirmId(null);
    toast.success('Link berhasil dihapus');
  };

  // Open modal for Add or Edit
  const openModal = (link = null) => {
    if (link) {
      setEditingLink(link);
      setFormTitle(link.title || '');
      setFormSubtitle(link.subtitle || '');
      setFormUrl(link.url || '');
      setFormCategory(link.category || 'Event & Kegiatan');
      setFormBadge(link.badge || '');
      setFormIsHighlighted(!!link.isHighlighted);
      setFormIsOpenNewTab(link.openNewTab !== false);
      setFormIsActive(link.isActive !== false);

      setSelectedLogoUrl(link.logoUrl || '');
      setSelectedClientLogoId(link.clientLogoId || '');
      setSelectedIcon(link.icon || 'camera');

      // Determine initial tab
      if (link.clientLogoId) {
        setLogoTab('client_logo');
      } else if (link.logoUrl) {
        setLogoTab('url');
      } else {
        setLogoTab('icon');
      }
    } else {
      setEditingLink(null);
      setFormTitle('');
      setFormSubtitle('');
      setFormUrl('');
      setFormCategory('Event & Kegiatan');
      setFormBadge('');
      setFormIsHighlighted(false);
      setFormIsOpenNewTab(true);
      setFormIsActive(true);

      setSelectedLogoUrl('');
      setSelectedClientLogoId('');
      setSelectedIcon('camera');
      setLogoTab('client_logo');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLink(null);
  };

  // Handle Logo Upload to Supabase Storage
  const handleUploadLogoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran logo maksimal 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `linktree_logo_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(fileName);

      setSelectedLogoUrl(publicUrl);
      setSelectedClientLogoId('');
      toast.success('Logo berhasil diunggah!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Gagal mengunggah gambar: ' + (err.message || 'Cek koneksi'));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Select a logo from existing Client Logos
  const handleSelectClientLogo = (client) => {
    setSelectedClientLogoId(client.id);
    setSelectedLogoUrl(client.logo_url);
    // If title is currently blank, propose client name
    if (!formTitle.trim()) {
      setFormTitle(client.client_name);
    }
    toast.success(`Logo "${client.client_name}" dipilih!`);
  };

  // Save Modal Form (Create or Update)
  const handleSaveModal = (e) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      toast.error('Judul link atau nama kegiatan wajib diisi!');
      return;
    }
    if (!formUrl.trim()) {
      toast.error('URL tujuan wajib diisi!');
      return;
    }

    let finalLogoUrl = '';
    let finalClientLogoId = '';
    let finalIcon = selectedIcon;

    if (logoTab === 'client_logo') {
      finalLogoUrl = selectedLogoUrl;
      finalClientLogoId = selectedClientLogoId;
    } else if (logoTab === 'upload' || logoTab === 'url') {
      finalLogoUrl = selectedLogoUrl;
      finalClientLogoId = '';
    } else {
      // icon mode
      finalLogoUrl = '';
      finalClientLogoId = '';
      finalIcon = selectedIcon;
    }

    if (editingLink) {
      // Update existing
      const updated = links.map(l => {
        if (l.id === editingLink.id) {
          return {
            ...l,
            title: formTitle.trim(),
            subtitle: formSubtitle.trim(),
            url: formUrl.trim(),
            category: formCategory,
            badge: formBadge.trim().toUpperCase(),
            isHighlighted: formIsHighlighted,
            openNewTab: formIsOpenNewTab,
            isActive: formIsActive,
            logoUrl: finalLogoUrl,
            clientLogoId: finalClientLogoId,
            icon: finalIcon
          };
        }
        return l;
      });
      setLinks(updated);
      persistChanges(updated, profile);
      toast.success('Link berhasil diperbarui!');
    } else {
      // Add new
      const newLink = {
        id: 'link_' + Date.now(),
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        url: formUrl.trim(),
        category: formCategory,
        badge: formBadge.trim().toUpperCase(),
        isHighlighted: formIsHighlighted,
        openNewTab: formIsOpenNewTab,
        isActive: formIsActive,
        logoUrl: finalLogoUrl,
        clientLogoId: finalClientLogoId,
        icon: finalIcon,
        clicks: 0
      };
      const updated = [newLink, ...links];
      setLinks(updated);
      persistChanges(updated, profile);
      toast.success('Link baru berhasil ditambahkan!');
    }

    closeModal();
  };

  // Section Modal Handlers
  const openSectionModal = (sec = null) => {
    if (sec) {
      setEditingSection(sec);
      setFormSectionTitle(sec.title || '');
      setFormSectionActive(sec.isActive !== false);
      setFormSectionType(sec.sectionType || 'normal');
      setFormSectionDefaultOpen(sec.defaultOpen !== false);
    } else {
      setEditingSection(null);
      setFormSectionTitle('');
      setFormSectionActive(true);
      setFormSectionType('normal');
      setFormSectionDefaultOpen(true);
    }
    setIsSectionModalOpen(true);
  };

  const closeSectionModal = () => {
    setIsSectionModalOpen(false);
    setEditingSection(null);
  };

  const handleSaveSection = (e) => {
    e.preventDefault();
    if (!formSectionTitle.trim()) {
      toast.error('Judul section wajib diisi!');
      return;
    }

    if (editingSection) {
      const updated = links.map(item => {
        if (item.id === editingSection.id) {
          return {
            ...item,
            title: formSectionTitle.trim(),
            isActive: formSectionActive,
            sectionType: formSectionType,
            defaultOpen: formSectionDefaultOpen
          };
        }
        return item;
      });
      setLinks(updated);
      persistChanges(updated, profile);
      toast.success('Section berhasil diperbarui!');
    } else {
      const newSection = {
        id: 'header_' + Date.now(),
        type: 'header',
        title: formSectionTitle.trim(),
        isActive: formSectionActive,
        sectionType: formSectionType,
        defaultOpen: formSectionDefaultOpen
      };
      const updated = [...links, newSection];
      setLinks(updated);
      persistChanges(updated, profile);
      toast.success('Section baru berhasil ditambahkan!');
    }
    closeSectionModal();
  };

  // Save Profile settings
  const handleSaveProfile = (e) => {
    e.preventDefault();
    persistChanges(links, profile);
    setIsProfileOpen(false);
  };

  // Filter links for display in admin
  const filteredLinks = links.filter(l => {
    const matchSearch = l.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        l.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        l.url?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = categoryFilter === 'Semua' || l.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const activeCount = links.filter(l => l.isActive).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Top Bar: Title & Stats ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--admin-surface)] border border-[var(--admin-border)] p-4 sm:p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D90429]/15 text-[#D90429] flex items-center justify-center text-xl font-bold shrink-0">
              <FiLink />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[var(--admin-text-main)] font-heading">
                Kelola Linktree & Bio Links
              </h1>
              <p className="text-xs text-[var(--admin-text-muted)] mt-0.5 line-clamp-2 sm:line-clamp-none">
                Atur tautan kegiatan, logo sponsor/klien, promo, dan menu profil untuk pengunjung.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-hover-bg)] text-[var(--admin-text-main)] hover:border-[#D90429]/40 text-xs sm:text-sm font-medium transition-all cursor-pointer"
          >
            <FiSettings className="text-[#D90429] shrink-0" size={14} />
            <span className="truncate">Pengaturan Bio</span>
          </button>

          <a
            href="/links"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-hover-bg)] text-[var(--admin-text-main)] hover:border-[#D90429]/40 text-xs sm:text-sm font-medium transition-all"
          >
            <FiExternalLink className="shrink-0" size={14} />
            <span className="truncate">Buka Bio</span>
          </a>

          <button
            onClick={() => openSectionModal()}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-hover-bg)] text-[var(--admin-text-main)] hover:border-[#D90429]/40 text-xs sm:text-sm font-medium transition-all cursor-pointer"
          >
            <FiTag className="text-[#D90429] shrink-0" size={14} />
            <span className="truncate">+ Section</span>
          </button>

          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[#D90429]/25 transition-all cursor-pointer"
          >
            <FiPlus size={16} className="shrink-0" />
            <span className="truncate">+ Link Baru</span>
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-3 sm:p-4 rounded-xl">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider block truncate">Total Link</span>
          <p className="text-xl sm:text-2xl font-bold text-[var(--admin-text-main)] mt-0.5 sm:mt-1">{links.length}</p>
        </div>
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-3 sm:p-4 rounded-xl">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider block truncate">Link Aktif</span>
          <p className="text-xl sm:text-2xl font-bold text-emerald-500 mt-0.5 sm:mt-1">{activeCount}</p>
        </div>
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-3 sm:p-4 rounded-xl">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider block truncate">Total Klik</span>
          <p className="text-xl sm:text-2xl font-bold text-[var(--admin-text-main)] mt-0.5 sm:mt-1">{totalClicks.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-3 sm:p-4 rounded-xl">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider block truncate">Client Logos</span>
          <p className="text-xl sm:text-2xl font-bold text-amber-500 mt-0.5 sm:mt-1">{clientLogos.length}</p>
        </div>
      </div>

      {/* ── Profile Settings Drawer / Panel ── */}
      <div
        style={{
          maxHeight: isProfileOpen ? '2000px' : '0px',
          opacity: isProfileOpen ? 1 : 0,
          overflow: 'hidden',
          transition: isProfileOpen
            ? 'max-height 0.4s ease, opacity 0.25s ease'
            : 'max-height 0.3s ease, opacity 0.2s ease'
        }}
      >
        {isProfileOpen && (
          <div className="bg-[var(--admin-surface)] border border-[#D90429]/30 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[var(--admin-text-main)] flex items-center gap-2">
                <FiSliders className="text-[#D90429]" />
                Pengaturan Tampilan Halaman Bio / Linktree
              </h3>
              <button
                onClick={() => setIsProfileOpen(false)}
                className="text-[var(--admin-text-muted)] hover:text-white p-1 rounded-lg"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                    Nama Profil / Brand
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    placeholder="SnapHub Photobooth"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                    Handle (@)
                  </label>
                  <input
                    type="text"
                    value={profile.handle}
                    onChange={(e) => setProfile({ ...profile, handle: e.target.value })}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    placeholder="@snaphub.id"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                  Bio / Tagline
                </label>
                <textarea
                  rows={2}
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                  placeholder="Photobooth Malang & Jawa Timur • Instant Prints & Digital Memories ✨"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                    URL WhatsApp
                  </label>
                  <input
                    type="text"
                    value={profile.socials?.find(s => s.platform === 'whatsapp')?.url || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const exists = profile.socials?.some(s => s.platform === 'whatsapp');
                      const updated = exists
                        ? profile.socials.map(s => s.platform === 'whatsapp' ? { ...s, url: val } : s)
                        : [...(profile.socials || []), { platform: 'whatsapp', url: val, label: 'WhatsApp' }];
                      setProfile({ ...profile, socials: updated });
                    }}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    placeholder="https://wa.me/..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                    URL Instagram
                  </label>
                  <input
                    type="text"
                    value={profile.socials?.find(s => s.platform === 'instagram')?.url || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const exists = profile.socials?.some(s => s.platform === 'instagram');
                      const updated = exists
                        ? profile.socials.map(s => s.platform === 'instagram' ? { ...s, url: val } : s)
                        : [...(profile.socials || []), { platform: 'instagram', url: val, label: 'Instagram' }];
                      setProfile({ ...profile, socials: updated });
                    }}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5">
                    URL TikTok
                  </label>
                  <input
                    type="text"
                    value={profile.socials?.find(s => s.platform === 'tiktok')?.url || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const exists = profile.socials?.some(s => s.platform === 'tiktok');
                      const updated = exists
                        ? profile.socials.map(s => s.platform === 'tiktok' ? { ...s, url: val } : s)
                        : [...(profile.socials || []), { platform: 'tiktok', url: val, label: 'TikTok' }];
                      setProfile({ ...profile, socials: updated });
                    }}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    placeholder="https://tiktok.com/@..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1.5 flex items-center justify-between">
                    <span>URL Website</span>
                    <span className="text-[10px] lowercase font-normal text-zinc-500">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={profile.socials?.find(s => s.platform === 'website')?.url || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const exists = profile.socials?.some(s => s.platform === 'website');
                      const updated = exists
                        ? profile.socials.map(s => s.platform === 'website' ? { ...s, url: val } : s)
                        : [...(profile.socials || []), { platform: 'website', url: val, label: 'Website Utama' }];
                      setProfile({ ...profile, socials: updated });
                    }}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    placeholder="https://snaphub.my.id"
                  />
                </div>
              </div>

              {/* Kotak Konsultasi & Reservasi Acara (Concierge Box) */}
              <div className="pt-4 mt-2 border-t border-[var(--admin-border)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider">
                      Kotak Konsultasi & Reservasi Acara (Bagian Bawah)
                    </h4>
                    <p className="text-[11px] text-[var(--admin-text-muted)] mt-0.5">
                      Kartu khusus di bawah daftar link untuk mengarahkan pengunjung langsung reservasi ke WhatsApp.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.concierge?.show !== false}
                      onChange={(e) => {
                        const current = profile.concierge || DEFAULT_LINKTREE_PROFILE.concierge;
                        setProfile({
                          ...profile,
                          concierge: { ...current, show: e.target.checked }
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D90429]"></div>
                    <span className="ml-2 text-xs font-medium text-[var(--admin-text-main)]">
                      {profile.concierge?.show !== false ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </label>
                </div>

                {profile.concierge?.show !== false && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--admin-text-muted)] mb-1">
                        Judul Kotak
                      </label>
                      <input
                        type="text"
                        value={profile.concierge?.title ?? 'Konsultasi & Reservasi Acara'}
                        onChange={(e) => {
                          const current = profile.concierge || DEFAULT_LINKTREE_PROFILE.concierge;
                          setProfile({
                            ...profile,
                            concierge: { ...current, title: e.target.value }
                          });
                        }}
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                        placeholder="Konsultasi & Reservasi Acara"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--admin-text-muted)] mb-1">
                        Teks Tombol
                      </label>
                      <input
                        type="text"
                        value={profile.concierge?.buttonText ?? 'Hubungi WA'}
                        onChange={(e) => {
                          const current = profile.concierge || DEFAULT_LINKTREE_PROFILE.concierge;
                          setProfile({
                            ...profile,
                            concierge: { ...current, buttonText: e.target.value }
                          });
                        }}
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                        placeholder="Hubungi WA"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--admin-text-muted)] mb-1">
                        Deskripsi / Subtitle
                      </label>
                      <input
                        type="text"
                        value={profile.concierge?.subtitle ?? 'Pernikahan, wisuda, gathering, & custom booth.'}
                        onChange={(e) => {
                          const current = profile.concierge || DEFAULT_LINKTREE_PROFILE.concierge;
                          setProfile({
                            ...profile,
                            concierge: { ...current, subtitle: e.target.value }
                          });
                        }}
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                        placeholder="Pernikahan, wisuda, gathering, & custom booth."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--admin-text-muted)] mb-1">
                        Link WhatsApp / URL Tujuan
                      </label>
                      <input
                        type="text"
                        value={profile.concierge?.buttonUrl ?? 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20tanya%20paket%20photobooth.'}
                        onChange={(e) => {
                          const current = profile.concierge || DEFAULT_LINKTREE_PROFILE.concierge;
                          setProfile({
                            ...profile,
                            concierge: { ...current, buttonUrl: e.target.value }
                          });
                        }}
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                        placeholder="https://wa.me/..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white text-sm font-semibold transition-all cursor-pointer"
                >
                  <FiSave />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Profil'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] p-3 sm:p-4 rounded-xl">
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari link, kegiatan, url..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-lg text-xs sm:text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {LINK_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#D90429] text-white font-semibold shadow-sm'
                  : 'bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Links List ── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-[#D90429] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--admin-text-muted)]">Memuat data linktree...</p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="bg-[var(--admin-surface)] border border-dashed border-[var(--admin-border)] rounded-2xl p-8 sm:p-12 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 sm:mb-4 text-[var(--admin-text-muted)]">
            <FiLink size={24} className="sm:hidden" />
            <FiLink size={28} className="hidden sm:block" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[var(--admin-text-main)]">Belum ada link</h3>
          <p className="text-xs sm:text-sm text-[var(--admin-text-muted)] mt-1 max-w-md mx-auto">
            {searchQuery
              ? 'Tidak ada link yang sesuai dengan kata kunci pencarian.'
              : 'Tambahkan link kegiatan, event, sponsorship, atau kontak pertama Anda!'}
          </p>
          <button
            onClick={() => openModal()}
            className="mt-4 sm:mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <FiPlus /> Tambah Link Baru
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-[var(--admin-text-muted)]">
            <span className="flex items-center gap-1.5 text-[11px] sm:text-xs">
              <span className="text-zinc-400 font-mono text-sm leading-none">⠿</span>
              <span>Tahan & geser untuk atur urutan</span>
            </span>
            <span className="font-mono text-[11px] opacity-70">
              {filteredLinks.length} item
            </span>
          </div>

          {filteredLinks.map((link) => {
            // SECTION HEADER ITEM
            if (link.type === 'header') {
              const isDragging = draggedId === link.id;
              const isOver = dragOverId === link.id && !isDragging;

              return (
                <div
                  key={link.id}
                  data-link-id={link.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, link.id)}
                  onDragOver={(e) => handleDragOver(e, link.id)}
                  onDragLeave={(e) => handleDragLeave(e, link.id)}
                  onDrop={(e) => handleDrop(e, link.id)}
                  onDragEnd={handleDragEnd}
                  className={`group bg-[var(--admin-surface)] border border-dashed rounded-xl p-3 sm:p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                    isDragging
                      ? 'opacity-30 scale-[0.99] border-[#D90429]'
                      : isOver
                      ? 'border-[#D90429] ring-2 ring-[#D90429]/50 bg-[#D90429]/10'
                      : link.isActive
                      ? 'border-[var(--admin-border)] bg-white/[0.02] hover:border-zinc-500'
                      : 'border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                    <div
                      className="p-1 sm:p-1.5 text-zinc-500 hover:text-white cursor-grab active:cursor-grabbing transition-colors rounded-lg hover:bg-white/5 flex items-center justify-center shrink-0 select-none touch-none"
                      title="Tahan & geser untuk memindahkan urutan"
                      onTouchStart={(e) => handleTouchStart(e, link.id)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
                        <circle cx="4" cy="3" r="1.6" />
                        <circle cx="10" cy="3" r="1.6" />
                        <circle cx="4" cy="9" r="1.6" />
                        <circle cx="10" cy="9" r="1.6" />
                        <circle cx="4" cy="15" r="1.6" />
                        <circle cx="10" cy="15" r="1.6" />
                      </svg>
                    </div>

                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      link.sectionType === 'dropdown' ? 'bg-purple-500/15 text-purple-400' : 'bg-[#D90429]/10 text-[#D90429]'
                    }`}>
                      {link.sectionType === 'dropdown' ? <FiFolder size={13} /> : <FiTag size={13} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                        {link.sectionType === 'dropdown' ? (
                          <span className="text-[9px] sm:text-[9.5px] font-mono uppercase tracking-wider text-purple-300 bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <FiChevronDown size={10} /> DROPDOWN
                          </span>
                        ) : (
                          <span className="text-[9px] sm:text-[9.5px] font-mono uppercase tracking-wider text-[var(--admin-text-muted)] bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                            HEADER BIASA
                          </span>
                        )}
                        {link.sectionType === 'dropdown' && (
                          <span className="text-[10px] sm:text-[11px] text-[var(--admin-text-muted)]">
                            • Default: {link.defaultOpen !== false ? 'Buka' : 'Tutup'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-[var(--admin-text-main)] truncate mt-0.5 uppercase tracking-wide">
                        {link.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 sm:gap-2 self-end sm:self-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-white/5 w-full sm:w-auto">
                    <button
                      onClick={() => toggleActive(link.id)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        link.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-[var(--admin-text-muted)]'
                      }`}
                    >
                      {link.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                    <button
                      onClick={() => openSectionModal(link)}
                      className="p-1.5 rounded-lg bg-[var(--admin-hover-bg)] text-[var(--admin-text-main)] hover:bg-[#D90429]/20 hover:text-[#D90429] cursor-pointer"
                      title="Edit Judul Section"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(link.id)}
                      className="p-1.5 rounded-lg bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)] hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
                      title="Hapus Section"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            }

            // LINK ITEM
            const isDragging = draggedId === link.id;
            const isOver = dragOverId === link.id && !isDragging;

            return (
              <div
                key={link.id}
                data-link-id={link.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, link.id)}
                onDragOver={(e) => handleDragOver(e, link.id)}
                onDragLeave={(e) => handleDragLeave(e, link.id)}
                onDrop={(e) => handleDrop(e, link.id)}
                onDragEnd={handleDragEnd}
                className={`group bg-[var(--admin-surface)] border rounded-2xl p-3.5 sm:p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 ${
                  isDragging
                    ? 'opacity-30 scale-[0.99] border-[#D90429]'
                    : isOver
                    ? 'border-[#D90429] ring-2 ring-[#D90429]/50 bg-[#D90429]/10'
                    : link.isActive
                    ? 'border-[var(--admin-border)] hover:border-[#D90429]/40'
                    : 'border-white/5 opacity-60'
                } ${link.isHighlighted ? 'ring-1 ring-[#D90429]/30 bg-[#D90429]/5' : ''}`}
              >
                {/* Left: Drag Handle & Thumbnail & Details */}
                <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 w-full min-w-0">
                  {/* Drag Handle */}
                  <div
                    className="p-1 sm:p-1.5 text-zinc-500 hover:text-white cursor-grab active:cursor-grabbing transition-colors rounded-lg hover:bg-white/5 flex items-center justify-center shrink-0 select-none touch-none mt-1 sm:mt-0"
                    title="Tahan & geser untuk memindahkan urutan"
                    onTouchStart={(e) => handleTouchStart(e, link.id)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
                      <circle cx="4" cy="3" r="1.6" />
                      <circle cx="10" cy="3" r="1.6" />
                      <circle cx="4" cy="9" r="1.6" />
                      <circle cx="10" cy="9" r="1.6" />
                      <circle cx="4" cy="15" r="1.6" />
                      <circle cx="10" cy="15" r="1.6" />
                    </svg>
                  </div>

                  {/* Thumbnail / Logo Kegiatan */}
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {link.logoUrl ? (
                      <img
                        src={link.logoUrl}
                        alt={link.title}
                        className="w-full h-full object-contain p-1 sm:p-1.5"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="text-lg sm:text-xl text-[#D90429]">
                        {PRESET_ICONS.find(p => p.id === link.icon)?.icon || <FiLink />}
                      </div>
                    )}
                    {link.isHighlighted && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#D90429] rounded-full border-2 border-[var(--admin-surface)]" title="Link Unggulan" />
                    )}
                  </div>

                  {/* Content Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="font-bold text-[var(--admin-text-main)] text-sm sm:text-base truncate">
                        {link.title}
                      </h4>
                      {link.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/10 text-[var(--admin-text-main)] border border-white/10">
                          {link.badge}
                        </span>
                      )}
                      {link.category && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-white/5 text-[var(--admin-text-muted)] border border-white/5">
                          {link.category}
                        </span>
                      )}
                    </div>

                    {link.subtitle && (
                      <p className="text-xs text-[var(--admin-text-muted)] mt-0.5 line-clamp-1">
                        {link.subtitle}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-0.5 sm:mt-1 text-xs text-[var(--admin-text-muted)]">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#D90429] transition-colors truncate max-w-[180px] sm:max-w-xs flex items-center gap-1 font-mono text-[10.5px] sm:text-[11px]"
                      >
                        {link.url} <FiExternalLink size={10} className="shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right: Stats & Action Buttons */}
                <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto pt-2.5 md:pt-0 border-t md:border-t-0 border-[var(--admin-border)]">
                  {/* Click Badge */}
                  <div
                    onClick={() => resetClicks(link.id)}
                    title="Klik untuk reset jumlah klik"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] sm:text-xs text-[var(--admin-text-muted)] hover:text-white cursor-pointer shrink-0"
                  >
                    <span>{link.clicks || 0} klik</span>
                    <FiRefreshCw size={9} className="opacity-60" />
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Active Toggle Button */}
                    <button
                      onClick={() => toggleActive(link.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        link.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-[var(--admin-text-muted)] border border-white/10'
                      }`}
                    >
                      {link.isActive ? <FiEye size={12} /> : <FiEyeOff size={12} />}
                      <span className="hidden xs:inline">{link.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => openModal(link)}
                      className="p-1.5 sm:p-2 rounded-lg bg-[var(--admin-hover-bg)] text-[var(--admin-text-main)] hover:bg-[#D90429]/20 hover:text-[#D90429] transition-colors cursor-pointer"
                      title="Edit link"
                    >
                      <FiEdit2 size={14} />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteConfirmId(link.id)}
                      className="p-1.5 sm:p-2 rounded-lg bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)] hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                      title="Hapus link"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--admin-text-main)]">Hapus Link?</h3>
            <p className="text-sm text-[var(--admin-text-muted)] mt-2">
              Link ini akan dihapus dari halaman Bio / Linktree publik. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-[var(--admin-border)] text-sm font-medium hover:bg-white/5 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteLink(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Link Modal ── */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto">
            <div
              className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-4 sm:p-6 relative my-auto"
              style={{ animation: 'adminModalIn 0.18s ease forwards' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--admin-border)]">
                <div>
                  <h3 className="text-lg font-bold text-[var(--admin-text-main)] font-heading">
                    {editingLink ? 'Edit Link Kegiatan' : 'Tambah Link Kegiatan Baru'}
                  </h3>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                    Lengkapi informasi link kegiatan, pilih logo dari Client Logo atau upload baru.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 text-[var(--admin-text-muted)] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveModal} className="space-y-5 pt-4">
                {/* 1. Basic Info */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1">
                      Judul Link / Nama Kegiatan <span className="text-[#D90429]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Contoh: Wisuda UB Periode VII 2026 - Softfile Booth"
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1">
                      Deskripsi Singkat / Subtitle
                    </label>
                    <input
                      type="text"
                      value={formSubtitle}
                      onChange={(e) => setFormSubtitle(e.target.value)}
                      placeholder="Contoh: Akses hasil foto photobooth instan & unduh softfile"
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1">
                      URL Tujuan <span className="text-[#D90429]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://drive.google.com/... atau /live/slug atau https://wa.me/..."
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429] font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                {/* 2. Logo Kegiatan Section */}
                <div className="bg-white/[0.02] border border-[var(--admin-border)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider block">
                        Logo Kegiatan / Thumbnail
                      </span>
                      <p className="text-[11px] text-[var(--admin-text-muted)]">
                        Bisa dipilih langsung dari Client Logo yang sudah ada di database, upload logo baru, atau icon.
                      </p>
                    </div>

                    {/* Preview box */}
                    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {selectedLogoUrl ? (
                        <img
                          src={selectedLogoUrl}
                          alt="Preview"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <div className="text-lg text-[#D90429]">
                          {PRESET_ICONS.find(p => p.id === selectedIcon)?.icon || <FiLink />}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Logo Source Tabs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-black/20 p-1.5 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setLogoTab('client_logo')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-medium transition-colors cursor-pointer text-center ${
                        logoTab === 'client_logo'
                          ? 'bg-[#D90429] text-white font-semibold shadow-sm'
                          : 'text-[var(--admin-text-muted)] hover:text-white'
                      }`}
                    >
                      Client Logo ({clientLogos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoTab('upload')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-medium transition-colors cursor-pointer text-center ${
                        logoTab === 'upload'
                          ? 'bg-[#D90429] text-white font-semibold shadow-sm'
                          : 'text-[var(--admin-text-muted)] hover:text-white'
                      }`}
                    >
                      Upload Gambar
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoTab('url')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-medium transition-colors cursor-pointer text-center ${
                        logoTab === 'url'
                          ? 'bg-[#D90429] text-white font-semibold shadow-sm'
                          : 'text-[var(--admin-text-muted)] hover:text-white'
                      }`}
                    >
                      URL Gambar
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoTab('icon')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-medium transition-colors cursor-pointer text-center ${
                        logoTab === 'icon'
                          ? 'bg-[#D90429] text-white font-semibold shadow-sm'
                          : 'text-[var(--admin-text-muted)] hover:text-white'
                      }`}
                    >
                      Preset Icon
                    </button>
                  </div>

                  {/* Tab 1: Client Logo Selector */}
                  {logoTab === 'client_logo' && (
                    <div className="space-y-2.5 pt-1">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] text-xs" />
                        <input
                          type="text"
                          value={clientLogoSearch}
                          onChange={(e) => setClientLogoSearch(e.target.value)}
                          placeholder="Cari nama client logo..."
                          className="w-full pl-8 pr-3 py-1.5 bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-lg text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                        />
                      </div>

                      {clientLogos.length === 0 ? (
                        <div className="text-center py-4 text-xs text-[var(--admin-text-muted)] bg-white/5 rounded-lg border border-white/5">
                          Belum ada Client Logo di database.{' '}
                          <a href="/admin/logos" className="text-[#D90429] underline">
                            Tambah di menu Client Logos
                          </a>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-black/10 rounded-lg border border-white/5">
                          {clientLogos
                            .filter(c => c.client_name?.toLowerCase().includes(clientLogoSearch.toLowerCase()))
                            .map((client) => {
                              const isSelected = selectedLogoUrl === client.logo_url;
                              return (
                                <button
                                  type="button"
                                  key={client.id}
                                  onClick={() => handleSelectClientLogo(client)}
                                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-[#D90429] bg-[#D90429]/15 ring-1 ring-[#D90429]'
                                      : 'border-[var(--admin-border)] hover:bg-white/5'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded bg-white/10 shrink-0 flex items-center justify-center p-1 overflow-hidden">
                                    <img
                                      src={client.logo_url}
                                      alt={client.client_name}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-[var(--admin-text-main)] truncate">
                                      {client.client_name}
                                    </p>
                                    {isSelected && (
                                      <span className="text-[10px] text-[#E79EA7] flex items-center gap-0.5">
                                        <FiCheck size={10} /> Terpilih
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Upload File */}
                  {logoTab === 'upload' && (
                    <div className="pt-1">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-[var(--admin-border)] hover:border-[#D90429]/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-white/[0.01]"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUploadLogoFile}
                          className="hidden"
                        />
                        <FiUpload className="mx-auto text-2xl text-[#D90429] mb-2" />
                        <p className="text-xs font-semibold text-[var(--admin-text-main)]">
                          {uploadingLogo ? 'Sedang mengunggah...' : 'Klik untuk memilih logo kegiatan'}
                        </p>
                        <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
                          PNG, JPG, SVG, WebP (maks. 2MB)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: URL Gambar */}
                  {logoTab === 'url' && (
                    <div className="pt-1">
                      <input
                        type="url"
                        value={selectedLogoUrl}
                        onChange={(e) => {
                          setSelectedLogoUrl(e.target.value);
                          setSelectedClientLogoId('');
                        }}
                        placeholder="https://domain.com/logo-kegiatan.png"
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-lg px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                      />
                    </div>
                  )}

                  {/* Tab 4: Preset Icon */}
                  {logoTab === 'icon' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {PRESET_ICONS.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            setSelectedIcon(item.id);
                            setSelectedLogoUrl('');
                            setSelectedClientLogoId('');
                          }}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            selectedIcon === item.id && !selectedLogoUrl
                              ? 'border-[#D90429] bg-[#D90429]/15 text-white font-semibold'
                              : 'border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:bg-white/5'
                          }`}
                        >
                          <span className="text-sm">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Category & Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1">
                      Nama Section / Bagian
                    </label>
                    <input
                      type="text"
                      list="section-presets"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="Contoh: Event & Kegiatan, Layanan..."
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    />
                    <datalist id="section-presets">
                      {LINK_CATEGORIES.filter(c => c !== 'Semua').map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                    <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
                      Tautan akan dikelompokkan berdasarkan nama section ini di halaman publik.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1">
                      Badge Text (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formBadge}
                      onChange={(e) => setFormBadge(e.target.value)}
                      placeholder="Misal: EVENT AKTIF, NEW, PROMO"
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    />
                  </div>
                </div>

                {/* 4. Toggles */}
                <div className="space-y-2 pt-1 border-t border-[var(--admin-border)]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsHighlighted}
                      onChange={(e) => setFormIsHighlighted(e.target.checked)}
                      className="rounded accent-[#D90429] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-[var(--admin-text-main)]">
                      <strong className="font-semibold">Jadikan Link Unggulan</strong> (Tampil dengan efek glow & animasi perhatian)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsOpenNewTab}
                      onChange={(e) => setFormIsOpenNewTab(e.target.checked)}
                      className="rounded accent-[#D90429] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-[var(--admin-text-main)]">
                      Buka di tab baru (Target _blank)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded accent-[#D90429] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-[var(--admin-text-main)]">
                      Status Aktif (Tampilkan di halaman publik)
                    </span>
                  </label>
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t border-[var(--admin-border)]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-xs sm:text-sm font-medium hover:bg-white/5 cursor-pointer text-center"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[#D90429]/25 cursor-pointer text-center"
                  >
                    {editingLink ? 'Simpan Perubahan' : 'Tambahkan Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}

      {/* ── Section / Header Modal ── */}
      {isSectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 overflow-y-auto">
            <div
              className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl p-4 sm:p-6 relative my-auto"
              style={{ animation: 'adminModalIn 0.18s ease forwards' }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--admin-border)]">
                <h3 className="text-base font-bold text-[var(--admin-text-main)]">
                  {editingSection ? 'Edit Section / Pembatas' : 'Tambah Section Baru'}
                </h3>
                <button onClick={closeSectionModal} className="p-1.5 text-[var(--admin-text-muted)] hover:text-white rounded-lg">
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSection} className="space-y-4 pt-4">
                {/* 1. Section Title */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-1">
                    Judul Section <span className="text-[#D90429]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formSectionTitle}
                    onChange={(e) => setFormSectionTitle(e.target.value)}
                    placeholder="Contoh: Event & Kegiatan Terkini"
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#D90429]"
                    required
                  />
                </div>

                {/* 2. Section Type Choice (Biasa vs Dropdown) */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--admin-text-muted)] uppercase mb-2">
                    Tipe Tampilan Section
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option: Biasa */}
                    <button
                      type="button"
                      onClick={() => setFormSectionType('normal')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formSectionType === 'normal'
                          ? 'border-[#D90429] bg-[#D90429]/10 text-white ring-1 ring-[#D90429]/40'
                          : 'border-[var(--admin-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text-muted)] hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FiList className={formSectionType === 'normal' ? 'text-[#D90429]' : 'text-zinc-400'} size={15} />
                        <span className="text-xs font-bold text-[var(--admin-text-main)]">Header Biasa</span>
                      </div>
                      <p className="text-[11px] text-[var(--admin-text-muted)] leading-relaxed">
                        Pemisah garis statis. Semua link di bawahnya langsung terlihat.
                      </p>
                    </button>

                    {/* Option: Dropdown / Accordion */}
                    <button
                      type="button"
                      onClick={() => setFormSectionType('dropdown')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formSectionType === 'dropdown'
                          ? 'border-purple-500 bg-purple-500/10 text-white ring-1 ring-purple-500/40'
                          : 'border-[var(--admin-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text-muted)] hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FiChevronDown className={formSectionType === 'dropdown' ? 'text-purple-400' : 'text-zinc-400'} size={15} />
                        <span className="text-xs font-bold text-[var(--admin-text-main)]">Dropdown Buka-Tutup</span>
                      </div>
                      <p className="text-[11px] text-[var(--admin-text-muted)] leading-relaxed">
                        Tombol interaktif. Pengunjung bisa mengklik untuk buka / tutup daftar link.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 3. Dropdown Options (Conditional) */}
                {formSectionType === 'dropdown' && (
                  <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSectionDefaultOpen}
                        onChange={(e) => setFormSectionDefaultOpen(e.target.checked)}
                        className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs text-[var(--admin-text-main)]">
                        <strong className="font-semibold">Default Terbuka</strong> (Saat halaman bio dibuka, daftar link section ini langsung terbuka)
                      </span>
                    </label>
                    <p className="text-[11px] text-zinc-400 pl-7">
                      Jika dinonaktifkan, section ini akan tertutup secara default dan pengunjung harus mengkliknya untuk melihat isi tautan.
                    </p>
                  </div>
                )}

                {/* 4. Active Status Toggle */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSectionActive}
                      onChange={(e) => setFormSectionActive(e.target.checked)}
                      className="rounded accent-[#D90429] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-[var(--admin-text-main)]">
                      Status Aktif (Tampilkan section ini di halaman publik)
                    </span>
                  </label>
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t border-[var(--admin-border)]">
                  <button
                    type="button"
                    onClick={closeSectionModal}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-xs sm:text-sm font-medium hover:bg-white/5 cursor-pointer text-center"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#D90429] hover:bg-[#b00320] text-white text-xs sm:text-sm font-semibold shadow-md shadow-[#D90429]/20 cursor-pointer text-center"
                  >
                    {editingSection ? 'Simpan Section' : 'Tambahkan Section'}
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}
    </div>
  );
};

export default AdminLinks;
