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

// Nomor WhatsApp tersimpan sudah berformat 62xxxx; terima juga format lama 08xxxx.
export const toWaNumber = (phone) => {
  let digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits;
};
