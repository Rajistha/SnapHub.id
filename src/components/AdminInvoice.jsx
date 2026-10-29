import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { SNAPHUB_LOGO_BASE64, SNAPHUB_LOGO_RED_BASE64 } from '../assets/logoBase64';
import {
  FiFileText, FiPlus, FiTrash2, FiPrinter, FiDownload, FiSave,
  FiEdit2, FiRefreshCw, FiDollarSign, FiSearch, FiSliders,
  FiChevronDown, FiX, FiLayers, FiColumns, FiMaximize2,
  FiUser, FiTag, FiZoomIn, FiZoomOut, FiCalendar, FiClock,
  FiMapPin, FiPhone, FiMail, FiCheck, FiCheckCircle, FiCreditCard,
  FiShield, FiArrowRight, FiFilePlus, FiShare2, FiEye, FiPercent,
  FiTrendingUp, FiAlertCircle, FiType
} from 'react-icons/fi';
import { SiWhatsapp } from 'react-icons/si';
import { DEFAULT_PACKAGES, formatRupiah, mergePackages } from '../lib/pricelistDefaults';

const STORAGE_KEY = 'snaphub_documents_history';

// Helper pemisah ribuan
const formatThousand = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return new Intl.NumberFormat('id-ID').format(clean);
};

const parseRawNumber = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  return parseInt(String(val).replace(/\D/g, ''), 10) || 0;
};

// Generate nomor dokumen unik berurutan
const generateDocNumber = (type, existingDocs = []) => {
  const prefix = type === 'quotation' ? 'QUO' : 'INV';
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sameMonthDocs = existingDocs.filter(d => 
    d.number && d.number.startsWith(`${prefix}-${yearMonth}`)
  );
  const nextSeq = String(sameMonthDocs.length + 1).padStart(3, '0');
  return `${prefix}-${yearMonth}-${nextSeq}`;
};

const todayString = () => new Date().toISOString().split('T')[0];

