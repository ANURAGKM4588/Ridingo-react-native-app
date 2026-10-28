import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  LayoutAnimation,
  UIManager,
  Modal,
} from 'react-native';
import NativeIcon from './NativeIcon';
import { LightTheme, DarkTheme, Shadows } from '../../styles/theme';
import { cleanLocationName, getLocationUpToFirstComma } from '../../utils/locationCleaner';
import { isUserTrip } from '../../services/userService';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATS = {
  hourly: { name: 'Hourly', icon: 'clock' },
  daily: { name: 'Full day', icon: 'sun' },
  airport: { name: 'Airport', icon: 'plane' },
  outstation: { name: 'Outstation', icon: 'route' },
  event: { name: 'Night & events', icon: 'moon' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'up', label: 'Upcoming' },
  { id: 'done', label: 'Completed' },
  { id: 'cancel', label: 'Cancelled' },
];

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
      year: y,
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
      year: y,
    };
  }

  return {
    title: `${monthName} ${y}`,
    subtitle: `${monthName} ${y}`,
    isCurrent: false,
    monthName,
    year: y,
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

export default function NativeTripsTab({
  trips = [],
  user = null,
  isDark = false,
  onOpenBooking,
  onOpenLiveTracking,
  onCancelTrip,
}) {
  const theme = isDark ? DarkTheme : LightTheme;
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  const [expandedTripId, setExpandedTripId] = useState(null);
  const [datePickerModalOpen, setDatePickerModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTripId(prev => (prev === id ? null : id));
  };

  const handleResetFilters = () => {
    setFilter('all');
    setSelectedDate('');
    setSelectedMonthFilter('all');
    setSearchQuery('');
  };

  // Base list of user trips (excluding inprogress) - strictly scoped to logged-in user
  const allUserTrips = (trips || []).filter(t => {
    if (user && isUserTrip && !isUserTrip(t, user)) return false;
    return t.status !== 'inprogress';
  });

  // Collect all months and available unique dates for date picker
  const allMonthsSet = new Set();
  const allDatesSet = new Set();
  const currentMonthKey = CURRENT_MONTH_KEY;
  allMonthsSet.add(currentMonthKey);

  allUserTrips.forEach(t => {
    const td = parseTripDate(t);
    allMonthsSet.add(getYearMonthKey(td));
    allDatesSet.add(getLocalDateString(td));
  });

  const sortedAllMonths = Array.from(allMonthsSet).sort().reverse();
  const previousMonths = sortedAllMonths.filter(m => m !== currentMonthKey);
  const availableDates = Array.from(allDatesSet).sort().reverse();

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

  // Search Query Filter (Pickup, Drop, Driver, Booking ID, Category)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(t => {
      const fromClean = cleanLocationName(typeof t.pickup === 'object' ? (t.pickup?.name || t.pickup?.address) : (t.pickup || t.pickup_loc || '')) || '';
      const toClean = cleanLocationName(typeof t.drop_loc === 'object' ? (t.drop_loc?.name || t.drop_loc?.address) : (typeof t.drop === 'object' ? (t.drop?.name || t.drop?.address) : (t.drop_loc || t.drop || ''))) || '';
      const rawFrom = getLocationUpToFirstComma(fromClean) || '';
      const rawTo = getLocationUpToFirstComma(toClean) || '';
      const driver = t.driver_name || t.assignedDriver?.name || '';
      const bId = String(t.id || '');
      const cat = t.cat || '';

      return (
        fromClean.toLowerCase().includes(q) ||
        toClean.toLowerCase().includes(q) ||
        rawFrom.toLowerCase().includes(q) ||
        rawTo.toLowerCase().includes(q) ||
        driver.toLowerCase().includes(q) ||
        bId.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }

  // Group list month by month
  const groupedByMonth = {};
  list.forEach(t => {
    const mKey = getYearMonthKey(parseTripDate(t));
    if (!groupedByMonth[mKey]) groupedByMonth[mKey] = [];
    groupedByMonth[mKey].push(t);
  });
  const sortedMonthKeys = Object.keys(groupedByMonth).sort().reverse();

  const hasDateFilter = Boolean(selectedDate) || selectedMonthFilter !== 'all';
  const hasActiveFilters = filter !== 'all' || hasDateFilter;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return { label: 'Driver Assigned', bg: 'rgba(34, 197, 94, 0.12)', color: '#16A34A' };
      case 'pickup_arrived':
        return { label: 'Driver Arrived', bg: 'rgba(34, 197, 94, 0.16)', color: '#15803D' };
      case 'ready_to_start':
        return { label: 'Ready to Start', bg: 'rgba(34, 197, 94, 0.16)', color: '#15803D' };
      case 'scheduled':
        return { label: 'Scheduled', bg: 'rgba(11, 11, 12, 0.08)', color: '#0B0B0C' };
      case 'completed':
        return { label: 'Completed', bg: 'rgba(34, 197, 94, 0.12)', color: '#16A34A' };
      case 'cancelled':
        return { label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.12)', color: '#DC2626' };
      default:
        return { label: 'Waiting for driver', bg: 'rgba(245, 158, 11, 0.12)', color: '#D97706' };
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.surface }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.ink }]}>History</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          All your driver bookings & trips
        </Text>
      </View>

      {/* 1. Status Chips in previous section (All, Upcoming, Completed, Cancelled) - Single line horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScrollContent}
        style={styles.chipsScrollView}
      >
        {FILTERS.map((f) => {
          const isActive = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              activeOpacity={0.7}
              onPress={() => setFilter(f.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.solid : theme.card,
                  borderColor: isActive ? theme.solid : theme.line,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? theme.onSolid : theme.ink },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2. Below Status Section: Modern Search Bar with Filter Button at the End */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <NativeIcon name="search" size={16} color={theme.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search rides, destinations, drivers..."
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.ink }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.searchClearBtn}
            >
              <NativeIcon name="x" size={14} color={theme.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button at the end of the search bar */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setFilterPanelOpen(prev => !prev);
          }}
          style={[
            styles.filterToggleBtn,
            {
              backgroundColor: (hasDateFilter || filterPanelOpen) ? theme.solid : theme.card,
              borderColor: (hasDateFilter || filterPanelOpen) ? theme.solid : theme.line,
            },
          ]}
        >
          <NativeIcon
            name="sliders"
            size={17}
            color={(hasDateFilter || filterPanelOpen) ? theme.onSolid : theme.ink}
          />
          {hasDateFilter && (
            <View
              style={[
                styles.filterActiveDot,
                { backgroundColor: filterPanelOpen ? theme.onSolid : '#0B0B0C' },
              ]}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* 3. Expandable Filter Panel (Date filter only, not status chips) */}
      {filterPanelOpen && (
        <View style={[styles.filterPanel, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <View style={styles.filterPanelHead}>
            <Text style={[styles.filterPanelTitle, { color: theme.ink }]}>Filter by Date</Text>
            {hasDateFilter && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedDate('');
                  setSelectedMonthFilter('all');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.resetFilterText, { color: theme.ink }]}>Reset Date</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date Selector Trigger in Single-line Straight Alignment */}
          <View style={styles.filterSingleRow}>
            <Text style={[styles.filterRowLabel, { color: theme.ink }]}>
              SELECT SPECIFIC DATE
            </Text>
            <View style={styles.filterRowActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDatePickerModalOpen(true)}
                style={[styles.dateFilterBtn, { backgroundColor: theme.field, borderColor: theme.line }]}
              >
                <NativeIcon name="calendar" size={15} color={theme.ink} />
                <Text style={[styles.dateFilterLabel, { color: theme.ink }]}>
                  {selectedDate || 'Choose Date'}
                </Text>
                <NativeIcon name="chevronDown" size={12} color={theme.muted} />
              </TouchableOpacity>

              {selectedDate ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedDate('')}
                  style={styles.clearDateBtn}
                >
                  <Text style={styles.clearDateText}>Clear ✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {/* Active Filter Indicators */}
      {(hasActiveFilters || searchQuery.trim()) ? (
        <View style={styles.activeFilterNotice}>
          <Text style={[styles.activeFilterText, { color: theme.muted }]}>
            {selectedDate && <>Date: <Text style={{ color: theme.ink, fontWeight: '700' }}>{selectedDate}</Text> · </>}
            {filter !== 'all' && <>Status: <Text style={{ color: theme.ink, fontWeight: '700' }}>{FILTERS.find(f => f.id === filter)?.label}</Text> · </>}
            {selectedMonthFilter !== 'all' && <>Month: <Text style={{ color: theme.ink, fontWeight: '700' }}>{getMonthHeader(selectedMonthFilter).subtitle}</Text> · </>}
            {searchQuery.trim() && <>Query: &ldquo;<Text style={{ color: theme.ink, fontWeight: '700' }}>{searchQuery}</Text>&rdquo; · </>}
            <Text style={{ color: theme.ink, fontWeight: '700' }}>{list.length} {list.length === 1 ? 'ride' : 'rides'} found</Text>
          </Text>
          <TouchableOpacity onPress={handleResetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearFilterLink, { color: theme.ink }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Trip List */}
      {list.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.field }]}>
            <NativeIcon name="route" size={28} color={theme.ink} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>
            {selectedDate || searchQuery || filter !== 'all' ? 'No matching rides found' : 'No rides yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
            {selectedDate || searchQuery || filter !== 'all'
              ? 'Try modifying your search or clearing your filters to see more bookings.'
              : 'Your upcoming and completed bookings will appear here once you hire a verified driver.'}
          </Text>
          {hasActiveFilters || searchQuery ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleResetFilters}
              style={[styles.bookButton, { backgroundColor: theme.solid }]}
            >
              <Text style={[styles.bookButtonText, { color: theme.onSolid }]}>Clear Filters & Search</Text>
            </TouchableOpacity>
          ) : (
            onOpenBooking && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onOpenBooking('hourly')}
                style={[styles.bookButton, { backgroundColor: theme.solid }]}
              >
                <NativeIcon name="navigation" size={15} color={theme.onSolid} />
                <Text style={[styles.bookButtonText, { color: theme.onSolid }]}>Book a Driver</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      ) : (
        <View style={styles.listContainer}>
          {/* Month by Month Sections */}
          {sortedMonthKeys.map((mKey) => {
            const monthInfo = getMonthHeader(mKey);
            const monthTrips = groupedByMonth[mKey] || [];

            return (
              <View key={mKey} style={styles.monthSection}>
                {/* Month Section Header with Black Text */}
                <View style={styles.monthSectionHeader}>
                  <View style={styles.monthTitleRow}>
                    <Text
                      style={[
                        styles.monthTitleText,
                        { color: theme.ink },
                      ]}
                    >
                      {monthInfo.title}
                    </Text>
                    <Text style={[styles.monthSubtitleText, { color: theme.muted }]}>
                      · {monthInfo.subtitle}
                    </Text>
                  </View>
                  <View style={[styles.monthCountBadge, { backgroundColor: theme.field, borderColor: theme.line }]}>
                    <Text style={[styles.monthCountText, { color: theme.ink }]}>
                      {monthTrips.length} {monthTrips.length === 1 ? 'ride' : 'rides'}
                    </Text>
                  </View>
                </View>

                {/* Cards for this Month */}
                <View style={styles.monthTripsList}>
                  {monthTrips.map((t) => {
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
                    const isExpanded = expandedTripId === t.id;

                    const fullPickup = (typeof t.pickup === 'object' ? (t.pickup?.address || t.pickup?.name) : t.pickup) || (typeof t.pickup_loc === 'object' ? (t.pickup_loc?.address || t.pickup_loc?.name) : t.pickup_loc) || 'Current Location';
                    const fullDrop = (typeof t.drop_loc === 'object' ? (t.drop_loc?.address || t.drop_loc?.name) : t.drop_loc) || (typeof t.drop === 'object' ? (t.drop?.address || t.drop?.name) : t.drop) || 'Destination';

                    const baseFareVal = t.baseFare || (t.fare - (t.extensionFare || 0) - (t.waitingFare || 0));
                    const extraKmVal = Number(t.extensionDistanceKm) || 0;
                    const extraFareVal = Number(t.extensionFare) || (extraKmVal > 0 ? Math.round(extraKmVal * 18) : 0);
                    const waitingMinsVal = Number(t.waitingMinutes) || 0;
                    const waitingFareVal = Number(t.waitingFare) || (waitingMinsVal > 0 ? waitingMinsVal * 2 : 0);

                    const badge = getStatusBadge(t.status);

                    return (
                      <View
                        key={t.id}
                        style={[
                          styles.tripCard,
                          {
                            backgroundColor: theme.card,
                            borderColor: isExpanded ? theme.ink : theme.line,
                          },
                        ]}
                      >
                        {/* 1. First-showing Notification / Header Tab: Tapping expands or minimizes */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => toggleExpand(t.id)}
                          style={styles.notificationTab}
                        >
                          <View
                            style={[
                              styles.iconBadge,
                              {
                                backgroundColor: isExpanded ? 'rgba(0, 0, 0, 0.08)' : theme.field,
                              },
                            ]}
                          >
                            <NativeIcon
                              name={c.icon || 'clock'}
                              size={20}
                              color={theme.ink}
                            />
                          </View>

                          {/* Route Notification Center: From Name → To Name */}
                          <View style={styles.headerInfo}>
                            <View style={styles.routeTitleRow}>
                              <Text
                                numberOfLines={1}
                                style={[styles.routeTitleText, { color: theme.ink }]}
                              >
                                {routeTitle}
                              </Text>
                              {isAssigned && t.start_otp && (
                                <View style={[styles.otpBadge, { backgroundColor: theme.solid }]}>
                                  <Text style={[styles.otpText, { color: theme.onSolid }]}>
                                    OTP: {t.start_otp}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text
                              numberOfLines={1}
                              style={[styles.routeSubText, { color: theme.muted }]}
                            >
                              {c.name} · {formatCardDateTime(tripDate, t.scheduleDisplay)}
                            </Text>
                          </View>

                          {/* Status Badge + Chevron Icon (NO FARE AMOUNT in first view) */}
                          <View style={styles.headerRight}>
                            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                                {badge.label}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.chevronCircle,
                                {
                                  backgroundColor: isExpanded ? 'rgba(0, 0, 0, 0.06)' : theme.field,
                                  transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                                },
                              ]}
                            >
                              <NativeIcon
                                name="chevronDown"
                                size={14}
                                color={isExpanded ? theme.ink : theme.muted}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>

                        {/* 2. Expanded Window: Detailed From & To Address, Total Fare & Breakdown */}
                        {isExpanded && (
                          <View style={[styles.expandedContent, { borderTopColor: theme.line }]}>
                            {/* Full Route Addresses Card */}
                            <View style={[styles.addressCard, { backgroundColor: theme.field, borderColor: theme.line }]}>
                              {/* From Address Fully */}
                              <View style={styles.addressRow}>
                                <View style={[styles.routeDot, { backgroundColor: '#10B981' }]} />
                                <View style={styles.addressTextContainer}>
                                  <Text style={[styles.addressLabel, { color: theme.muted }]}>
                                    FROM (FULL PICKUP ADDRESS)
                                  </Text>
                                  <Text style={[styles.addressValue, { color: theme.ink }]}>
                                    {fullPickup}
                                  </Text>
                                </View>
                              </View>

                              {/* Route track line */}
                              <View style={[styles.routeTrackLine, { backgroundColor: theme.line }]} />

                              {/* To Address Fully */}
                              <View style={styles.addressRow}>
                                <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
                                <View style={styles.addressTextContainer}>
                                  <Text style={[styles.addressLabel, { color: theme.muted }]}>
                                    TO (FULL DESTINATION ADDRESS)
                                  </Text>
                                  <Text style={[styles.addressValue, { color: theme.ink }]}>
                                    {fullDrop}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Total Fare & Itemized Details Card */}
                            <View style={[styles.fareCard, { backgroundColor: theme.field, borderColor: theme.line }]}>
                              <Text style={[styles.fareCardTitle, { color: theme.muted }]}>
                                FARE SUMMARY & CHARGES
                              </Text>

                              <View style={styles.fareRow}>
                                <Text style={[styles.fareRowLabel, { color: theme.muted }]}>Base Trip Fare</Text>
                                <Text style={[styles.fareRowValue, { color: theme.ink }]}>₹{baseFareVal}</Text>
                              </View>

                              {extraFareVal > 0 && (
                                <View style={styles.fareRow}>
                                  <Text style={[styles.fareRowLabel, { color: '#16A34A' }]}>
                                    Extra Distance ({extraKmVal} km @ ₹18/km)
                                  </Text>
                                  <Text style={[styles.fareRowValue, { color: '#16A34A' }]}>+₹{extraFareVal}</Text>
                                </View>
                              )}

                              {waitingFareVal > 0 && (
                                <View style={styles.fareRow}>
                                  <Text style={[styles.fareRowLabel, { color: '#EF4444' }]}>
                                    Waiting Duration ({waitingMinsVal}m @ ₹2/m)
                                  </Text>
                                  <Text style={[styles.fareRowValue, { color: '#EF4444' }]}>+₹{waitingFareVal}</Text>
                                </View>
                              )}

                              <View style={[styles.divider, { backgroundColor: theme.line }]} />

                              <View style={styles.totalFareRow}>
                                <View>
                                  <Text style={[styles.totalFareLabel, { color: theme.ink }]}>Total Fare</Text>
                                  <Text style={[styles.totalFareSub, { color: theme.muted }]}>
                                    All taxes & driver allowances included
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.totalFareAmount,
                                    { color: t.status === 'completed' ? '#16A34A' : theme.ink },
                                  ]}
                                >
                                  ₹{t.fare}
                                </Text>
                              </View>
                            </View>

                            {/* Driver & Trip Metadata */}
                            <View style={styles.metaRow}>
                              <Text style={[styles.metaText, { color: theme.muted }]}>
                                Booking ID: <Text style={{ color: theme.ink, fontWeight: '700' }}>#{t.id}</Text>
                              </Text>
                              <Text style={[styles.metaText, { color: theme.muted }]}>
                                Date: <Text style={{ color: theme.ink, fontWeight: '700' }}>{tripDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                              </Text>
                            </View>

                            {/* Active Trip Action Buttons */}
                            {['requested', 'accepted', 'pickup_arrived', 'ready_to_start', 'scheduled'].includes(t.status) && (
                              <View style={styles.actionButtonsRow}>
                                {onOpenLiveTracking && (
                                  <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => onOpenLiveTracking(t.id)}
                                    style={[styles.trackButton, { backgroundColor: theme.solid }]}
                                  >
                                    <NativeIcon name="navigation" size={13} color={theme.onSolid} />
                                    <Text style={[styles.trackButtonText, { color: theme.onSolid }]}>
                                      Track Live GPS
                                    </Text>
                                  </TouchableOpacity>
                                )}

                                {onCancelTrip && (
                                  <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => onCancelTrip(t)}
                                    style={styles.cancelButton}
                                  >
                                    <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Bottom Previous Months Navigation Bar */}
          {previousMonths.length > 0 && (
            <View style={[styles.prevMonthsBox, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <View style={styles.prevMonthsHead}>
                <Text style={[styles.prevMonthsTitle, { color: theme.ink }]}>
                  Previous Months History
                </Text>
                {selectedMonthFilter !== 'all' && (
                  <TouchableOpacity onPress={() => setSelectedMonthFilter('all')}>
                    <Text style={[styles.viewAllText, { color: theme.ink }]}>View All Months</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.prevMonthsButtonsRow}>
                {sortedAllMonths.map((mKey) => {
                  const info = getMonthHeader(mKey);
                  const isSelected = selectedMonthFilter === mKey || (selectedMonthFilter === 'all' && mKey === currentMonthKey);
                  return (
                    <TouchableOpacity
                      key={mKey}
                      activeOpacity={0.7}
                      onPress={() => setSelectedMonthFilter(prev => prev === mKey ? 'all' : mKey)}
                      style={[
                        styles.prevMonthBtn,
                        {
                          backgroundColor: isSelected ? theme.solid : theme.field,
                          borderColor: isSelected ? theme.solid : theme.line,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.prevMonthBtnText,
                          { color: isSelected ? theme.onSolid : theme.ink },
                        ]}
                      >
                        {info.monthName} {info.year} {mKey === currentMonthKey ? '(Current)' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Date Picker Modal for Mobile */}
      <Modal
        visible={datePickerModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDatePickerModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDatePickerModalOpen(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>Select Date</Text>
            <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
              Choose a specific date from your ride history
            </Text>

            <ScrollView style={{ maxHeight: 280 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedDate('');
                  setDatePickerModalOpen(false);
                }}
                style={[
                  styles.dateOptionItem,
                  { borderBottomColor: theme.line, backgroundColor: !selectedDate ? theme.field : 'transparent' },
                ]}
              >
                <Text style={[styles.dateOptionText, { color: theme.ink, fontWeight: !selectedDate ? '800' : '500' }]}>
                  All Dates (Show entire history)
                </Text>
                {!selectedDate && <NativeIcon name="check" size={16} color={theme.ink} />}
              </TouchableOpacity>

              {availableDates.map((dateStr) => {
                const isSelected = selectedDate === dateStr;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedDate(dateStr);
                      setDatePickerModalOpen(false);
                    }}
                    style={[
                      styles.dateOptionItem,
                      { borderBottomColor: theme.line, backgroundColor: isSelected ? theme.field : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.dateOptionText, { color: theme.ink, fontWeight: isSelected ? '800' : '500' }]}>
                      {dateStr}
                    </Text>
                    {isSelected && <NativeIcon name="check" size={16} color={theme.ink} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setDatePickerModalOpen(false)}
              style={[styles.closeModalBtn, { backgroundColor: theme.solid }]}
            >
              <Text style={[styles.closeModalBtnText, { color: theme.onSolid }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 90,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
    height: '100%',
  },
  searchClearBtn: {
    padding: 4,
  },
  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    ...Shadows.sm,
  },
  filterPanelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterPanelTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  resetFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  chipsScrollView: {
    marginBottom: 12,
  },
  chipsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterRowLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  filterRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateFilterLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  clearDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  clearDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  activeFilterNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
    gap: 8,
  },
  activeFilterText: {
    fontSize: 12,
    flex: 1,
  },
  clearFilterLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  emptyCard: {
    padding: 36,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 240,
    marginBottom: 18,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  bookButtonText: {
    fontSize: 13.5,
    fontWeight: '750',
  },
  listContainer: {
    gap: 16,
  },
  monthSection: {
    marginBottom: 8,
  },
  monthSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  monthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthTitleText: {
    fontSize: 14,
    fontWeight: '850',
    letterSpacing: -0.2,
  },
  monthSubtitleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  monthCountText: {
    fontSize: 11,
    fontWeight: '750',
  },
  monthTripsList: {
    gap: 12,
  },
  tripCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...Shadows.sm,
  },
  notificationTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  routeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeTitleText: {
    fontSize: 14.5,
    fontWeight: '750',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  otpBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  otpText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  routeSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '750',
  },
  chevronCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  addressCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 4,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  routeTrackLine: {
    width: 2,
    height: 14,
    marginLeft: 3.5,
    marginVertical: 4,
  },
  fareCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  fareCardTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fareRowLabel: {
    fontSize: 12.5,
  },
  fareRowValue: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  totalFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalFareLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  totalFareSub: {
    fontSize: 11,
    marginTop: 1,
  },
  totalFareAmount: {
    fontSize: 20,
    fontWeight: '850',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  metaText: {
    fontSize: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  trackButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cancelButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.22)',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  prevMonthsBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    gap: 10,
  },
  prevMonthsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prevMonthsTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  viewAllText: {
    fontSize: 11.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  prevMonthsButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prevMonthBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  prevMonthBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  dateOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: 8,
  },
  dateOptionText: {
    fontSize: 13.5,
  },
  closeModalBtn: {
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    fontSize: 13.5,
    fontWeight: '750',
  },
});
