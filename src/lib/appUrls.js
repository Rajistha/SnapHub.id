// Helper URL & format yang dipakai halaman internal (Antrian, Sesi Foto, Link).

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const slugify = (text) =>
  (text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const formatRp = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(n || 0)}`;

export const formatDate = (date) =>
  date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Tanpa tanggal';

// Selisih hari dari hari ini (lokal) ke tanggal event yyyy-MM-dd.
export const daysUntil = (date, todayStr) =>
  Math.round((new Date(`${date}T00:00:00`) - new Date(`${todayStr}T00:00:00`)) / 86400000);

export const todayString = () => new Date().toLocaleDateString('en-CA');

export const getAdminUrl = () => {
  if (typeof window === 'undefined') return '/admin';
  return window.location.hostname.includes('snaphub.my.id') ? 'https://spanel.snaphub.my.id' : '/admin';
};

export const getBioUrl = () =>
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? '/links'
    : 'https://link.snaphub.my.id';

export const queueBaseUrl = () => {
  if (typeof window === 'undefined') return 'https://queue.snaphub.my.id';
  // Jika dibuka di localhost: HP yang scan QR code TIDAK BISA mengakses http://localhost!
  // QR code harus mengarah ke domain publik https://queue.snaphub.my.id agar HP bisa membukanya!
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'https://queue.snaphub.my.id';
  }
  // Jika dibuka lewat IP LAN lokal (misal 192.168.x.x:5173), gunakan origin tersebut
  if (/^192\.168\./.test(window.location.hostname) || /^10\./.test(window.location.hostname)) {
    return `${window.location.origin}/queue`;
  }
  return 'https://queue.snaphub.my.id';
};

export const queueGuestUrl = (event) =>
  event?.queue_token ? `${queueBaseUrl()}/${slugify(event.name)}-${event.queue_token}` : '';

export const queueDisplayUrl = (event) => (event?.queue_token ? `${queueGuestUrl(event)}/display` : '');

export const queueQrUrl = (event) => (event?.queue_token ? `${queueGuestUrl(event)}/qr` : '');

// Token selalu bagian setelah tanda hubung terakhir pada slug "nama-event-token".
export const tokenFromSlug = (slug) => (slug ? slug.split('-').pop() : '');

// Hanya izinkan tautan http(s), mailto, tel, path internal, dan #anchor. Menolak javascript:/data:.
export const safeUrl = (url) => {
  const value = (url || '').trim();
  if (!value) return '#';
  if (value.startsWith('/') || value.startsWith('#')) return value;
  return /^(https?:|mailto:|tel:)/i.test(value) ? value : '#';
};

export const newToken = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);
