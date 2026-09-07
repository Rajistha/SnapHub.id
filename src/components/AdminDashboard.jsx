import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FiTrendingUp, FiTarget, FiArrowUpRight, FiActivity, FiPieChart, FiCalendar, FiStar, FiPercent, FiList, FiDollarSign } from 'react-icons/fi';
import { format, getDaysInMonth, getDate } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEventIncome: 0,
    totalEventExpense: 0,
    netProfit: 0
  });
  const [insightStats, setInsightStats] = useState({
    totalEvents: 0,
    avgProfit: 0,
    profitMargin: 0,
    topEventName: '-',
    topEventProfit: 0
  });
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [targets, setTargets] = useState({
    allTime: 0,
    monthly: 0,
    custom: []
  });
  const [upcomingSchedules, setUpcomingSchedules] = useState([]);
  const [pastSchedules, setPastSchedules] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: events } = await supabase.from('financial_events').select('*').order('date', { ascending: true });
      const { data: transactions } = await supabase.from('transactions').select('*');
      const { data: settingsData } = await supabase.from('settings').select('*');
      const { data: schedules } = await supabase.from('booked_dates').select('*').order('date', { ascending: true });

      const currentMonthStr = format(new Date(), 'yyyy-MM');

      let targetAllTime = 0;
      let targetMonthly = 0;
      let customTargets = [];
      let operationalExpenses = [];

      if (settingsData) {
        const t = {};
        settingsData.forEach(item => t[item.key] = item.value);

        if (t['target_all_time']) targetAllTime = Number(t['target_all_time']);
        if (t[`target_keuntungan_${currentMonthStr}`]) targetMonthly = Number(t[`target_keuntungan_${currentMonthStr}`]);
        else if (t['target_keuntungan']) targetMonthly = Number(t['target_keuntungan']);

        if (t['custom_targets']) {
          try {
            customTargets = JSON.parse(t['custom_targets']);
          } catch (e) {
            console.error('Gagal memparsing custom_targets:', e);
            toast.error('Data target kustom rusak, ditampilkan kosong.');
          }
        }

        if (t['operational_expenses']) {
          try {
            operationalExpenses = JSON.parse(t['operational_expenses']);
          } catch (e) {
            console.error('Gagal memparsing operational_expenses:', e);
            toast.error('Data pengeluaran operasional rusak, ditampilkan kosong.');
          }
        }
      }
      setTargets({ allTime: targetAllTime, monthly: targetMonthly, custom: customTargets });

      let unifiedSchedules = [];
      if (schedules) {
        unifiedSchedules = [...schedules];
      }
      if (events) {
        events.forEach(ev => {
          if (ev.date) {
            const exists = unifiedSchedules.some(s => s.date === ev.date && s.event_name === ev.name);
            if (!exists) {
              unifiedSchedules.push({ id: `fin_${ev.id}`, date: ev.date, event_name: ev.name });
            }
          }
        });
      }

      if (unifiedSchedules.length > 0) {
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        const upcoming = unifiedSchedules.filter(d => new Date(d.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date));
        const past = unifiedSchedules.filter(d => new Date(d.date) < today).sort((a, b) => new Date(b.date) - new Date(a.date));
        setUpcomingSchedules(upcoming);
        setPastSchedules(past);
      } else {
        setUpcomingSchedules([]);
        setPastSchedules([]);
      }

      let eventExpense = 0;
      let eventIncome = 0;
      let thisMonthNetProfit = 0;

      if (events && transactions) {
        eventIncome = events.reduce((acc, curr) => acc + Number(curr.income), 0);

        transactions.forEach(t => {
          if (t.type === 'event_expense') eventExpense += Number(t.amount);
        });
        
        let totalOperationalExpense = 0;
        operationalExpenses.forEach(t => {
          totalOperationalExpense += Number(t.amount);
        });

        events.forEach(ev => {
          if (ev.date && ev.date.startsWith(currentMonthStr)) {
            const evExpenses = transactions.filter(t => t.event_id === ev.id && t.type === 'event_expense').reduce((sum, t) => sum + Number(t.amount), 0);
            thisMonthNetProfit += (Number(ev.income) - evExpenses);
          }
        });
        
        // Deduct this month's operational expenses
        const thisMonthOperational = operationalExpenses.filter(t => t.date && t.date.startsWith(currentMonthStr)).reduce((sum, t) => sum + Number(t.amount), 0);
        thisMonthNetProfit -= thisMonthOperational;
      }

      const netProfit = eventIncome - eventExpense - (events && transactions ? operationalExpenses.reduce((sum, t) => sum + Number(t.amount), 0) : 0);

      // Calculations for insights
      const totalEvents = events ? events.length : 0;
      let topEventName = '-';
      let topEventProfit = 0;

      if (events && transactions) {
        events.forEach(ev => {
          const evExpenses = transactions.filter(t => t.event_id === ev.id).reduce((sum, t) => sum + Number(t.amount), 0);
          const evProfit = Number(ev.income) - evExpenses;
          if (evProfit >= topEventProfit && evProfit > 0) {
            topEventProfit = evProfit;
            topEventName = ev.name;
          }
        });
      }

      const avgProfit = totalEvents > 0 ? netProfit / totalEvents : 0;
      const profitMargin = eventIncome > 0 ? (netProfit / eventIncome) * 100 : 0;

      setInsightStats({
        totalEvents,
        avgProfit,
        profitMargin,
        topEventName,
        topEventProfit,
        thisMonthNetProfit
      });

      setStats({
        totalEventIncome: eventIncome,
        totalEventExpense: eventExpense,
        totalOperationalExpense: events && transactions ? operationalExpenses.reduce((sum, t) => sum + Number(t.amount), 0) : 0,
        netProfit: netProfit
      });

      // Prepare Chart Data
      if (events && transactions) {
        const dataForChart = events.map(ev => {
          const evExpenses = transactions.filter(t => t.event_id === ev.id).reduce((sum, t) => sum + Number(t.amount), 0);
          return {
            name: ev.name.substring(0, 10) + (ev.name.length > 10 ? '...' : ''),
            Pemasukan: Number(ev.income),
            Pengeluaran: evExpenses
          };
        }).slice(-7); // Last 7 events

        setChartData(dataForChart);
      }

      // Prepare Pie Chart Data
      if (transactions) {
        const expenseMap = {};
        transactions.filter(t => t.type === 'event_expense').forEach(t => {
          const desc = t.description.toLowerCase().trim();
          const displayDesc = desc.charAt(0).toUpperCase() + desc.slice(1);
          expenseMap[displayDesc] = (expenseMap[displayDesc] || 0) + Number(t.amount);
        });

        let pieArr = Object.keys(expenseMap).map(key => ({ name: key, value: expenseMap[key] }));
        pieArr.sort((a, b) => b.value - a.value); // Sort descending

        if (pieArr.length > 4) {
          const top4 = pieArr.slice(0, 4);
          const othersValue = pieArr.slice(4).reduce((sum, curr) => sum + curr.value, 0);
          pieArr = [...top4, { name: 'Lainnya', value: othersValue }];
        } else if (pieArr.length === 0) {
          pieArr = [{ name: 'Belum Ada', value: 1 }];
        }

        setPieData(pieArr);
      }

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-start pt-32 h-screen relative">
        <div className="w-10 h-10 border-4 border-[#E79EA7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const PIE_COLORS = ['#D28A94', '#64D194', '#E79EA7', '#8E7B7D', '#6E3A42'];

  const todayDate = new Date();
  const daysLeft = getDaysInMonth(todayDate) - getDate(todayDate);

  const allTimeTarget = targets.allTime || 1;
  const allTimeTercapaiRaw = Math.max(0, ((stats.netProfit || 0) / allTimeTarget) * 100);
  const allTimeTercapaiWidth = Math.min(allTimeTercapaiRaw, 100);

  const monthlyTarget = targets.monthly || 1;
  const monthlyTercapaiRaw = Math.max(0, ((insightStats.thisMonthNetProfit || 0) / monthlyTarget) * 100);
  const monthlyTercapaiWidth = Math.min(monthlyTercapaiRaw, 100);

  return (
    <div className="space-y-4 font-sans max-w-[1100px]">

      {/* Top Hero & Financial Summary */}
      <div className="space-y-6">
        
        {/* Main Net Profit Card */}
        <div className="bg-gradient-to-br from-[var(--admin-hero-grad)] to-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-6 md:p-8 shadow-[var(--admin-shadow)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--admin-accent)] opacity-5 rounded-full blur-[80px] pointer-events-none group-hover:opacity-10 transition-opacity duration-1000" />
          
          <div className="relative z-10">
            <p className="text-[var(--admin-text-muted)] text-[0.95rem] font-semibold tracking-wider uppercase mb-1">Total Laba Bersih</p>
            <h2 className="text-4xl md:text-[3.25rem] font-extrabold text-[var(--admin-accent)] mt-2 leading-tight drop-shadow-md">
              {formatIDR(stats.netProfit)}
            </h2>
            <p className="text-[var(--admin-text-subtle)] text-sm mt-3 font-medium">Akumulasi dari seluruh event & operasional bisnis</p>
          </div>
        </div>

        {/* Sub Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.25rem] p-5 hover:border-[#64D194]/30 hover:shadow-[0_4px_20px_rgba(100,209,148,0.05)] transition-all duration-300">
            <p className="text-[var(--admin-text-muted)] text-sm font-medium tracking-wide mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#64D194]/10 flex items-center justify-center text-[#64D194]">
                <FiTrendingUp size={16} />
              </span>
              Pemasukan Event
            </p>
            <span className="text-2xl font-bold text-[#64D194]">{formatIDR(stats.totalEventIncome)}</span>
          </div>

          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.25rem] p-5 hover:border-[#D28A94]/30 hover:shadow-[0_4px_20px_rgba(210,138,148,0.05)] transition-all duration-300">
            <p className="text-[var(--admin-text-muted)] text-sm font-medium tracking-wide mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#D28A94]/10 flex items-center justify-center text-[#D28A94]">
                <FiArrowUpRight size={16} />
              </span>
              Pengeluaran Event
            </p>
            <span className="text-2xl font-bold text-[#D28A94]">{formatIDR(stats.totalEventExpense)}</span>
          </div>

          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.25rem] p-5 hover:border-[#D28A94]/30 hover:shadow-[0_4px_20px_rgba(210,138,148,0.05)] transition-all duration-300">
            <p className="text-[var(--admin-text-muted)] text-sm font-medium tracking-wide mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#D28A94]/10 flex items-center justify-center text-[#D28A94]">
                <FiArrowUpRight size={16} />
              </span>
              Pengeluaran Operasional
            </p>
            <span className="text-2xl font-bold text-[#D28A94]">{formatIDR(stats.totalOperationalExpense || 0)}</span>
          </div>

        </div>

      </div>

      {/* Target Progress Bars */}
      <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-6 md:p-8 shadow-[var(--admin-shadow)] space-y-6 mt-6">

          {/* Target Keseluruhan */}
          {targets.allTime > 0 && (
            <div>
              <div className="flex justify-between items-center text-[var(--admin-accent)] mb-2">
                <span className="flex items-center gap-2 text-sm font-semibold"><FiTarget size={16} /> Target Keseluruhan Bisnis</span>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatIDR(targets.allTime)}</div>
                </div>
              </div>
              <div className="h-4 w-full bg-[var(--admin-hover-bg)] rounded-full overflow-hidden border border-[var(--admin-border-subtle)]">
                <div className="h-full bg-gradient-to-r from-[#6E3A42] to-[#C9868F] rounded-full transition-all duration-1000 relative" style={{ width: `${allTimeTercapaiWidth}%` }}>
                  <div className="absolute inset-0 bg-white/10 w-full h-full" />
                </div>
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-[var(--admin-text-muted)] font-medium">
                <span>Terkumpul: {formatIDR(stats.netProfit)}</span>
                <span className={allTimeTercapaiRaw >= 100 ? 'text-[#64D194]' : ''}>{allTimeTercapaiRaw.toFixed(1)}% Tercapai</span>
              </div>
            </div>
          )}

          {/* Target Bulanan */}
          {targets.monthly > 0 && (
            <div>
              <div className="flex justify-between items-center text-[var(--admin-accent)] mb-2">
                <span className="flex items-center gap-2 text-sm font-semibold"><FiCalendar size={16} /> Target Bulan Ini</span>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatIDR(targets.monthly)}</div>
                  <div className="text-[var(--admin-text-muted)] text-[10px] font-normal mt-0.5">Sisa {daysLeft} hari lagi</div>
                </div>
              </div>
              <div className="h-4 w-full bg-[var(--admin-hover-bg)] rounded-full overflow-hidden border border-[var(--admin-border-subtle)]">
                <div className="h-full bg-gradient-to-r from-[#8E7B7D] to-[#D28A94] rounded-full transition-all duration-1000 relative" style={{ width: `${monthlyTercapaiWidth}%` }}>
                  <div className="absolute inset-0 bg-white/10 w-full h-full" />
                </div>
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-[var(--admin-text-muted)] font-medium">
                <span>Terkumpul: {formatIDR(insightStats.thisMonthNetProfit)}</span>
                <span className={monthlyTercapaiRaw >= 100 ? 'text-[#64D194]' : ''}>{monthlyTercapaiRaw.toFixed(1)}% Tercapai</span>
              </div>
            </div>
          )}

          {/* Target Kustom */}
          {targets.custom && targets.custom.length > 0 && (
            <div className="pt-4 border-t border-[var(--admin-border-subtle)] space-y-4">
              <h4 className="text-sm font-semibold text-[var(--admin-text-main)] flex items-center gap-2"><FiStar className="text-[var(--admin-accent)]" /> Target Impian</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {targets.custom.map(target => {
                  const cTercapaiRaw = Math.max(0, (stats.netProfit / target.amount) * 100);
                  const cTercapaiWidth = Math.min(cTercapaiRaw, 100);
                  const isDone = cTercapaiRaw >= 100;
                  return (
                    <div key={target.id} className="bg-[var(--admin-input-bg)] p-4 rounded-xl border border-[var(--admin-border-subtle)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-sm font-medium ${isDone ? 'text-[#64D194]' : 'text-[var(--admin-text-main)]'}`}>{target.name}</span>
                        <span className="text-xs font-bold text-[var(--admin-text-muted)]">{formatIDR(target.amount)}</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--admin-hover-bg)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isDone ? 'bg-[#64D194]' : 'bg-[#D28A94]'}`} style={{ width: `${cTercapaiWidth}%` }} />
                      </div>
                      <div className="mt-2 flex justify-between items-center text-[11px] text-[var(--admin-text-muted)]">
                        <span>Terkumpul: <span className="font-medium text-[var(--admin-text-main)]">{formatIDR(stats.netProfit)}</span></span>
                        <span className={isDone ? 'text-[#64D194] font-medium' : ''}>{cTercapaiRaw.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!targets.allTime && !targets.monthly && (!targets.custom || targets.custom.length === 0) && (
            <div className="text-center py-6 border border-dashed border-[var(--admin-border-subtle)] rounded-xl text-[var(--admin-text-muted)] text-sm">
              Belum ada target yang diatur. Buka menu <b>Event & Keuangan</b> untuk mengatur target.
            </div>
          )}
        </div>

      {/* Mini Cards (Statistik Bisnis) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Event */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-5 shadow-[var(--admin-shadow)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center text-[var(--admin-accent)] flex-shrink-0">
            <FiStar size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[var(--admin-text-muted)] text-[11px] font-medium mb-1">Event Paling Untung</p>
            <p className="text-[var(--admin-text-main)] font-bold text-sm truncate" title={insightStats.topEventName}>{insightStats.topEventName}</p>
            <p className="text-[#64D194] text-xs font-semibold mt-0.5">{formatIDR(insightStats.topEventProfit)}</p>
          </div>
        </div>

        {/* Rata Rata Laba */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-5 shadow-[var(--admin-shadow)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center text-[var(--admin-accent)] flex-shrink-0">
            <FiDollarSign size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[var(--admin-text-muted)] text-[11px] font-medium mb-1">Rata-rata Laba / Event</p>
            <p className="text-[var(--admin-text-main)] font-bold text-[1.1rem] truncate">{formatIDR(insightStats.avgProfit)}</p>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-5 shadow-[var(--admin-shadow)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center text-[var(--admin-accent)] flex-shrink-0">
            <FiPercent size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[var(--admin-text-muted)] text-[11px] font-medium mb-1">Margin Keuntungan</p>
            <p className="text-[var(--admin-text-main)] font-bold text-[1.1rem] truncate">{insightStats.profitMargin.toFixed(1)}%</p>
          </div>
        </div>

        {/* Total Event */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-5 shadow-[var(--admin-shadow)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--admin-accent-bg)] flex items-center justify-center text-[var(--admin-accent)] flex-shrink-0">
            <FiList size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[var(--admin-text-muted)] text-[11px] font-medium mb-1">Total Event Aktif</p>
            <p className="text-[var(--admin-text-main)] font-bold text-[1.1rem] truncate">{insightStats.totalEvents} Event</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-6 shadow-[var(--admin-shadow)] flex flex-col">
          <h3 className="text-[var(--admin-accent)] font-semibold flex items-center gap-2 mb-6 text-[0.95rem]"><FiActivity /> Perkembangan Keuangan Event</h3>
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--admin-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--admin-text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000000}jt`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: '12px', color: 'var(--admin-accent)' }}
                  itemStyle={{ color: 'var(--admin-accent)', fontSize: '13px' }}
                  labelStyle={{ color: 'var(--admin-text-muted)', fontSize: '12px', marginBottom: '4px' }}
                  formatter={(value) => formatIDR(value)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#8E7B7D', paddingTop: '15px' }} />
                <Line type="monotone" dataKey="Pemasukan" stroke="#64D194" strokeWidth={2} dot={{ r: 4, fill: '#64D194', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Pengeluaran" stroke="#D28A94" strokeWidth={2} dot={{ r: 4, fill: '#D28A94', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart Section */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[1.5rem] p-6 shadow-[var(--admin-shadow)] flex flex-col">
          <h3 className="text-[var(--admin-accent)] font-semibold flex items-center gap-2 mb-2 text-[0.95rem]"><FiPieChart /> Kategori Pengeluaran Event</h3>
          <p className="text-[var(--admin-text-muted)] text-xs mb-4">Pengeluaran berdasarkan deskripsi.</p>
          <div className="flex-1 flex flex-col justify-center items-center relative min-h-[220px]">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  stroke="none"
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Belum Ada' ? '#29181A' : PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatIDR(value)}
                  contentStyle={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: '12px', fontSize: '13px' }}
                  itemStyle={{ color: 'var(--admin-accent)' }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 w-full justify-center text-[10px] text-[var(--admin-text-muted)]">
              {pieData.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.name === 'Belum Ada' ? '#29181A' : PIE_COLORS[idx % PIE_COLORS.length] }} />
                  {entry.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Schedules Lists Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Upcoming Events Dashboard */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] max-h-[340px] flex flex-col">
          <h3 className="text-[var(--admin-accent)] font-semibold mb-4 border-b border-[var(--admin-border)] pb-3 flex items-center gap-2">
            <FiCalendar /> Jadwal Mendatang
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {upcomingSchedules.length > 0 ? (
              upcomingSchedules.map(schedule => (
                <div key={schedule.id} className="bg-[var(--admin-input-bg)] border border-[var(--admin-border-subtle)] p-4 rounded-xl flex items-center gap-4">
                  <div className="bg-[#C9868F]/20 text-[var(--admin-accent)] w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold font-heading flex-shrink-0">
                    <span className="text-lg leading-none">{format(new Date(schedule.date), 'dd')}</span>
                    <span className="text-[10px] uppercase leading-none mt-0.5">{format(new Date(schedule.date), 'MMM')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--admin-text-main)] font-medium text-sm truncate">{schedule.event_name || 'Event Booked'}</p>
                    <p className="text-[var(--admin-text-muted)] text-xs mt-0.5">{format(new Date(schedule.date), 'EEEE, yyyy')}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">Belum ada jadwal terdekat.</div>
            )}
          </div>
        </div>

        {/* Past Events Dashboard */}
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6 rounded-[1.5rem] shadow-[var(--admin-shadow)] max-h-[340px] flex flex-col">
          <h3 className="text-[var(--admin-text-muted)] font-semibold mb-4 border-b border-[var(--admin-border)] pb-3 flex items-center gap-2">
            <FiCalendar /> Jadwal Terlewati
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {pastSchedules.length > 0 ? (
              pastSchedules.map(schedule => (
                <div key={schedule.id} className="bg-[var(--admin-bg)] border border-[var(--admin-border)] p-4 rounded-xl flex items-center gap-4 opacity-70">
                  <div className="bg-[var(--admin-hover-bg)] border border-[var(--admin-border-subtle)] text-[var(--admin-text-muted)] w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold font-heading flex-shrink-0">
                    <span className="text-lg leading-none">{format(new Date(schedule.date), 'dd')}</span>
                    <span className="text-[10px] uppercase leading-none mt-0.5">{format(new Date(schedule.date), 'MMM')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--admin-text-muted)] font-medium text-sm truncate line-through decoration-current/30">{schedule.event_name || 'Event Booked'}</p>
                    <p className="text-[var(--admin-text-subtle)] text-xs mt-0.5">{format(new Date(schedule.date), 'EEEE, yyyy')}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">Belum ada histori jadwal.</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
