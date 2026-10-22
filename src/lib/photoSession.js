// Harga & perhitungan pencatatan sesi foto (dipakai halaman Sesi Foto dan Keuangan Event).
export const VOUCHER_PRICE = 30000;
export const NO_VOUCHER_PRICE = 35000;
export const PRINT_PRICE = 10000;

// Penanda baris pengeluaran otomatis di tabel transactions.
export const SHARING_SOURCE = 'sharing_profit';
export const SHARING_DESCRIPTION = 'Sharing profit (otomatis)';

export const sessionPrice = (session) => {
  const base = session.no_voucher ? NO_VOUCHER_PRICE : VOUCHER_PRICE;
  return base + (session.prints || 0) * PRINT_PRICE;
};

export const eventTotal = (event) => (event.sessions || []).reduce((sum, s) => sum + sessionPrice(s), 0);

export const voucherCount = (event) => (event.sessions || []).filter((s) => !s.no_voucher).length;

export const eventSharing = (event) => voucherCount(event) * (event.share_per_voucher || 0);
