import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiBox, FiCalendar, FiTarget, FiCheck, FiLock, FiUnlock, FiSearch, FiDownload, FiEdit2 } from 'react-icons/fi';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const AdminFinance = ({ activeSubTab = 'events' }) => {
  const [events, setEvents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState('schedule');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventSortOrder, setEventSortOrder] = useState('newest');
  const [recapSortOrder, setRecapSortOrder] = useState('newest');
  const [operationalSearchQuery, setOperationalSearchQuery] = useState('');
  const [operationalSortOrder, setOperationalSortOrder] = useState('dateDesc');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', id: null, title: '', message: '' });
  const [masterPage, setMasterPage] = useState(1);

  // Password Modal State
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, action: null, payload: null });
  const [inputPassword, setInputPassword] = useState('');

  // Target State
  const [targetAllTime, setTargetAllTime] = useState('0');
  const [targetKeuntungan, setTargetKeuntungan] = useState('10.000.000');
  const [targetMonth, setTargetMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [customTargets, setCustomTargets] = useState([]);
  const [allTargets, setAllTargets] = useState({});
  const [isUpdatingTarget, setIsUpdatingTarget] = useState(false);
  const [newCustomTarget, setNewCustomTarget] = useState({ name: '', amount: '' });
  const [isEditingAllTime, setIsEditingAllTime] = useState(false);
  const [isEditingMonthly, setIsEditingMonthly] = useState(false);

  // Forms State
  const [newEvent, setNewEvent] = useState({ name: '', date: '' });
  const [newTransaction, setNewTransaction] = useState({ type: 'event_expense', description: '', amount: '', event_id: '' });
  const [newOperationalExpense, setNewOperationalExpense] = useState({ description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [operationalExpenses, setOperationalExpenses] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const key = `target_keuntungan_${targetMonth}`;
    if (allTargets[key]) {
      setTargetKeuntungan(new Intl.NumberFormat('id-ID').format(allTargets[key]));
    } else if (allTargets['target_keuntungan']) {
      setTargetKeuntungan(new Intl.NumberFormat('id-ID').format(allTargets['target_keuntungan']));
    } else {
      setTargetKeuntungan('10.000.000');
    }
  }, [targetMonth, allTargets]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error: e1 } = await supabase.from('financial_events').select('*').order('date', { ascending: false });
      if (e1) throw e1;

      const { data: trxData, error: e2 } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if (e2) throw e2;

      const { data: settingsData, error: e3 } = await supabase.from('settings').select('*');
      if (settingsData) {
        const targets = {};
        settingsData.forEach(t => targets[t.key] = t.value);
        setAllTargets(targets);

        if (targets['target_all_time']) {
          setTargetAllTime(new Intl.NumberFormat('id-ID').format(targets['target_all_time']));
        }

        const currentKey = `target_keuntungan_${format(new Date(), 'yyyy-MM')}`;
        if (targets[currentKey]) {
          setTargetKeuntungan(new Intl.NumberFormat('id-ID').format(targets[currentKey]));
        } else if (targets['target_keuntungan']) {
          setTargetKeuntungan(new Intl.NumberFormat('id-ID').format(targets['target_keuntungan']));
        }

        if (targets['custom_targets']) {
          try {
            setCustomTargets(JSON.parse(targets['custom_targets']));
          } catch (e) {
            console.error('Gagal memparsing custom_targets:', e);
            toast.error('Data target kustom rusak, ditampilkan kosong.');
            setCustomTargets([]);
          }
        }

        if (targets['operational_expenses']) {
          try {
            setOperationalExpenses(JSON.parse(targets['operational_expenses']));
          } catch (e) {
            console.error('Gagal memparsing operational_expenses:', e);
            toast.error('Data pengeluaran operasional rusak, ditampilkan kosong.');
            setOperationalExpenses([]);
          }
        }
      }

      const { data: schedData } = await supabase.from('booked_dates').select('*').order('date', { ascending: true });
      if (schedData) {
        setSchedules(schedData);
      }

      setEvents(eventsData || []);
      setTransactions(trxData || []);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data keuangan');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAllTime = async (e) => {
    e.preventDefault();
    setIsUpdatingTarget(true);
    try {
      const { error } = await supabase.from('settings').upsert({ key: 'target_all_time', value: getRawNumber(targetAllTime) }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Target Keseluruhan berhasil diperbarui!');
      setIsEditingAllTime(false);
      fetchData();
    } catch (error) {
      toast.error('Gagal memperbarui target');
    } finally {
      setIsUpdatingTarget(false);
    }
  };

  const handleUpdateMonthly = async (e) => {
    e.preventDefault();
    setIsUpdatingTarget(true);
    const key = `target_keuntungan_${targetMonth}`;
    try {
      const { error } = await supabase.from('settings').upsert({ key: key, value: getRawNumber(targetKeuntungan) }, { onConflict: 'key' });
      if (error) throw error;
      toast.success(`Target untuk bulan ${format(new Date(targetMonth + '-01'), 'MMMM yyyy')} berhasil diperbarui!`);
      setIsEditingMonthly(false);
      fetchData();
    } catch (error) {
      toast.error('Gagal memperbarui target');
    } finally {
      setIsUpdatingTarget(false);
    }
  };

  const handleAddCustomTarget = async (e) => {
    e.preventDefault();
    if (!newCustomTarget.name || !newCustomTarget.amount) return;

    setIsUpdatingTarget(true);
    try {
      const newTarget = {
        id: Date.now().toString(),
        name: newCustomTarget.name,
        amount: getRawNumber(newCustomTarget.amount)
      };
      const updatedList = [...customTargets, newTarget];

      const { error } = await supabase.from('settings').upsert({ key: 'custom_targets', value: JSON.stringify(updatedList) }, { onConflict: 'key' });
      if (error) throw error;

      setCustomTargets(updatedList);
      setNewCustomTarget({ name: '', amount: '' });
      toast.success('Target Kustom berhasil ditambahkan!');
    } catch (error) {
      toast.error('Gagal menambah target kustom');
    } finally {
      setIsUpdatingTarget(false);
    }
  };

  const handleDeleteCustomTarget = async (id) => {
    setIsUpdatingTarget(true);
    try {
      const updatedList = customTargets.filter(t => t.id !== id);
      const { error } = await supabase.from('settings').upsert({ key: 'custom_targets', value: JSON.stringify(updatedList) }, { onConflict: 'key' });
      if (error) throw error;

      setCustomTargets(updatedList);
      toast.success('Target Kustom berhasil dihapus!');
    } catch (error) {
      toast.error('Gagal menghapus target kustom');
    } finally {
      setIsUpdatingTarget(false);
    }
  };



  const handleAddEvent = async (e) => {
    e.preventDefault();
    setPasswordModal({ isOpen: true, action: 'add_event', payload: { ...newEvent } });
  };

  const executeAddEvent = async () => {
    try {
      const { error } = await supabase.from('financial_events').insert([{
        name: passwordModal.payload.name,
        date: passwordModal.payload.date,
        income: 0
      }]);
      if (error) throw error;

      await supabase.from('booked_dates').insert([{
        date: passwordModal.payload.date,
        event_name: passwordModal.payload.name
      }]);

      toast.success('Event berhasil ditambahkan!');
      setNewEvent({ name: '', date: '' });
      fetchData();
    } catch (error) {
      toast.error('Gagal menambah event');
      console.error(error);
    }
  };

  const verifyPasswordAndExecute = (e) => {
    e.preventDefault();
    if (inputPassword !== 'admin123') {
      toast.error('Password salah!');
      return;
    }

    if (passwordModal.action === 'add_event') {
      executeAddEvent();
    }
    setPasswordModal({ isOpen: false, action: null, payload: null });
    setInputPassword('');
  };

  const handleUpdateIncome = async (eventId, newIncome) => {
    try {
      const val = getRawNumber(newIncome);
      const { error } = await supabase.from('financial_events').update({ income: val }).eq('id', eventId);
      if (error) throw error;
      fetchData();
    } catch (error) {
      toast.error('Gagal memperbarui pemasukan');
    }
  };

  const confirmDeleteEvent = (id, name) => {
    setDeleteModal({ isOpen: true, type: 'event', id, title: 'Hapus Event?', message: `Yakin ingin menghapus event "${name}"? Semua data pengeluarannya juga akan ikut terhapus.` });
  };

  const executeDeleteEvent = async (id) => {
    try {
      const eventToDelete = events.find(ev => ev.id === id);

      const { error } = await supabase.from('financial_events').delete().eq('id', id);
      if (error) throw error;

      if (eventToDelete) {
        await supabase.from('booked_dates').delete().match({ date: eventToDelete.date, event_name: eventToDelete.name });
      }

      toast.success('Event dihapus');
      if (selectedEventId === id) setSelectedEventId(null);
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus event');
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        date: new Date().toISOString().split('T')[0],
        type: newTransaction.type,
        description: newTransaction.description,
        amount: getRawNumber(newTransaction.amount),
        event_id: newTransaction.type === 'event_expense' ? newTransaction.event_id : null
      };

      const { error } = await supabase.from('transactions').insert([payload]);
      if (error) throw error;

      toast.success('Transaksi berhasil ditambahkan!');
      setNewTransaction({ ...newTransaction, description: '', amount: '' });
      fetchData();
    } catch (error) {
      toast.error('Gagal menambah transaksi');
      console.error(error);
    }
  };

  const handleAddOperationalExpense = async (e) => {
    e.preventDefault();
    try {
      const newItem = {
        id: Date.now().toString(),
        date: newOperationalExpense.date || new Date().toISOString().split('T')[0],
        description: newOperationalExpense.description,
        amount: getRawNumber(newOperationalExpense.amount)
      };

      const updatedList = [...operationalExpenses, newItem];

      const { error } = await supabase.from('settings').upsert({ key: 'operational_expenses', value: JSON.stringify(updatedList) }, { onConflict: 'key' });
      if (error) throw error;

      toast.success('Pengeluaran operasional berhasil ditambahkan!');
      setOperationalExpenses(updatedList);
      setNewOperationalExpense({ description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (error) {
      toast.error('Gagal menambah pengeluaran operasional');
      console.error(error);
    }
  };

  const handleDeleteOperationalExpense = async (id) => {
    try {
      const updatedList = operationalExpenses.filter(item => item.id !== id);
      const { error } = await supabase.from('settings').upsert({ key: 'operational_expenses', value: JSON.stringify(updatedList) }, { onConflict: 'key' });
      if (error) throw error;

      toast.success('Pengeluaran operasional dihapus');
      setOperationalExpenses(updatedList);
    } catch (error) {
      toast.error('Gagal menghapus pengeluaran operasional');
    }
  };

  const handleToggleLock = async (id, currentStatus) => {
    try {
      const { error } = await supabase.from('financial_events').update({ is_locked: !currentStatus }).eq('id', id);
      if (error) throw error;
      toast.success(!currentStatus ? 'Event disimpan & dikunci' : 'Mode Edit diaktifkan');
      fetchData();
    } catch (error) {
      toast.error('Gagal mengubah status event');
    }
  };

  const confirmDeleteTransaction = (id, desc) => {
    setDeleteModal({ isOpen: true, type: 'transaction', id, title: 'Hapus Pengeluaran?', message: `Yakin ingin menghapus pengeluaran "${desc}" ini?` });
  };

  const executeDeleteTransaction = async (id) => {
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Transaksi dihapus');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus transaksi');
    }
  };

  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const getRawNumber = (val) => {
    return parseFloat(val.toString().replace(/\./g, '')) || 0;
  };

  const handleNumberInput = (val, setter) => {
    const rawValue = val.replace(/\D/g, '');
    if (!rawValue) {
      setter('');
      return;
    }
    setter(new Intl.NumberFormat('id-ID').format(rawValue));
  };

  const renderEventsTab = () => {
    const availableSchedules = schedules.filter(sched => {
      return !events.some(ev => ev.name === sched.event_name && ev.date === sched.date);
    });

    if (selectedEventId) {
      const event = events.find(e => e.id === selectedEventId);
      if (!event) {
        setSelectedEventId(null);
        return null;
      }

      const eventExpenses = transactions.filter(t => t.event_id === event.id && t.type === 'event_expense');
      const totalExpense = eventExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
      const netProfit = Number(event.income) - totalExpense;

      return (
        <div className="space-y-6 max-w-[1100px]">
          {/* Password Modal */}
          {passwordModal.isOpen && (
            <div className="fixed inset-0 lg:left-64 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-sm shadow-[var(--admin-shadow)] relative">
                <div className="w-14 h-14 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center mb-5 mx-auto border border-[var(--admin-accent)]/20">
                  <FiLock size={24} className="text-[var(--admin-accent)]" />
                </div>
                <h3 className="text-[var(--admin-accent)] font-bold text-xl mb-2 text-center">Masukkan Password</h3>
                <p className="text-[var(--admin-text-muted)] text-sm mb-6 text-center">
                  Otorisasi diperlukan untuk melakukan aksi ini.
                </p>
                <form onSubmit={verifyPasswordAndExecute}>
                  <div className="mb-6">
                    <input
                      type="password"
                      autoFocus
                      required
                      placeholder="Password"
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)] transition-colors text-center"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setPasswordModal({ isOpen: false, action: null, payload: null }); setInputPassword(''); }} className="flex-1 bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] py-3 rounded-xl transition-all font-bold text-sm">
                      Batal
                    </button>
                    <button type="submit" className="flex-1 bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] text-[var(--admin-surface)] font-bold py-3 rounded-xl transition-all shadow-lg shadow-[var(--admin-accent)]/20 text-sm">
                      Konfirmasi
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setSelectedEventId(null);
              setIsEditingIncome(false);
            }}
            className="flex items-center gap-2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors text-sm font-semibold mb-2"
          >
            ← Kembali ke Daftar Event
          </button>

          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] overflow-hidden shadow-[var(--admin-shadow)]">
            {/* Header Event */}
            <div className="bg-[var(--admin-hover-bg)] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--admin-border)]">
              <div>
                <h4 className="text-[var(--admin-accent)] font-bold text-lg">{event.name}</h4>
                <p className="text-[var(--admin-text-muted)] text-sm">{format(new Date(event.date), 'dd MMMM yyyy')}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm font-medium">
                <div className="bg-[var(--admin-border-subtle)] text-[#64D194] px-4 py-2 rounded-xl flex items-center justify-between min-w-[140px]">
                  <span className="text-[var(--admin-text-muted)] text-xs font-normal mr-2">Income:</span>
                  <span className="font-bold">{formatIDR(event.income)}</span>
                </div>
                <div className="bg-[var(--admin-border-subtle)] text-[#D28A94] px-4 py-2 rounded-xl flex items-center justify-between min-w-[140px]">
                  <span className="text-[var(--admin-text-muted)] text-xs font-normal">Expense:</span> {formatIDR(totalExpense)}
                </div>
                <div className="bg-[var(--admin-accent-bg)] border border-[#E79EA7]/30 text-[var(--admin-accent)] px-4 py-2 rounded-xl flex items-center justify-between min-w-[140px]">
                  <span className="text-[var(--admin-text-muted)] text-xs font-normal mr-2">Net Profit:</span> {formatIDR(netProfit)}
                </div>
              </div>
            </div>

            {/* Table Pengeluaran Event */}
            <div className="p-5 space-y-6">
              {/* Input Pemasukan */}
              {!event.is_locked && (
                isEditingIncome ? (
                  <div className="bg-[var(--admin-hover-bg)] p-4 rounded-xl border border-[#64D194]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h5 className="text-[#64D194] text-sm font-semibold mb-1">Set Pemasukan Event</h5>
                      <p className="text-[var(--admin-text-muted)] text-xs">Masukkan total pemasukan kotor dari event ini.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#64D194] text-sm font-medium">Rp</span>
                      <input
                        type="text"
                        defaultValue={new Intl.NumberFormat('id-ID').format(event.income)}
                        onBlur={(e) => {
                          handleUpdateIncome(event.id, e.target.value);
                          setIsEditingIncome(false);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        onChange={(e) => handleNumberInput(e.target.value, val => { e.target.value = val; })}
                        className="bg-[var(--admin-surface)] border border-[#64D194]/50 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-[#64D194] w-36 text-[var(--admin-text-main)] transition-colors"
                        placeholder="0"
                        autoFocus
                      />
                      <button
                        onClick={(e) => e.currentTarget.previousElementSibling.blur()}
                        className="bg-[#64D194] hover:bg-[#64D194]/80 text-[var(--admin-surface)] px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-flex"
                        title="Simpan Pemasukan"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--admin-hover-bg)] p-4 rounded-xl border border-[#64D194]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h5 className="text-[#64D194] text-sm font-semibold mb-1">Pemasukan Event</h5>
                      <p className="text-[var(--admin-text-muted)] text-xs">Total pemasukan kotor dari event ini.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#64D194] text-lg font-bold">{formatIDR(event.income)}</span>
                      <button
                        onClick={() => setIsEditingIncome(true)}
                        className="bg-[#64D194]/10 hover:bg-[#64D194] hover:text-[var(--admin-surface)] text-[#64D194] px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                      >
                        <FiEdit2 size={14} /> Edit
                      </button>
                    </div>
                  </div>
                )
              )}

              <div>
                <h5 className="text-[var(--admin-text-muted)] text-sm font-medium mb-3">Tabel Pengeluaran Produksi</h5>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--admin-border)]">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)] text-xs">
                        <th className="py-2.5 px-4 font-medium w-1/2">Deskripsi Item</th>
                        <th className="py-2.5 px-4 font-medium text-right w-1/3">Nominal (Rp)</th>
                        <th className="py-2.5 px-4 font-medium text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventExpenses.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="py-4 text-center text-[var(--admin-text-muted)] text-xs italic">Belum ada pengeluaran tercatat untuk event ini.</td>
                        </tr>
                      ) : (
                        eventExpenses.map(exp => (
                          <tr key={exp.id} className="border-b border-white/[0.02] hover:bg-[var(--admin-hover-bg)]">
                            <td className="py-2.5 px-4 text-[var(--admin-text-main)] text-sm">{exp.description}</td>
                            <td className="py-2.5 px-4 text-[#D28A94] font-medium text-sm text-right">{formatIDR(exp.amount)}</td>
                            <td className="py-2.5 px-4 text-center">
                              {!event.is_locked ? (
                                <button onClick={() => confirmDeleteTransaction(exp.id, exp.description)} className="text-[var(--admin-text-muted)] hover:text-[#D28A94]"><FiTrash2 size={14} /></button>
                              ) : (
                                <span className="text-gray-700 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                      {/* Form Tambah Row */}
                      {!event.is_locked && (
                        <tr className="bg-[var(--admin-hover-bg)]">
                          <td className="p-2">
                            <input type="text" placeholder="Tambah pengeluaran (Cth: Kertas Foto)" value={newTransaction.event_id === event.id ? newTransaction.description : ''} onChange={e => setNewTransaction({ type: 'event_expense', event_id: event.id, description: e.target.value, amount: newTransaction.amount })} className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--admin-text-main)] focus:border-[#E79EA7] outline-none" />
                          </td>
                          <td className="p-2">
                            <input type="text" placeholder="Nominal" value={newTransaction.event_id === event.id ? newTransaction.amount : ''} onChange={e => handleNumberInput(e.target.value, val => setNewTransaction(prev => ({ ...prev, amount: val })))} className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--admin-text-main)] focus:border-[#E79EA7] outline-none text-right" />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={(e) => {
                              if (!newTransaction.description || !newTransaction.amount || newTransaction.event_id !== event.id) return;
                              handleAddTransaction(e);
                            }} className="bg-[var(--admin-accent-bg)] hover:bg-[var(--admin-accent)] hover:text-[var(--admin-surface)] text-[var(--admin-accent)] p-1.5 rounded-lg transition-colors inline-flex"><FiPlus size={16} /></button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3">
                  {eventExpenses.length === 0 ? (
                    <div className="text-center text-[var(--admin-text-muted)] text-xs italic py-4 border border-[var(--admin-border)] rounded-xl bg-[var(--admin-surface)]">
                      Belum ada pengeluaran tercatat.
                    </div>
                  ) : (
                    eventExpenses.map(exp => (
                      <div key={exp.id} className="bg-[var(--admin-hover-bg)] border border-[var(--admin-border)] rounded-xl p-3 flex justify-between items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-[var(--admin-text-main)] text-sm">{exp.description}</span>
                          <span className="text-[#D28A94] font-medium text-sm">{formatIDR(exp.amount)}</span>
                        </div>
                        {!event.is_locked && (
                          <button onClick={() => confirmDeleteTransaction(exp.id, exp.description)} className="text-[var(--admin-text-muted)] hover:text-[#D28A94] p-2 bg-[var(--admin-input-bg)] rounded-lg transition-colors">
                            <FiTrash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))
                  )}

                  {!event.is_locked && (
                    <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-3 flex flex-col gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Deskripsi pengeluaran..."
                        value={newTransaction.event_id === event.id ? newTransaction.description : ''}
                        onChange={e => setNewTransaction({ type: 'event_expense', event_id: event.id, description: e.target.value, amount: newTransaction.amount })}
                        className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-lg px-3 py-2 text-sm text-[var(--admin-text-main)] focus:border-[#E79EA7] outline-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nominal Rp"
                          value={newTransaction.event_id === event.id ? newTransaction.amount : ''}
                          onChange={e => handleNumberInput(e.target.value, val => setNewTransaction(prev => ({ ...prev, amount: val })))}
                          className="w-full flex-1 bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-lg px-3 py-2 text-sm text-[var(--admin-text-main)] focus:border-[#E79EA7] outline-none"
                        />
                        <button
                          onClick={(e) => {
                            if (!newTransaction.description || !newTransaction.amount || newTransaction.event_id !== event.id) return;
                            handleAddTransaction(e);
                          }}
                          className="bg-[var(--admin-accent)] hover:bg-[#E79EA7]/80 text-[var(--admin-surface)] px-4 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <FiPlus size={16} /> Tambah
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer / Aksi Utama */}
            <div className="p-5 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] flex justify-end">
              <button onClick={() => handleToggleLock(event.id, event.is_locked)} className={`px-8 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-colors ${event.is_locked ? 'bg-[var(--admin-border-subtle)] border border-[#64D194]/30 text-[#64D194] hover:bg-[#64D194] hover:text-[var(--admin-surface)]' : 'bg-[#C9868F] text-[var(--admin-surface)] hover:bg-[var(--admin-accent)]'}`}>
                {event.is_locked ? <FiLock size={18} /> : <FiUnlock size={18} />}
                {event.is_locked ? 'Edit' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    let filteredMasterEvents = events.filter(ev => ev.name.toLowerCase().includes(eventSearchQuery.toLowerCase()));

    // Sorting Logic
    if (eventSortOrder === 'newest') {
      filteredMasterEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (eventSortOrder === 'oldest') {
      filteredMasterEvents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (eventSortOrder === 'dateDesc') {
      filteredMasterEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (eventSortOrder === 'dateAsc') {
      filteredMasterEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (eventSortOrder === 'az') {
      filteredMasterEvents.sort((a, b) => a.name.localeCompare(b.name));
    } else if (eventSortOrder === 'za') {
      filteredMasterEvents.sort((a, b) => b.name.localeCompare(a.name));
    }

    // Pagination for Master Table
    const masterEventsPerPage = 5;
    const totalMasterPages = Math.ceil(filteredMasterEvents.length / masterEventsPerPage);
    const startIndex = (masterPage - 1) * masterEventsPerPage;
    const paginatedMasterEvents = filteredMasterEvents.slice(startIndex, startIndex + masterEventsPerPage);

    // Tampilan Tabel Master
    return (
      <div className="space-y-8 max-w-[1100px]">
        {/* Password Modal */}
        {passwordModal.isOpen && (
          <div className="fixed inset-0 lg:left-64 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-sm shadow-[var(--admin-shadow)] relative">
              <div className="w-14 h-14 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center mb-5 mx-auto border border-[var(--admin-accent)]/20">
                <FiLock size={24} className="text-[var(--admin-accent)]" />
              </div>
              <h3 className="text-[var(--admin-accent)] font-bold text-xl mb-2 text-center">Masukkan Password</h3>
              <p className="text-[var(--admin-text-muted)] text-sm mb-6 text-center">
                Otorisasi diperlukan untuk melakukan aksi ini.
              </p>
              <form onSubmit={verifyPasswordAndExecute}>
                <div className="mb-6">
                  <input
                    type="password"
                    autoFocus
                    required
                    placeholder="Password"
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)] transition-colors text-center"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setPasswordModal({ isOpen: false, action: null, payload: null }); setInputPassword(''); }} className="flex-1 bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] py-3 rounded-xl transition-all font-bold text-sm">
                    Batal
                  </button>
                  <button type="submit" className="flex-1 bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] text-[var(--admin-surface)] font-bold py-3 rounded-xl transition-all shadow-lg shadow-[var(--admin-accent)]/20 text-sm">
                    Konfirmasi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] flex flex-col justify-center">
            <h3 className="text-[var(--admin-accent)] font-semibold flex items-center gap-2 mb-4"><FiCalendar /> Tambah Event Manual</h3>
            <form onSubmit={handleAddEvent} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" required placeholder="Nama Event (Cth: Wedding Anya)" value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} className="bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7]" />
              <input type="date" required value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} className="bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] [color-scheme:dark]" />
              <button type="submit" className="bg-[#C9868F] hover:bg-[var(--admin-accent)] text-[var(--admin-surface)] font-bold rounded-xl px-4 py-2.5 transition-colors">Tambah Event</button>
            </form>
          </div>
        </div>

        {/* Tabel Master Event */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-[var(--admin-accent)] font-semibold">Daftar Keuangan Event</h3>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
                <input
                  type="text"
                  placeholder="Cari event..."
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                  className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] transition-colors"
                />
              </div>
              <select
                value={eventSortOrder}
                onChange={(e) => setEventSortOrder(e.target.value)}
                className="w-full sm:w-auto bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] [&>option]:bg-[var(--admin-surface)]"
              >
                <option value="newest">Terbaru Dibuat</option>
                <option value="oldest">Terlama Dibuat</option>
                <option value="dateDesc">Tanggal Event (Terbaru)</option>
                <option value="dateAsc">Tanggal Event (Terlama)</option>
                <option value="az">Nama (A-Z)</option>
                <option value="za">Nama (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 z-10 bg-[var(--admin-surface)]">
                <tr className="border-b border-[var(--admin-border)] text-[var(--admin-text-muted)] text-sm bg-[var(--admin-hover-bg)]">
                  <th className="py-3 px-4 font-medium rounded-tl-xl w-1/2">Nama Event</th>
                  <th className="py-3 px-4 font-medium w-1/4">Tanggal</th>
                  <th className="py-3 px-4 font-medium text-center rounded-tr-xl w-1/4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMasterEvents.map(ev => (
                  <tr key={ev.id} className="border-b border-[var(--admin-border)]/50 hover:bg-[var(--admin-hover-bg)] transition-colors group">
                    <td className="py-4 px-4 text-sm text-[var(--admin-text-main)] font-medium">{ev.name}</td>
                    <td className="py-4 px-4 text-sm text-[var(--admin-text-muted)]">{format(new Date(ev.date), 'dd MMM yyyy')}</td>
                    <td className="py-4 px-4 text-sm text-center flex justify-center items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectedEventId(ev.id);
                          setIsEditingIncome(ev.income === 0 || ev.income === '0');
                        }}
                        className="bg-[var(--admin-border-subtle)] text-[var(--admin-accent)] hover:bg-[var(--admin-accent)] hover:text-[var(--admin-surface)] px-4 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                      >
                        Kelola Event
                      </button>
                      <button
                        onClick={() => confirmDeleteEvent(ev.id, ev.name)}
                        className="text-[var(--admin-text-muted)] hover:text-[#D28A94] transition-colors p-1"
                        title="Hapus Event"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredMasterEvents.length === 0 && !loading && (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-[var(--admin-text-muted)] text-sm">Tidak ada event ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-4">
            {paginatedMasterEvents.map(ev => (
              <div key={ev.id} className="bg-[var(--admin-hover-bg)] border border-[var(--admin-border)]/50 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <h4 className="text-[var(--admin-text-main)] font-medium">{ev.name}</h4>
                  <span className="text-xs text-[var(--admin-text-muted)] bg-black/20 px-2 py-1 rounded">{format(new Date(ev.date), 'dd MMM yyyy')}</span>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--admin-border)]/50 mt-1">
                  <button
                    onClick={() => {
                      setSelectedEventId(ev.id);
                      setIsEditingIncome(ev.income === 0 || ev.income === '0');
                    }}
                    className="bg-[var(--admin-border-subtle)] text-[var(--admin-accent)] hover:bg-[var(--admin-accent)] hover:text-[var(--admin-surface)] px-4 py-2 rounded-lg font-semibold text-xs transition-colors"
                  >
                    Kelola
                  </button>
                  <button
                    onClick={() => confirmDeleteEvent(ev.id, ev.name)}
                    className="bg-[var(--admin-border-subtle)] text-[var(--admin-text-muted)] hover:text-[#D28A94] px-4 py-2 rounded-lg font-semibold text-xs transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
            {filteredMasterEvents.length === 0 && !loading && (
              <div className="text-center text-[var(--admin-text-muted)] py-8 text-sm">Tidak ada event ditemukan.</div>
            )}
          </div>

          {totalMasterPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                onClick={() => setMasterPage(p => Math.max(1, p - 1))}
                disabled={masterPage === 1}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${masterPage === 1 ? 'bg-[var(--admin-surface)] text-gray-600 border border-[var(--admin-border)] cursor-not-allowed' : 'bg-[var(--admin-border-subtle)] text-[var(--admin-accent)] hover:bg-[var(--admin-accent)] hover:text-[var(--admin-surface)]'}`}
              >
                Sebelumnya
              </button>
              <span className="text-[var(--admin-text-muted)] text-sm font-medium">Halaman {masterPage} dari {totalMasterPages}</span>
              <button
                onClick={() => setMasterPage(p => Math.min(totalMasterPages, p + 1))}
                disabled={masterPage === totalMasterPages}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${masterPage === totalMasterPages ? 'bg-[var(--admin-surface)] text-gray-600 border border-[var(--admin-border)] cursor-not-allowed' : 'bg-[var(--admin-border-subtle)] text-[var(--admin-accent)] hover:bg-[var(--admin-accent)] hover:text-[var(--admin-surface)]'}`}
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>

        {/* Log Penambahan Event */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] flex flex-col min-h-[220px] max-h-[250px]">
          <h3 className="text-[var(--admin-accent)] font-semibold flex items-center gap-2 mb-4 text-sm"><FiCheck /> Riwayat Ditambahkan</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-[#2E1C1F] scrollbar-track-transparent">
            {events.length === 0 ? (
              <p className="text-[var(--admin-text-muted)] text-xs italic text-center mt-4">Belum ada event</p>
            ) : (
              [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4).map(ev => (
                <div key={ev.id} className="border-l-2 border-[#64D194] pl-3 py-1">
                  <p className="text-[var(--admin-text-main)] text-sm font-medium truncate" title={ev.name}>{ev.name}</p>
                  <p className="text-[var(--admin-text-muted)] text-[10px] mt-0.5">{format(new Date(ev.created_at), 'dd MMM yyyy • HH:mm')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("Laporan Rekapitulasi Keuangan Event", 14, 22);
      doc.setFontSize(10);
      doc.text("Dibuat pada: " + format(new Date(), 'dd MMMM yyyy HH:mm'), 14, 30);

      const tableColumn = ["Nama Event", "Tanggal", "Pemasukan", "Pengeluaran", "Laba Bersih"];
      const tableRows = [];

      const filteredEvents = events.filter(ev => ev.name.toLowerCase().includes(searchQuery.toLowerCase()));

      let totalPemasukan = 0;
      let totalPengeluaran = 0;

      filteredEvents.forEach(ev => {
        const evExpenses = transactions.filter(t => t.event_id === ev.id && t.type === 'event_expense').reduce((sum, t) => sum + Number(t.amount), 0);
        const evProfit = Number(ev.income) - evExpenses;

        totalPemasukan += Number(ev.income);
        totalPengeluaran += evExpenses;

        const eventData = [
          ev.name,
          format(new Date(ev.date), 'dd MMM yyyy'),
          formatIDR(ev.income),
          formatIDR(evExpenses),
          formatIDR(evProfit)
        ];
        tableRows.push(eventData);
      });

      tableRows.push([
        "SUBTOTAL",
        "",
        formatIDR(totalPemasukan),
        formatIDR(totalPengeluaran),
        formatIDR(totalPemasukan - totalPengeluaran)
      ]);

      const totalOperasional = operationalExpenses.reduce((sum, t) => sum + Number(t.amount), 0);

      tableRows.push([
        "PENG. OPERASIONAL",
        "",
        "",
        formatIDR(totalOperasional),
        ""
      ]);

      tableRows.push([
        "LABA BERSIH TOTAL",
        "",
        "",
        "",
        formatIDR((totalPemasukan - totalPengeluaran) - totalOperasional)
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [217, 4, 41] },
      });

      doc.save(`Rekapitulasi_Keuangan_${format(new Date(), 'MMM_yyyy')}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengunduh PDF");
    }
  };

  const renderRecapTab = () => {
    let filteredEvents = events.filter(ev => ev.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Sorting Logic
    if (recapSortOrder === 'newest') {
      filteredEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (recapSortOrder === 'oldest') {
      filteredEvents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (recapSortOrder === 'dateDesc') {
      filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (recapSortOrder === 'dateAsc') {
      filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (recapSortOrder === 'az') {
      filteredEvents.sort((a, b) => a.name.localeCompare(b.name));
    } else if (recapSortOrder === 'za') {
      filteredEvents.sort((a, b) => b.name.localeCompare(a.name));
    }

    const totalFilteredPemasukan = filteredEvents.reduce((sum, ev) => sum + Number(ev.income), 0);
    const totalFilteredPengeluaran = filteredEvents.reduce((sum, ev) => {
      const exps = transactions.filter(t => t.event_id === ev.id && t.type === 'event_expense').reduce((s, t) => s + Number(t.amount), 0);
      return sum + exps;
    }, 0);
    const totalFilteredLaba = totalFilteredPemasukan - totalFilteredPengeluaran;

    const totalOperational = operationalExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const finalLaba = totalFilteredLaba - totalOperational;

    return (
      <div className="space-y-8 max-w-[1100px]">
        {/* Tabel Rekapitulasi */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] overflow-hidden flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-[var(--admin-accent)] font-semibold text-lg">Rekapitulasi Keuangan Seluruh Event</h3>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
                <input
                  type="text"
                  placeholder="Cari nama event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] transition-colors"
                />
              </div>
              <select
                value={recapSortOrder}
                onChange={(e) => setRecapSortOrder(e.target.value)}
                className="w-full sm:w-auto bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] [&>option]:bg-[var(--admin-surface)]"
              >
                <option value="newest">Terbaru Dibuat</option>
                <option value="oldest">Terlama Dibuat</option>
                <option value="dateDesc">Tanggal Event (Terbaru)</option>
                <option value="dateAsc">Tanggal Event (Terlama)</option>
                <option value="az">Nama (A-Z)</option>
                <option value="za">Nama (Z-A)</option>
              </select>
              <button onClick={handleDownloadPDF} className="bg-[var(--admin-accent-bg)] hover:bg-[var(--admin-accent)] text-[var(--admin-accent)] hover:text-[var(--admin-surface)] border border-[#E79EA7]/30 border-solid font-semibold rounded-xl px-4 py-2 transition-colors flex items-center gap-2 text-sm whitespace-nowrap">
                <FiDownload /> PDF
              </button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--admin-surface)]">
                <tr className="border-b border-[var(--admin-border)] text-[var(--admin-text-muted)] text-sm bg-[var(--admin-hover-bg)]">
                  <th className="py-3 px-4 font-medium rounded-tl-xl">Nama Event</th>
                  <th className="py-3 px-4 font-medium">Tanggal</th>
                  <th className="py-3 px-4 font-medium text-right">Pemasukan</th>
                  <th className="py-3 px-4 font-medium text-right">Pengeluaran</th>
                  <th className="py-3 px-4 font-medium text-right rounded-tr-xl">Laba Bersih</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(ev => {
                  const evExpenses = transactions.filter(t => t.event_id === ev.id && t.type === 'event_expense').reduce((sum, t) => sum + Number(t.amount), 0);
                  const evProfit = Number(ev.income) - evExpenses;
                  return (
                    <tr key={ev.id} className="border-b border-[var(--admin-border)]/50 hover:bg-[var(--admin-hover-bg)] transition-colors">
                      <td className="py-3 px-4 text-sm text-[var(--admin-text-main)] font-medium">{ev.name}</td>
                      <td className="py-3 px-4 text-sm text-[var(--admin-text-muted)]">{format(new Date(ev.date), 'dd MMM yyyy')}</td>
                      <td className="py-3 px-4 text-sm font-medium text-[#64D194] text-right">{formatIDR(ev.income)}</td>
                      <td className="py-3 px-4 text-sm font-medium text-[#D28A94] text-right">{formatIDR(evExpenses)}</td>
                      <td className="py-3 px-4 text-sm font-bold text-[var(--admin-accent)] text-right">{formatIDR(evProfit)}</td>
                    </tr>
                  );
                })}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[var(--admin-text-muted)] text-sm">Tidak ada event ditemukan.</td>
                  </tr>
                )}
              </tbody>
              {/* Total Row */}
              {filteredEvents.length > 0 && (
                <tfoot>
                  <tr className="bg-[var(--admin-hover-bg)] border-t-2 border-[#E79EA7]/20">
                    <td colSpan="2" className="py-2 px-4 text-sm text-[var(--admin-text-main)] font-medium text-right">Subtotal Event</td>
                    <td className="py-2 px-4 text-sm font-medium text-[#64D194] text-right">{formatIDR(totalFilteredPemasukan)}</td>
                    <td className="py-2 px-4 text-sm font-medium text-[#D28A94] text-right">{formatIDR(totalFilteredPengeluaran)}</td>
                    <td className="py-2 px-4 text-sm font-bold text-[var(--admin-accent)] text-right">{formatIDR(totalFilteredLaba)}</td>
                  </tr>
                  <tr className="bg-[var(--admin-hover-bg)]">
                    <td colSpan="3" className="py-2 px-4 text-sm text-[var(--admin-text-main)] font-medium text-right">Pengeluaran Operasional</td>
                    <td className="py-2 px-4 text-sm font-medium text-[#D28A94] text-right">{formatIDR(totalOperational)}</td>
                    <td className="py-2 px-4"></td>
                  </tr>
                  <tr className="bg-[var(--admin-surface)] border-t-2 border-[#E79EA7]/20 sticky bottom-0">
                    <td colSpan="4" className="py-4 px-4 text-sm text-[var(--admin-text-main)] font-bold text-right">LABA BERSIH TOTAL</td>
                    <td className="py-4 px-4 text-sm font-bold text-[var(--admin-accent)] text-right">{formatIDR(finalLaba)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {filteredEvents.map(ev => {
              const evExpenses = transactions.filter(t => t.event_id === ev.id && t.type === 'event_expense').reduce((sum, t) => sum + Number(t.amount), 0);
              const evProfit = Number(ev.income) - evExpenses;
              return (
                <div key={ev.id} className="bg-[var(--admin-hover-bg)] border border-[var(--admin-border)]/50 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-[var(--admin-border)]/50 pb-3">
                    <div>
                      <h4 className="text-[var(--admin-text-main)] font-medium">{ev.name}</h4>
                      <span className="text-xs text-[var(--admin-text-muted)]">{format(new Date(ev.date), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--admin-text-muted)] text-xs">Pemasukan:</span>
                    <span className="text-[#64D194] font-medium text-sm">{formatIDR(ev.income)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--admin-text-muted)] text-xs">Pengeluaran:</span>
                    <span className="text-[#D28A94] font-medium text-sm">{formatIDR(evExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--admin-border)]/50 mt-1">
                    <span className="text-[var(--admin-text-main)] text-xs font-semibold">Laba Bersih:</span>
                    <span className="text-[var(--admin-accent)] font-bold text-sm">{formatIDR(evProfit)}</span>
                  </div>
                </div>
              );
            })}
            {filteredEvents.length === 0 && (
              <div className="text-center text-[var(--admin-text-muted)] py-8 text-sm">Tidak ada event ditemukan.</div>
            )}

            {/* Mobile Total Row */}
            {filteredEvents.length > 0 && (
              <div className="bg-[var(--admin-hover-bg)] border-2 border-[#E79EA7]/20 p-4 rounded-xl flex flex-col gap-2 mt-2">
                <div className="text-[var(--admin-text-main)] font-bold text-sm mb-1 border-b border-[#E79EA7]/20 pb-2">TOTAL KESELURUHAN</div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--admin-text-muted)] text-xs">Subtotal Pemasukan:</span>
                  <span className="text-[#64D194] font-medium text-sm">{formatIDR(totalFilteredPemasukan)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--admin-text-muted)] text-xs">Subtotal Peng. Event:</span>
                  <span className="text-[#D28A94] font-medium text-sm">{formatIDR(totalFilteredPengeluaran)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--admin-text-muted)] text-xs">Pengeluaran Operasional:</span>
                  <span className="text-[#D28A94] font-medium text-sm">{formatIDR(totalOperational)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E79EA7]/20 mt-1">
                  <span className="text-[var(--admin-text-main)] text-xs font-bold">Laba Bersih Total:</span>
                  <span className="text-[var(--admin-accent)] font-bold text-sm">{formatIDR(finalLaba)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTargetTab = () => {
    // Hitung Monthly Stats
    const monthlyStats = {};
    events.forEach(ev => {
      if (!ev.date) return;
      const monthStr = format(new Date(ev.date), 'yyyy-MM');
      const evExpenses = transactions.filter(t => t.event_id === ev.id && t.type === 'event_expense').reduce((sum, t) => sum + Number(t.amount), 0);
      const evProfit = Number(ev.income) - evExpenses;

      if (!monthlyStats[monthStr]) {
        monthlyStats[monthStr] = { profit: 0, count: 0 };
      }
      monthlyStats[monthStr].profit += evProfit;
      monthlyStats[monthStr].count += 1;
    });

    // Kurangi dengan pengeluaran operasional di bulan tersebut
    operationalExpenses.forEach(t => {
      if (!t.date) return;
      const monthStr = format(new Date(t.date), 'yyyy-MM');
      if (!monthlyStats[monthStr]) {
        monthlyStats[monthStr] = { profit: 0, count: 0 };
      }
      monthlyStats[monthStr].profit -= Number(t.amount);
    });

    return (
      <div className="space-y-8 max-w-[1100px]">

        {/* Target Keseluruhan (All-Time) */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] animate-fade-in-up">
          <h3 className="text-[var(--admin-accent)] font-semibold mb-4 flex items-center gap-2"><FiTarget /> Pengaturan Target Keseluruhan</h3>
          {isEditingAllTime ? (
            <form onSubmit={handleUpdateAllTime} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] font-medium">Rp</span>
                <input type="text" required value={targetAllTime} onChange={e => handleNumberInput(e.target.value, setTargetAllTime)} className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--admin-text-main)] font-bold focus:outline-none focus:border-[#E79EA7]" />
              </div>
              <button type="submit" disabled={isUpdatingTarget} title="Simpan Target Utama" className="bg-[#C9868F] hover:bg-[var(--admin-accent)] text-[var(--admin-surface)] rounded-xl p-3.5 transition-colors flex items-center justify-center flex-shrink-0">
                {isUpdatingTarget ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiCheck size={20} />}
              </button>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1 max-w-sm bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] font-bold">
                Rp {targetAllTime}
              </div>
              <button type="button" onClick={() => setIsEditingAllTime(true)} title="Edit Target Utama" className="bg-[var(--admin-input-bg)] hover:bg-[#C9868F] text-[var(--admin-text-main)] hover:text-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-3.5 transition-colors flex items-center justify-center flex-shrink-0">
                <FiEdit2 size={20} />
              </button>
            </div>
          )}
          <p className="text-[var(--admin-text-muted)] text-xs mt-3">Target ini adalah target akhir atau utama tanpa ada batasan waktu pencapaian.</p>
        </div>

        {/* Target Bulanan & Tabel Log */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <h3 className="text-[var(--admin-accent)] font-semibold mb-4 flex items-center gap-2"><FiCalendar /> Pengaturan Target Bulanan</h3>
          {isEditingMonthly ? (
            <form onSubmit={handleUpdateMonthly} className="flex flex-col sm:flex-row gap-4 mb-6">
              <input type="month" required value={targetMonth} onChange={e => setTargetMonth(e.target.value)} className="bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] [color-scheme:dark]" />
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] font-medium">Rp</span>
                <input type="text" required value={targetKeuntungan} onChange={e => handleNumberInput(e.target.value, setTargetKeuntungan)} className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--admin-text-main)] font-bold focus:outline-none focus:border-[#E79EA7]" />
              </div>
              <button type="submit" disabled={isUpdatingTarget} title="Simpan Target Bulanan" className="bg-[#C9868F] hover:bg-[var(--admin-accent)] text-[var(--admin-surface)] rounded-xl p-3.5 transition-colors flex items-center justify-center flex-shrink-0">
                {isUpdatingTarget ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiCheck size={20} />}
              </button>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center">
              <div className="bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] min-w-[200px]">
                {format(new Date(targetMonth + '-01'), 'MMMM yyyy')}
              </div>
              <div className="flex-1 max-w-sm bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] font-bold">
                Rp {targetKeuntungan}
              </div>
              <button type="button" onClick={() => setIsEditingMonthly(true)} title="Edit Target Bulanan" className="bg-[var(--admin-input-bg)] hover:bg-[#C9868F] text-[var(--admin-text-main)] hover:text-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-3.5 transition-colors flex items-center justify-center flex-shrink-0">
                <FiEdit2 size={20} />
              </button>
            </div>
          )}

          {/* Log Pencapaian Target per Bulan */}
          <div className="overflow-y-auto max-h-[400px] custom-scrollbar pr-2 mt-4 pt-4 border-t border-[var(--admin-border-subtle)]">
            <h4 className="text-sm font-semibold text-[var(--admin-text-main)] mb-3">Log Pencapaian Target per Bulan</h4>
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--admin-surface)]">
                <tr className="border-b border-[var(--admin-border)] text-[var(--admin-text-muted)] text-sm bg-[var(--admin-hover-bg)]">
                  <th className="py-3 px-4 font-medium rounded-tl-xl">Bulan</th>
                  <th className="py-3 px-4 font-medium text-center">Jumlah Event</th>
                  <th className="py-3 px-4 font-medium text-right">Target Keuntungan</th>
                  <th className="py-3 px-4 font-medium text-right">Laba Tercapai</th>
                  <th className="py-3 px-4 font-medium text-center rounded-tr-xl">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(monthlyStats).length > 0 ? (
                  Object.keys(monthlyStats).sort((a, b) => b.localeCompare(a)).map(monthKey => {
                    const stat = monthlyStats[monthKey];
                    const rawTarget = allTargets[`target_keuntungan_${monthKey}`] || allTargets['target_keuntungan'] || 10000000;
                    const isAchieved = stat.profit >= rawTarget;
                    const percentage = Math.min((stat.profit / rawTarget) * 100, 100).toFixed(1);

                    return (
                      <tr key={monthKey} className="border-b border-[var(--admin-border)]/50 hover:bg-[var(--admin-hover-bg)] transition-colors">
                        <td className="py-3 px-4 text-sm text-[var(--admin-text-main)] font-medium">{format(new Date(monthKey + '-01'), 'MMMM yyyy')}</td>
                        <td className="py-3 px-4 text-sm text-[var(--admin-text-main)] text-center">{stat.count} Event</td>
                        <td className="py-3 px-4 text-sm font-medium text-[var(--admin-text-muted)] text-right">{formatIDR(rawTarget)}</td>
                        <td className="py-3 px-4 text-sm font-bold text-[var(--admin-accent)] text-right">{formatIDR(stat.profit)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs px-3 py-1 rounded-full ${isAchieved ? 'bg-[#64D194]/20 text-[#64D194]' : 'bg-[#D28A94]/20 text-[#D28A94]'}`}>
                            {isAchieved ? 'Tercapai' : `${percentage}%`}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[var(--admin-text-muted)] text-sm">Belum ada data pencapaian.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Target Kustom */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] overflow-hidden flex flex-col animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <h3 className="text-[var(--admin-accent)] font-semibold mb-4 flex items-center gap-2"><FiBox /> Daftar Target Kustom / Impian</h3>

          <form onSubmit={handleAddCustomTarget} className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b border-[var(--admin-border-subtle)]">
            <input type="text" placeholder="Nama Target (misal: Beli Lensa)" value={newCustomTarget.name} onChange={e => setNewCustomTarget({ ...newCustomTarget, name: e.target.value })} className="flex-1 bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7]" required />
            <div className="relative w-full sm:w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] font-medium">Rp</span>
              <input type="text" required value={newCustomTarget.amount} onChange={e => handleNumberInput(e.target.value, (val) => setNewCustomTarget({ ...newCustomTarget, amount: val }))} className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--admin-text-main)] font-bold focus:outline-none focus:border-[#E79EA7]" placeholder="0" />
            </div>
            <button type="submit" disabled={isUpdatingTarget} className="bg-[var(--admin-accent-bg)] hover:bg-[var(--admin-accent)] text-[var(--admin-accent)] hover:text-[var(--admin-surface)] border border-[#E79EA7]/30 border-solid font-semibold rounded-xl px-6 py-2.5 transition-colors flex items-center gap-2 text-sm whitespace-nowrap">
              <FiPlus /> Tambah
            </button>
          </form>

          <div className="overflow-y-auto max-h-[300px] custom-scrollbar pr-2 space-y-3">
            {customTargets.length > 0 ? (
              customTargets.map(target => (
                <div key={target.id} className="bg-[var(--admin-hover-bg)] border border-[var(--admin-border-subtle)] p-4 rounded-xl flex items-center justify-between group transition-colors">
                  <div>
                    <h4 className="text-[var(--admin-text-main)] font-medium">{target.name}</h4>
                    <span className="text-[#64D194] font-bold text-sm">{formatIDR(target.amount)}</span>
                  </div>
                  <button onClick={() => setDeleteModal({ isOpen: true, type: 'custom_target', id: target.id, title: 'Hapus Target Impian?', message: `Apakah Anda yakin ingin menghapus target "${target.name}"?` })} className="text-[#D28A94] bg-[#D28A94]/10 hover:bg-[#D28A94] hover:text-[var(--admin-surface)] p-2.5 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <FiTrash2 size={18} />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center text-[var(--admin-text-muted)] py-8 text-sm bg-[var(--admin-input-bg)] rounded-xl border border-[var(--admin-border-subtle)] border-dashed">
                Belum ada target kustom. Tambahkan target di atas!
              </div>
            )}
          </div>
        </div>

      </div>
    );
  };

  const renderOperationalTab = () => {
    let filteredOperational = operationalExpenses.filter(exp =>
      exp.description.toLowerCase().includes(operationalSearchQuery.toLowerCase())
    );

    if (operationalSortOrder === 'dateDesc') {
      filteredOperational.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (operationalSortOrder === 'dateAsc') {
      filteredOperational.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (operationalSortOrder === 'highest') {
      filteredOperational.sort((a, b) => b.amount - a.amount);
    } else if (operationalSortOrder === 'lowest') {
      filteredOperational.sort((a, b) => a.amount - b.amount);
    } else if (operationalSortOrder === 'az') {
      filteredOperational.sort((a, b) => a.description.localeCompare(b.description));
    } else if (operationalSortOrder === 'za') {
      filteredOperational.sort((a, b) => b.description.localeCompare(a.description));
    }

    const totalOperational = filteredOperational.reduce((sum, t) => sum + Number(t.amount), 0);

    return (
      <div className="space-y-8 max-w-[1100px]">
        {/* Form Tambah Pengeluaran */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] animate-fade-in-up">
          <h3 className="text-[var(--admin-accent)] font-semibold flex items-center gap-2 mb-4"><FiPlus /> Tambah Pengeluaran Operasional (Luar Event)</h3>
          <form onSubmit={handleAddOperationalExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="date" required value={newOperationalExpense.date} onChange={e => setNewOperationalExpense({ ...newOperationalExpense, date: e.target.value })} className="bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] [color-scheme:dark]" />
            <input type="text" required placeholder="Deskripsi (Cth: Beli Kamera)" value={newOperationalExpense.description} onChange={e => setNewOperationalExpense({ ...newOperationalExpense, description: e.target.value })} className="md:col-span-2 bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7]" />
            <div className="relative w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] font-medium">Rp</span>
              <input type="text" required placeholder="0" value={newOperationalExpense.amount} onChange={e => handleNumberInput(e.target.value, (val) => setNewOperationalExpense({ ...newOperationalExpense, amount: val }))} className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--admin-text-main)] font-bold focus:outline-none focus:border-[#E79EA7]" />
            </div>
            <button type="submit" className="md:col-span-4 bg-[#C9868F] hover:bg-[var(--admin-accent)] text-[var(--admin-surface)] font-bold rounded-xl px-4 py-2.5 transition-colors flex items-center justify-center gap-2 mt-2">
              <FiCheck /> Simpan Pengeluaran
            </button>
          </form>
        </div>

        {/* Tabel Daftar Pengeluaran */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-[var(--admin-accent)] font-semibold flex items-center gap-2"><FiSearch /> Daftar Pengeluaran Operasional</h3>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 w-full sm:w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
                <input
                  type="text"
                  placeholder="Cari deskripsi..."
                  value={operationalSearchQuery}
                  onChange={(e) => setOperationalSearchQuery(e.target.value)}
                  className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl pl-10 pr-4 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] transition-colors"
                />
              </div>
              <select
                value={operationalSortOrder}
                onChange={(e) => setOperationalSortOrder(e.target.value)}
                className="w-full sm:w-auto bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-2 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#E79EA7] [&>option]:bg-[var(--admin-surface)]"
              >
                <option value="dateDesc">Tanggal (Terbaru)</option>
                <option value="dateAsc">Tanggal (Terlama)</option>
                <option value="highest">Nominal (Tertinggi)</option>
                <option value="lowest">Nominal (Terendah)</option>
                <option value="az">Deskripsi (A-Z)</option>
                <option value="za">Deskripsi (Z-A)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)]">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-hover-bg)] text-[var(--admin-text-muted)] text-sm">
                  <th className="py-3 px-4 font-medium w-1/4">Tanggal</th>
                  <th className="py-3 px-4 font-medium w-1/2">Deskripsi Item</th>
                  <th className="py-3 px-4 font-medium text-right w-1/4">Nominal (Rp)</th>
                  <th className="py-3 px-4 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOperational.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-[var(--admin-text-muted)] text-sm italic">Belum ada pengeluaran operasional.</td>
                  </tr>
                ) : (
                  filteredOperational.map(exp => (
                    <tr key={exp.id} className="border-b border-white/[0.02] hover:bg-[var(--admin-hover-bg)] transition-colors">
                      <td className="py-3 px-4 text-sm text-[var(--admin-text-muted)]">{format(new Date(exp.date), 'dd MMM yyyy')}</td>
                      <td className="py-3 px-4 text-sm text-[var(--admin-text-main)] font-medium">{exp.description}</td>
                      <td className="py-3 px-4 text-sm font-bold text-[#D28A94] text-right">{formatIDR(exp.amount)}</td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => setDeleteModal({ isOpen: true, type: 'operational', id: exp.id, title: 'Hapus Pengeluaran?', message: `Yakin menghapus operasional "${exp.description}"?` })} className="text-[var(--admin-text-muted)] hover:text-[#D28A94] transition-colors p-1" title="Hapus">
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredOperational.length > 0 && (
                <tfoot>
                  <tr className="bg-[var(--admin-hover-bg)] border-t-2 border-[#E79EA7]/20 sticky bottom-0">
                    <td colSpan="2" className="py-4 px-4 text-sm text-[var(--admin-text-main)] font-bold text-right">TOTAL PENGELUARAN OPERASIONAL</td>
                    <td className="py-4 px-4 text-sm font-bold text-[#D28A94] text-right">{formatIDR(totalOperational)}</td>
                    <td className="py-4 px-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-start pt-20 rounded-[1.5rem]">
          <div className="w-8 h-8 border-4 border-[#E79EA7] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {activeSubTab === 'events' && renderEventsTab()}
      {activeSubTab === 'operational' && renderOperationalTab()}
      {activeSubTab === 'recap' && renderRecapTab()}
      {activeSubTab === 'target' && renderTargetTab()}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 lg:left-64 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-sm shadow-[0_0_40px_rgba(210,138,148,0.1)]">
            <div className="w-14 h-14 rounded-full bg-[#D28A94]/10 flex items-center justify-center mb-5 mx-auto border border-[#D28A94]/20">
              <FiTrash2 size={24} className="text-[#D28A94]" />
            </div>
            <h3 className="text-[var(--admin-accent)] font-bold text-xl mb-2 text-center">{deleteModal.title}</h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-8 text-center leading-relaxed">
              {deleteModal.message}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, type: '', id: null, title: '', message: '' })}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-input-bg)] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (deleteModal.type === 'event') {
                    executeDeleteEvent(deleteModal.id);
                  } else if (deleteModal.type === 'transaction') {
                    executeDeleteTransaction(deleteModal.id);
                  } else if (deleteModal.type === 'custom_target') {
                    handleDeleteCustomTarget(deleteModal.id);
                  } else if (deleteModal.type === 'operational') {
                    handleDeleteOperationalExpense(deleteModal.id);
                  }
                  setDeleteModal({ isOpen: false, type: '', id: null, title: '', message: '' });
                }}
                className="flex-1 bg-[#D28A94] hover:bg-red-500 text-[var(--admin-surface)] hover:text-[var(--admin-text-main)] px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#D28A94]/20"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFinance;
