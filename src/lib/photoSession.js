// Harga & perhitungan pencatatan sesi foto (dipakai halaman Sesi Foto dan Keuangan Event).
export const VOUCHER_PRICE = 30000;
export const NO_VOUCHER_PRICE = 35000;
export const PRINT_PRICE = 10000;
export const SESSION_PRICE = 45000;

// Penanda baris pengeluaran otomatis di tabel transactions.
export const SHARING_SOURCE = 'sharing_profit';
export const SHARING_DESCRIPTION = 'Sharing profit (otomatis)';

// Mode tarif event: 'voucher' (voucher/non-voucher, sharing Rp per voucher)
// atau 'percent' (satu tarif per sesi, sharing = persen dari pemasukan sesi).
export const isPercentMode = (event) => event?.pricing_mode === 'percent';

// Gabungkan tarif dari kolom event dengan override (mis. draft di modal). Override menang.
export const pricingOf = (event, custom = {}) => ({
  mode: custom?.mode ?? event?.pricing_mode ?? 'voucher',
  voucherPrice: custom?.voucherPrice ?? event?.voucher_price ?? VOUCHER_PRICE,
  noVoucherPrice: custom?.noVoucherPrice ?? event?.no_voucher_price ?? NO_VOUCHER_PRICE,
  sessionPrice: custom?.sessionPrice ?? event?.session_price ?? SESSION_PRICE,
  printPrice: custom?.printPrice ?? event?.print_price ?? PRINT_PRICE,
});

export const sessionPrice = (session, customPrices = {}) => {
  const p = pricingOf(null, customPrices);
  const base = p.mode === 'percent' ? p.sessionPrice : session.no_voucher ? p.noVoucherPrice : p.voucherPrice;
  return base + (session.prints || 0) * p.printPrice;
};

export const eventTotal = (event, customPrices = {}) => {
  const p = pricingOf(event, customPrices);
  return (event?.sessions || []).reduce((sum, s) => sum + sessionPrice(s, p), 0);
};

export const voucherCount = (event) => (event?.sessions || []).filter((s) => !s.no_voucher).length;

// Mode voucher: jumlah voucher × nominal per voucher. Mode persen: persentase dari pemasukan sesi.
export const eventSharing = (event) =>
  isPercentMode(event)
    ? Math.round((eventTotal(event) * (Number(event?.share_percent) || 0)) / 100)
    : voucherCount(event) * (event?.share_per_voucher || 0);
