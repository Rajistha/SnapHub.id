import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FiTrash2, FiUpload, FiImage, FiPlus, FiX } from 'react-icons/fi';
// framer-motion removed for performance

const AdminLogos = () => {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Form states
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [clientName, setClientName] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLogo, setEditingLogo] = useState(null);

  // Delete state
  const [logoToDelete, setLogoToDelete] = useState(null);

  useEffect(() => {
    fetchLogos();
  }, []);

  const fetchLogos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_logos')
        .select('id, client_name, logo_url, instagram_url, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogos(data || []);
    } catch (error) {
      toast.error('Gagal mengambil data logo.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 2 * 1024 * 1024) { // 2MB limit for logos
        toast.error('Ukuran file maksimal 1MB');
        return;
      }
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const openAddModal = (logo = null) => {
    if (logo) {
      setEditingLogo(logo);
      setClientName(logo.client_name);
      setInstagramUrl(logo.instagram_url || '');
      setPreviewUrl(logo.logo_url);
      setFile(null);
    } else {
      setEditingLogo(null);
      setClientName('');
      setInstagramUrl('');
      setPreviewUrl('');
      setFile(null);
    }
    setIsModalOpen(true);
  };

  const closeAddModal = () => {
    setIsModalOpen(false);
    setFile(null);
    setPreviewUrl('');
    setEditingLogo(null);
    setClientName('');
    setInstagramUrl('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file && !editingLogo) {
      toast.error('Pilih gambar logo terlebih dahulu!');
      return;
    }
    if (!clientName.trim()) {
      toast.error('Nama klien wajib diisi!');
      return;
    }

    setUploading(true);
    try {
      let finalLogoUrl = editingLogo ? editingLogo.logo_url : '';

      // Jika ada file baru yang dipilih (baik saat tambah baru maupun edit)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('client-logos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('client-logos')
          .getPublicUrl(fileName);
        
        finalLogoUrl = publicUrl;
      }

      if (editingLogo) {
        // Update data
        const { error: dbError } = await supabase
          .from('client_logos')
          .update({
            client_name: clientName,
            instagram_url: instagramUrl,
            logo_url: finalLogoUrl
          })
          .eq('id', editingLogo.id);

        if (dbError) throw dbError;
        toast.success('Logo berhasil diperbarui!');
      } else {
        // Insert data
        const { error: dbError } = await supabase
          .from('client_logos')
          .insert([{
            client_name: clientName,
            instagram_url: instagramUrl,
            logo_url: finalLogoUrl
          }]);

        if (dbError) throw dbError;
        toast.success('Logo berhasil ditambahkan!');
      }

      closeAddModal();
      fetchLogos();
    } catch (error) {
      toast.error('Gagal mengunggah logo: ' + error.message);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!logoToDelete) return;

    try {
      // Ekstrak nama file dari URL
      const urlParts = logoToDelete.logo_url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // 1. Hapus dari Storage
      const { error: storageError } = await supabase.storage
        .from('client-logos')
        .remove([fileName]);

      if (storageError) console.error('Storage deletion error:', storageError);

      // 2. Hapus dari Database
      const { error: dbError } = await supabase
        .from('client_logos')
        .delete()
        .eq('id', logoToDelete.id);

      if (dbError) throw dbError;

      toast.success('Logo berhasil dihapus!');
      fetchLogos();
    } catch (error) {
      toast.error('Gagal menghapus logo: ' + error.message);
      console.error(error);
    } finally {
      setLogoToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--admin-surface)] p-6 rounded-2xl border border-[var(--admin-border)]">
        <div>
          <h2 className="text-xl font-bold text-[var(--admin-text-main)]">Kelola Logo Klien</h2>

        </div>
        <button
          onClick={() => openAddModal()}
          className="flex items-center space-x-2 bg-[var(--admin-accent)] hover:bg-opacity-80 text-black px-4 py-2.5 rounded-xl transition-all font-medium text-sm w-fit"
          style={{ color: '#000000' }}
        >
          <FiPlus />
          <span>Tambah Logo</span>
        </button>
      </div>

      {/* Grid Logo */}
      {logos.length === 0 ? (
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-12 text-center">
          <FiImage className="mx-auto text-4xl text-[var(--admin-text-subtle)] mb-4" />
          <p className="text-[var(--admin-text-muted)]">Belum ada logo yang ditambahkan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {logos.map((logo) => (
            <div
              key={logo.id}
              className="relative group aspect-video bg-white/10 dark:bg-black/10 border border-[var(--admin-border)] rounded-xl overflow-hidden flex items-center justify-center p-4"
            >
              <img
                src={logo.logo_url}
                alt={logo.client_name}
                className="max-w-full max-h-full object-contain filter brightness-0 invert"
                style={{
                  filter: 'grayscale(100%) brightness(0) invert(1)'
                }}
                loading="lazy"
              />

              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2">
                <span className="text-white text-xs font-medium text-center px-2">{logo.client_name}</span>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => openAddModal(logo)}
                    className="bg-[var(--admin-hover-bg)] hover:bg-[var(--admin-border)] text-white p-2 rounded-lg transition-colors border border-[var(--admin-border)]"
                    title="Edit Logo"
                  >
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button
                    onClick={() => setLogoToDelete(logo)}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                    title="Hapus Logo"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div
              onClick={closeAddModal}
              className="absolute inset-0 bg-black/75"
            />
            <div
              className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
              style={{ animation: 'adminModalIn 0.18s ease forwards' }}
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-[var(--admin-text-main)]">
                  {editingLogo ? 'Edit Logo Klien' : 'Tambah Logo Klien'}
                </h3>
                <button
                  onClick={closeAddModal}
                  className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--admin-text-subtle)] mb-1">
                    Foto Logo
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${previewUrl
                      ? 'border-[#D90429] bg-[#D90429]/5'
                      : 'border-[var(--admin-border)] hover:border-[var(--admin-text-subtle)] bg-[var(--admin-input-bg)]'
                      }`}
                  >
                    {previewUrl ? (
                      <div className="relative w-full aspect-video flex items-center justify-center bg-black/5 rounded-lg p-2">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FiUpload className="mx-auto text-3xl text-[var(--admin-text-subtle)] mb-2" />
                        <p className="text-sm text-[var(--admin-text-main)] font-medium">Klik untuk upload logo</p>
                        <p className="text-xs text-[var(--admin-text-muted)] mt-1">WEBP, PNG, atau SVG (Maks. 1MB)</p>
                        <p className="text-xs text-[var(--admin-text-muted)] mt-1">1024 x 1024</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/webp, image/png, image/svg+xml"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[var(--admin-text-subtle)] mb-1">Nama Klien / Perusahaan</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-[var(--admin-text-main)] text-sm focus:border-[var(--admin-accent)] outline-none"
                    placeholder="Contoh: HBC2026"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--admin-text-subtle)] mb-1">Tautan Instagram (Opsional)</label>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-[var(--admin-text-main)] text-sm focus:border-[var(--admin-accent)] outline-none"
                    placeholder="https://instagram.com/hbc2026"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="px-4 py-2 text-sm text-[var(--admin-text-main)] hover:bg-[var(--admin-input-bg)] rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 text-sm bg-[var(--admin-accent)] hover:bg-opacity-80 text-black rounded-xl transition-all disabled:opacity-50 min-w-[100px] flex items-center justify-center"
                    style={{ color: '#000000' }}
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Simpan'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {logoToDelete && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div
              onClick={() => setLogoToDelete(null)}
              className="absolute inset-0 bg-black/75"
            />
            <div
              className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
              style={{ animation: 'adminModalIn 0.18s ease forwards' }}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <FiTrash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-[var(--admin-text-main)] mb-2">Hapus Logo?</h3>
              <p className="text-[var(--admin-text-subtle)] text-sm mb-6">
                Hapus logo <strong>{logoToDelete.client_name}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setLogoToDelete(null)}
                  className="px-4 py-2 text-sm text-[var(--admin-text-main)] hover:bg-[var(--admin-input-bg)] rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
                  style={{ color: '#ffffff' }}
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default AdminLogos;
