// Default Linktree data for SnapHub
// Disimpan di Supabase 'site_settings' dengan key 'linktree'

export const DEFAULT_LINKTREE_PROFILE = {
  name: 'SnapHub Photobooth',
  handle: '@snaphub.id',
  bio: 'Photobooth Malang & Jawa Timur • Instant Prints & Digital Memories ✨',
  avatarUrl: '/icons.svg',
  verified: true,
  theme: 'dark',
  socials: [
    { platform: 'whatsapp', url: 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20tertarik%20dengan%20layanan%20photobooth!', label: 'WhatsApp' },
    { platform: 'instagram', url: 'https://instagram.com/snaphub.id', label: 'Instagram' },
    { platform: 'tiktok', url: 'https://tiktok.com/@snaphub.id', label: 'TikTok' },
    { platform: 'website', url: 'https://snaphub.my.id', label: 'Website Utama' }
  ],
  concierge: {
    show: true,
    title: 'Konsultasi & Reservasi Acara',
    subtitle: 'Pernikahan, wisuda, gathering, & custom booth.',
    buttonText: 'Hubungi WA',
    buttonUrl: 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20tanya%20paket%20photobooth.'
  }
};

export const DEFAULT_LINKS = [
  {
    id: 'header-events',
    type: 'header',
    title: 'Event & Kegiatan',
    sectionType: 'normal',
    defaultOpen: true,
    isActive: true
  },
  {
    id: 'link-gala-premiere',
    type: 'link',
    title: 'Live Sesi Foto: Gala Premiere',
    subtitle: 'Pantau sesi foto langsung & unduh softfile',
    url: '/live/gala-premiere-883',
    logoUrl: '',
    icon: 'camera',
    badge: 'Event',
    isHighlighted: false,
    isActive: true,
    openNewTab: true,
    clicks: 64
  },
  {
    id: 'header-services',
    type: 'header',
    title: 'Layanan & Booking',
    sectionType: 'normal',
    defaultOpen: true,
    isActive: true
  },
  {
    id: 'link-booking',
    type: 'link',
    title: 'Booking Jadwal Photobooth',
    subtitle: 'Cek ketersediaan tanggal & reservasi acara',
    url: '/#availability',
    logoUrl: '',
    icon: 'calendar',
    badge: '',
    isHighlighted: true,
    isActive: true,
    openNewTab: false,
    clicks: 85
  },
  {
    id: 'link-pricelist',
    type: 'link',
    title: 'Pricelist & Paket Photobooth 2026',
    subtitle: 'Pilihan Unlimited & Limited Print',
    url: '/#pricelist',
    logoUrl: '',
    icon: 'ticket',
    badge: '',
    isHighlighted: false,
    isActive: true,
    openNewTab: false,
    clicks: 120
  },
  {
    id: 'header-info',
    type: 'header',
    title: 'Portofolio & Kontak',
    sectionType: 'dropdown',
    defaultOpen: true,
    isActive: true
  },
  {
    id: 'link-gallery',
    type: 'link',
    title: 'Portofolio & Galeri Foto',
    subtitle: 'Koleksi dokumentasi photobooth SnapHub',
    url: '/#gallery',
    logoUrl: '',
    icon: 'image',
    badge: '',
    isHighlighted: false,
    isActive: true,
    openNewTab: false,
    clicks: 42
  },
  {
    id: 'link-consult-wa',
    type: 'link',
    title: 'WhatsApp Admin SnapHub',
    subtitle: 'Konsultasi paket & informasi ketersediaan tanggal',
    url: 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20konsultasi%20paket%20photobooth.',
    logoUrl: '',
    icon: 'whatsapp',
    badge: '',
    isHighlighted: false,
    isActive: true,
    openNewTab: true,
    clicks: 98
  }
];

export const LINK_CATEGORIES = [
  'Event & Kegiatan',
  'Layanan & Booking',
  'Portofolio',
  'Kontak & Sosmed'
];
