// Helper URL & format yang dipakai halaman internal (Antrian, Sesi Foto, Link).

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const isLocalHost = () =>
  typeof window !== 'undefined' && (
    ['localhost', '127.0.0.1'].includes(window.location.hostname) ||
    window.location.hostname.endsWith('.local') ||
    /^192\.168\./.test(window.location.hostname) ||
    /^10\./.test(window.location.hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
  );

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

export const getBioUrl = () => (isLocalHost() ? '/links' : 'https://link.snaphub.my.id');

export const queueBaseUrl = () =>
  isLocalHost() ? `${window.location.origin}/queue` : 'https://queue.snaphub.my.id';

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
