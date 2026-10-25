import { supabase } from './supabase';

// Hapus file di bucket yang sudah tidak dipakai (yatim) agar storage Supabase tidak menumpuk.
// - prefix: hanya file berawalan ini yang boleh dihapus (pengaman agar file milik fitur lain aman)
// - inUse: string/daftar string tempat file masih direferensikan (URL, JSON setting, dsb.)
// - minAgeMs: file yang lebih baru dari ini dilewati (mungkin baru diunggah & belum disimpan)
// Tidak pernah melempar error: kegagalan cleanup tidak boleh menggagalkan penyimpanan utama.
export async function removeUnusedFiles(bucket, { prefix = '', inUse = [], minAgeMs = 0 } = {}) {
  try {
    const haystack = (Array.isArray(inUse) ? inUse : [inUse]).filter(Boolean).join('\n');
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000 });
    if (error || !data) return 0;

    const now = Date.now();
    const stale = data
      .filter((f) => f.id && f.name.startsWith(prefix)) // f.id kosong = folder
      .filter((f) => !haystack.includes(f.name))
      .filter((f) => !minAgeMs || !f.created_at || now - new Date(f.created_at).getTime() > minAgeMs)
      .map((f) => f.name);

    if (stale.length === 0) return 0;
    const { error: removeError } = await supabase.storage.from(bucket).remove(stale);
    if (removeError) {
      console.warn('Cleanup storage gagal:', removeError);
      return 0;
    }
    return stale.length;
  } catch (err) {
    console.warn('Cleanup storage gagal:', err);
    return 0;
  }
}
