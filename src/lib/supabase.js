import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isBrowser = typeof window !== 'undefined';

const getCookieDomain = () => {
  if (!isBrowser) return '';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return '';
  if (host.endsWith('snaphub.my.id')) {
    return '; domain=.snaphub.my.id';
  }
  return '';
};

// Storage adapter yang membagikan session login ke seluruh subdomain (*.snaphub.my.id)
const crossDomainStorage = {
  getItem: (key) => {
    if (!isBrowser) return null;
    // 1. Coba baca dari cookie bersama (.snaphub.my.id)
    try {
      const escapedKey = key.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escapedKey + '=([^;]*)'));
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        // Sinkronkan juga ke localStorage lokal
        try {
          window.localStorage.setItem(key, decoded);
        } catch {}
        return decoded;
      }
    } catch (e) {
      console.warn('Gagal membaca cookie auth:', e);
    }

    // 2. Fallback baca dari localStorage
    try {
      const localVal = window.localStorage.getItem(key);
      if (localVal) {
        // Migrasikan nilai ke cookie bersama agar subdomain lain bisa mengakses
        crossDomainStorage.setItem(key, localVal);
        return localVal;
      }
    } catch {}

    return null;
  },
  setItem: (key, value) => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {}

    try {
      const domain = getCookieDomain();
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      // Simpan cookie 1 tahun, path=/, SameSite=Lax
      document.cookie = `${key}=${encodeURIComponent(value)}; max-age=31536000; path=/${domain}; SameSite=Lax${secure}`;
    } catch (e) {
      console.warn('Gagal menulis cookie auth cross-domain:', e);
    }
  },
  removeItem: (key) => {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(key);
    } catch {}

    try {
      const domain = getCookieDomain();
      document.cookie = `${key}=; max-age=0; path=/${domain}`;
      // Hapus juga tanpa domain jika ada cookie lama
      document.cookie = `${key}=; max-age=0; path=/`;
    } catch (e) {
      console.warn('Gagal menghapus cookie auth cross-domain:', e);
    }
  }
};

// Buat client dummy jika env belum di-set agar app tidak crash
export const supabase = supabaseUrl 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: crossDomainStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      }
    })
  : {
      from: () => ({ select: () => Promise.resolve({ data: [] }), insert: () => Promise.resolve({ error: null }), delete: () => Promise.resolve({ error: null }) }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: () => Promise.resolve({ data: null, error: { message: "Sistem belum dikonfigurasi (Supabase URL kosong). Silakan atur file .env terlebih dahulu." } }),
        signOut: () => Promise.resolve({ error: null })
      },
      supabaseUrl: '' // flag for checking
    };
