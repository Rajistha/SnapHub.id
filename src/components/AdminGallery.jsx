import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FiTrash2, FiUpload, FiImage, FiPlus, FiX, FiEdit2 } from 'react-icons/fi';

const AdminGallery = () => {
  // Tailwind Safelist: col-span-1 row-span-1 col-span-2 row-span-2
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const MAX_STORAGE_MB = 50;
  const MAX_STORAGE_BYTES = MAX_STORAGE_MB * 1024 * 1024;
  const fileInputRef = useRef(null);

  // Form states
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [category, setCategory] = useState('Event');
  const [title, setTitle] = useState('Event Handled');
  const [alt, setAlt] = useState('Photobooth event SnapHub Malang');
  const [span, setSpan] = useState(''); // '' or 'row-span-2'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Delete state
  const [imageToDelete, setImageToDelete] = useState(null);

  // Edit state
  const [imageToEdit, setImageToEdit] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAlt, setEditAlt] = useState('');
  const [editSpan, setEditSpan] = useState('');

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('id, url, category, title, alt, span, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Fetched images:', data);
      setImages(data || []);

      // Hitung penggunaan storage
      const { data: storageData, error: storageError } = await supabase.storage.from('gallery').list();
      if (!storageError && storageData) {
        const totalBytes = storageData.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
        setStorageUsed(totalBytes);
      }
    } catch (error) {
      toast.error('Gagal mengambil data galeri.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Ukuran file maksimal 5MB');
        return;
      }
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const openAddModal = () => {
    setFile(null);
    setPreviewUrl('');
    setCategory('Event');
    setTitle('Event Handled');
    setAlt('Photobooth event SnapHub Malang');
    setSpan('');
    setIsModalOpen(true);
  };

  const closeAddModal = () => {
    setIsModalOpen(false);
    setFile(null);
    setPreviewUrl('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Pilih gambar terlebih dahulu!');
      return;
    }

    if (storageUsed + file.size > MAX_STORAGE_BYTES) {
      toast.error(`Gagal: Kapasitas penyimpanan penuh (Max ${MAX_STORAGE_MB}MB)`);
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('gallery')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('gallery')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      // Insert to DB
      const { error: dbError } = await supabase
        .from('gallery_images')
        .insert([{
          url: publicUrl,
          category,
          title,
          alt,
          span
        }]);

      if (dbError) throw dbError;

      toast.success('Gambar berhasil ditambahkan!');
      closeAddModal();
      fetchImages();
    } catch (error) {
      toast.error('Gagal mengunggah gambar: ' + (error.message || 'Unknown error'));
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (img) => {
    setImageToEdit(img);
    setEditTitle(img.title);
    setEditCategory(img.category);
    setEditAlt(img.alt || '');
    setEditSpan(img.span || '');
  };

  const closeEditModal = () => {
    setImageToEdit(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!imageToEdit) return;

    setUploading(true);
    try {
      const { error: dbError } = await supabase
        .from('gallery_images')
        .update({
          title: editTitle,
          category: editCategory,
          alt: editAlt,
          span: editSpan
        })
        .eq('id', imageToEdit.id);

      if (dbError) throw dbError;

      toast.success('Data gambar berhasil diperbarui!');
      closeEditModal();
      fetchImages();
    } catch (error) {
      toast.error('Gagal memperbarui data gambar: ' + (error.message || 'Unknown error'));
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!imageToDelete) return;
    setUploading(true);
    try {
      // Extract filename from URL
      const fileName = imageToDelete.url.split('/').pop();

      // Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('gallery')
        .remove([fileName]);

      if (storageError) console.warn("File not found in storage, but continuing DB delete", storageError);

      // Delete from DB
      const { error: dbError } = await supabase
        .from('gallery_images')
        .delete()
        .eq('id', imageToDelete.id);

      if (dbError) throw dbError;

      toast.success('Gambar berhasil dihapus!');
      setImageToDelete(null);
      fetchImages();
    } catch (error) {
      toast.error('Gagal menghapus gambar: ' + (error.message || 'Unknown error'));
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl">
      <div className="flex justify-between items-center bg-[var(--admin-surface)] p-6 rounded-[1.5rem] border border-[var(--admin-border)] shadow-[var(--admin-shadow)]">
        <div>
          <h2 className="text-2xl font-bold text-[var(--admin-accent)]">Manajemen Galeri</h2>
          <p className="text-[var(--admin-text-muted)] mt-1">Kelola foto portofolio yang ditampilkan di halaman beranda.</p>
          <div className="mt-4 w-full max-w-xs">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--admin-text-muted)]">Kapasitas Penyimpanan</span>
              <span className="text-[var(--admin-text-main)] font-semibold">
                {(storageUsed / (1024 * 1024)).toFixed(2)} MB / {MAX_STORAGE_MB} MB
              </span>
            </div>
            <div className="w-full bg-[var(--admin-input-bg)] rounded-full h-2">
              <div
                className={`h-2 rounded-full ${storageUsed > MAX_STORAGE_BYTES * 0.9 ? 'bg-red-500' : 'bg-[var(--admin-accent)]'}`}
                style={{ width: `${Math.min((storageUsed / MAX_STORAGE_BYTES) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
        <button
          onClick={openAddModal}
          disabled={storageUsed >= MAX_STORAGE_BYTES}
          className="flex items-center gap-2 bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] text-[var(--admin-surface)] px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-[var(--admin-accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiPlus size={20} />
          <span>Tambah Foto</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[var(--admin-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div style={{ gridAutoRows: '200px' }} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 grid-flow-dense">
          {images.map((img) => {
            // Parse spans for inline styles to guarantee they apply
            const isCol2 = img.span?.includes('col-span-2');
            const isRow2 = img.span?.includes('row-span-2');

            return (
              <div
                key={img.id}
                style={{
                  gridColumn: isCol2 ? 'span 2 / span 2' : undefined,
                  gridRow: isRow2 ? 'span 2 / span 2' : undefined
                }}
                className={`group relative rounded-2xl overflow-hidden bg-[var(--admin-input-bg)] border border-[var(--admin-border)] ${img.span || ''}`}
              >
                <img src={img.url} alt={img.alt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <span className="text-white font-semibold text-sm">{img.title}</span>
                  <span className="text-white/70 text-xs">{img.category} • {img.span ? img.span.replace('col-span-2', 'Lebar').replace('row-span-2', 'Tinggi') : 'Normal'}</span>
                </div>
                <div className="absolute top-2 right-2 flex flex-col gap-2">
                  <button
                    onClick={() => openEditModal(img)}
                    className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:scale-110"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={() => setImageToDelete(img)}
                    className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {images.length === 0 && (
            <div className="col-span-full py-20 text-center text-[var(--admin-text-muted)] border-2 border-dashed border-[var(--admin-border)] rounded-2xl">
              Belum ada gambar di galeri.
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 lg:left-64 bg-black/75 z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-md shadow-[var(--admin-shadow)] relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={closeAddModal} className="absolute top-6 right-6 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors">
              <FiX size={20} />
            </button>
            <div className="w-14 h-14 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center mb-5 border border-[var(--admin-accent)]/20">
              <FiImage size={24} className="text-[var(--admin-accent)]" />
            </div>
            <h3 className="text-[var(--admin-accent)] font-bold text-xl mb-6">Tambah Foto Galeri</h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-[var(--admin-text-muted)] text-sm mb-2 font-medium">Gambar</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-[var(--admin-border)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--admin-accent)] transition-colors overflow-hidden bg-[var(--admin-input-bg)]"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <FiUpload size={24} className="text-[var(--admin-text-muted)] mx-auto mb-2" />
                      <span className="text-sm text-[var(--admin-text-muted)]">Klik untuk pilih gambar</span> <br />
                      <span className="text-sm text-[var(--admin-text-muted)]">Max. 1000kb</span><br />
                      <span className="text-sm text-[var(--admin-text-muted)]">Format WebP</span>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>

              <div>
                <label className="block text-[var(--admin-text-muted)] text-sm mb-2 font-medium">Kategori</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)]">
                  <option value="Event" className="bg-[var(--admin-bg)]">Event</option>
                  <option value="Wedding" className="bg-[var(--admin-bg)]">Wedding</option>
                </select>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--admin-text-muted)] text-sm mb-2 font-medium">Judul Hover</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)]" />
                </div>
                <div>
                  <label className="block text-[var(--admin-text-muted)] text-sm mb-2 font-medium">Alt Text (SEO)</label>
                  <input type="text" value={alt} onChange={e => setAlt(e.target.value)} required className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)]" />
                </div>
              </div>

              <button type="submit" disabled={uploading} className="w-full bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--admin-surface)] font-bold py-3 rounded-xl transition-all shadow-lg shadow-[var(--admin-accent)]/20 text-sm mt-4 flex items-center justify-center gap-2">
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--admin-surface)] border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Foto'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {imageToDelete && (
        <div className="fixed inset-0 lg:left-64 bg-black/75 z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-sm shadow-[var(--admin-shadow)] relative">
            <div className="w-14 h-14 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center mb-5 mx-auto border border-[#D28A94]/20">
              <FiTrash2 size={24} className="text-[var(--admin-accent-hover)]" />
            </div>
            <h3 className="text-[var(--admin-accent)] font-bold text-xl mb-2 text-center">Hapus Foto?</h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-6 text-center leading-relaxed">
              Tindakan ini tidak dapat dibatalkan dan foto akan hilang dari halaman utama.
            </p>
            <div className="w-full aspect-video rounded-xl overflow-hidden mb-6 border border-[var(--admin-border)]">
              <img src={imageToDelete.url} alt="To delete" className="w-full h-full object-cover opacity-50" />
            </div>
            <div className="flex justify-center gap-3">
              <button disabled={uploading} onClick={() => setImageToDelete(null)} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors">
                Batal
              </button>
              <button disabled={uploading} onClick={confirmDelete} className="flex-1 flex items-center justify-center gap-2 bg-[var(--admin-accent-hover)] hover:bg-red-500 disabled:opacity-50 text-[var(--admin-surface)] hover:text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#D28A94]/20">
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-[var(--admin-surface)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Ya, Hapus'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {imageToEdit && (
        <div className="fixed inset-0 lg:left-64 bg-black/75 z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-md shadow-[var(--admin-shadow)] relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={closeEditModal} className="absolute top-6 right-6 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors">
              <FiX size={20} />
            </button>
            <div className="w-14 h-14 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center mb-5 border border-[var(--admin-accent)]/20">
              <FiEdit2 size={24} className="text-[var(--admin-accent)]" />
            </div>
            <h3 className="text-[var(--admin-text-main)] font-bold text-xl mb-6">Edit Data Foto</h3>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-[var(--admin-text-muted)] text-sm mb-2 font-medium">Kategori</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)]">
                  <option value="Event" className="bg-[var(--admin-bg)]">Event</option>
                  <option value="Wedding" className="bg-[var(--admin-bg)]">Wedding</option>
                </select>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--admin-text-muted)] text-sm mb-2 font-medium">Judul Hover</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} required className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)]" />
                </div>
                <div>
                  <label className="block text-[var(--admin-text-muted)] text-sm mb-2 font-medium">Alt Text (SEO)</label>
                  <input type="text" value={editAlt} onChange={e => setEditAlt(e.target.value)} required className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)]" />
                </div>
              </div>

              <button type="submit" disabled={uploading} className="w-full bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--admin-surface)] font-bold py-3 rounded-xl transition-all shadow-lg shadow-[var(--admin-accent)]/20 text-sm mt-4 flex items-center justify-center gap-2">
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--admin-surface)] border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGallery;
