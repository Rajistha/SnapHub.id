import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiArrowLeft, FiSun, FiMoon, FiPlus, FiSearch, FiCopy, FiEdit2, FiTrash2, FiEye, FiEyeOff,
  FiGrid, FiDownload, FiExternalLink,
} from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import useAdminSession from '../lib/useAdminSession';
import { getAdminUrl } from '../lib/appUrls';
import AdminLogin from '../components/ui/AdminLogin';
import Modal from '../components/ui/Modal';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const RESERVED = ['admin', 'queue', 'links', 'linktree', 'bio', 'sesi', 'sesi-foto', 'live', 'crew', 'short', 'app', 'api', 'assets'];

const shortBase = () => {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' ? window.location.origin : 'https://snaphub.my.id';
};
const shortUrl = (slug) => `${shortBase()}/${slug}`;

const randomSlug = () => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

const normalizeUrl = (value) => {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const EMPTY = { slug: '', url: '', title: '' };

const ManageShortLinks = () => {
  const { session, loading: authLoading, theme, toggleTheme } = useAdminSession();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { slug|null }
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [qr, setQr] = useState(null); // { slug, dataUrl }

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('short_links').select('*').order('created_at', { ascending: false });
    if (err) toast.error('Gagal memuat link. Pastikan short_links.sql sudah dijalankan.');
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => !needle || [r.slug, r.url, r.title].some((v) => (v || '').toLowerCase().includes(needle)));
  }, [rows, search]);

  const openModal = (row = null) => {
    setError('');
    setForm(row ? { slug: row.slug, url: row.url, title: row.title || '' } : { slug: '', url: '', title: '' });
    setModal({ slug: row?.slug || null });
  };

  const submit = async (e) => {
    e.preventDefault();
    const slug = (form.slug.trim() || randomSlug()).toLowerCase();
    if (!SLUG_RE.test(slug)) return setError('Slug 2–40 karakter: huruf kecil, angka, - atau _.');
    if (RESERVED.includes(slug)) return setError('Slug ini dipakai halaman situs. Pilih yang lain.');
    if (!form.url.trim()) return setError('URL tujuan wajib diisi.');
    const url = normalizeUrl(form.url);
    try {
      new URL(url);
    } catch {
      return setError('URL tujuan tidak valid.');
    }

    setSaving(true);
    const payload = { slug, url, title: form.title.trim() || null, updated_at: new Date().toISOString() };
    const { error: err } = modal.slug
      ? await supabase.from('short_links').update(payload).eq('slug', modal.slug)
      : await supabase.from('short_links').insert(payload);
    setSaving(false);

    if (err) return setError(err.code === '23505' ? 'Slug sudah dipakai. Pilih yang lain.' : 'Gagal menyimpan. Coba lagi.');
    setModal(null);
    toast.success(modal.slug ? 'Link diperbarui' : `Link dibuat: ${shortUrl(slug)}`);
    load();
  };

  const toggleActive = async (row) => {
    const { error: err } = await supabase.from('short_links').update({ is_active: !row.is_active }).eq('slug', row.slug);
    if (err) return toast.error('Gagal mengubah status');
    setRows((prev) => prev.map((r) => (r.slug === row.slug ? { ...r, is_active: !r.is_active } : r)));
  };

  const remove = async () => {
    const target = toDelete;
    setToDelete(null);
    const { error: err } = await supabase.from('short_links').delete().eq('slug', target.slug);
    if (err) return toast.error('Gagal menghapus');
    setRows((prev) => prev.filter((r) => r.slug !== target.slug));
    toast.success('Link dihapus');
  };

  const copy = async (slug) => {
    try {
      await navigator.clipboard.writeText(shortUrl(slug));
      toast.success('Link disalin');
    } catch {
      toast.error('Gagal menyalin');
    }
  };

  // QR dibuat di browser (tanpa layanan pihak ketiga); library dimuat hanya saat dibutuhkan.
  const showQr = async (slug) => {
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(shortUrl(slug), { width: 1024, margin: 2, errorCorrectionLevel: 'M' });
      setQr({ slug, dataUrl });
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat QR');
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#050505]"><div className="w-8 h-8 border-[3px] border-[#D90429] border-t-transparent rounded-full animate-spin" role="status" aria-label="Memuat" /></div>;
  }
  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <AdminLogin title="Shortlink" subtitle="Masuk untuk mengelola link pendek snaphub.my.id." />
      </>
    );
  }

  const totalClicks = rows.reduce((sum, r) => sum + Number(r.clicks || 0), 0);

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] relative overflow-hidden" data-theme={theme}>
      {/* Cahaya latar identik halaman antrian */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-[#D90429]/15 blur-[120px]" />
      <Toaster position="top-center" toastOptions={{ style: { background: '#222', color: '#fff' } }} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-5 relative">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a href={getAdminUrl()} className="ui-btn ui-btn-icon" aria-label="Kembali ke Admin"><FiArrowLeft size={16} /></a>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight">Shortlink</h1>
              <p className="text-sm text-[var(--admin-text-muted)] num">
                {rows.length} link · {totalClicks.toLocaleString('id-ID')} klik · hasil: snaphub.my.id/<span className="opacity-70">slug</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => openModal()} className="ui-btn ui-btn-primary"><FiPlus size={15} /> <span className="hidden sm:inline">Buat link</span></button>
            <button onClick={toggleTheme} className="ui-btn ui-btn-icon" aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}>
              {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
            </button>
          </div>
        </header>

        <div className="relative sm:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={15} aria-hidden="true" />
          <input type="search" aria-label="Cari link" placeholder="Cari slug, judul, atau URL" value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input pl-10" />
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-8 h-8 border-[3px] border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="Memuat" /></div>
        ) : visible.length === 0 ? (
          <div className="ui-card border-dashed p-10 text-center">
            <p className="font-medium">{search ? 'Tidak ada link yang cocok' : 'Belum ada shortlink'}</p>
            {!search && <button onClick={() => openModal()} className="ui-btn ui-btn-primary mt-4"><FiPlus size={15} /> Buat link pertama</button>}
          </div>
        ) : (
          <ul className="ui-card divide-y divide-[var(--admin-border)] overflow-hidden">
            {visible.map((row) => (
              <li key={row.slug} className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${row.is_active ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    <span className="font-mono">/{row.slug}</span>
                    {row.title && <span className="text-[var(--admin-text-muted)] font-normal"> · {row.title}</span>}
                    {!row.is_active && <span className="ui-tag ml-2 align-middle">Nonaktif</span>}
                  </p>
                  <p className="text-sm text-[var(--admin-text-muted)] truncate">
                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="hover:underline font-mono">{row.url}</a>
                  </p>
                  <p className="text-sm text-[var(--admin-text-muted)] num">{Number(row.clicks).toLocaleString('id-ID')} klik</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => copy(row.slug)} className="ui-btn ui-btn-sm"><FiCopy size={14} /> Salin</button>
                  <button onClick={() => showQr(row.slug)} className="ui-btn ui-btn-sm ui-btn-icon" aria-label={`QR code /${row.slug}`} title="QR code"><FiGrid size={14} /></button>
                  <button onClick={() => toggleActive(row)} className="ui-btn ui-btn-sm ui-btn-icon" aria-label={row.is_active ? `Nonaktifkan /${row.slug}` : `Aktifkan /${row.slug}`} title={row.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                    {row.is_active ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                  </button>
                  <button onClick={() => openModal(row)} className="ui-btn ui-btn-sm ui-btn-icon" aria-label={`Edit /${row.slug}`}><FiEdit2 size={14} /></button>
                  <button onClick={() => setToDelete(row)} className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" aria-label={`Hapus /${row.slug}`}><FiTrash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {modal && (
        <Modal
          title={modal.slug ? 'Edit shortlink' : 'Buat shortlink'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} className="ui-btn">Batal</button>
              <button type="submit" form="short-form" disabled={saving} className="ui-btn ui-btn-primary">{saving ? 'Menyimpan…' : modal.slug ? 'Simpan' : 'Buat link'}</button>
            </>
          }
        >
          <form id="short-form" onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="s-url" className="ui-label">URL tujuan</label>
              <input id="s-url" className="ui-input font-mono" inputMode="url" placeholder="https://drive.google.com/…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} autoFocus />
            </div>
            <div>
              <label htmlFor="s-slug" className="ui-label">Slug</label>
              <div className="flex items-center ui-input py-0 focus-within:border-[var(--admin-primary)]">
                <span className="text-sm text-[var(--admin-text-muted)] shrink-0">snaphub.my.id/</span>
                <input id="s-slug" className="w-full bg-transparent py-2.5 outline-none font-mono" placeholder="kosongkan untuk acak" value={form.slug} maxLength={40} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
                <button type="button" onClick={() => setForm({ ...form, slug: randomSlug() })} className="text-sm underline underline-offset-2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] shrink-0 px-1">Acak</button>
              </div>
              <p className="ui-hint">Huruf kecil, angka, - dan _. Contoh: wisuda-ub</p>
            </div>
            <div>
              <label htmlFor="s-title" className="ui-label">Catatan (opsional)</label>
              <input id="s-title" className="ui-input" maxLength={80} placeholder="Softfile wisuda UB periode VII" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            {error && <p role="alert" className="text-sm text-[var(--admin-danger)]">{error}</p>}
          </form>
        </Modal>
      )}

      {qr && (
        <Modal
          title={`QR /${qr.slug}`}
          description={shortUrl(qr.slug)}
          size="sm"
          onClose={() => setQr(null)}
          footer={
            <>
              <a href={shortUrl(qr.slug)} target="_blank" rel="noopener noreferrer" className="ui-btn"><FiExternalLink size={14} /> Buka</a>
              <a href={qr.dataUrl} download={`qr-${qr.slug}.png`} className="ui-btn ui-btn-primary"><FiDownload size={14} /> Unduh PNG</a>
            </>
          }
        >
          <div className="flex justify-center">
            <img src={qr.dataUrl} alt={`QR code untuk ${shortUrl(qr.slug)}`} width="224" height="224" className="w-56 h-56 rounded-xl bg-white" />
          </div>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Hapus shortlink?"
          description={`/${toDelete.slug} tidak akan bisa dibuka lagi. QR atau link yang sudah disebar jadi mati.`}
          size="sm"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button onClick={() => setToDelete(null)} className="ui-btn">Batal</button>
              <button onClick={remove} className="ui-btn ui-btn-solid-danger">Hapus</button>
            </>
          }
        />
      )}
    </div>
  );
};

export default ManageShortLinks;