const futureDateString = (days = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatDateIndo = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const inputCls =
  'w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)]/50 focus:outline-none focus:border-[#D90429] focus:ring-2 focus:ring-[#D90429]/15 hover:border-[var(--admin-border)]/80 transition-all';

const labelCls = 'block text-[11px] font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1.5';

const DEFAULT_BANK_INFO = {
  bankName: 'Bank Jago',
  accountNumber: '1023 0289 6677',
  accountHolder: 'Made Puja Rajistha AW',
  qrisNote: 'Tersedia QRIS All Payment (Gopay, OVO, ShopeePay, BCA, Mandiri, dll)',
};

const DEFAULT_TNC_ITEMS = [
  'Booking jadwal dianggap sah dan mengikat setelah pembayaran Down Payment (DP) minimal 30%.',
  'Pelunasan sisa tagihan wajib diselesaikan maksimal H-1 sebelum waktu pelaksanaan acara.',
  'Konfirmasi perubahan jadwal/waktu maksimal H-7 sebelum acara (tergantung ketersediaan slot).',
  'Pembatalan sepihak oleh penyewa mengakibatkan uang muka (DP) dinyatakan hangus.',
  'Tim SnapHub standby di lokasi acara ±1 jam sebelum jadwal sewa dimulai untuk setup dan kalibrasi.',
  'Pihak penyelenggara/klien wajib menyediakan colokan listrik (min. 1000W) dan area min. 3x3 meter.',
];

const FONT_OPTIONS = [
  { id: 'inter', label: 'Inter (Modern Clean)', family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'arial', label: 'Arial (Standar Bersih)', family: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  { id: 'calibri', label: 'Calibri (Office Formal)', family: 'Calibri, "Segoe UI", Candara, Optima, -apple-system, sans-serif' },
  { id: 'poppins', label: 'Poppins (Brand Geometric)', family: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'jakarta', label: 'Plus Jakarta Sans (Corporate)', family: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'times', label: 'Times New Roman (Serif Formal)', family: '"Times New Roman", Times, "Liberation Serif", Georgia, serif' },
];

const AdminInvoice = () => {
  // View mode: 'split' (desktop side-by-side) | 'editor' | 'preview' | 'history'
  const [viewMode, setViewMode] = useState('split');
  const [openPresetPkg, setOpenPresetPkg] = useState(null);

  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [savingDoc, setSavingDoc] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Document form state
  const [currentId, setCurrentId] = useState(null);
  const [docType, setDocType] = useState('quotation'); // 'quotation' | 'invoice'
  const [docNumber, setDocNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayString());
  const [dueDate, setDueDate] = useState(futureDateString(7));
  const [status, setStatus] = useState('sent');
  const [docFont, setDocFont] = useState('inter');
  const selectedFontObj = useMemo(
    () => FONT_OPTIONS.find((f) => f.id === docFont) || FONT_OPTIONS[0],
    [docFont]
  );
  
  // Client & Event Details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventVenue, setEventVenue] = useState('');

  // Itemized Services
  const [items, setItems] = useState([
    {
      id: 'item-1',
      name: 'Paket Unlimited Print (3 Jam)',
      description: '• Cetak sepuasnya tanpa batas (Highspeed Print)\n• Unlimited Shots + Soft file via QR & GIF Booth\n• Custom Desain Frame 2R/4R (Free 2 Desain)\n• Aksesoris & Fun Props eksklusif\n• 2 Crew Standby + Lighting & Live Monitor 24"',
      qty: 1,
      unitPrice: 2900000,
      total: 2900000,
    }
  ]);

  // Financials
  const [discount, setDiscount] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [dpDate, setDpDate] = useState('');

  // Custom bank info & TNC
  const [bankInfo, setBankInfo] = useState(DEFAULT_BANK_INFO);
  const [isBankEditing, setIsBankEditing] = useState(false);
  const [tncList, setTncList] = useState(DEFAULT_TNC_ITEMS);
  const [notes, setNotes] = useState('Terima kasih atas kepercayaan Anda memilih SnapHub Photobooth sebagai partner dokumentasi acara Anda. Abadikan setiap senyum bersama kami!');
  const [showStamp, setShowStamp] = useState(true);
  const [stampShape, setStampShape] = useState('oval'); // 'oval' | 'round'

  // Zoom & A4 scaling for split view & preview
  const [zoomMode, setZoomMode] = useState('fit'); // 'fit' | 'custom'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);
  const [docHeight, setDocHeight] = useState(1123);
  const printAreaRef = useRef(null);
  const previewContainerRef = useRef(null);
  const presetDropdownRef = useRef(null);

  // ResizeObserver to calculate container width for auto-fit zoom in split view
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const updateSize = () => {
      if (previewContainerRef.current) {
        setContainerWidth(previewContainerRef.current.clientWidth);
      }
      if (printAreaRef.current) {
        setDocHeight(printAreaRef.current.offsetHeight || 1123);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(previewContainerRef.current);
    if (printAreaRef.current) ro.observe(printAreaRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [viewMode, items, docType, notes, tncList, discount, downPayment]);

  const activeScale = useMemo(() => {
    if (zoomMode === 'custom') return zoomLevel;
    // Fit width: available width minus horizontal padding (24px)
    const available = Math.max(280, containerWidth - 24);
    const scale = available / 794;
    return Math.min(1.05, Math.max(0.35, Number(scale.toFixed(3))));
  }, [zoomMode, zoomLevel, containerWidth]);

  // Close preset dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target)) {
        setOpenPresetPkg(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Load custom pricelist from Supabase
  useEffect(() => {
    const loadPricelist = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'pricelist')
          .single();
        if (data?.value?.packages) {
          setPackages(mergePackages(data.value.packages));
        }
      } catch {
        // Fallback default
      }
    };
    loadPricelist();
  }, []);

  // Load documents history
  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'invoices_quotations')
          .single();

        if (data?.value && Array.isArray(data.value)) {
          setHistory(data.value);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value));
          if (!docNumber) {
            setDocNumber(generateDocNumber('quotation', data.value));
          }
        } else {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            setHistory(parsed);
            if (!docNumber) setDocNumber(generateDocNumber('quotation', parsed));
          } else {
            if (!docNumber) setDocNumber(generateDocNumber('quotation', []));
          }
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setHistory(parsed);
          if (!docNumber) setDocNumber(generateDocNumber('quotation', parsed));
        } else {
          if (!docNumber) setDocNumber(generateDocNumber('quotation', []));
        }
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  // Sync calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [items]);

  const discountNum = useMemo(() => parseRawNumber(discount), [discount]);
  const dpNum = useMemo(() => {
    if (status !== 'partial') return 0;
    return parseRawNumber(downPayment);
  }, [downPayment, status]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountNum);
  }, [subtotal, discountNum]);

  const balanceDue = useMemo(() => {
    if (status === 'paid') return 0;
    return Math.max(0, totalAmount - dpNum);
  }, [totalAmount, dpNum, status]);

  // Statistik Riwayat Dokumen untuk KPI Dashboard
  const historyStats = useMemo(() => {
    const totalDocs = history.length;
    const quotations = history.filter((d) => d.docType === 'quotation');
    const invoices = history.filter((d) => d.docType === 'invoice');
    const paidInvoices = invoices.filter((d) => d.status === 'paid');
    const totalPaidVal = paidInvoices.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
    const totalInvoicedVal = invoices.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
    return {
      totalDocs,
      quoCount: quotations.length,
      invCount: invoices.length,
      paidCount: paidInvoices.length,
      totalPaidVal,
      totalInvoicedVal,
    };
  }, [history]);

  // Item helpers
  const addItem = (custom = null) => {
    const newItem = custom || {
      id: `item-${Date.now()}`,
      name: '',
      description: '',
      qty: 1,
      unitPrice: 0,
      total: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const updateItem = (index, patch) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], ...patch };
      target.total = (target.qty || 1) * (target.unitPrice || 0);
      copy[index] = target;
      return copy;
    });
  };

  const removeItem = (index) => {
    if (items.length <= 1) {
      toast.error('Minimal harus ada 1 item di dalam dokumen');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick preset from pricelist
  const applyPreset = (pkg, priceObj) => {
    const featureText = (pkg.features || []).map((f) => `• ${f}`).join('\n');
    const noteText = pkg.extraNote ? `\n• Catatan: ${pkg.extraNote}` : '';
    const desc = `${featureText}${noteText}`;

    const newItem = {
      id: `item-${Date.now()}`,
      name: `Paket ${pkg.label} (${priceObj.label}${priceObj.sub ? ` - ${priceObj.sub}` : ''})`,
      description: desc,
      qty: 1,
      unitPrice: priceObj.price,
      total: priceObj.price,
    };

    setItems([newItem]);
    toast.success(`Paket ${pkg.label} berhasil dimasukkan!`);
  };

  // Convert Quotation -> Invoice
  const handleConvertType = () => {
    if (docType === 'quotation') {
      setDocType('invoice');
      setStatus('unpaid');
      setDocNumber(generateDocNumber('invoice', history));
      toast.success('Beralih ke format Tagihan (INVOICE)');
    } else {
      setDocType('quotation');
      setStatus('sent');
      setDocNumber(generateDocNumber('quotation', history));
      toast.success('Beralih ke format Penawaran (QUOTATION)');
    }
  };

  // Reset to brand new document
  const handleNewDocument = () => {
    setCurrentId(null);
    setDocNumber(generateDocNumber(docType, history));
    setIssueDate(todayString());
    setDueDate(futureDateString(7));
    setStatus(docType === 'quotation' ? 'sent' : 'unpaid');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientCompany('');
    setEventName('');
    setEventDate('');
    setEventTime('');
    setEventVenue('');
    setDiscount('');
    setDownPayment('');
    setDpDate('');
    setItems([
      {
        id: `item-${Date.now()}`,
        name: 'Paket Unlimited Print (3 Jam)',
        description: '• Cetak sepuasnya tanpa batas (Highspeed Print)\n• Unlimited Shots + Soft file via QR & GIF Booth\n• Custom Desain Frame 2R/4R (Free 2 Desain)\n• Aksesoris & Fun Props eksklusif\n• 2 Crew Standby + Lighting & Live Monitor 24"',
        qty: 1,
        unitPrice: 2900000,
        total: 2900000,
      }
    ]);
    toast.success('Formulir dokumen baru disiapkan');
  };

  // Save to Cloud & Local
  const handleSaveDocument = async () => {
    if (!clientName.trim()) {
      toast.error('Nama klien wajib diisi');
      return;
    }
    if (!docNumber.trim()) {
      toast.error('Nomor dokumen wajib diisi');
      return;
    }
    if (items.some((it) => !it.name.trim() || it.total <= 0)) {
      toast.error('Pastikan semua baris item memiliki nama dan harga');
      return;
    }

    setSavingDoc(true);
    const docId = currentId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      id: docId,
      docType,
      docFont,
      number: docNumber,
      issueDate,
      dueDate,
      status,
      client: {
        name: clientName,
        phone: clientPhone,
        email: clientEmail,
        company: clientCompany,
      },
      event: {
        name: eventName,
        date: eventDate,
        time: eventTime,
        venue: eventVenue,
      },
      items,
      subtotal,
      discount: discountNum,
      totalAmount,
      downPayment: dpNum,
      dpDate,
      balanceDue,
      bankInfo,
      tncList,
      notes,
      updatedAt: new Date().toISOString(),
    };

    try {
      const existingIdx = history.findIndex((d) => d.id === docId);
      let updatedHistory;
      if (existingIdx >= 0) {
        updatedHistory = [...history];
        updatedHistory[existingIdx] = payload;
      } else {
        updatedHistory = [payload, ...history];
      }

      setHistory(updatedHistory);
      setCurrentId(docId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));

      await supabase.from('site_settings').upsert({
        key: 'invoices_quotations',
        value: updatedHistory,
      });

      toast.success(`${docType === 'quotation' ? 'Quotation' : 'Invoice'} berhasil disimpan!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan ke cloud, data tersimpan di browser');
    } finally {
      setSavingDoc(false);
    }
  };

  // Load document from history
  const handleLoadDocument = (doc) => {
    setCurrentId(doc.id);
    setDocType(doc.docType || 'quotation');
    setDocFont(doc.docFont || 'inter');
    setDocNumber(doc.number || '');
    setIssueDate(doc.issueDate || todayString());
    setDueDate(doc.dueDate || futureDateString(7));
    setStatus(doc.status || 'sent');

    setClientName(doc.client?.name || '');
    setClientPhone(doc.client?.phone || '');
    setClientEmail(doc.client?.email || '');
    setClientCompany(doc.client?.company || '');

    setEventName(doc.event?.name || '');
    setEventDate(doc.event?.date || '');
    setEventTime(doc.event?.time || '');
    setEventVenue(doc.event?.venue || '');

    setItems(doc.items && doc.items.length > 0 ? doc.items : []);
    setDiscount(doc.discount ? formatThousand(doc.discount) : '');
    setDownPayment(doc.downPayment ? formatThousand(doc.downPayment) : '');
    setDpDate(doc.dpDate || '');

    if (doc.bankInfo) setBankInfo(doc.bankInfo);
    if (doc.tncList) setTncList(doc.tncList);
    if (doc.notes !== undefined) setNotes(doc.notes);

    toast.success(`Dokumen ${doc.number} dimuat`);
  };

  // Delete from history
  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Yakin ingin menghapus dokumen ini dari riwayat?')) return;
    const updated = history.filter((d) => d.id !== id);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (currentId === id) {
      handleNewDocument();
    }
    try {
      await supabase.from('site_settings').upsert({
        key: 'invoices_quotations',
        value: updated,
      });
      toast.success('Dokumen dihapus');
    } catch {
      toast.error('Gagal menghapus di cloud');
    }
  };

  // Print execution
  const handlePrint = () => {
    window.print();
  };

  // Direct Download PDF (No print dialog, pixel-perfect A4)
  const handleDownloadPDF = async () => {
    const el = printAreaRef.current;
    if (!el) return;

    setDownloadingPdf(true);
    const toastId = toast.loading('Sedang menyiapkan file PDF...');

    try {
      // Temporarily remove preview scale for 1:1 crisp render
      const prevTransform = el.style.transform;
      const prevTransition = el.style.transition;
      el.style.transform = 'none';
      el.style.transition = 'none';

      // Wait 100ms for layout reflow
      await new Promise((r) => setTimeout(r, 100));

      const canvas = await html2canvas(el, {
        scale: 2, // 2x for sharp 300 DPI text & vector rendering
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });

      // Restore preview scale
      el.style.transform = prevTransform;
      el.style.transition = prevTransition;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const filename = `${docType === 'quotation' ? 'Quotation' : 'Invoice'}-${docNumber || 'SnapHub'}.pdf`;
      pdf.save(filename);

      toast.success(`PDF berhasil diunduh: ${filename}`, { id: toastId });
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error(`Gagal unduh: ${err?.message || 'Error'}, silakan gunakan tombol Cetak`, { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Send WhatsApp message
  const handleSendWhatsApp = () => {
    if (!clientPhone) {
      toast.error('Isi nomor WhatsApp klien terlebih dahulu');
      return;
    }
    const cleanPhone = clientPhone.replace(/\D/g, '').replace(/^0/, '62');
    const isQuo = docType === 'quotation';

    let msg = `Halo Kak *${clientName || 'Klien'}*, salam hangat dari *SnapHub Photobooth Malang*! ✨\n\n`;
    if (isQuo) {
      msg += `Berikut kami lampirkan *Surat Penawaran Resmi (Quotation)*:\n`;
      msg += `📄 *No. Dokumen:* ${docNumber}\n`;
      msg += `📅 *Tanggal Terbit:* ${formatDateIndo(issueDate)}\n`;
      if (eventName) msg += `🎉 *Acara:* ${eventName} (${formatDateIndo(eventDate)})\n`;
      msg += `\n*Rincian Paket & Layanan:*\n`;
      items.forEach((it, idx) => {
        msg += `${idx + 1}. *${it.name}* (Qty: ${it.qty}) - ${formatRupiah(it.total)}\n`;
      });
      if (discountNum > 0) msg += `🎁 *Diskon:* -${formatRupiah(discountNum)}\n`;
      msg += `\n💰 *Total Investasi:* *${formatRupiah(totalAmount)}*\n`;
      msg += `⏳ *Berlaku hingga:* ${formatDateIndo(dueDate)}\n\n`;
      msg += `Silakan konfirmasi jika Kakak berkenan untuk mengunci slot jadwal acara. Terima kasih! 🙏`;
    } else {
      msg += `Berikut kami sampaikan *Faktur Tagihan Resmi (Invoice)*:\n`;
      msg += `📄 *No. Invoice:* ${docNumber}\n`;
      if (eventName) msg += `🎉 *Acara:* ${eventName} (${formatDateIndo(eventDate)})\n`;
      msg += `💰 *Total Biaya:* ${formatRupiah(totalAmount)}\n`;
      if (dpNum > 0) {
        msg += `✅ *DP Terbayar:* ${formatRupiah(dpNum)}\n`;
        msg += `⏳ *Sisa Pelunasan:* *${formatRupiah(balanceDue)}*\n`;
      } else {
        msg += `⏳ *Status:* Menunggu Pembayaran DP / Lunas\n`;
      }
      msg += `\n*Pembayaran dapat ditransfer ke:*\n`;
      msg += `🏦 *${bankInfo.bankName}*\n`;
      msg += `💳 *${bankInfo.accountNumber}*\n`;
      msg += `👤 a/n *${bankInfo.accountHolder}*\n\n`;
      msg += `Mohon kirimkan bukti transfer setelah pembayaran dilakukan ya Kak. Terima kasih banyak! ✨`;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter((d) => {
      const matchType = filterType === 'all' || d.docType === filterType;
      const q = searchHistory.toLowerCase();
      const matchSearch =
        !q ||
        (d.number && d.number.toLowerCase().includes(q)) ||
        (d.client?.name && d.client.name.toLowerCase().includes(q)) ||
        (d.event?.name && d.event.name.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [history, filterType, searchHistory]);

  return (
    <div className="space-y-6">
      {/* ── PRINT-ONLY STYLESHEET ── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 10mm 6mm 10mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all surrounding app chrome & buttons */
          nav, aside, header, footer, .no-print, button, input {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-document, #printable-document * {
            visibility: visible;
          }
          /* Target the printable document - Fits 100% into A4 without overflow */
          #printable-document {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #111827 !important;
            border-radius: 0 !important;
            transform: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }

        /* Scoped Document Font Styling (Live Screen Preview & Print/PDF) */
        #printable-document,
        #printable-document *:not(svg):not(text):not(tspan):not(textPath) {
          font-family: ${selectedFontObj.family} !important;
        }
        #printable-document .font-mono {
          font-family: ${selectedFontObj.family} !important;
          font-variant-numeric: tabular-nums !important;
        }
      `}</style>

      {/* ── TOP CONTROL BAR ── */}
      <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-2xl border border-[var(--admin-border)] shadow-[var(--admin-shadow)] no-print relative overflow-hidden space-y-4">
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D90429] via-[#E79EA7] to-transparent opacity-80" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-0.5">
          {/* Brand & Document Type Badge */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 px-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <img src={SNAPHUB_LOGO_RED_BASE64} alt="SnapHub Logo" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#D90429] bg-[#D90429]/10 px-2 py-0.5 rounded-full border border-[#D90429]/20">
                  Official Document Generator
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  {docType === 'quotation' ? 'Surat Penawaran Resmi' : 'Faktur Tagihan Resmi'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--admin-text-main)] font-heading tracking-tight mt-0.5">
                Quotation &amp; Invoice
              </h3>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={handleNewDocument}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--admin-hover-bg)] hover:bg-[var(--admin-border)] border border-[var(--admin-border)] text-xs font-bold text-[var(--admin-text-main)] transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              title="Buat dokumen baru dari awal"
            >
              <FiFilePlus size={14} className="text-[#D90429]" /> Dokumen Baru
            </button>
            <button
              onClick={handleSaveDocument}
              disabled={savingDoc}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D90429] to-[#B80323] hover:brightness-110 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-[#D90429]/20 active:scale-95 shrink-0"
              title="Simpan dokumen ke cloud dan database"
            >
              <FiSave size={14} /> {savingDoc ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D90429] hover:bg-[#b80323] text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
              title="Unduh langsung sebagai file PDF A4 resmi"
            >
              <FiDownload size={14} /> {downloadingPdf ? 'Mengunduh...' : 'Unduh PDF'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              title="Cetak langsung ke printer atau dialog cetak"
            >
              <FiPrinter size={14} /> Cetak
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm shadow-emerald-600/20 active:scale-95 shrink-0"
              title="Kirim ke WhatsApp Klien"
            >
              <SiWhatsapp size={14} /> WhatsApp
            </button>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--admin-border-subtle)]">
          <div className="flex items-center gap-1 bg-black/40 border border-[var(--admin-border)] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-[#D90429] text-white shadow-sm'
                  : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-white/5'
              }`}
            >
              <FiColumns size={13} /> Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'editor'
                  ? 'bg-[#D90429] text-white shadow-sm'
                  : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-white/5'
              }`}
            >
              <FiEdit2 size={13} /> Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-[#D90429] text-white shadow-sm'
                  : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-white/5'
              }`}
            >
              <FiMaximize2 size={13} /> Pratinjau A4
            </button>
            <button
              type="button"
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'history'
                  ? 'bg-[#D90429] text-white shadow-sm'
                  : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-white/5'
              }`}
            >
              <FiLayers size={13} /> Riwayat Dokumen
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                viewMode === 'history' ? 'bg-white/20 text-white' : 'bg-white/10 text-[var(--admin-text-muted)]'
              }`}>
                {history.length}
              </span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
            <span className="font-mono text-[11px] font-bold text-[var(--admin-accent)] bg-[var(--admin-accent-bg)] px-2.5 py-0.5 rounded-lg border border-[var(--admin-accent)]/20">
              {docNumber}
            </span>
            <span>•</span>
            <span className="capitalize font-semibold text-[var(--admin-text-main)]">{status}</span>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE: SPLIT / EDITOR / PREVIEW ── */}
      {viewMode !== 'history' && (
        <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 xl:grid-cols-12 items-start' : 'grid-cols-1'}`}>
          {/* ── LEFT: EDITOR COLUMN (Visible in 'split' or 'editor') ── */}
          {(viewMode === 'split' || viewMode === 'editor') && (
            <div className={`${viewMode === 'split' ? 'xl:col-span-5' : 'max-w-4xl mx-auto w-full'} space-y-5 no-print`}>
              {/* Kartu 1: Metadata Dokumen */}
              <div className="bg-[var(--admin-surface)] p-5 rounded-2xl border border-[var(--admin-border)] shadow-sm space-y-4 hover:border-[var(--admin-border)]/80 transition-all">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--admin-border-subtle)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#D90429]/15 text-[#D90429] flex items-center justify-center">
                      <FiSliders size={14} />
                    </div>
                    Dokumen &amp; Status
                  </span>
                  
                  {/* Segmented Switcher Type */}
                  <div className="flex items-center p-1 bg-black/40 border border-[var(--admin-border)] rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        if (docType !== 'quotation') handleConvertType();
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        docType === 'quotation'
                          ? 'bg-[#D90429] text-white shadow-sm'
                          : 'text-[var(--admin-text-muted)] hover:text-white'
                      }`}
                    >
                      Quotation
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (docType !== 'invoice') handleConvertType();
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        docType === 'invoice'
                          ? 'bg-[#D90429] text-white shadow-sm'
                          : 'text-[var(--admin-text-muted)] hover:text-white'
                      }`}
                    >
                      Invoice
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>No. Dokumen</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        className={`${inputCls} font-mono font-bold text-[var(--admin-accent)]`}
                        placeholder="QUO-202610-001"
                      />
                      <button
                        type="button"
                        onClick={() => setDocNumber(generateDocNumber(docType, history))}
                        title="Generate Nomor Baru Berurutan"
                        className="p-2.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-hover-bg)] hover:bg-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        <FiRefreshCw size={13} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Status Dokumen</label>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D90429] focus:ring-2 focus:ring-[#D90429]/15 transition-all cursor-pointer font-medium appearance-none"
                      >
                        {docType === 'quotation' ? (
                          <>
                            <option value="draft" className="bg-[#160F11] text-zinc-300">Draft (Konsep)</option>
                            <option value="sent" className="bg-[#160F11] text-sky-400">Terkirim (Sent)</option>
                            <option value="approved" className="bg-[#160F11] text-emerald-400">Disetujui (Approved)</option>
                            <option value="declined" className="bg-[#160F11] text-rose-400">Ditolak (Declined)</option>
                          </>
                        ) : (
                          <>
                            <option value="unpaid" className="bg-[#160F11] text-rose-400">Belum Dibayar (Unpaid)</option>
                            <option value="partial" className="bg-[#160F11] text-blue-400">Uang Muka / DP Terbayar</option>
                            <option value="paid" className="bg-[#160F11] text-emerald-400">Lunas (Paid in Full)</option>
                          </>
                        )}
                      </select>
                      <FiChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Tanggal Terbit</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      {docType === 'quotation' ? 'Berlaku Hingga' : 'Jatuh Tempo'}
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  {/* Gaya Font Dokumen */}
                  <div className="sm:col-span-2 pt-2 border-t border-[var(--admin-border-subtle)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-[var(--admin-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <FiType size={12} className="text-[#D90429]" /> Gaya Font Dokumen
                      </label>
                      <span
                        className="text-[11px] text-[var(--admin-accent)] font-semibold"
                        style={{ fontFamily: selectedFontObj.family }}
                      >
                        Pratinjau: {selectedFontObj.label.split(' ')[0]}
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={docFont}
                        onChange={(e) => {
                          setDocFont(e.target.value);
                          const chosen = FONT_OPTIONS.find((f) => f.id === e.target.value);
                          toast.success(`Font dokumen diubah ke ${chosen ? chosen.label.split(' ')[0] : e.target.value}`);
                        }}
                        style={{ colorScheme: 'dark', fontFamily: selectedFontObj.family }}
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D90429] focus:ring-2 focus:ring-[#D90429]/15 transition-all cursor-pointer font-medium appearance-none"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.id} value={f.id} className="bg-[#160F11] text-zinc-200" style={{ fontFamily: f.family }}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Kartu 2: Detail Klien & Acara */}
              <div className="bg-[var(--admin-surface)] p-5 rounded-2xl border border-[var(--admin-border)] shadow-sm space-y-4 hover:border-[var(--admin-border)]/80 transition-all">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--admin-border-subtle)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                      <FiUser size={14} />
                    </div>
                    Data Klien &amp; Acara
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>Nama Klien *</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className={inputCls}
                      placeholder="mis. Bpk. Andika Pratama"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Perusahaan / Instansi (Opsional)</label>
                    <input
                      type="text"
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                      className={inputCls}
                      placeholder="mis. PT Samudra Indonesia"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>WhatsApp Klien *</label>
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className={inputCls}
                      placeholder="081234567890"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email Klien (Opsional)</label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className={inputCls}
                      placeholder="client@gmail.com"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--admin-border-subtle)] space-y-3">
                  <div className="flex items-center gap-2">
                    <FiCalendar size={13} className="text-[var(--admin-accent)]" />
                    <span className="text-[11px] font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
                      Detail Pelaksanaan Acara
                    </span>
                  </div>

                  <div>
                    <label className={labelCls}>Nama Acara</label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      className={inputCls}
                      placeholder="mis. Wedding of Dian &amp; Bagas"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelCls}>Tanggal Acara</label>
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Waktu Operasional</label>
                      <input
                        type="text"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        className={inputCls}
                        placeholder="mis. 18.00 - 21.00 WIB"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Lokasi / Venue</label>
                    <input
                      type="text"
                      value={eventVenue}
                      onChange={(e) => setEventVenue(e.target.value)}
                      className={inputCls}
                      placeholder="mis. Grand Ballroom Ijen Suites Malang"
                    />
                  </div>
                </div>
              </div>

              {/* Kartu 3: Rincian Layanan (Itemized Services) */}
              <div className="bg-[var(--admin-surface)] p-5 rounded-2xl border border-[var(--admin-border)] shadow-sm space-y-4 hover:border-[var(--admin-border)]/80 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--admin-border-subtle)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                      <FiTag size={14} />
                    </div>
                    Rincian Paket &amp; Layanan ({items.length})
                  </span>
                </div>

                {/* Preset Buttons Popover Bar */}
                <div ref={presetDropdownRef} className="space-y-2">
                  <span className="text-[11px] font-bold text-[var(--admin-text-muted)] uppercase tracking-wider block">
                    + Pilih Paket Bawaan:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenPresetPkg(openPresetPkg === pkg.id ? null : pkg.id)}
                          className={`w-full text-center px-2 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm active:scale-95 ${
                            openPresetPkg === pkg.id
                              ? 'bg-[#D90429] text-white border-[#D90429]'
                              : 'bg-[var(--admin-hover-bg)] text-[var(--admin-text-main)] border-[var(--admin-border)] hover:border-[#D90429]/50'
                          }`}
                        >
                          <span className="truncate">{pkg.label}</span>
                          <FiChevronDown size={12} className={openPresetPkg === pkg.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>

                        {/* Dropdown Options Popup */}
                        {openPresetPkg === pkg.id && (
                          <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#140E10] border border-white/15 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#D28A94] border-b border-white/10">
                              {pkg.label} — Pilih Jam:
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-0.5">
                              {pkg.prices.map((pr, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    applyPreset(pkg, pr);
                                    setOpenPresetPkg(null);
                                  }}
                                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs text-zinc-200 hover:bg-[#D90429] hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                                >
                                  <span className="font-medium">{pr.label} {pr.sub ? `(${pr.sub})` : ''}</span>
                                  <span className="font-mono font-bold text-xs">{formatRupiah(pr.price)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-3 pt-1">
                  {items.map((item, idx) => (
                    <div key={item.id} className="p-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]/60 hover:border-[#D90429]/40 transition-all space-y-2.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="px-2 py-0.5 rounded-md bg-[var(--admin-hover-bg)] text-[10px] font-mono font-bold text-[var(--admin-accent)] border border-[var(--admin-border)]">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(idx, { name: e.target.value })}
                            placeholder="Nama Layanan / Paket..."
                            className="flex-1 bg-transparent border-b border-white/10 focus:border-[#D90429] text-xs font-bold text-[var(--admin-text-main)] outline-none py-1 transition-colors"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-[var(--admin-text-muted)] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Hapus baris ini"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        placeholder="Rincian fitur/fasilitas yang sudah termasuk..."
                        className="w-full bg-[var(--admin-hover-bg)] text-[11px] text-[var(--admin-text-muted)] focus:text-[var(--admin-text-main)] border border-[var(--admin-border)]/60 focus:border-[#D90429] rounded-lg p-2.5 outline-none resize-none leading-relaxed transition-colors"
                      />

                      <div className="grid grid-cols-3 gap-2.5 pt-1 items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[var(--admin-text-muted)] block mb-1">Qty</span>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--admin-text-main)] outline-none tabular-nums font-mono text-center font-bold"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[var(--admin-text-muted)] block mb-1">Harga Satuan (Rp)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatThousand(item.unitPrice)}
                            onChange={(e) => updateItem(idx, { unitPrice: parseRawNumber(e.target.value) })}
                            className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--admin-text-main)] outline-none tabular-nums text-right font-mono font-medium"
                          />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-[var(--admin-text-muted)] block mb-1">Subtotal</span>
                          <span className="text-xs font-bold text-[var(--admin-accent)] tabular-nums font-mono block py-1.5">
                            {formatRupiah(item.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Add Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => addItem()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] hover:text-white hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                  >
                    <FiPlus size={13} /> Tambah Item Bebas
                  </button>
                  <button
                    type="button"
                    onClick={() => addItem({
                      id: `item-${Date.now()}`,
                      name: 'Tambah Waktu Sewa (1 Jam)',
                      description: '• Penambahan durasi operasional photobooth di luar paket awal (tanpa cetak tambahan)',
                      qty: 1,
                      unitPrice: 500000,
                      total: 500000,
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] hover:text-white hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                  >
                    <FiPlus size={13} /> + Tambah Waktu (500rb)
                  </button>
                  <button
                    type="button"
                    onClick={() => addItem({
                      id: `item-${Date.now()}`,
                      name: 'Biaya Transport Luar Kota',
                      description: '• Akomodasi dan transportasi logistik & kru photobooth ke luar area Malang Kota',
                      qty: 1,
                      unitPrice: 350000,
                      total: 350000,
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] hover:text-white hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer"
                  >
                    <FiPlus size={13} /> + Transport Luar Kota
                  </button>
                </div>
              </div>

              {/* Kartu 4: Perhitungan & Pembayaran */}
              <div className="bg-[var(--admin-surface)] p-5 rounded-2xl border border-[var(--admin-border)] shadow-sm space-y-4 hover:border-[var(--admin-border)]/80 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--admin-border-subtle)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <FiDollarSign size={14} />
                    </div>
                    Ringkasan Finansial
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--admin-text-muted)]">Subtotal Layanan:</span>
                    <span className="font-mono font-semibold tabular-nums text-[var(--admin-text-main)]">{formatRupiah(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-1">
                    <span className="text-[var(--admin-text-muted)]">Potongan Diskon (Rp):</span>
                    <div className="w-36">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={discount}
                        onChange={(e) => setDiscount(formatThousand(e.target.value))}
                        placeholder="0"
                        className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-2.5 py-1.5 text-xs text-right tabular-nums font-mono text-[var(--admin-text-main)] outline-none focus:border-[#D90429]"
                      />
                    </div>
                  </div>

                  {/* Highlighted Total Biaya */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-[#D90429]/15 via-[var(--admin-surface)] to-transparent border border-[#D90429]/30">
                    <div>
                      <span className="font-bold text-xs uppercase tracking-wider text-[var(--admin-text-main)] block">
                        Total Biaya Dokumen:
                      </span>
                      <span className="text-[10px] text-[var(--admin-text-muted)]">
                        {docType === 'quotation' ? 'Estimasi total penawaran' : 'Total tagihan resmi'}
                      </span>
                    </div>
                    <span className="font-extrabold text-base text-[#D90429] tabular-nums font-mono">
                      {formatRupiah(totalAmount)}
                    </span>
                  </div>

                  {docType === 'invoice' && (
                    <>
                      <div className="flex items-center justify-between gap-4 pt-3 border-t border-[var(--admin-border-subtle)]">
                        <div>
                          <span className="font-medium text-[var(--admin-text-main)] block">Uang Muka (DP) Terbayar (Rp):</span>
                          <span className="text-[10px] text-[var(--admin-text-muted)]">
                            {status === 'partial' ? (
                              <span className="text-emerald-400 font-semibold">✓ Status aktif: DP Terbayar</span>
                            ) : (
                              'Status saat ini bukan DP'
                            )}
                          </span>
                        </div>
                        <div className="w-36 flex flex-col items-end gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={status === 'partial' ? downPayment : ''}
                            onChange={(e) => setDownPayment(formatThousand(e.target.value))}
                            disabled={status !== 'partial'}
                            placeholder={status === 'partial' ? '0' : '- (Terkunci)'}
                            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs text-right tabular-nums font-mono font-semibold outline-none transition-all ${
                              status === 'partial'
                                ? 'bg-[var(--admin-hover-bg)] border-emerald-500/50 text-emerald-400 focus:border-emerald-500'
                                : 'bg-[var(--admin-surface)]/60 border-[var(--admin-border)]/40 text-[var(--admin-text-muted)] opacity-50 cursor-not-allowed'
                            }`}
                          />
                          {status !== 'partial' && (
                            <button
                              type="button"
                              onClick={() => setStatus('partial')}
                              className="text-[10px] text-[#D90429] hover:underline font-semibold cursor-pointer"
                            >
                              + Aktifkan Input DP
                            </button>
                          )}
                        </div>
                      </div>

                      {status === 'partial' && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[var(--admin-text-muted)]">Tanggal Terima DP:</span>
                          <div className="w-36">
                            <input
                              type="date"
                              value={dpDate}
                              onChange={(e) => setDpDate(e.target.value)}
                              className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-2.5 py-1 text-xs text-[var(--admin-text-main)] outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-hover-bg)]">
                        <div>
                          <span className="font-bold text-xs uppercase tracking-wider text-[var(--admin-text-muted)] block">
                            Sisa Pelunasan (Balance Due)
                          </span>
                          <span className="text-[10px] text-[var(--admin-text-muted)]">
                            {status === 'paid' ? 'Tagihan sudah lunas sepenuhnya' : 'Wajib diselesaikan H-1 sebelum acara'}
                          </span>
                        </div>
                        <span className={`font-extrabold text-base tabular-nums font-mono ${status === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {status === 'paid' ? 'Rp 0 (LUNAS)' : formatRupiah(balanceDue)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Kartu 5: Syarat & Ketentuan & Stempel */}
              <div className="bg-[var(--admin-surface)] p-5 rounded-2xl border border-[var(--admin-border)] shadow-sm space-y-4 hover:border-[var(--admin-border)]/80 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--admin-border-subtle)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
                      <FiFileText size={14} />
                    </div>
                    Syarat &amp; Ketentuan ({tncList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setTncList(DEFAULT_TNC_ITEMS)}
                    className="text-xs text-[var(--admin-text-muted)] hover:text-white transition-colors cursor-pointer"
                  >
                    Reset Bawaan
                  </button>
                </div>

                <div className="space-y-2">
                  {tncList.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] text-[10px] font-mono text-[var(--admin-text-muted)] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        value={t}
                        onChange={(e) => {
                          const copy = [...tncList];
                          copy[i] = e.target.value;
                          setTncList(copy);
                        }}
                        className="flex-1 bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-[#D90429] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setTncList(tncList.filter((_, idx) => idx !== i))}
                        className="text-[var(--admin-text-muted)] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Hapus baris syarat ini"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setTncList([...tncList, ''])}
                  className="text-xs text-[#D90429] hover:underline flex items-center gap-1.5 cursor-pointer font-semibold pt-1"
                >
                  <FiPlus size={13} /> Tambah Poin Syarat
                </button>

                <div className="pt-3 border-t border-[var(--admin-border-subtle)] space-y-1.5">
                  <label className={labelCls}>Catatan Penutup untuk Klien</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-xl p-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[#D90429] resize-none leading-relaxed transition-colors"
                  />
                </div>

                {/* Stempel Toggle & Shape Selector */}
                <div className="pt-3 border-t border-[var(--admin-border-subtle)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[var(--admin-text-main)] block">Cap Stempel Resmi SnapHub</span>
                      <span className="text-[10px] text-[var(--admin-text-muted)]">Stempel merah resmi pada tanda tangan dokumen</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        checked={showStamp}
                        onChange={(e) => setShowStamp(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D90429]"></div>
                      <span className={`text-xs font-bold ${showStamp ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {showStamp ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </label>
                  </div>

                  {showStamp && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-semibold text-[var(--admin-text-muted)]">Model Cap Stempel:</span>
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-[var(--admin-border)]">
                        <button
                          type="button"
                          onClick={() => setStampShape('oval')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            stampShape === 'oval'
                              ? 'bg-[#D90429] text-white shadow-sm'
                              : 'text-[var(--admin-text-muted)] hover:text-white'
                          }`}
                        >
                          Oval (Bisnis)
                        </button>
                        <button
                          type="button"
                          onClick={() => setStampShape('round')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            stampShape === 'round'
                              ? 'bg-[#D90429] text-white shadow-sm'
                              : 'text-[var(--admin-text-muted)] hover:text-white'
                          }`}
                        >
                          Bulat (Lingkaran)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Kartu 6: Rekening & Metode Pembayaran */}
              <div className="bg-[var(--admin-surface)] p-5 rounded-2xl border border-[var(--admin-border)] shadow-sm space-y-3.5 hover:border-[var(--admin-border)]/80 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--admin-border-subtle)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                      <FiCreditCard size={14} />
                    </div>
                    Rekening Pembayaran
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBankEditing(!isBankEditing)}
                    className="text-xs font-semibold text-[var(--admin-text-muted)] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <FiEdit2 size={12} /> {isBankEditing ? 'Tutup Edit' : 'Ubah Rekening'}
                  </button>
                </div>

                {isBankEditing ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className={labelCls}>Nama Bank</label>
                      <input
                        type="text"
                        value={bankInfo.bankName}
                        onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                        className={inputCls}
                        placeholder="mis. Bank BCA / Bank Jago"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Nomor Rekening</label>
                      <input
                        type="text"
                        value={bankInfo.accountNumber}
                        onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
                        className={inputCls}
                        placeholder="1023 0289 6677"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Atas Nama</label>
                      <input
                        type="text"
                        value={bankInfo.accountHolder}
                        onChange={(e) => setBankInfo({ ...bankInfo, accountHolder: e.target.value })}
                        className={inputCls}
                        placeholder="Made Puja Rajistha AW"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Catatan QRIS / Metode Tambahan</label>
                      <input
                        type="text"
                        value={bankInfo.qrisNote}
                        onChange={(e) => setBankInfo({ ...bankInfo, qrisNote: e.target.value })}
                        className={inputCls}
                        placeholder="Tersedia QRIS All Payment..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)]/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--admin-text-muted)]">Bank Tujuan:</span>
                      <span className="font-bold text-[var(--admin-text-main)]">{bankInfo.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--admin-text-muted)]">Nomor Rekening:</span>
                      <span className="font-mono font-bold text-[var(--admin-accent)]">{bankInfo.accountNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--admin-text-muted)]">Atas Nama:</span>
                      <span className="font-medium text-[var(--admin-text-main)]">{bankInfo.accountHolder}</span>
                    </div>
                    <p className="text-[10px] text-[var(--admin-text-muted)] pt-1.5 border-t border-[var(--admin-border)]/50 italic">
                      {bankInfo.qrisNote}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RIGHT: LIVE A4 DOCUMENT CANVAS (Visible in 'split' or 'preview') ── */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div className={`${viewMode === 'split' ? 'xl:col-span-7 xl:sticky xl:top-6' : 'max-w-[850px] mx-auto w-full'}`}>
              {/* Preview Toolbar with A4 Indicator & Zoom Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 px-1 no-print">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[11px] font-bold text-[var(--admin-text-main)] shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <FiFileText size={13} className="text-[#D90429]" /> Standar A4 (210 × 297 mm)
                  </span>

                  {/* Font Selector in Toolbar */}
                  <div className="relative">
                    <select
                      value={docFont}
                      onChange={(e) => {
                        setDocFont(e.target.value);
                        const chosen = FONT_OPTIONS.find((f) => f.id === e.target.value);
                        toast.success(`Font diubah ke ${chosen ? chosen.label.split(' ')[0] : e.target.value}`);
                      }}
                      style={{ colorScheme: 'dark', fontFamily: selectedFontObj.family }}
                      title="Ganti Gaya Font Dokumen A4"
                      className="px-2.5 py-1.5 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[11px] font-bold text-[var(--admin-text-main)] hover:border-[#D90429]/40 transition-all cursor-pointer shadow-sm appearance-none pr-6 focus:outline-none focus:border-[#D90429]"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#160F11] text-zinc-200" style={{ fontFamily: f.family }}>
                          Font: {f.label.split(' ')[0]}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] pointer-events-none" />
                  </div>

                  <span className="text-xs font-mono text-[var(--admin-text-muted)] font-bold px-2.5 py-1 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)]/40">
                    {Math.round(activeScale * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setZoomMode('custom');
                      setZoomLevel((prev) => Math.max(0.4, Number((prev - 0.1).toFixed(2))));
                    }}
                    className="p-2 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-white hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer shadow-sm active:scale-95"
                    title="Perkecil (-10%)"
                  >
                    <FiZoomOut size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomMode('fit')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm active:scale-95 ${
                      zoomMode === 'fit'
                        ? 'bg-[#D90429] text-white border-[#D90429]'
                        : 'bg-[var(--admin-surface)] border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-white'
                    }`}
                    title="Sesuaikan otomatis dengan lebar layar"
                  >
                    Fit Layar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setZoomMode('custom');
                      setZoomLevel(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm active:scale-95 ${
                      zoomMode === 'custom' && zoomLevel === 1
                        ? 'bg-[#D90429] text-white border-[#D90429]'
                        : 'bg-[var(--admin-surface)] border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-white'
                    }`}
                    title="Ukuran Asli 100% (A4)"
                  >
                    100%
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setZoomMode('custom');
                      setZoomLevel((prev) => Math.min(1.5, Number((prev + 0.1).toFixed(2))));
                    }}
                    className="p-2 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-white hover:bg-[var(--admin-hover-bg)] transition-colors cursor-pointer shadow-sm active:scale-95"
                    title="Perbesar (+10%)"
                  >
                    <FiZoomIn size={13} />
                  </button>
                </div>
              </div>

              {/* ── A4 CANVAS SCALING CONTAINER (GUARANTEES EXACT A4 RATIO IN SPLIT VIEW) ── */}
              <div
                ref={previewContainerRef}
                className="w-full rounded-2xl bg-[#090607] border border-[var(--admin-border)] p-4 sm:p-6 shadow-inner flex flex-col items-center overflow-x-auto min-h-[640px] relative"
              >
                <div
                  style={{
                    width: `${794 * activeScale}px`,
                    height: `${docHeight * activeScale}px`,
                    transition: 'width 0.15s ease, height 0.15s ease',
                    overflow: 'visible',
                    position: 'relative',
                  }}
                >
                  {/* ── THE A4 DOCUMENT SHEET (CLEAN, UNBOXED, PROFESSIONAL STATIONERY) ── */}
                  <div
                    id="printable-document"
                    ref={printAreaRef}
                    className="bg-white text-zinc-900 shadow-2xl border border-zinc-200/90 relative"
                    style={{
                      width: '794px',
                      minHeight: '1123px',
                      padding: '36px 48px',
                      boxSizing: 'border-box',
                      transform: `scale(${activeScale})`,
                      transformOrigin: 'top left',
                      fontFamily: selectedFontObj.family,
                    }}
                  >
                    {/* ── 1. HEADER: OFFICIAL SNAP HUB LOGO & DOCUMENT META ── */}
                    <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4 gap-6">
                      {/* Left: Official Transparent Logo */}
                      <div>
                        <img
                          src={SNAPHUB_LOGO_BASE64}
                          alt="SnapHub"
                          className="h-13 w-auto object-contain"
                        />

                        <div className="mt-2.5 text-xs text-zinc-600 leading-relaxed space-y-0.5">
                          <p className="font-bold text-zinc-950">SnapHub Photobooth Malang</p>
                          <p className="text-[11px] text-zinc-600">Perumahan Joyogrand Blok VII, Merjosari, Lowokwaru, Kota Malang</p>
                          <p className="text-[11px] text-zinc-600">
                            WhatsApp: <strong className="text-zinc-900 font-mono">+62 851-9064-3459</strong> · Web: <strong className="text-zinc-900">snaphub.my.id</strong>
                          </p>
                          <p className="text-[11px] text-zinc-500">Instagram: @snaphub.id</p>
                        </div>
                      </div>

                      {/* Right: Document Identification & Key Dates */}
                      <div className="text-right flex flex-col items-end">
                        <h2
                          className="text-3xl font-black uppercase tracking-wider text-zinc-950"
                          style={{ fontFamily: selectedFontObj.family }}
                        >
                          {docType === 'quotation' ? 'QUOTATION' : 'INVOICE'}
                        </h2>
                        <p className="font-mono text-sm font-bold text-zinc-700 tracking-tight mt-0.5">
                          No: {docNumber || 'QUO-202610-001'}
                        </p>

                        <div className="mt-3 text-xs space-y-0.5 text-right">
                          <p className="text-zinc-500">
                            Tanggal Terbit:{' '}
                            <strong className="text-zinc-900 font-semibold font-mono">{formatDateIndo(issueDate)}</strong>
                          </p>
                          <p className="text-zinc-500">
                            {docType === 'quotation' ? 'Berlaku Hingga:' : 'Batas Jatuh Tempo:'}{' '}
                            <strong className="text-zinc-900 font-semibold font-mono">{formatDateIndo(dueDate)}</strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ── 2. CLIENT & EVENT DETAILS (CLEAN UNBOXED STATIONERY) ── */}
                    <div className="grid grid-cols-2 gap-8 my-3.5 py-0">
                      {/* Left: Client info */}
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-0.5">
                          Kepada Yth:
                        </span>
                        <h3 className="text-base font-bold text-zinc-950 leading-snug">
                          {clientName || 'Nama Klien / Perusahaan'}
                        </h3>
                        {clientCompany && (
                          <p className="text-xs font-medium text-zinc-700 mt-0.5">{clientCompany}</p>
                        )}
                        <div className="mt-1.5 text-xs text-zinc-600 space-y-0.5">
                          {clientPhone && (
                            <p>
                              WhatsApp: <span className="font-mono text-zinc-800 font-medium">{clientPhone}</span>
                            </p>
                          )}
                          {clientEmail && (
                            <p>
                              Email: <span className="text-zinc-800">{clientEmail}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Event schedule & venue */}
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-0.5">
                          Rincian Pelaksanaan Acara:
                        </span>
                        <p className="text-sm font-bold text-zinc-950 leading-snug">
                          {eventName || 'Nama Acara Belum Diisi'}
                        </p>
                        <div className="mt-1.5 text-xs text-zinc-600 space-y-0.5">
                          <p>
                            Waktu:{' '}
                            <span className="font-medium text-zinc-900">
                              {eventDate ? formatDateIndo(eventDate) : '-'}
                              {eventTime ? ` (${eventTime})` : ''}
                            </span>
                          </p>
                          <p>
                            Lokasi / Venue:{' '}
                            <span className="font-medium text-zinc-900">{eventVenue || '-'}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ── 3. ITEMIZED SERVICES TABLE ── */}
                    <div className="mb-4 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b-2 border-zinc-900 text-[10px] font-extrabold uppercase tracking-wider text-zinc-900">
                            <th className="py-2 px-1 w-8 text-center">No</th>
                            <th className="py-2 px-3">Layanan &amp; Rincian Fasilitas</th>
                            <th className="py-2 px-2 text-center w-12">Qty</th>
                            <th className="py-2 px-2 text-right w-28">Harga Satuan</th>
                            <th className="py-2 px-2 text-right w-28">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 text-xs">
                          {items.map((item, i) => (
                            <tr key={item.id || i} className="align-top hover:bg-zinc-50/50 transition-colors">
                              <td className="py-2 px-1 text-center font-mono text-zinc-400 font-medium">{i + 1}</td>
                              <td className="py-2 px-3">
                                <p className="font-bold text-zinc-950 text-sm leading-snug">{item.name || '-'}</p>
                                {item.description && (
                                  <div className="text-[11px] text-zinc-600 mt-0.5 leading-normal space-y-0.5 font-normal">
                                    {item.description.split('\n').filter(Boolean).map((line, idx) => (
                                      <p key={idx} className="leading-snug">
                                        {line}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-semibold text-zinc-800">{item.qty}</td>
                              <td className="py-2 px-2 text-right font-mono font-medium text-zinc-700">
                                {formatRupiah(item.unitPrice)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-zinc-950">
                                {formatRupiah(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* ── 4. FINANCIAL SUMMARY & PAYMENT SECTION (UNBOXED & EDITORIAL) ── */}
                    <div className="grid grid-cols-12 gap-6 items-start mb-4 pt-3 border-t border-zinc-200">
                      {/* Left (7 cols): Bank Account Transfer */}
                      <div className="col-span-7 space-y-1.5 pr-4">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                          Metode Pembayaran Transfer Bank:
                        </span>

                        <div className="text-xs space-y-0.5 pt-0.5">
                          <p className="text-zinc-600">
                            Bank:{' '}
                            <strong className="text-zinc-950 font-bold">{bankInfo.bankName}</strong>
                          </p>
                          <p className="text-zinc-600">
                            No. Rekening:{' '}
                            <strong className="text-zinc-950 font-mono text-base font-extrabold tracking-wider">
                              {bankInfo.accountNumber}
                            </strong>
                          </p>
                          <p className="text-zinc-600">
                            Atas Nama:{' '}
                            <strong className="text-zinc-950 font-bold">{bankInfo.accountHolder}</strong>
                          </p>
                        </div>

                        {bankInfo.qrisNote && (
                          <p className="text-[11px] text-zinc-500 pt-1.5 border-t border-zinc-200 leading-relaxed italic">
                            {bankInfo.qrisNote}
                          </p>
                        )}
                      </div>

                      {/* Right (5 cols): Calculation Box */}
                      <div className="col-span-5 space-y-1.5 text-xs">
                        <div className="flex justify-between py-0.5 text-zinc-600">
                          <span>Subtotal</span>
                          <span className="font-mono text-zinc-900 font-semibold">{formatRupiah(subtotal)}</span>
                        </div>

                        {discountNum > 0 && (
                          <div className="flex justify-between py-0.5 text-emerald-700 font-semibold">
                            <span>Potongan Diskon</span>
                            <span className="font-mono">-{formatRupiah(discountNum)}</span>
                          </div>
                        )}

                        <div className="flex justify-between py-1.5 border-t-2 border-zinc-900 text-sm font-extrabold text-zinc-950">
                          <span>Total Biaya</span>
                          <span className="font-mono text-base">{formatRupiah(totalAmount)}</span>
                        </div>

                        {docType === 'invoice' && (
                          <>
                            {status === 'partial' && dpNum > 0 && (
                              <div className="flex justify-between py-0.5 text-zinc-600">
                                <span>
                                  DP Terbayar {dpDate ? `(${formatDateIndo(dpDate)})` : ''}
                                </span>
                                <span className="font-mono font-bold text-emerald-600">
                                  -{formatRupiah(dpNum)}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-baseline pt-1.5 mt-0.5 border-t-2 border-zinc-900">
                              <div>
                                <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-900 block">
                                  {status === 'paid' ? 'Status Tagihan:' : 'Sisa Pelunasan:'}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-normal">
                                  {status === 'paid' ? 'Lunas Diterima' : 'Wajib H-1 Acara'}
                                </span>
                              </div>
                              <span className={`font-mono text-lg font-black ${status === 'paid' ? 'text-emerald-600' : 'text-[#D90429]'}`}>
                                {status === 'paid' ? 'LUNAS (Rp 0)' : formatRupiah(balanceDue)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* ── 5. TERMS & CONDITIONS ── */}
                    {tncList.length > 0 && (
                      <div className="mb-3.5 pt-3 border-t border-zinc-200">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1">
                          Syarat &amp; Ketentuan Kerjasama Sewa Photobooth:
                        </p>
                        <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-zinc-600 leading-snug font-normal">
                          {tncList.filter(Boolean).map((t, idx) => (
                            <li key={idx} className="pl-0.5">{t}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* ── 6. CLOSING NOTES ── */}
                    {notes && (
                      <div className="mb-3.5 text-[11px] text-zinc-600 leading-snug italic border-l-2 border-zinc-300 pl-3 py-0.5">
                        <strong className="not-italic text-zinc-900 font-bold">Catatan: </strong> {notes}
                      </div>
                    )}

                    {/* ── 7. SIGNATURES ── */}
                    <div className="grid grid-cols-2 gap-8 pt-3 border-t border-zinc-200 text-xs">
                      <div className="text-center">
                        <p className="text-zinc-500 text-[11px] mb-1">Disetujui Oleh,</p>
                        <div className="h-20" />
                        <p className="font-bold text-zinc-950 border-t border-zinc-300 pt-1.5 inline-block min-w-[150px]">
                          {clientName || '( Nama Klien )'}
                        </p>
                      </div>

                      <div className="text-center relative">
                        <p className="text-zinc-500 text-[11px] mb-1">Hormat Kami,</p>
                        <div className="h-20 relative flex items-center justify-center">
                          {/* Cap Stempel Resmi SnapHub Management (Minimalist Vector SVG) */}
                          {showStamp && stampShape === 'oval' && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none select-none flex items-center justify-center z-10">
                              <svg
                                viewBox="0 0 200 120"
                                className="w-38 h-auto text-[#D90429] -rotate-6 mix-blend-multiply opacity-85"
                              >
                                <defs>
                                  <path
                                    id="oval-stamp-top"
                                    d="M 45,36 A 60,14 0 0,1 155,36"
                                    fill="none"
                                  />
                                </defs>
                                <ellipse cx="100" cy="60" rx="95" ry="55" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                <ellipse cx="100" cy="60" rx="89" ry="49" fill="none" stroke="currentColor" strokeWidth="0.8" />
                                
                                {/* Baris 1: SNAP HUB (melengkung rapi di bagian atas) */}
                                <text
                                  fill="currentColor"
                                  fontSize="9.5"
                                  fontWeight="900"
                                  letterSpacing="2.2"
                                  fontFamily="sans-serif"
                                >
                                  <textPath href="#oval-stamp-top" startOffset="50%" textAnchor="middle">
                                    SNAP HUB
                                  </textPath>
                                </text>

                                {/* Baris 2: PHOTOBOOTH (horizontal rapi dan terpisah, tanpa tabrakan) */}
                                <text
                                  x="100"
                                  y="44"
                                  fill="currentColor"
                                  fontSize="8"
                                  fontWeight="800"
                                  letterSpacing="2"
                                  textAnchor="middle"
                                  fontFamily="sans-serif"
                                >
                                  PHOTOBOOTH
                                </text>

                                <line x1="18" y1="52" x2="182" y2="52" stroke="currentColor" strokeWidth="1.2" />
                                <line x1="18" y1="76" x2="182" y2="76" stroke="currentColor" strokeWidth="1.2" />
                                
                                <text
                                  x="100"
                                  y="66"
                                  fill="currentColor"
                                  fontSize="11"
                                  fontWeight="900"
                                  letterSpacing="2.5"
                                  textAnchor="middle"
                                  fontFamily="sans-serif"
                                >
                                  ★ MANAGEMENT ★
                                </text>
                                <text
                                  x="100"
                                  y="97"
                                  fill="currentColor"
                                  fontSize="11"
                                  fontWeight="900"
                                  textAnchor="middle"
                                  fontFamily="sans-serif"
                                >
                                  ★
                                </text>
                              </svg>
                            </div>
                          )}

                          {showStamp && stampShape === 'round' && (
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 pointer-events-none select-none flex items-center justify-center z-10">
                              <svg
                                viewBox="0 0 160 160"
                                className="w-28 h-28 text-[#D90429] -rotate-8 mix-blend-multiply opacity-85"
                              >
                                <defs>
                                  <path
                                    id="round-stamp-top"
                                    d="M 36,48 A 50,50 0 0,1 124,48"
                                    fill="none"
                                  />
                                </defs>
                                <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" strokeWidth="2.5" />
                                <circle cx="80" cy="80" r="69" fill="none" stroke="currentColor" strokeWidth="0.8" />
                                
                                {/* Baris 1: SNAP HUB (melengkung rapi di bagian atas) */}
                                <text
                                  fill="currentColor"
                                  fontSize="10"
                                  fontWeight="900"
                                  letterSpacing="2.2"
                                  fontFamily="sans-serif"
                                >
                                  <textPath href="#round-stamp-top" startOffset="50%" textAnchor="middle">
                                    SNAP HUB
                                  </textPath>
                                </text>

                                {/* Baris 2: PHOTOBOOTH (horizontal terpisah, tidak tabrakan) */}
                                <text
                                  x="80"
                                  y="55"
                                  fill="currentColor"
                                  fontSize="8"
                                  fontWeight="800"
                                  letterSpacing="2"
                                  textAnchor="middle"
                                  fontFamily="sans-serif"
                                >
                                  PHOTOBOOTH
                                </text>

                                <line x1="18" y1="68" x2="142" y2="68" stroke="currentColor" strokeWidth="1.2" />
                                <line x1="18" y1="94" x2="142" y2="94" stroke="currentColor" strokeWidth="1.2" />
                                
                                <text
                                  x="80"
                                  y="83"
                                  fill="currentColor"
                                  fontSize="11.5"
                                  fontWeight="900"
                                  letterSpacing="2.5"
                                  textAnchor="middle"
                                  fontFamily="sans-serif"
                                >
                                  ★ MANAGEMENT ★
                                </text>
                                <text
                                  x="80"
                                  y="124"
                                  fill="currentColor"
                                  fontSize="12"
                                  fontWeight="900"
                                  textAnchor="middle"
                                  fontFamily="sans-serif"
                                >
                                  ★
                                </text>
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="font-bold text-zinc-950 border-t border-zinc-300 pt-1.5 inline-block min-w-[150px] relative z-10">
                          SnapHub Management
                        </p>
                      </div>
                    </div>

                    {/* ── 8. FOOTER ── */}
                    <div className="mt-3.5 pt-2 border-t border-zinc-200/80 flex items-center justify-between text-[10px] text-zinc-400">
                      <p>© {new Date().getFullYear()} SnapHub Photobooth. Capture Every Smile.</p>
                      <p className="font-mono">www.snaphub.my.id · Malang, Indonesia</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: RIWAYAT DOKUMEN TERSIMPAN ── */}
      {viewMode === 'history' && (
        <div className="bg-[var(--admin-surface)] p-6 rounded-2xl border border-[var(--admin-border)] shadow-[var(--admin-shadow)] space-y-5 no-print">
          {/* KPI Dashboard Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--admin-text-muted)] tracking-wider block">Total Dokumen</span>
                <span className="text-xl font-extrabold text-[var(--admin-text-main)] font-mono">{historyStats.totalDocs}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#D90429]/15 text-[#D90429] flex items-center justify-center">
                <FiFileText size={18} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block">Quotation (Penawaran)</span>
                <span className="text-xl font-extrabold text-[var(--admin-text-main)] font-mono">{historyStats.quoCount}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <FiFilePlus size={18} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">Invoice (Tagihan)</span>
                <span className="text-xl font-extrabold text-[var(--admin-text-main)] font-mono">{historyStats.invCount}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <FiDollarSign size={18} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">Tagihan Lunas</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">{historyStats.paidCount}</span>
                <span className="text-[10px] text-[var(--admin-text-muted)] block font-mono">{formatRupiah(historyStats.totalPaidVal)}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <FiCheckCircle size={18} />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[var(--admin-border-subtle)]">
            <div>
              <h3 className="text-base font-bold text-[var(--admin-text-main)]">Daftar Dokumen Tersimpan</h3>
              <p className="text-xs text-[var(--admin-text-muted)]">Semua penawaran (quotation) dan tagihan (invoice) yang pernah dibuat.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" size={14} />
                <input
                  type="text"
                  placeholder="Cari nama klien / no. dokumen..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[var(--admin-text-main)] outline-none w-60 focus:border-[#D90429] transition-colors"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-[#18181b] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#18181b] text-white">Semua Jenis Dokumen</option>
                <option value="quotation" className="bg-[#18181b] text-white">Quotation (Penawaran)</option>
                <option value="invoice" className="bg-[#18181b] text-white">Invoice (Tagihan)</option>
              </select>
            </div>
          </div>

          {/* Table History */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--admin-border)] text-[var(--admin-text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Jenis</th>
                  <th className="py-3 px-4">No. Dokumen</th>
                  <th className="py-3 px-4">Klien &amp; Acara</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]/50">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-[var(--admin-text-muted)]">
                      Memuat riwayat dokumen...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[var(--admin-text-muted)]">
                      Belum ada dokumen yang disimpan. Klik "Dokumen Baru" untuk membuat penawaran atau invoice.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((doc) => {
                    const isQuo = doc.docType === 'quotation';
                    return (
                      <tr key={doc.id} className="hover:bg-[var(--admin-hover-bg)] transition-colors">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isQuo
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {doc.docType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[var(--admin-text-main)]">
                          {doc.number}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[var(--admin-text-main)]">{doc.client?.name || '-'}</p>
                          {doc.event?.name && (
                            <p className="text-[11px] text-[var(--admin-text-muted)]">{doc.event.name}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[var(--admin-text-muted)]">
                          {formatDateIndo(doc.issueDate)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--admin-accent)]">
                          {formatRupiah(doc.totalAmount)}
                          {!isQuo && doc.balanceDue > 0 && (
                            <span className="block text-[10px] text-rose-400 font-normal">
                              Sisa: {formatRupiah(doc.balanceDue)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold inline-block capitalize ${
                            doc.status === 'paid' || doc.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : doc.status === 'partial'
                              ? 'bg-blue-500/15 text-blue-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                handleLoadDocument(doc);
                                setViewMode('split');
                              }}
                              className="p-1.5 rounded-lg bg-[var(--admin-hover-bg)] hover:bg-[var(--admin-accent)] hover:text-[var(--admin-surface)] text-[var(--admin-text-main)] transition-colors cursor-pointer"
                              title="Buka / Edit Dokumen"
                            >
                              <FiEdit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                handleLoadDocument(doc);
                                setViewMode('preview');
                              }}
                              className="p-1.5 rounded-lg bg-[var(--admin-hover-bg)] hover:bg-white/20 text-[var(--admin-text-muted)] hover:text-white transition-colors cursor-pointer"
                              title="Pratinjau Penuh"
                            >
                              <FiPrinter size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1.5 rounded-lg bg-[var(--admin-hover-bg)] hover:bg-red-500/20 text-[var(--admin-text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                              title="Hapus"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInvoice;
