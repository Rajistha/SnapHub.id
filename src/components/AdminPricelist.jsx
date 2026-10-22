import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiSave, FiRotateCcw } from 'react-icons/fi';
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
        .upsert({ key: 'pricelist', value: { packages: cleaned, tnc: cleanedTnc }, updated_at: new Date().toISOString() });
      if (error) throw error;
      setPackages(toEditable(mergePackages(cleaned)));
      setTnc(cleanedTnc);
      setDirty(false);
      toast.success('Pricelist disimpan');
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
      {/* Package tabs */}
      <div className="flex flex-wrap gap-2">
        {packages.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
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
            className="flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors"
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
                className="sm:order-last p-2 rounded-lg text-[var(--admin-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
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
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
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
            className="flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors"
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
                className="shrink-0 p-2 rounded-lg text-[var(--admin-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Hapus poin"
              >
                <FiTrash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addTnc}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--admin-border)] text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors"
        >
          <FiPlus size={14} /> Tambah poin
        </button>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-[var(--admin-text-muted)]">Ada perubahan belum disimpan</span>}
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiSave size={14} /> {saving ? 'Menyimpan...' : 'Simpan Pricelist'}
        </button>
      </div>
    </div>
  );
};

export default AdminPricelist;
