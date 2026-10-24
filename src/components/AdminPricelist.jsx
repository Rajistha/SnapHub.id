import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  FiPlus, FiTrash2, FiSave, FiRotateCcw, 
  FiUploadCloud, FiExternalLink, FiFileText 
} from 'react-icons/fi';
import { DEFAULT_PACKAGES, DEFAULT_TNC, mergePackages, formatRupiah, startFrom } from '../lib/pricelistDefaults';

const inputCls =
  'w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-3 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]';

const toEditable = (packages) =>
  packages.map(({ id, label, tagline, prices }) => ({
    id,
    label,
    tagline,
    prices: prices.map((p) => ({ label: p.label, sub: p.sub || '', price: p.price })),
  }));

const AdminPricelist = () => {
  const [packages, setPackages] = useState(() => toEditable(DEFAULT_PACKAGES));
  const [tnc, setTnc] = useState(DEFAULT_TNC);
  const [pdfUrl, setPdfUrl] = useState('/PriceGuideSnapHub.id.pdf');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef(null);
  const [activeId, setActiveId] = useState(DEFAULT_PACKAGES[0].id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'pricelist')
          .maybeSingle();
        if (error) throw error;
        setPackages(toEditable(mergePackages(data?.value?.packages)));
        if (Array.isArray(data?.value?.tnc) && data.value.tnc.length > 0) setTnc(data.value.tnc);
        if (data?.value?.pdfUrl) setPdfUrl(data.value.pdfUrl);
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengambil pricelist, menampilkan data bawaan');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pkg = packages.find((p) => p.id === activeId);

  const updatePkg = (patch) => {
    setPackages((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
    setDirty(true);
  };

  const updateRow = (index, patch) =>
    updatePkg({ prices: pkg.prices.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  const addRow = () => updatePkg({ prices: [...pkg.prices, { label: '', sub: '', price: 0 }] });

  const removeRow = (index) => updatePkg({ prices: pkg.prices.filter((_, i) => i !== index) });

  const resetPkg = () => {
    const def = DEFAULT_PACKAGES.find((p) => p.id === activeId);
    updatePkg(toEditable([def])[0]);
    toast('Dikembalikan ke harga bawaan, klik Simpan untuk menerapkan');
  };

  const updateTnc = (index, text) => {
    setTnc((prev) => prev.map((t, i) => (i === index ? text : t)));
    setDirty(true);
  };

  const addTnc = () => {
    setTnc((prev) => [...prev, '']);
    setDirty(true);
  };

  const removeTnc = (index) => {
    setTnc((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const resetTnc = () => {
    setTnc(DEFAULT_TNC);
    setDirty(true);
    toast('Dikembalikan ke bawaan, klik Simpan untuk menerapkan');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 20MB');
      return;
    }

    setUploadingPdf(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `pricelist_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(fileName);

      setPdfUrl(publicUrl);
      setDirty(true);
      toast.success('File pricelist berhasil diunggah! Klik "Simpan Pricelist" untuk menerapkan ke website.');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Gagal mengunggah file: ' + (err.message || 'Error'));
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const cleaned = packages.map((p) => ({
      id: p.id,
      label: p.label.trim(),
      tagline: p.tagline.trim(),
      prices: p.prices
        .filter((r) => r.label.trim())
        .map((r) => {
          const row = { label: r.label.trim(), price: Math.max(0, Number(r.price) || 0) };
          if (r.sub.trim()) row.sub = r.sub.trim();
          return row;
        }),
    }));
    if (cleaned.some((p) => !p.label || p.prices.length === 0)) {
      toast.error('Nama paket dan minimal satu harga wajib diisi');
      return;
    }
    const cleanedTnc = tnc.map((t) => t.trim()).filter(Boolean);
    if (cleanedTnc.length === 0) {
      toast.error('Syarat & ketentuan minimal satu poin');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ 
          key: 'pricelist', 
          value: { 
            packages: cleaned, 
            tnc: cleanedTnc,
            pdfUrl: pdfUrl.trim() || '/PriceGuideSnapHub.id.pdf'
          }, 
          updated_at: new Date().toISOString() 
        });
      if (error) throw error;
      setPackages(toEditable(mergePackages(cleaned)));
      setTnc(cleanedTnc);
      setDirty(false);
      toast.success('Pricelist & file unduhan berhasil disimpan');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan pricelist');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── File Download Pricelist ── */}
      <div className="border border-[var(--admin-border)] rounded-2xl p-5 space-y-4 bg-[var(--admin-card-bg)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-main)] flex items-center gap-2">
              <FiFileText className="text-[#D90429]" size={16} /> File Download Pricelist (PDF / Dokumen)
            </h4>
            <p className="text-xs text-[var(--admin-text-muted)] mt-1">
              File yang diunduh pengunjung saat mengklik tombol <strong>"Download Pricelist"</strong> di landing page.
            </p>
          </div>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#D90429] hover:underline shrink-0 bg-[var(--admin-accent-bg)] px-3 py-1.5 rounded-lg border border-[var(--admin-accent)]/20 font-medium"
            >
              <FiExternalLink size={13} /> Buka File Saat Ini
            </a>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
            className="hidden"
          />
          <button
            type="button"
            disabled={uploadingPdf}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--admin-accent)] text-white text-xs font-medium hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {uploadingPdf ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Mengunggah file...
              </>
            ) : (
              <>
                <FiUploadCloud size={15} /> Upload File PDF Baru
              </>
            )}
          </button>

          <span className="text-xs text-[var(--admin-text-muted)] text-center sm:text-left">atau isi URL file langsung:</span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pdfUrl}
              onChange={(e) => {
                setPdfUrl(e.target.value);
                setDirty(true);
              }}
              placeholder="https://... atau /PriceGuideSnapHub.id.pdf"
              className={inputCls}
            />
            {pdfUrl !== '/PriceGuideSnapHub.id.pdf' && (
              <button
                type="button"
                onClick={() => {
                  setPdfUrl('/PriceGuideSnapHub.id.pdf');
                  setDirty(true);
                  toast('Direset ke file bawaan, klik Simpan untuk menerapkan');
                }}
                className="shrink-0 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] px-3 py-2 rounded-lg border border-[var(--admin-border)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                title="Reset ke bawaan"
              >
                Reset Default
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1.5">
            Bisa berupa file PDF yang diunggah, link Google Drive, Canva, atau file statis lokal (<code>/PriceGuideSnapHub.id.pdf</code>).
          </p>
        </div>
      </div>

      {/* Package tabs */}
      <div className="flex flex-wrap gap-2">
        {packages.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              activeId === p.id
                ? 'bg-[var(--admin-accent-bg)] text-[var(--admin-accent)] border-[var(--admin-accent)]/30'
                : 'text-[var(--admin-text-muted)] border-[var(--admin-border)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)]'
            }`}
          >
            {p.label || 'Tanpa nama'}
          </button>
        ))}
      </div>

      <div className="border border-[var(--admin-border)] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--admin-text-muted)] mb-2">Nama paket</label>
            <input className={inputCls} value={pkg.label} onChange={(e) => updatePkg({ label: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-[var(--admin-text-muted)] mb-2">Tagline</label>
            <input className={inputCls} value={pkg.tagline} onChange={(e) => updatePkg({ tagline: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-[var(--admin-text-muted)]">
          "Mulai dari" di website otomatis memakai harga terendah:{' '}
          <span className="font-semibold text-[var(--admin-text-main)]">{formatRupiah(startFrom(pkg))}</span>
        </p>
      </div>

      <div className="border border-[var(--admin-border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
            Daftar Harga ({pkg.prices.length})
          </h4>
          <button
            onClick={resetPkg}
            className="flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors cursor-pointer"
          >
            <FiRotateCcw size={12} /> Kembalikan bawaan
          </button>
        </div>

        <div className="space-y-2">
          {pkg.prices.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_1.2fr_auto] gap-2 items-center">
              <input
                className={inputCls}
                placeholder="Nama (mis. 3 Jam)"
                value={row.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
              />
              <button
                onClick={() => removeRow(i)}
                className="sm:order-last p-2 rounded-lg text-[var(--admin-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Hapus baris"
              >
                <FiTrash2 size={15} />
              </button>
              <input
                className={inputCls}
                placeholder="Keterangan (opsional)"
                value={row.sub}
                onChange={(e) => updateRow(i, { sub: e.target.value })}
              />
              <div className="flex items-center gap-2 bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-3 focus-within:border-[var(--admin-accent)]">
                <span className="text-xs text-[var(--admin-text-muted)]">Rp</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1000"
                  value={row.price}
                  onChange={(e) => updateRow(i, { price: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent py-2 text-sm text-[var(--admin-text-main)] focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
        >
          <FiPlus size={14} /> Tambah baris harga
        </button>
      </div>

      <div className="border border-[var(--admin-border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
            Syarat &amp; Ketentuan ({tnc.length})
          </h4>
          <button
            onClick={resetTnc}
            className="flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors cursor-pointer"
          >
            <FiRotateCcw size={12} /> Kembalikan bawaan
          </button>
        </div>

        <div className="space-y-2">
          {tnc.map((text, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-6 shrink-0 pt-2 text-xs font-semibold text-[var(--admin-text-muted)] tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <textarea
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="Tulis poin syarat & ketentuan..."
                value={text}
                onChange={(e) => updateTnc(i, e.target.value)}
              />
              <button
                onClick={() => removeTnc(i)}
                className="shrink-0 p-2 rounded-lg text-[var(--admin-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Hapus poin"
              >
                <FiTrash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addTnc}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
        >
          <FiPlus size={14} /> Tambah poin
        </button>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-[var(--admin-text-muted)]">Ada perubahan belum disimpan</span>}
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <FiSave size={14} /> {saving ? 'Menyimpan...' : 'Simpan Pricelist'}
        </button>
      </div>
    </div>
  );
};

export default AdminPricelist;
