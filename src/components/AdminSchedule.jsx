import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format, isSameDay, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FiCalendar, FiTrash2, FiPlus, FiX } from 'react-icons/fi';

const AdminSchedule = () => {
  const [bookedDates, setBookedDates] = useState([]);
  const [financialEvents, setFinancialEvents] = useState([]);
  const [dbData, setDbData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for adding event name
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventName, setEventName] = useState('');

  // Modal State for deleting schedule
  const [scheduleToDelete, setScheduleToDelete] = useState(null);

  // Tab State for Schedule List
  const [activeListTab, setActiveListTab] = useState('upcoming');

  useEffect(() => {
    fetchScheduleData();
  }, []);

  const fetchScheduleData = async () => {
    setLoading(true);
    try {
      const { data: bookedData, error: e1 } = await supabase.from('booked_dates').select('*').order('date', { ascending: true });
      if (e1) throw e1;

      const { data: financeData, error: e2 } = await supabase.from('financial_events').select('*');
      if (e2) throw e2;

      if (bookedData) {
        setDbData(bookedData);
        setBookedDates(bookedData.map(item => parseISO(item.date)));
      }
      if (financeData) {
        setFinancialEvents(financeData);
      }
    } catch (error) {
      toast.error('Gagal mengambil data jadwal.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = async (clickedDate) => {
    const isBooked = bookedDates.some(date => isSameDay(date, clickedDate));
    if (isBooked) {
      // Hapus booking lewat modal
      const itemToDelete = dbData.find(d => isSameDay(parseISO(d.date), clickedDate));
      if (itemToDelete) {
        setScheduleToDelete(itemToDelete);
      }
      return;
    }

    const isFinance = financialEvents.some(ev => ev.date && isSameDay(parseISO(ev.date), clickedDate));
    if (isFinance) {
      toast.success("Event ini dikelola dari halaman Keuangan.");
      return;
    }

    // Buka modal untuk isi nama event
    setSelectedDate(clickedDate);
    setEventName('');
  };

  const confirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedDate) return;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    setLoading(true);
    try {
      const { error } = await supabase.from('booked_dates').insert([{
        date: formattedDate,
        event_name: eventName || 'Event Booked'
      }]);
      if (error) throw error;

      const { error: finError } = await supabase.from('financial_events').insert([{
        name: eventName || 'Event Booked',
        date: formattedDate,
        income: 0
      }]);
      if (finError) throw finError;

      toast.success(`Berhasil mem-booking untuk ${eventName || 'Event'}!`);
      setSelectedDate(null);
      await fetchScheduleData();
    } catch (error) {
      toast.error('Gagal memperbarui jadwal.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('booked_dates').delete().eq('id', scheduleToDelete.id);
      if (error) throw error;

      const { error: finError } = await supabase.from('financial_events')
        .delete()
        .match({ date: scheduleToDelete.date, name: scheduleToDelete.event_name });
      if (finError) throw finError;

      toast.success('Jadwal berhasil dibatalkan.');
      setScheduleToDelete(null);
      await fetchScheduleData();
    } catch (error) {
      toast.error('Gagal membatalkan jadwal');
    } finally {
      setLoading(false);
    }
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const isBooked = bookedDates.some(bookedDate => isSameDay(date, bookedDate));

      if (isBooked) return 'booked-date relative';
      return 'relative';
    }
    return null;
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const isBooked = bookedDates.some(bookedDate => isSameDay(date, bookedDate));
      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

      if (isBooked) {
        return <div className="calendar-tooltip bg-[#D90429]">Booked</div>;
      } else if (!isPast) {
        return <div className="calendar-tooltip bg-[#25D366]">Available</div>;
      }
    }
    return null;
  };

  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const unifiedSchedules = dbData.map(d => ({ ...d, source: 'booked' }));

  const upcomingSchedules = unifiedSchedules.filter(d => new Date(d.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date));
  const pastSchedules = unifiedSchedules.filter(d => new Date(d.date) < today).sort((a, b) => new Date(b.date) - new Date(a.date));

  const displaySchedules = activeListTab === 'upcoming' ? upcomingSchedules : pastSchedules;

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-8 relative max-w-[1100px]">

      {/* Modal Input Event Name */}
      {selectedDate && (
        <div className="fixed inset-0 lg:left-64 bg-black/75 z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-sm shadow-[var(--admin-shadow)] relative">
            <button onClick={() => setSelectedDate(null)} className="absolute top-6 right-6 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] transition-colors">
              <FiX size={20} />
            </button>
            <div className="w-14 h-14 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center mb-5 mx-auto border border-[var(--admin-accent)]/20">
              <FiCalendar size={24} className="text-[var(--admin-accent)]" />
            </div>
            <h3 className="text-[var(--admin-accent)] font-bold text-xl mb-2 text-center">Booking Tanggal</h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-6 text-center">
              {format(selectedDate, 'EEEE, dd MMMM yyyy')}
            </p>
            <form onSubmit={confirmBooking}>
              <div className="mb-6">
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Nama Event (Cth: Wedding Budi)"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] rounded-xl px-4 py-3 text-[var(--admin-text-main)] text-sm focus:outline-none focus:border-[var(--admin-accent)] transition-colors text-center"
                />
              </div>
              <button type="submit" className="w-full bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] text-[var(--admin-surface)] font-bold py-3 rounded-xl transition-all shadow-lg shadow-[var(--admin-accent)]/20 text-sm">
                Simpan Jadwal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Jadwal */}
      {scheduleToDelete && (
        <div className="fixed inset-0 lg:left-64 bg-black/75 z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-3xl p-8 w-full max-w-sm shadow-[var(--admin-shadow)] relative">
            <div className="w-14 h-14 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center mb-5 mx-auto border border-[#D28A94]/20">
              <FiTrash2 size={24} className="text-[var(--admin-accent-hover)]" />
            </div>
            <h3 className="text-[var(--admin-accent)] font-bold text-xl mb-2 text-center">Batalkan Jadwal?</h3>
            <p className="text-[var(--admin-text-muted)] text-sm mb-8 text-center leading-relaxed">
              Yakin ingin membatalkan jadwal <br />
              <span className="text-[var(--admin-text-main)] font-semibold">{scheduleToDelete.event_name || 'Event Booked'}</span> pada <br />
              <span className="text-[var(--admin-text-main)] font-semibold">{format(new Date(scheduleToDelete.date), 'EEEE, dd MMMM yyyy')}</span>?
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setScheduleToDelete(null)} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-hover-bg)] transition-colors">
                Batal
              </button>
              <button onClick={confirmDelete} className="flex-1 bg-[var(--admin-accent-hover)] hover:bg-red-500 text-[var(--admin-surface)] hover:text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#D28A94]/20">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Side */}
      <div className="w-full lg:w-[500px] bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 md:p-8 rounded-[1.5rem] calendar-wrapper admin-calendar relative shadow-[var(--admin-shadow)]">
        <Calendar
          onClickDay={handleDateClick}
          tileClassName={tileClassName}
          tileContent={tileContent}
          prev2Label={null}
          next2Label={null}
        />
        {loading && (
          <div className="absolute inset-0 bg-black/30 rounded-[1.5rem] flex items-center justify-center z-10">
            <div className="w-8 h-8 border-4 border-[var(--admin-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Status Indikator Legend */}
        <div className="mt-6 pt-5 border-t border-[var(--admin-border)]">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--admin-text-muted)]">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md bg-[var(--admin-input-bg)] border border-[var(--admin-border-subtle)] flex items-center justify-center">
                <span className="text-[var(--admin-text-main)] text-[10px] font-medium">01</span>
              </div>
              <span className="font-medium text-[var(--admin-text-main)]">Available</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(217, 4, 41, 0.05)',
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(217, 4, 41, 0.2) 3px, rgba(217, 4, 41, 0.2) 6px)'
                }}>
                <span className="text-[var(--admin-text-muted)] text-[10px] font-medium line-through decoration-[#D90429]/70">02</span>
              </div>
              <span className="font-medium text-[var(--admin-text-main)]">Booked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Schedules Side */}
      <div className="flex-1 flex flex-col max-w-[500px]">
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] flex flex-col">

          <div className="flex gap-2 border-b border-[var(--admin-border)] pb-3 mb-4">
            <button
              onClick={() => setActiveListTab('upcoming')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeListTab === 'upcoming' ? 'bg-[var(--admin-accent)] text-[var(--admin-surface)]' : 'text-[var(--admin-text-muted)] hover:bg-[var(--admin-hover-bg)] hover:text-[var(--admin-text-main)]'}`}
            >
              Mendatang
            </button>
            <button
              onClick={() => setActiveListTab('past')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeListTab === 'past' ? 'bg-[var(--admin-accent)] text-[var(--admin-surface)]' : 'text-[var(--admin-text-muted)] hover:bg-[var(--admin-hover-bg)] hover:text-[var(--admin-text-main)]'}`}
            >
              Terlewati
            </button>
          </div>

          <div className="overflow-y-auto pr-2 custom-scrollbar max-h-[420px]">
            <div className="space-y-3">
              {displaySchedules.length === 0 ? (
                <p className="text-[var(--admin-text-muted)] text-sm italic text-center py-4">Belum ada jadwal.</p>
              ) : (
                displaySchedules.map(sched => (
                  <div key={sched.id} className={`flex items-center justify-between p-4 bg-[var(--admin-input-bg)] border border-[var(--admin-border-subtle)] rounded-xl transition-colors ${sched.source === 'finance' ? 'border-l-4 border-l-[var(--admin-accent)]' : 'hover:bg-[var(--admin-hover-bg)]'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border shrink-0 ${sched.source === 'finance' ? 'bg-[var(--admin-accent-bg)] border-[var(--admin-accent)]/30 text-[var(--admin-accent)]' : 'bg-[#D90429]/10 border-[#D90429]/20 text-[#D90429]'}`}>
                        <FiCalendar size={18} />
                      </div>
                      <div>
                        <p className="text-[var(--admin-text-main)] font-medium">{sched.event_name}</p>
                        <p className="text-[var(--admin-text-muted)] text-sm">{format(new Date(sched.date), 'EEEE, dd MMMM yyyy')}</p>
                      </div>
                    </div>
                    <button onClick={() => setScheduleToDelete(sched)} className="p-2 bg-[var(--admin-hover-bg)] hover:bg-[#D90429] text-[var(--admin-accent)] hover:text-white rounded-xl transition-colors">
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--admin-border)]">
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSchedule;
