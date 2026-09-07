import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaWhatsapp, FaChevronDown, FaPaperPlane, FaTimes, FaRobot } from 'react-icons/fa';
import { supabase } from '../lib/supabase';

const WA_URL = 'https://wa.me/6285190643459?text=Halo%20SnapHub%2C%20saya%20ingin%20booking%20photobooth!';

// Daftar template jawaban dan kata kunci (bisa ditambah/diubah untuk jaga-jaga)
const BOT_TEMPLATES = [
  {
    keywords: ['halo', 'hai', 'pagi', 'siang', 'sore', 'malam', 'hello'],
    reply: 'Halo! Ada yang bisa saya bantu terkait layanan photobooth SnapHub? 📷✨'
  },
  {
    keywords: ['terima kasih', 'makasih', 'thanks', 'thank you'],
    reply: 'Sama-sama! Jangan ragu untuk bertanya lagi atau langsung hubungi admin kami via WhatsApp ya. 🙏'
  },
  {
    keywords: ['pricelist', 'harga', 'paket', 'biaya', 'berapa'],
    reply: 'Kami memiliki 3 pilihan paket Photobooth utama:\n1. Soft File Only (mulai Rp 999.000)\n2. Limited Print (mulai Rp 1.800.000)\n3. Unlimited Print (mulai Rp 2.400.000)\n\nAnda bisa melihat rincian lengkap tiap paket dan tambahan jamnya di bagian "Pricelist" pada website kami. 📸'
  },
  {
    keywords: ['rekomendasi', 'saran', 'bagusnya'],
    reply: 'Untuk acara pernikahan atau event besar, kami sangat merekomendasikan Paket Unlimited Print! Sedangkan untuk intimate event atau ulang tahun, Paket Limited Print (mulai 100 prints) sudah sangat cocok. Ingin rekomendasi yang lebih pas? Yuk ngobrol dengan admin di WhatsApp! 🪄'
  },
  {
    keywords: ['lokasi', 'alamat', 'tempat', 'dimana', 'luar kota', 'area', 'cover'],
    reply: 'Kami siap meluncur langsung ke lokasi acara Anda! Tim SnapHub meng-cover berbagai area (termasuk gratis transport untuk area Malang Kota). Untuk detail acara luar kota dan biayanya, silakan hubungi admin kami. 🚗💨'
  },
  {
    keywords: ['admin', 'manusia', 'ngobrol', 'berbicara', 'hubungi'],
    reply: 'Ingin berdiskusi lebih detail atau ada pertanyaan khusus? Jangan ragu untuk ngobrol langsung dengan tim admin kami! Silakan klik tombol "Chat via WhatsApp" berwarna hijau di bawah ya. 😊💬'
  },
  {
    keywords: ['cara pesan', 'cara booking', 'order', 'pesan', 'alur'],
    reply: 'Cara booking sangat mudah!\n1. Cek ketersediaan tanggal.\n2. Pilih paket pilihan.\n3. Hubungi admin via WhatsApp untuk konfirmasi & DP.\n4. Tim kami siap memeriahkan acara Anda! 🎉'
  },
  {
    keywords: ['fasilitas', 'dapat apa', 'cetak', 'print', 'template', 'kamera', 'alat'],
    reply: 'Setiap paket kami sudah otomatis termasuk:\n✅ Kamera, Lighting & Monitor 24"\n✅ 2 Standby Crew & Funprops\n✅ Free Custom Design (Max 2 Revisi)\n✅ Soft File via QR & GIF Booth\n✅ Free Transport Kota Malang\nUntuk paket cetak, kami pakai Highspeed Printer & Kertas High Quality! 🎭'
  },
  {
    keywords: ['durasi', 'jam', 'waktu', 'berapa lama'],
    reply: 'Durasi sewa kami sangat fleksibel! Anda bebas memilih paket mulai dari 2 jam hingga 10 jam sesuai kebutuhan acara. Tersedia juga extra time di hari H jika acara Anda memanjang! ⏰'
  },
  {
    keywords: ['dp', 'bayar', 'pembayaran', 'lunas', 'rekening', 'transfer'],
    reply: 'Untuk mengamankan jadwal, Anda cukup membayar DP (Down Payment) sebesar 50%. Pelunasan dapat dilakukan maksimal H-1 acara via transfer bank. 💳'
  },
  {
    keywords: ['setup', 'loading', 'datang jam berapa', 'persiapan', 'stanby'],
    reply: 'Tim kami akan tiba di lokasi acara 1-2 jam sebelum acara dimulai untuk melakukan loading barang, setup peralatan, dan tes foto. ⏱️'
  },
  {
    keywords: ['custom', 'desain', 'template', 'frame', 'tulisan', 'watermark'],
    reply: 'Bisa banget! Anda bebas menentukan desain, warna, dan tulisan pada frame/template foto agar sesuai dengan tema acara Anda. Tim desainer kami siap membantu! 🎨'
  },
  {
    keywords: ['listrik', 'watt', 'daya', 'colokan'],
    reply: 'Untuk operasional photobooth, kami membutuhkan akses listrik standar dengan daya kurang lebih 500-900 watt di dekat area photobooth. 🔌'
  },
  {
    keywords: ['outdoor', 'luar ruangan', 'tenda', 'angin'],
    reply: 'Bisa untuk acara outdoor! Namun kami sarankan agar area photobooth memiliki atap/kanopi untuk melindungi peralatan dari hujan atau sinar matahari langsung, serta meminimalisir angin kencang. ⛺'
  },
  {
    keywords: ['ukuran', 'kertas', 'strip', '4r', 'polaroid'],
    reply: 'Kami menyediakan beberapa opsi ukuran cetak foto. Yang paling populer adalah ukuran 4R standar dan ukuran Photostrip (2x6 inch). Bebas pilih sesuai selera Anda! 📏'
  },
  {
    keywords: ['background', 'backdrop', 'latar belakang', 'warna'],
    reply: 'Setiap paket sudah termasuk pilihan standar backdrop dari kami (seperti kain hitam, putih, dll). Ingin custom backdrop atau pakai greenscreen? Hubungi admin kami untuk detailnya! 🎪'
  },
  {
    keywords: ['operator', 'crew', 'kru', 'petugas', 'jaga'],
    reply: 'Tentu saja! Semua harga paket kami sudah termasuk 2 orang kru/operator profesional yang akan standby melayani tamu Anda selama acara berlangsung. Serta Free Transport untuk Kota Malang! 🤵🏻‍♂️'
  },
  {
    keywords: ['softcopy', 'file', 'gdrive', 'flashdisk', 'mentahan'],
    reply: 'Jangan khawatir! Soft file bisa langsung didapatkan via QR di lokasi acara. Dan setiap paket (termasuk paket Soft File Only) sudah dilengkapi dengan fitur GIF Booth yang seru! 💾'
  },
  {
    keywords: ['batal', 'cancel', 'refund', 'reschedule', 'undur'],
    reply: 'Untuk kebijakan pembatalan (refund) atau perubahan jadwal (reschedule), mohon konsultasikan langsung dengan admin kami via WhatsApp ya! 📅'
  },
  {
    keywords: ['promo', 'diskon', 'potongan', 'murah', 'cashback'],
    reply: 'Terkadang kami memiliki promo spesial lho! 🎉 Langsung saja klik tombol WhatsApp di bawah untuk menanyakan promo apa yang sedang berlangsung bulan ini.'
  },
  {
    keywords: ['h-1', 'mepet', 'dadakan', 'besok', 'batas waktu'],
    reply: 'Kami menyarankan booking maksimal H-7 sebelum acara. Tapi jika Anda butuh dadakan (H-1 / H-2), silakan chat admin via WA untuk memastikan ketersediaan tim kami! 🚀'
  }
];

const BotAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && !hasOpened) {
      setHasOpened(true);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages([
          {
            id: 1,
            sender: 'bot',
            text: 'Halo! Saya Asisten AI Snapies. Ada yang bisa saya bantu hari ini? 📸 ✨\n\nAnda bisa menanyakan tentang harga paket sewa, mengecek ketersediaan tanggal acara, atau meminta rekomendasi paket.',
          }
        ]);
      }, 600);
    }
  }, [isOpen, hasOpened]);

  const quickReplies = [
    { label: '💰 Pricelist & Paket', text: 'Saya ingin info pricelist dan paket.' },
    { label: '🗓️ Cek Jadwal', text: 'Saya ingin cek jadwal ketersediaan.' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (text) => {
    if (!text.trim()) return;

    // Add user message
    const newUserMsg = { id: Date.now(), sender: 'user', text };
    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    // Mock bot reply logic
    setTimeout(async () => {
      let replyText = 'Maaf, saya belum mengerti pertanyaan Anda. Silakan hubungi admin via WhatsApp untuk ngobrol lebih lanjut ya! 😊';
      const lowerText = text.toLowerCase();

      // Cek jadwal secara spesifik dari database
      if (lowerText.match(/jadwal|ketersediaan|cek|tanggal|booking|kosong|kapan/)) {
        try {
          const { data, error } = await supabase.from('booked_dates').select('*');
          if (!error && data) {
            const today = new Date(new Date().setHours(0, 0, 0, 0));
            const upcoming = data
              .filter(d => new Date(d.date) >= today)
              .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (upcoming.length > 0) {
              const dateStrings = upcoming.map(d => {
                const dateObj = new Date(d.date);
                const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
              }).join(', ');

              replyText = `Saat ini, jadwal yang sudah FULL BOOKED adalah tanggal:\n🗓️ ${dateStrings}.\n\nSelain tanggal-tanggal tersebut, jadwal kami masih AVAILABLE! (Syarat booking idealnya maksimal H-7 sebelum acara). Untuk melihat kalender lebih jelas, silakan gulir (scroll) ke bagian Schedule di website kami, atau chat admin untuk mengamankan tanggal Anda! ✨`;
            } else {
              replyText = 'Kabar baik! Saat ini jadwal kami masih kosong dan AVAILABLE. (Syarat booking idealnya maksimal H-7 sebelum acara). Untuk melihat kalender lebih jelas, silakan gulir (scroll) ke bagian Schedule di website kami. Segera hubungi admin via WhatsApp untuk mengamankan tanggal spesial Anda! 🗓️✨';
            }
          } else {
            replyText = 'Untuk mengecek ketersediaan jadwal, Anda bisa menggulir (scroll) ke bagian Schedule di website kami atau langsung hubungi admin via WhatsApp ya! 🗓️✨';
          }
        } catch (e) {
          console.error('Gagal mengecek jadwal:', e);
          replyText = 'Untuk mengecek ketersediaan jadwal, Anda bisa menggulir (scroll) ke bagian Schedule di website kami atau langsung hubungi admin via WhatsApp ya! 🗓️✨';
        }
      } else {
        // Cek apakah input mengandung salah satu keyword di BOT_TEMPLATES
        for (const template of BOT_TEMPLATES) {
          if (template.keywords.some(keyword => lowerText.includes(keyword))) {
            replyText = template.reply;
            break; // Hentikan pencarian setelah menemukan kecocokan pertama
          }
        }
      }

      const botReply = {
        id: Date.now() + 1,
        sender: 'bot',
        text: replyText,
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, botReply]);
    }, 1200);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end space-y-3 sm:space-y-4">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-[#111111] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden mb-2 border border-white/10 h-[480px] sm:h-[500px] max-h-[calc(100vh-140px)]"
          >
            {/* Header */}
            <div className="bg-[#0B0B0B] text-white p-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#D90429] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(217,4,41,0.5)]">
                  SP
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Snapies Assistant</h3>
                  <div className="flex items-center text-xs text-green-400">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
                    Online
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 min-h-0 p-4 bg-[#050505] overflow-y-auto overscroll-contain flex flex-col space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.sender === 'user'
                        ? 'bg-[#D90429] text-white rounded-br-none shadow-md'
                        : 'bg-[#1C1C1C] text-gray-200 border border-white/5 shadow-sm rounded-tl-none'
                        }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div
                    key="typing-indicator"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="flex justify-start"
                  >
                    <div className="bg-[#1C1C1C] border border-white/5 shadow-sm rounded-2xl rounded-tl-none p-3.5 px-4 flex items-center space-x-1.5 w-fit">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.15 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.3 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            <div className="px-4 py-3 bg-[#0B0B0B] flex gap-2 border-t border-white/5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {quickReplies.map((qr, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(qr.text)}
                  className="whitespace-nowrap px-2.5 py-1.5 text-[11px] sm:text-xs border border-white/10 rounded-full text-gray-300 hover:bg-white/5 hover:border-white/20 transition-all duration-200"
                >
                  {qr.label}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-[#0B0B0B] border-t border-white/5">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend(inputValue)}
                  placeholder="Tulis pesan Anda..."
                  className="flex-1 bg-[#161616] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D90429] focus:ring-1 focus:ring-[#D90429] transition-all"
                />
                <button
                  onClick={() => handleSend(inputValue)}
                  disabled={!inputValue.trim()}
                  className="bg-gradient-to-r from-[#D90429] to-[#A50320] hover:opacity-90 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-opacity shadow-md disabled:opacity-50"
                >
                  <FaPaperPlane size={14} />
                </button>
              </div>
            </div>

            {/* Direct WhatsApp Button in Chat */}
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-[#D90429] to-[#A50320] text-white text-center py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity flex justify-center items-center gap-2 border-t border-white/10"
            >
              <FaWhatsapp size={18} />
              Hubungi Admin via WhatsApp
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Buttons Group */}
      <div className="flex flex-col items-center space-y-3 z-10">
        {/* Chat Toggle Button */}
        <div className="relative flex items-center justify-end group">
          {/* Tooltip */}
          {!isOpen && (
            <div className="absolute right-[4.5rem] whitespace-nowrap bg-white text-[#D90429] text-[13px] font-bold px-4 py-2.5 rounded-2xl shadow-[0_5px_15px_rgba(0,0,0,0.1)] opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none">
              Tanya Asisten AI
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white rotate-45" />
            </div>
          )}

          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="relative w-14 h-14 rounded-full flex items-center justify-center bg-[#D90429] text-white hover:bg-[#A50320] transition-colors bot-pulse"
          >
            {isOpen ? <FaChevronDown size={22} /> : <FaRobot size={24} />}
          </motion.button>
        </div>

        {/* WhatsApp Button */}
        <div className="relative flex items-center justify-end group">
          {/* Tooltip */}
          <div className="absolute right-[4.5rem] whitespace-nowrap bg-white text-[#128C7E] text-[13px] font-bold px-4 py-2.5 rounded-2xl shadow-[0_5px_15px_rgba(0,0,0,0.1)] opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none">
            Hubungi Sekarang
            <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white rotate-45" />
          </div>

          <motion.a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="relative w-14 h-14 rounded-full flex items-center justify-center wa-pulse"
            style={{
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              boxShadow: '0 4px 24px rgba(37,211,102,0.4), 0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {/* WhatsApp icon */}
            <svg
              className="w-7 h-7 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </motion.a>
        </div>
      </div>
    </div>
  );
};

export default BotAssistant;
