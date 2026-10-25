import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FiTrash2, FiPlus, FiX, FiStar, FiEdit2, FiChevronDown } from 'react-icons/fi';
// framer-motion removed for performance
import { format, parseISO } from 'date-fns';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [customEventType, setCustomEventType] = useState('');

  const [formData, setFormData] = useState({
    client_name: '',
    event_type: 'Wedding',
    rating: 5,
    comment: ''
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      toast.error('Gagal mengambil data review.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (review = null) => {
    const predefinedTypes = ['Wedding', 'Birthday', 'Corporate Event', 'Graduation', 'Engagement', 'Event Campus'];

    if (review) {
      setEditingReview(review);
      
      let isCustom = !predefinedTypes.includes(review.event_type) && review.event_type;
      
      setFormData({
        client_name: review.client_name,
        event_type: isCustom ? 'Lainnya' : (review.event_type || 'Wedding'),
        rating: review.rating,
        comment: review.comment
      });
      setCustomEventType(isCustom ? review.event_type : '');
    } else {
      setEditingReview(null);
      setFormData({
        client_name: '',
        event_type: 'Wedding',
        rating: 5,
        comment: ''
      });
      setCustomEventType('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingReview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_name || !formData.comment) {
      toast.error('Nama klien dan komentar wajib diisi!');
      return;
    }
    if (formData.event_type === 'Lainnya' && !customEventType.trim()) {
      toast.error('Silakan isi jenis acara secara spesifik!');
      return;
    }

    setLoading(true);
    try {
      const dataToSave = { ...formData };
      if (dataToSave.event_type === 'Lainnya') {
        dataToSave.event_type = customEventType;
      }

      if (editingReview) {
        const { error } = await supabase
          .from('reviews')
          .update(dataToSave)
          .eq('id', editingReview.id);
        if (error) throw error;
        toast.success('Review berhasil diperbarui!');
      } else {
        const { error } = await supabase
          .from('reviews')
          .insert([dataToSave]);
        if (error) throw error;
        toast.success('Review berhasil ditambahkan!');
      }
      handleCloseModal();
      fetchReviews();
    } catch (error) {
      toast.error('Gagal menyimpan review.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!reviewToDelete) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewToDelete.id);
      if (error) throw error;
      toast.success('Review berhasil dihapus!');
      setReviewToDelete(null);
      fetchReviews();
    } catch (error) {
      toast.error('Gagal menghapus review.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex space-x-1 text-yellow-500">
        {[...Array(5)].map((_, i) => (
          <FiStar key={i} className={i < rating ? "fill-current" : "text-gray-600"} size={14} />
        ))}
      </div>
    );
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="flex justify-center pt-20 h-screen">
        <div className="w-8 h-8 border-4 border-[#D90429] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--admin-text-main)]">Customer Reviews</h2>

        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-[var(--admin-accent)] hover:bg-opacity-80 text-black px-4 py-2.5 rounded-xl transition-all font-medium text-sm w-fit"
          style={{ color: '#000000' }}
        >
          <FiPlus size={18} />
          <span>Tambah Review</span>
        </button>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-20 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl">
          <FiStar className="mx-auto text-[var(--admin-text-muted)] mb-4" size={48} />
          <p className="text-[var(--admin-text-subtle)]">Belum ada review. Silakan tambahkan review baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map(review => (
            <div key={review.id} className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5 hover:border-[var(--admin-border-hover)] transition-all flex flex-col h-full shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--admin-text-main)]">{review.client_name}</h3>
                  <p className="text-xs text-[var(--admin-text-subtle)]">{review.event_type || 'Event'}</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleOpenModal(review)} className="p-1.5 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors bg-[var(--admin-hover-bg)] rounded-lg">
                    <FiEdit2 size={14} />
                  </button>
                  <button onClick={() => setReviewToDelete(review)} className="p-1.5 text-red-400 hover:text-red-500 transition-colors bg-red-500/10 rounded-lg">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mb-3">
                {renderStars(review.rating)}
              </div>
              <p className="text-sm text-[var(--admin-text-muted)] italic flex-1">&quot;{review.comment}&quot;</p>
              <div className="mt-4 text-[10px] text-[var(--admin-text-subtle)]">
                Ditambahkan: {review.created_at ? format(parseISO(review.created_at), 'dd MMM yyyy') : '-'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/75"
              onClick={handleCloseModal}
            />
            <div
              className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
              style={{ animation: 'adminModalIn 0.18s ease forwards' }}
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-[var(--admin-text-main)]">
                  {editingReview ? 'Edit Review' : 'Tambah Review'}
                </h3>
                <button onClick={handleCloseModal} className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--admin-text-subtle)] mb-1">Nama Klien</label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-[var(--admin-text-main)] text-sm focus:border-[var(--admin-accent)] outline-none"
                    placeholder="Contoh: Budi & Ani"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--admin-text-subtle)] mb-1">Jenis Acara</label>
                  <div className="relative">
                    <select
                      value={formData.event_type}
                      onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-[var(--admin-text-main)] text-sm focus:border-[var(--admin-accent)] outline-none appearance-none cursor-pointer pr-10"
                    >
                      <option className="bg-[#111111] text-white" value="Wedding">Wedding</option>
                      <option className="bg-[#111111] text-white" value="Birthday">Birthday</option>
                      <option className="bg-[#111111] text-white" value="Corporate Event">Corporate Event</option>
                      <option className="bg-[#111111] text-white" value="Graduation">Graduation</option>
                      <option className="bg-[#111111] text-white" value="Engagement">Engagement</option>
                      <option className="bg-[#111111] text-white" value="Event Campus">Event Campus</option>
                      <option className="bg-[#111111] text-white" value="Lainnya">Lainnya (Ketik Sendiri)</option>
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] pointer-events-none" size={16} />
                  </div>
                </div>
                
                {formData.event_type === 'Lainnya' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <input
                      type="text"
                      value={customEventType}
                      onChange={(e) => setCustomEventType(e.target.value)}
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-[var(--admin-text-main)] text-sm focus:border-[var(--admin-accent)] outline-none mt-2"
                      placeholder="Masukkan jenis acara..."
                      required
                    />
                  </motion.div>
                )}

                <div>
                  <label className="block text-xs text-[var(--admin-text-subtle)] mb-1">Rating Bintang</label>
                  <div className="relative">
                    <select
                      value={formData.rating}
                      onChange={(e) => setFormData({...formData, rating: parseInt(e.target.value)})}
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-[var(--admin-text-main)] text-sm focus:border-[var(--admin-accent)] outline-none appearance-none cursor-pointer pr-10"
                    >
                      <option className="bg-[#111111] text-white" value="5">5 Bintang (Sangat Puas)</option>
                      <option className="bg-[#111111] text-white" value="4">4 Bintang (Puas)</option>
                      <option className="bg-[#111111] text-white" value="3">3 Bintang (Cukup)</option>
                      <option className="bg-[#111111] text-white" value="2">2 Bintang (Kurang)</option>
                      <option className="bg-[#111111] text-white" value="1">1 Bintang (Buruk)</option>
                    </select>
                    <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] pointer-events-none" size={16} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--admin-text-subtle)] mb-1">Komentar / Testimoni</label>
                  <textarea
                    value={formData.comment}
                    onChange={(e) => setFormData({...formData, comment: e.target.value})}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-[var(--admin-text-main)] text-sm focus:border-[var(--admin-accent)] outline-none min-h-[100px] resize-y"
                    placeholder="Tulis testimoni..."
                    required
                  />
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={handleCloseModal} 
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors font-medium text-sm cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--admin-accent)] hover:bg-opacity-80 text-black transition-colors font-medium text-sm border border-[var(--admin-accent)] cursor-pointer disabled:opacity-50"
                    style={{ color: '#000000' }}
                  >
                    {loading ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {reviewToDelete && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/75"
              onClick={() => setReviewToDelete(null)}
            />
            <div
              className="relative bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              style={{ animation: 'adminModalIn 0.18s ease forwards' }}
            >
              <h3 className="text-xl font-bold text-[var(--admin-accent)] mb-2">Hapus Review</h3>
              <p className="text-[var(--admin-text-muted)] text-sm mb-6">
                Apakah Anda yakin ingin menghapus review dari <strong className="text-[var(--admin-text-main)]">{reviewToDelete.client_name}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors font-medium text-sm cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm border border-red-500 cursor-pointer"
                >
                  {loading ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default AdminReviews;
