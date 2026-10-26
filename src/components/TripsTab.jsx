import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icon from './Icon';
import { openPhonePeCheckout } from '../utils/phonepe';
import { cleanLocationName, getLocationUpToFirstComma } from '../utils/locationCleaner';
import { autoShareTripInvoice } from '../utils/tripInvoiceSharing';

const CATS = {
  hourly: { name: 'Hourly', icon: 'hourly', unit: 'hr', units: 'hours' },
  daily: { name: 'Full day', icon: 'sun', unit: 'day', units: 'days' },
  airport: { name: 'Airport', icon: 'plane' },
  outstation: { name: 'Outstation', icon: 'route', unit: 'day', units: 'days' },
  event: { name: 'Night & events', icon: 'moon', unit: 'hr', units: 'hours' }
};

const parseTripDate = (t) => {
  if (t.scheduledDate && typeof t.scheduledDate === 'string') {
    const parts = t.scheduledDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (t.when_ts) {
    const d = new Date(Number(t.when_ts));
    if (!isNaN(d.getTime())) return d;
  }
  if (t.created_at) {
    const d = new Date(t.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  if (t.scheduleDisplay && typeof t.scheduleDisplay === 'string') {
    const lower = t.scheduleDisplay.toLowerCase();
    const today = new Date();
    if (lower.includes('today')) return today;
    if (lower.includes('yesterday')) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return y;
    }
    if (lower.includes('tomorrow')) {
      const tm = new Date();
      tm.setDate(tm.getDate() + 1);
      return tm;
    }
  }
  return new Date();
};

const getLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatToDDMMYYYY = (isoStr) => {
  if (!isoStr || typeof isoStr !== 'string') return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return isoStr;
};

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
};

const getYearMonthKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getMonthHeader = (yearMonthKey) => {
  const [y, m] = yearMonthKey.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  const monthName = date.toLocaleString('default', { month: 'long' });
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (yearMonthKey === currentKey) {
    return {
      title: 'This Month',
      subtitle: `${monthName} ${y}`,
      isCurrent: true,
      monthName,
      year: y
    };
  }

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  if (yearMonthKey === prevKey) {
    return {
      title: 'Previous Month',
      subtitle: `${monthName} ${y}`,
      isCurrent: false,
      monthName,
      year: y
    };
  }

  return {
    title: `${monthName} ${y}`,
    subtitle: `${monthName} ${y}`,
    isCurrent: false,
    monthName,
    year: y
  };
};

const formatCardDateTime = (d, scheduleDisplay) => {
  const day = d.getDate();
  const month = d.toLocaleString('default', { month: 'short' });
  const year = d.getFullYear();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (scheduleDisplay && (scheduleDisplay.includes('Today') || scheduleDisplay.includes('Yesterday') || scheduleDisplay.includes('Tomorrow'))) {
    return `${scheduleDisplay} · ${day} ${month}`;
  }
  return `${day} ${month} ${year} · ${timeStr}`;
};

const CURRENT_MONTH_KEY = getYearMonthKey(new Date());

export default function TripsTab() {
  const {
    trips,
    tripsLoaded,
    setTrips,
    setUtx,
    user,
    isUserTrip,
    addToast,
    setBookingOpen,
    setBookingCategory,
    setLiveTrackingOpen,
    setActiveTrackingTripId,
    setTripToCancel,
    cancelTripByUser,
    isUpcomingFutureTrip,
    isTripTrackingUnlocked
  } = useApp();

  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState(null);
  const [calViewYear, setCalViewYear] = useState(() => (new Date()).getFullYear());
  const [calViewMonth, setCalViewMonth] = useState(() => (new Date()).getMonth());

  const handlePrevMonth = () => {
    if (calViewMonth === 0) {
      setCalViewMonth(11);
      setCalViewYear(prev => prev - 1);
    } else {
      setCalViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calViewMonth === 11) {
      setCalViewMonth(0);
      setCalViewYear(prev => prev + 1);
    } else {
      setCalViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day) => {
    const monthStr = String(calViewMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const iso = `${calViewYear}-${monthStr}-${dayStr}`;
    if (selectedDate === iso) {
      setSelectedDate('');
    } else {
      setSelectedDate(iso);
    }
  };

  const toggleExpand = (id) => {
    setExpandedTripId(prev => (prev === id ? null : id));
  };

  const handlePayRemaining = (trip) => {
    const extraKm = Number(trip.extensionDistanceKm || trip.additionalKm || 0);
    const extensionFare = Number(trip.extensionFare || (extraKm * 18) || 0);
    const waitingMins = Number(trip.waitingMinutes || 0);
    const waitingFare = Number(trip.waitingFare || (waitingMins * 2) || 0);
    const baseFare = Number(trip.baseFare || trip.originalBaseFare || trip.fare || 0);
    const totalCalculated = baseFare + extensionFare + waitingFare;
    const advancePaid = Number(trip.advance || trip.advancePaid || Math.round(baseFare * 0.3));
    const rem = Math.max(0, totalCalculated - advancePaid);
    if (rem <= 0) return;

    const breakdown = {
      tripId: trip.id,
      bookingId: trip.id,
      baseFare,
      extraKm,
      extensionFare,
      waitingMinutes: waitingMins,
      waitingFare,
      totalTripFare: totalCalculated,
      advancePaid,
      balancePayable: rem,
      riderName: user?.name || trip?.rider?.name || 'Customer',
      riderPhone: user?.phone || trip?.rider?.phone || '',
      riderEmail: user?.email || trip?.rider?.email || '',
      pickup: trip?.pickup?.name || trip?.pickup || 'Pickup',
      drop: trip?.drop?.name || trip?.drop || 'Destination',
      driverName: trip?.driver?.name || 'Assigned Driver'
    };

    openPhonePeCheckout({
      amount: rem,
      name: 'Ridingo Trip Final Settlement',
      description: `Remaining balance for #${trip.id}`,
      trip,
      breakdown,
      prefill: {
        name: user?.name || trip?.rider?.name,
        email: user?.email || trip?.rider?.email,
        phone: user?.phone || trip?.rider?.phone
      },
      notes: {
        tripId: trip.id
      },
      onSuccess: (paymentRes) => {
        const pId = paymentRes.phonepe_payment_id || paymentRes.phonepe_transaction_id || ('pay_ppe_' + Date.now().toString(36));
        setTrips(prev =>
          prev.map(t => (t.id === trip.id ? {
            ...t,
            balancePaid: true,
            balancePaymentId: pId,
            fare: totalCalculated,
            baseFare,
            extensionDistanceKm: extraKm,
            extensionFare,
            waitingMinutes: waitingMins,
            waitingFare
          } : t))
        );
        const newTx = {
          ts: Date.now(),
          type: 'trip',
          amount: -rem,
          title: `Trip Settlement · ${trip.id}`,
          sub: `PhonePe (${pId.slice(0, 14)}) · Just now`,
          gateway: 'PhonePe',
          paymentId: pId
        };
        setUtx(prev => [newTx, ...prev]);
        addToast(`Remaining ₹${rem} settled via PhonePe!`, 'check');

        // Auto-share invoice via WhatsApp with Email fallback
        try {
          autoShareTripInvoice({
            trip,
            invoiceData: {
              ...breakdown,
              amountPaid: rem
            },
            preferredMethod: 'whatsapp'
          });
        } catch (e) {
          console.warn('Invoice auto share error:', e);
        }
      },
      onError: () => {
        addToast('Settlement cancelled or failed', 'warn');
      }
    });
  };

  const F = { all: 'All', up: 'Upcoming', done: 'Completed', cancel: 'Cancelled' };

  // Base list of user trips (excluding inprogress)
  const allUserTrips = (trips || []).filter(t => isUserTrip(t, user) && t.status !== 'inprogress');
  const tripsDateSet = new Set(allUserTrips.map(t => getLocalDateString(parseTripDate(t))));

  const calDaysInMonth = getDaysInMonth(calViewYear, calViewMonth);
  const calFirstDayIndex = getFirstDayOfMonth(calViewYear, calViewMonth);
  const calMonthName = new Date(calViewYear, calViewMonth, 1).toLocaleString('default', { month: 'long' });
  const todayDateStr = getLocalDateString(new Date());

  // Collect all months in history for bottom month navigation
  const allMonthsSet = new Set();
  const currentMonthKey = CURRENT_MONTH_KEY;
  allMonthsSet.add(currentMonthKey);
  allUserTrips.forEach(t => {
    allMonthsSet.add(getYearMonthKey(parseTripDate(t)));
  });
  const sortedAllMonths = Array.from(allMonthsSet).sort().reverse();
  const previousMonths = sortedAllMonths.filter(m => m !== currentMonthKey);

  // Status Filter
  let list = allUserTrips;
  if (filter === 'up') {
    list = list.filter(t => ['requested', 'accepted', 'pickup_arrived', 'ready_to_start', 'scheduled'].includes(t.status));
  } else if (filter === 'done') {
    list = list.filter(t => t.status === 'completed');
  } else if (filter === 'cancel') {
    list = list.filter(t => t.status === 'cancelled');
  }

  // Specific Date Filter (if selected by user)
  if (selectedDate) {
    list = list.filter(t => {
      const tripDate = parseTripDate(t);
      return getLocalDateString(tripDate) === selectedDate;
    });
  }

  // Selected Month Filter (if selected from bottom navigator)
  if (selectedMonthFilter !== 'all') {
    list = list.filter(t => {
      const tripDate = parseTripDate(t);
      return getYearMonthKey(tripDate) === selectedMonthFilter;
    });
  }

  // Real-time Search query filter (location, driver, booking ID, category)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(t => {
      const from = (typeof t.pickup === 'object' ? (t.pickup?.address || t.pickup?.name || '') : (t.pickup || t.pickup_loc || '')).toLowerCase();
      const to = (typeof t.drop_loc === 'object' ? (t.drop_loc?.address || t.drop_loc?.name || '') : (typeof t.drop === 'object' ? (t.drop?.address || t.drop?.name || '') : (t.drop_loc || t.drop || ''))).toLowerCase();
      const driverName = (typeof t.driver === 'object' ? (t.driver?.name || '') : (t.driver || '')).toLowerCase();
      const id = String(t.id || '').toLowerCase();
      const cat = String(t.cat || '').toLowerCase();
      return from.includes(q) || to.includes(q) || driverName.includes(q) || id.includes(q) || cat.includes(q);
    });
  }

  const activeFilterCount = (selectedDate ? 1 : 0) + (selectedMonthFilter !== 'all' ? 1 : 0);

  // Group list month by month
  const groupedByMonth = {};
  list.forEach(t => {
    const mKey = getYearMonthKey(parseTripDate(t));
    if (!groupedByMonth[mKey]) groupedByMonth[mKey] = [];
    groupedByMonth[mKey].push(t);
  });
  const sortedMonthKeys = Object.keys(groupedByMonth).sort().reverse();

  const getStatusPill = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="pill good" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34, 197, 94, 0.12)', color: '#16A34A', fontWeight: 750 }}>
            Driver Assigned
          </span>
        );
      case 'pickup_arrived':
        return (
          <span className="pill good" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34, 197, 94, 0.16)', color: '#15803D', fontWeight: 800 }}>
            Driver Arrived
          </span>
        );
      case 'ready_to_start':
        return (
          <span className="pill good" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34, 197, 94, 0.16)', color: '#15803D', fontWeight: 800 }}>
            Ready to Start
          </span>
        );
      case 'inprogress':
        return (
          <span className="pill good" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span className="live-pulse-dot" style={{ width: '6px', height: '6px' }} /> On trip
          </span>
        );
      case 'completed':
        return <span className="pill done">Completed</span>;
      case 'scheduled':
        return <span className="pill good">Scheduled</span>;
      case 'cancelled':
        return <span className="pill bad">Cancelled</span>;
      default:
        return <span className="pill warn">Waiting for driver</span>;
    }
  };

  return (
    <div>
      <div className="hello stagger-1" style={{ marginBottom: '14px' }}>
        <h1 style={{ color: 'var(--ink, #0B0B0C)' }}>History</h1>
        <p style={{ color: 'var(--ink, #0B0B0C)', opacity: 0.7 }}>All your driver bookings</p>
      </div>

      {/* 1. Status Chips in previous section (All, Upcoming, Completed, Cancelled) - Horizontal single line scroll */}
      <div
        className="chips stagger-2"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          flexWrap: 'nowrap',
          paddingBottom: '4px',
          marginBottom: '12px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {Object.keys(F).map((k) => (
          <button
            key={k}
            type="button"
            className={`chip ${filter === k ? 'active' : ''}`}
            onClick={() => setFilter(k)}
            style={{
              flexShrink: 0,
              padding: '7px 16px',
              borderRadius: '20px',
              background: filter === k ? 'var(--solid, #0B0B0C)' : 'var(--card)',
              color: filter === k ? 'var(--on-solid, #FFFFFF)' : 'var(--ink, #0B0B0C)',
              border: filter === k ? '1px solid var(--solid, #0B0B0C)' : '1.5px solid var(--line)',
              fontSize: '12.5px',
              fontWeight: 750,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.18s ease'
            }}
          >
            {F[k]}
          </button>
        ))}
      </div>

      {/* 2. Below Status Section: Search Bar with Filter button at the end */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--card)',
            border: '1.5px solid var(--line)',
            borderRadius: '14px',
            padding: '0 12px',
            height: '46px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
        >
          <span style={{ color: 'var(--ink, #0B0B0C)', display: 'inline-flex', opacity: 0.7 }}>
            <Icon name="search" size={18} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history by location, driver, ID..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--ink, #0B0B0C)',
              fontSize: '13.5px',
              fontWeight: 500,
              outline: 'none',
              padding: '0',
              fontFamily: 'inherit'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--ink, #0B0B0C)',
                opacity: 0.5,
                cursor: 'pointer',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        {/* Filter button at the end of the search bar */}
        <button
          type="button"
          onClick={() => setShowFilterDrawer(prev => !prev)}
          style={{
            height: '46px',
            padding: '0 14px',
            borderRadius: '14px',
            background: showFilterDrawer || activeFilterCount > 0 ? 'var(--solid, #0B0B0C)' : 'var(--card)',
            color: showFilterDrawer || activeFilterCount > 0 ? 'var(--on-solid, #FFFFFF)' : 'var(--ink, #0B0B0C)',
            border: '1.5px solid var(--line)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 750,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            transition: 'all 0.2s ease'
          }}
        >
          <Icon name="sliders" size={16} />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: showFilterDrawer || activeFilterCount > 0 ? '#FFFFFF' : 'var(--solid, #0B0B0C)',
                color: showFilterDrawer || activeFilterCount > 0 ? '#0B0B0C' : '#FFFFFF',
                fontSize: '10.5px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Expandable Filter Drawer (Date filter only, not status chips) */}
      <AnimatePresence>
        {showFilterDrawer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', marginBottom: '14px' }}
          >
            <div
              style={{
                background: 'var(--card)',
                borderRadius: '16px',
                border: '1.5px solid var(--line-strong, #CBD5E1)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--ink, #0B0B0C)', display: 'inline-flex' }}>
                    <Icon name="calendar" size={17} />
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink, #0B0B0C)' }}>
                    Filter by Date
                  </span>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate('');
                      setSelectedMonthFilter('all');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--ink, #0B0B0C)',
                      fontSize: '11.5px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Date Display Bar: Prominent DD/MM/YYYY formatting */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--field, #F8FAFC)',
                  border: '1.5px solid var(--line, #E2E8F0)',
                  borderRadius: '12px',
                  padding: '9px 12px',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: selectedDate ? 'var(--solid, #0B0B0C)' : 'var(--card)',
                      color: selectedDate ? 'var(--on-solid, #FFFFFF)' : 'var(--ink, #0B0B0C)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: '1px solid var(--line)'
                    }}
                  >
                    <Icon name="calendar" size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted, #64748B)' }}>
                      Selected Date (DD/MM/YYYY)
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: selectedDate ? 800 : 500, color: selectedDate ? 'var(--ink, #0B0B0C)' : 'var(--muted, #64748B)', letterSpacing: '0.01em' }}>
                      {selectedDate ? formatToDDMMYYYY(selectedDate) : 'DD/MM/YYYY — Tap a date below'}
                    </span>
                  </div>
                </div>

                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate('')}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#EF4444',
                      fontSize: '11px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Clear</span>
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>

              {/* Quick Preset Buttons (Today, Yesterday, All) */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                <button
                  type="button"
                  onClick={() => {
                    const todayIso = getLocalDateString(new Date());
                    setSelectedDate(todayIso);
                    const now = new Date();
                    setCalViewYear(now.getFullYear());
                    setCalViewMonth(now.getMonth());
                  }}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '8px',
                    border: selectedDate === getLocalDateString(new Date()) ? '1.5px solid var(--solid, #0B0B0C)' : '1px solid var(--line)',
                    background: selectedDate === getLocalDateString(new Date()) ? 'var(--solid, #0B0B0C)' : 'var(--card)',
                    color: selectedDate === getLocalDateString(new Date()) ? 'var(--on-solid, #FFFFFF)' : 'var(--ink, #0B0B0C)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Today ({formatToDDMMYYYY(getLocalDateString(new Date()))})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    const yIso = getLocalDateString(y);
                    setSelectedDate(yIso);
                    setCalViewYear(y.getFullYear());
                    setCalViewMonth(y.getMonth());
                  }}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '8px',
                    border: selectedDate === getLocalDateString(new Date(Date.now() - 86400000)) ? '1.5px solid var(--solid, #0B0B0C)' : '1px solid var(--line)',
                    background: selectedDate === getLocalDateString(new Date(Date.now() - 86400000)) ? 'var(--solid, #0B0B0C)' : 'var(--card)',
                    color: selectedDate === getLocalDateString(new Date(Date.now() - 86400000)) ? 'var(--on-solid, #FFFFFF)' : 'var(--ink, #0B0B0C)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Yesterday
                </button>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate('')}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--card)',
                      color: 'var(--ink, #0B0B0C)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    All Dates
                  </button>
                )}
              </div>

              {/* Full Interactive Real Calendar Section */}
              <div
                style={{
                  background: 'var(--card)',
                  borderRadius: '14px',
                  border: '1px solid var(--line)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Calendar Month & Year Navigation Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label="Previous Month"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--field)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink, #0B0B0C)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Icon name="chevronLeft" size={16} />
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink, #0B0B0C)', letterSpacing: '-0.01em' }}>
                      {calMonthName} {calViewYear}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label="Next Month"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--field)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink, #0B0B0C)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Icon name="chevronRight" size={16} />
                  </button>
                </div>

                {/* Day-of-week header row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    textAlign: 'center',
                    gap: '2px'
                  }}
                >
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <span
                      key={d}
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 750,
                        color: 'var(--muted, #64748B)',
                        padding: '4px 0',
                        textTransform: 'uppercase'
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Days Grid with interactive selection & ride presence indicators */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '4px'
                  }}
                >
                  {Array.from({ length: calFirstDayIndex }).map((_, idx) => (
                    <div key={`empty-${idx}`} style={{ height: '34px' }} />
                  ))}

                  {Array.from({ length: calDaysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const mStr = String(calViewMonth + 1).padStart(2, '0');
                    const dStr = String(dayNum).padStart(2, '0');
                    const isoDate = `${calViewYear}-${mStr}-${dStr}`;
                    const isSelected = selectedDate === isoDate;
                    const isToday = isoDate === todayDateStr;
                    const hasTrip = tripsDateSet.has(isoDate);

                    return (
                      <button
                        key={isoDate}
                        type="button"
                        onClick={() => handleSelectDay(dayNum)}
                        title={formatToDDMMYYYY(isoDate)}
                        style={{
                          height: '34px',
                          borderRadius: '9px',
                          border: isSelected
                            ? '1.5px solid var(--solid, #0B0B0C)'
                            : isToday
                              ? '1.5px solid var(--line-strong, #94A3B8)'
                              : '1px solid transparent',
                          background: isSelected
                            ? 'var(--solid, #0B0B0C)'
                            : isToday
                              ? 'var(--field)'
                              : 'transparent',
                          color: isSelected
                            ? 'var(--on-solid, #FFFFFF)'
                            : 'var(--ink, #0B0B0C)',
                          fontSize: '12px',
                          fontWeight: isSelected ? 800 : isToday ? 750 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          padding: '0',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{dayNum}</span>
                        {hasTrip && (
                          <span
                            style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              background: isSelected ? '#FFFFFF' : '#10B981',
                              position: 'absolute',
                              bottom: '3px'
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter summary indicators */}
      {!showFilterDrawer && (activeFilterCount > 0 || searchQuery) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {searchQuery && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, background: 'var(--field)', color: 'var(--ink, #0B0B0C)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              Search: "{searchQuery}"
            </span>
          )}
          {filter !== 'all' && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, background: 'var(--field)', color: 'var(--ink, #0B0B0C)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              Status: {F[filter]}
            </span>
          )}
          {selectedDate && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, background: 'var(--field)', color: 'var(--ink, #0B0B0C)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              Date: {formatToDDMMYYYY(selectedDate)}
            </span>
          )}
          {selectedMonthFilter !== 'all' && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, background: 'var(--field)', color: 'var(--ink, #0B0B0C)', padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--line)' }}>
              Month: {getMonthHeader(selectedMonthFilter).subtitle}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilter('all');
              setSelectedDate('');
              setSelectedMonthFilter('all');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink, #0B0B0C)',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Trip List with Apple-style smooth crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${filter}_${selectedDate}_${selectedMonthFilter}_${searchQuery}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {!tripsLoaded && list.length === 0 ? (
            <div className="trip-list" style={{ marginTop: '8px' }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="card"
                  style={{
                    padding: '16px',
                    borderRadius: '20px',
                    background: 'var(--card)',
                    border: '1.5px solid var(--line)',
                    marginBottom: '10px',
                    opacity: 0.85
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'var(--field)',
                        animation: 'pulse 1.4s ease-in-out infinite'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          width: '55%',
                          height: '14px',
                          borderRadius: '6px',
                          background: 'var(--field)',
                          marginBottom: '8px',
                          animation: 'pulse 1.4s ease-in-out infinite'
                        }}
                      />
                      <div
                        style={{
                          width: '35%',
                          height: '11px',
                          borderRadius: '5px',
                          background: 'var(--field)',
                          animation: 'pulse 1.4s ease-in-out infinite'
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: '54px',
                        height: '24px',
                        borderRadius: '8px',
                        background: 'var(--field)',
                        animation: 'pulse 1.4s ease-in-out infinite'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', borderRadius: '22px', background: 'var(--card)', border: '1.5px solid var(--line)', marginTop: '8px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--field)', color: 'var(--ink, #0B0B0C)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Icon name="route" size={26} />
              </div>
              <b style={{ fontSize: '17px', color: 'var(--ink, #0B0B0C)', display: 'block', marginBottom: '6px' }}>
                {searchQuery ? 'No matching rides found' : (selectedDate ? 'No rides on this date' : 'No rides yet')}
              </b>
              <p style={{ fontSize: '13px', color: 'var(--ink, #0B0B0C)', opacity: 0.7, margin: '0 auto 20px', maxWidth: '250px', lineHeight: 1.45 }}>
                {searchQuery
                  ? `No bookings match "${searchQuery}". Try a different search keyword.`
                  : (selectedDate
                    ? `No bookings found for ${selectedDate}. Try selecting another date or clear the filter.`
                    : 'Your upcoming and completed bookings will appear here once you hire a verified driver.')}
              </p>
              {searchQuery || selectedDate || filter !== 'all' || selectedMonthFilter !== 'all' ? (
                <button
                  type="button"
                  className="btn primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 750, margin: '0 auto' }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDate('');
                    setFilter('all');
                    setSelectedMonthFilter('all');
                  }}
                >
                  <span>Reset All Filters</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', fontSize: '13.5px', fontWeight: 750, margin: '0 auto' }}
                  onClick={() => {
                    setBookingCategory('hourly');
                    setBookingOpen(true);
                  }}
                >
                  <Icon name="navigation" size={15} />
                  <span>Book a Driver</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Month by Month Sections */}
              {sortedMonthKeys.map((mKey) => {
                const monthInfo = getMonthHeader(mKey);
                const monthTrips = groupedByMonth[mKey] || [];

                return (
                  <div key={mKey} style={{ marginBottom: '24px' }}>
                    {/* Month Section Header: Black Text */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                        padding: '4px 2px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 850,
                            color: 'var(--ink, #0B0B0C)',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {monthInfo.title}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 650,
                            color: 'var(--ink, #0B0B0C)',
                            opacity: 0.7
                          }}
                        >
                          · {monthInfo.subtitle}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 750,
                          background: 'var(--field)',
                          color: 'var(--ink, #0B0B0C)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          border: '1px solid var(--line)'
                        }}
                      >
                        {monthTrips.length} {monthTrips.length === 1 ? 'ride' : 'rides'}
                      </span>
                    </div>

                    {/* Month Trip Cards */}
                    <div className="trip-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {monthTrips.map((t, idx) => {
                        const c = CATS[t.cat] || CATS.hourly;
                        const tripDate = parseTripDate(t);

                        const fromClean = cleanLocationName(typeof t.pickup === 'object' ? (t.pickup?.name || t.pickup?.address) : (t.pickup || t.pickup_loc || '')) || '';
                        const toClean = cleanLocationName(typeof t.drop_loc === 'object' ? (t.drop_loc?.name || t.drop_loc?.address) : (typeof t.drop === 'object' ? (t.drop?.name || t.drop?.address) : (t.drop_loc || t.drop || ''))) || '';

                        const rawFrom = getLocationUpToFirstComma(fromClean) || 'Pickup';
                        const rawTo = getLocationUpToFirstComma(toClean) || 'Destination';

                        const fromName = rawFrom.replace(/\.+$/, '').trim();
                        const toName = rawTo.replace(/\.+$/, '').trim();

                        const routeTitle = (fromName && toName && fromName.toLowerCase() !== toName.toLowerCase())
                          ? `${fromName} → ${toName}`
                          : (toName || fromName || `${c.name} Trip`);

                        const isAssigned = ['accepted', 'pickup_arrived', 'ready_to_start', 'inprogress'].includes(t.status);
                        const isFuture = isUpcomingFutureTrip ? isUpcomingFutureTrip(t) : false;
                        const trackingUnlocked = isTripTrackingUnlocked ? isTripTrackingUnlocked(t) : !isFuture;
                        const canTrack = trackingUnlocked && isAssigned;

                        const isExpanded = expandedTripId === t.id;
                        const fullPickup = (typeof t.pickup === 'object' ? (t.pickup?.address || t.pickup?.name) : t.pickup) || (typeof t.pickup_loc === 'object' ? (t.pickup_loc?.address || t.pickup_loc?.name) : t.pickup_loc) || 'Current Location';
                        const fullDrop = (typeof t.drop_loc === 'object' ? (t.drop_loc?.address || t.drop_loc?.name) : t.drop_loc) || (typeof t.drop === 'object' ? (t.drop?.address || t.drop?.name) : t.drop) || 'Destination';
                        const baseFareVal = t.baseFare || (t.fare - (t.extensionFare || 0) - (t.waitingFare || 0));
                        const extraKmVal = Number(t.extensionDistanceKm) || 0;
                        const extraFareVal = Number(t.extensionFare) || (extraKmVal > 0 ? Math.round(extraKmVal * 18) : 0);
                        const waitingMinsVal = Number(t.waitingMinutes) || 0;
                        const waitingFareVal = Number(t.waitingFare) || (waitingMinsVal > 0 ? waitingMinsVal * 2 : 0);
                        const totalCalculated = baseFareVal + extraFareVal + waitingFareVal;
                        const advancePaid = Number(t.advance || t.advancePaid || Math.round(baseFareVal * 0.3));
                        const rem = Math.max(0, totalCalculated - advancePaid);

                        return (
                          <div
                            key={t.id}
                            className={`trip-card-item stagger-${Math.min(6, 3 + idx)}`}
                            style={{
                              borderRadius: '18px',
                              background: 'var(--card)',
                              border: isExpanded ? '1.5px solid var(--ink, #0B0B0C)' : '1px solid var(--line)',
                              padding: '14px 16px',
                              boxShadow: isExpanded ? '0 8px 24px rgba(0, 0, 0, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                              overflow: 'hidden'
                            }}
                          >
                            {/* 1. First-showing Notification / Header Tab: Tapping expands or minimizes */}
                            <div
                              className="trip-card-notification-tab"
                              onClick={() => toggleExpand(t.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                userSelect: 'none'
                              }}
                              role="button"
                              aria-expanded={isExpanded}
                              title={isExpanded ? 'Click to minimize' : 'Click to view full details'}
                            >
                              <div
                                style={{
                                  width: '42px',
                                  height: '42px',
                                  borderRadius: '12px',
                                  background: 'var(--field)',
                                  color: 'var(--ink, #0B0B0C)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <Icon name={c.icon || 'hourly'} size={20} />
                              </div>

                              {/* Route Notification Center: From Name → To Name */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <b
                                    style={{
                                      fontSize: '14.5px',
                                      fontWeight: 750,
                                      color: 'var(--ink, #0B0B0C)',
                                      lineHeight: 1.3,
                                      letterSpacing: '-0.01em',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: '100%'
                                    }}
                                  >
                                    {routeTitle}
                                  </b>
                                  {isAssigned && !isFuture && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        background: 'var(--solid, #0B0B0C)',
                                        color: 'var(--on-solid, #FFFFFF)',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                        fontFamily: 'var(--font-mono, monospace)',
                                        letterSpacing: '0.04em'
                                      }}
                                    >
                                      OTP: {t.startOtp || '4821'}
                                    </span>
                                  )}
                                </div>
                                <span
                                  style={{
                                    fontSize: '12px',
                                    color: 'var(--ink, #0B0B0C)',
                                    opacity: 0.65,
                                    marginTop: '2px',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {c.name} · {formatCardDateTime(tripDate, t.scheduleDisplay)}
                                </span>
                              </div>

                              {/* Right side: Status Badge + Animated Chevron Arrow (NO fare amount in first view) */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {isFuture && ['requested', 'accepted', 'scheduled'].includes(t.status) ? (
                                  <span className="pill good" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    Scheduled
                                  </span>
                                ) : (
                                  getStatusPill(t.status)
                                )}
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'var(--field)',
                                    color: 'var(--ink, #0B0B0C)',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                    flexShrink: 0
                                  }}
                                >
                                  <Icon name="chevronDown" size={14} />
                                </span>
                              </div>
                            </div>

                            {/* 2. Expanded Window: Detailed From & To Address, Total Fare & Breakdown */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <div
                                    style={{
                                      marginTop: '14px',
                                      paddingTop: '14px',
                                      borderTop: '1px solid var(--line)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '12px'
                                    }}
                                  >
                                    {/* Full Route Addresses Card */}
                                    <div style={{ background: 'var(--field)', borderRadius: '14px', padding: '12px 14px', border: '1px solid var(--line)' }}>
                                      {/* From Address Fully */}
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10B981', marginTop: '4px', flexShrink: 0, boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)' }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ink, #0B0B0C)', opacity: 0.6, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                            From (Full Pickup Address)
                                          </span>
                                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink, #0B0B0C)', lineHeight: 1.4, wordBreak: 'break-word', display: 'block' }}>
                                            {fullPickup}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Dotted Route Connector */}
                                      <div style={{ width: '2px', height: '16px', background: 'var(--line-strong)', marginLeft: '3.5px', margin: '4px 0 4px 3.5px' }} />

                                      {/* To Address Fully */}
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#EF4444', marginTop: '4px', flexShrink: 0, boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.2)' }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ink, #0B0B0C)', opacity: 0.6, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                            To (Full Destination Address)
                                          </span>
                                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink, #0B0B0C)', lineHeight: 1.4, wordBreak: 'break-word', display: 'block' }}>
                                            {fullDrop}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Total Fare & Itemized Details Card */}
                                    <div style={{ background: 'var(--field)', borderRadius: '14px', padding: '14px', border: '1px solid var(--line)' }}>
                                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--ink, #0B0B0C)', opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '10px' }}>
                                        Fare Summary & Charges
                                      </span>

                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12.5px', color: 'var(--ink, #0B0B0C)', opacity: 0.75 }}>
                                        <span>Base Trip Fare</span>
                                        <b style={{ color: 'var(--ink, #0B0B0C)' }}>₹{baseFareVal}</b>
                                      </div>

                                      {extraFareVal > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12.5px', color: '#16A34A' }}>
                                          <span>Extra Distance ({extraKmVal} km @ ₹18/km)</span>
                                          <b>+₹{extraFareVal}</b>
                                        </div>
                                      )}

                                      {waitingFareVal > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12.5px', color: '#EF4444' }}>
                                          <span>Waiting Duration ({waitingMinsVal}m @ ₹2/m)</span>
                                          <b>+₹{waitingFareVal}</b>
                                        </div>
                                      )}

                                      <div style={{ height: '1px', background: 'var(--line)', margin: '10px 0' }} />

                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink, #0B0B0C)', display: 'block' }}>
                                            Total Fare
                                          </span>
                                          <span style={{ fontSize: '11px', color: 'var(--ink, #0B0B0C)', opacity: 0.65 }}>
                                            All taxes & driver allowances included
                                          </span>
                                        </div>
                                        <b style={{ fontSize: '20px', fontWeight: 850, color: t.status === 'completed' ? '#16A34A' : 'var(--ink, #0B0B0C)' }}>
                                          ₹{t.fare}
                                        </b>
                                      </div>

                                      {t.status === 'completed' && !t.balancePaid && rem > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePayRemaining(t);
                                          }}
                                          style={{
                                            marginTop: '10px',
                                            width: '100%',
                                            padding: '9px 14px',
                                            borderRadius: '10px',
                                            background: '#16A34A',
                                            color: '#FFFFFF',
                                            fontWeight: 750,
                                            fontSize: '12.5px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          <span>Settle Balance ₹{rem} via PhonePe</span>
                                        </button>
                                      )}
                                    </div>

                                    {/* Driver & Trip Metadata */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', fontSize: '12px', color: 'var(--ink, #0B0B0C)', opacity: 0.75, flexWrap: 'wrap', gap: '6px' }}>
                                      <span>Booking ID: <b style={{ color: 'var(--ink, #0B0B0C)' }}>#{t.id}</b></span>
                                      <span>Date: <b style={{ color: 'var(--ink, #0B0B0C)' }}>{tripDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b></span>
                                      {t.driver && (
                                        <span>Driver: <b style={{ color: 'var(--ink, #0B0B0C)' }}>{typeof t.driver === 'object' ? t.driver?.name : t.driver}</b></span>
                                      )}
                                    </div>

                                    {/* Active Trip Action Buttons */}
                                    {['requested', 'accepted', 'pickup_arrived', 'ready_to_start', 'scheduled'].includes(t.status) && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                                        {canTrack && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (setActiveTrackingTripId) setActiveTrackingTripId(t.id);
                                              if (setLiveTrackingOpen) setLiveTrackingOpen(true);
                                            }}
                                            style={{
                                              height: '34px',
                                              padding: '0 14px',
                                              fontSize: '12px',
                                              fontWeight: 700,
                                              borderRadius: '8px',
                                              background: 'var(--solid, #0F172A)',
                                              color: 'var(--on-solid, #FFFFFF)',
                                              border: 'none',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}
                                          >
                                            <Icon name="navigation" size={13} style={{ color: 'var(--on-solid, #FFFFFF)' }} />
                                            <span>Track Live GPS</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const isDriverAssigned = Boolean(
                                              t.driver ||
                                              t.driverId ||
                                              t.driver_id ||
                                              ['accepted', 'pickup_arrived', 'ready_to_start', 'scheduled', 'on_the_way', 'arrived', 'started', 'in_progress'].includes(t.status)
                                            );
                                            if (isDriverAssigned) {
                                              if (setTripToCancel) setTripToCancel(t);
                                            } else {
                                              if (cancelTripByUser) cancelTripByUser(t.id, { feeOverride: 0 });
                                              if (setActiveTrackingTripId) setActiveTrackingTripId(null);
                                              setLiveTrackingOpen(false);
                                              addToast('Trip request cancelled freely. No cancellation fee.', 'check');
                                            }
                                          }}
                                          style={{
                                            height: '34px',
                                            padding: '0 12px',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: '#EF4444',
                                            background: 'rgba(239, 68, 68, 0.08)',
                                            border: '1px solid rgba(239, 68, 68, 0.22)',
                                            borderRadius: '8px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Cancel Ride
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Bottom Previous Months Navigation Bar: Black styling */}
              {previousMonths.length > 0 && (
                <div
                  style={{
                    marginTop: '24px',
                    marginBottom: '16px',
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink, #0B0B0C)' }}>
                      Previous Months History
                    </span>
                    {selectedMonthFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setSelectedMonthFilter('all')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ink, #0B0B0C)',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        View All Months
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {sortedAllMonths.map((mKey) => {
                      const info = getMonthHeader(mKey);
                      const isSelected = selectedMonthFilter === mKey || (selectedMonthFilter === 'all' && mKey === currentMonthKey);
                      return (
                        <button
                          key={mKey}
                          type="button"
                          onClick={() => setSelectedMonthFilter(prev => prev === mKey ? 'all' : mKey)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '10px',
                            background: isSelected ? 'var(--solid, #0B0B0C)' : 'var(--field)',
                            color: isSelected ? 'var(--on-solid, #FFFFFF)' : 'var(--ink, #0B0B0C)',
                            border: isSelected ? '1px solid var(--solid, #0B0B0C)' : '1px solid var(--line)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {info.monthName} {info.year} {mKey === currentMonthKey ? '(Current)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
