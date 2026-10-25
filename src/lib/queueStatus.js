// Status antrian: label dan nada visual dipakai bersama di admin, tamu, dan layar TV.
export const ACTIVE_STATUSES = ['called', 'heading', 'serving'];

export const isActive = (q) => ACTIVE_STATUSES.includes(q.status);

export const STATUS_META = {
  waiting: { label: 'Menunggu', tone: 'warn' },
  called: { label: 'Dipanggil', tone: 'live' },
  heading: { label: 'Menuju booth', tone: 'live' },
  serving: { label: 'Dilayani', tone: 'live' },
  completed: { label: 'Selesai', tone: 'ok' },
  skipped: { label: 'Dilewati', tone: 'muted' },
  cancelled: { label: 'Dibatalkan', tone: 'muted' },
};

export const statusMeta = (status) => STATUS_META[status] || { label: status, tone: 'muted' };

// Estimasi tunggu: jumlah tamu di depan × rata-rata durasi layanan (default 5 menit bila belum ada data).
export const DEFAULT_SERVICE_SECONDS = 300;

export const estimateMinutes = (peopleAhead, avgSeconds) => {
  const per = Number(avgSeconds) > 0 ? Number(avgSeconds) : DEFAULT_SERVICE_SECONDS;
  return Math.max(0, Math.ceil((peopleAhead * per) / 60));
};

export const formatEstimate = (minutes) => {
  if (minutes < 60) return `± ${Math.max(1, minutes)} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `± ${h} jam ${m} menit` : `± ${h} jam`;
};

// Nomor WhatsApp tersimpan sudah berformat 62xxxx; terima juga format lama 08xxxx.
export const toWaNumber = (phone) => {
  let digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits;
};
