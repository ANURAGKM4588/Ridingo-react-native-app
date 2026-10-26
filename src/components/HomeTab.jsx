import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icon from './Icon';
import MapPickerModal from './MapPickerModal';
import GraphicLiveMap from './GraphicLiveMap';
import { getDeviceLocation, getCachedDeviceLocation } from '../lib/deviceLocation';
import { getRecommendations, APP_SETTINGS } from '../lib/searchEngine';
import realtime from '../utils/realtime';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { generateTripTicketImage } from '../utils/tripTicketGenerator';
import TripTicketModal from './TripTicketModal';
import { shareTicketImageWithCaption } from '../services/installedUpiService';
import { cleanLocationName, getLocationUpToFirstComma } from '../utils/locationCleaner';
import { fetchGoogleRoadDirections, searchGooglePlaces, fetchPlaceDetails, geocodeAddress, fetchNearestLandmarkByCoordinates } from '../services/googleMapsService';
import { getActiveOfferBanners, subscribeToOfferBanners } from '../services/bannerService';
import { POPULAR_DESTINATIONS } from '../data/popularDestinations';
import PopularDestinationsModal from './PopularDestinationsModal';

// Date, time & search helper functions for Home route card
const getTodayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultTime = () => {
  const d = new Date();
  const m = d.getMinutes();
  const rem = m % 15;
  d.setMinutes(m + (rem === 0 ? 15 : (15 - rem)));
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
};

const formatTime12h = (time24) => {
  if (!time24) return '6:00 PM';
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
};

const formatDateDisplay = (dateISO) => {
  if (!dateISO) return '';
  const today = getTodayISO();
  const tomorrow = getTomorrowISO();
  const parts = dateISO.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const d = parts[2];

  if (dateISO === today) {
    return `Today, ${monthName} ${d}`;
  } else if (dateISO === tomorrow) {
    return `Tomorrow, ${monthName} ${d}`;
  } else {
    const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday}, ${monthName} ${d}`;
  }
};

const formatShortMonthDay = (dateISO) => {
  if (!dateISO) return '';
  const parts = dateISO.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const d = parts[2];
  return `${monthName} ${d}`;
};

const highlightMatchGoogleStock = (text, query) => {
  if (!text) return '';
  if (!query) return <span style={{ fontWeight: 400, color: 'inherit' }}>{text}</span>;
  const q = query.trim().toLowerCase();
  if (!q) return <span style={{ fontWeight: 400, color: 'inherit' }}>{text}</span>;

  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) {
    return <span style={{ fontWeight: 400, color: 'inherit' }}>{text}</span>;
  }

  return (
    <>
      {idx > 0 && <span style={{ fontWeight: 400, color: 'inherit' }}>{text.substring(0, idx)}</span>}
      <span style={{ fontWeight: 700, color: 'var(--ink, #202124)' }}>{text.substring(idx, idx + q.length)}</span>
      <span style={{ fontWeight: 400, color: 'inherit' }}>{text.substring(idx + q.length)}</span>
    </>
  );
};

const CATS = {
  hourly: { name: 'Hourly', blurb: '2 to 12 hours', icon: 'hourly', from: '₹250 per hour' },
  daily: { name: 'Full day', blurb: '10 hours a day', icon: 'sun', from: '₹1,800 per day' },
  airport: { name: 'Airport', blurb: 'Pickup or drop', icon: 'plane', from: '₹900 flat' },
  outstation: { name: 'Outstation', blurb: 'Multi-day trips', icon: 'route', from: '₹2,200 per day' },
  event: { name: 'Night & events', blurb: 'Minimum 4 hours', icon: 'moon', from: '₹350 per hour' }
};

const REVIEWS = [
  {
    name: 'Arjun Mehta',
    init: 'AM',
    car: 'BMW 330i Gran Limousine',
    tag: 'Hourly Driver',
    quote: 'Handed over my keys for a late city dinner. Rajesh drove so smoothly, parked with extreme care, and was waiting right outside when we walked out.'
  },
  {
    name: 'Priya Nair',
    init: 'PN',
    car: 'Hyundai Creta SX(O)',
    tag: 'Airport Transfer',
    quote: 'Needed a 4:30 AM terminal drop. Vikram arrived 10 mins early in uniform, handled our luggage, and drove my family with calm precision.'
  },
  {
    name: 'Karan Singhania',
    init: 'KS',
    car: 'Toyota Fortuner 4x4',
    tag: 'Outstation Trip',
    quote: 'Hired Suresh for a 2-day family trip through the hills. Handled the hairpin bends effortlessly and treated my car like his own. Worth every rupee.'
  },
  {
    name: 'Dr. Sneha Roy',
    init: 'SR',
    car: 'Honda City ZX',
    tag: 'Full Day Hire',
    quote: 'Booked for back-to-back clinic visits and hospital rounds. Professional, zero mobile distractions while driving, and saved me hours of driving fatigue.'
  }
];

export default function HomeTab() {
  const {
    user,
    trips,
    setTrips,
    syncTripsFromSupabase,
    setBookingOpen,
    setBookingCategory,
    bookingDestination,
    setBookingDestination,
    bookingPickup,
    setBookingPickup,
    bookingPickupCoords,
    setBookingPickupCoords,
    bookingDropCoords,
    setBookingDropCoords,
    setBookingDate,
    setBookingTime,
    notifsOpen,
    setNotifsOpen,
    liveTrackingOpen,
    setLiveTrackingOpen,
    activeTrackingTripId,
    setActiveTrackingTripId,
    unotes,
    uTab,
    setUTab,
    addToast,
    isUserTrip,
    onboardingOpen,
    declineTrip,
    cancelTripByUser,
    setTripToCancel,
    isUpcomingFutureTrip,
    isTripTrackingUnlocked,
    savedHomeLoc,
    setSavedHomeLoc,
    savedWorkLoc,
    setSavedWorkLoc,
    savedPlacesLoc,
    setSavedPlacesLoc,
    updateSavedLocation,
    userThemeVal
  } = useApp();

  const isDark = userThemeVal === 'dark';

  const unreadCount = (unotes || []).filter(n => !n.read).length;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [destinationsModalOpen, setDestinationsModalOpen] = useState(false);

  // Home route box & schedule state (mirrors Booking page)
  const homePickupFullRef = useRef(bookingPickup || '');
  const homeDropFullRef = useRef(bookingDestination || '');
  const [homePickup, setHomePickup] = useState(() => (bookingPickup ? getLocationUpToFirstComma(bookingPickup) : ''));
  const [homeDrop, setHomeDrop] = useState(() => (bookingDestination ? getLocationUpToFirstComma(bookingDestination) : ''));
  const [homePickupCoords, setHomePickupCoords] = useState(() => bookingPickupCoords || null);
  const [homeDropCoords, setHomeDropCoords] = useState(() => bookingDropCoords || null);
  const [homePickupSuggestions, setHomePickupSuggestions] = useState([]);
  const [homeDropSuggestions, setHomeDropSuggestions] = useState([]);
  const [homeActiveSuggestField, setHomeActiveSuggestField] = useState(null); // 'pickup' | 'drop' | null
  const [homeShakingField, setHomeShakingField] = useState(null); // 'pickup' | 'drop' | null
  const [homeIsDetectingCurrent, setHomeIsDetectingCurrent] = useState(false);
  const [homeIsSearchingPlaces, setHomeIsSearchingPlaces] = useState(false);
  const [homeSelectedDate, setHomeSelectedDate] = useState(getTodayISO);
  const [homeTimeMode, setHomeTimeMode] = useState('now'); // 'now' | 'plus1' | 'custom'
  const [homeSelectedTime, setHomeSelectedTime] = useState(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });
  const [homeMapTarget, setHomeMapTarget] = useState('drop');

  // Manual location selection only: no auto-selected default location on startup

  // Saved locations modal state
  const [addLocationModalType, setAddLocationModalType] = useState(null); // 'home' | 'work' | 'saved' | null
  const [addLocationInput, setAddLocationInput] = useState('');
  const [addLocationSuggestions, setAddLocationSuggestions] = useState([]);

  const getCurrentTimeHHMM = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const getPlusOneHourHHMM = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleAddLocationInputChange = async (val) => {
    setAddLocationInput(val);
    if (!val || val.trim().length < 2) {
      setAddLocationSuggestions([]);
      return;
    }
    try {
      const results = await searchGooglePlaces(val);
      setAddLocationSuggestions(results || []);
    } catch (_) {
      setAddLocationSuggestions([]);
    }
  };

  const handleSaveLocation = () => {
    const val = addLocationInput.trim();
    if (!val) {
      if (addToast) addToast('Please enter or select an address', 'info');
      return;
    }
    if (updateSavedLocation) {
      updateSavedLocation(addLocationModalType, val);
    }
    homeDropFullRef.current = val;
    setHomeDrop(getLocationUpToFirstComma(val));
    if (setBookingDestination) setBookingDestination(val);
    if (addToast) {
      const typeLabel = addLocationModalType === 'home' ? 'Home' : addLocationModalType === 'work' ? 'Work' : 'Saved place';
      addToast(`${typeLabel} address saved: ${getLocationUpToFirstComma(val)}`, 'check');
    }
    setAddLocationModalType(null);
    setAddLocationInput('');
    setAddLocationSuggestions([]);
  };

  const handleCancelAddLocation = () => {
    setAddLocationModalType(null);
    setAddLocationInput('');
    setAddLocationSuggestions([]);
  };

  const homePickupInputRef = useRef(null);
  const homeDropInputRef = useRef(null);
  const pickupSearchDebounceRef = useRef(null);
  const dropSearchDebounceRef = useRef(null);
  const pickupSeqRef = useRef(0);
  const dropSeqRef = useRef(0);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.home-booking-hero-card') && !e.target.closest('.location-suggest-dropdown')) {
        setHomeActiveSuggestField(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      if (pickupSearchDebounceRef.current) clearTimeout(pickupSearchDebounceRef.current);
      if (dropSearchDebounceRef.current) clearTimeout(dropSearchDebounceRef.current);
    };
  }, []);

  const handleHomePickupChange = (val) => {
    setHomePickup(val);
    homePickupFullRef.current = val;
    setHomeActiveSuggestField('pickup');

    if (pickupSearchDebounceRef.current) clearTimeout(pickupSearchDebounceRef.current);

    const clean = (val || '').trim();
    if (!clean) {
      setHomePickupSuggestions([]);
      setHomeIsSearchingPlaces(false);
      return;
    }

    setHomeIsSearchingPlaces(true);
    const seq = ++pickupSeqRef.current;

    pickupSearchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchGooglePlaces(clean, { userCoords: homeDropCoords || homePickupCoords });
        if (seq === pickupSeqRef.current) {
          setHomePickupSuggestions(results || []);
          setHomeIsSearchingPlaces(false);
        }
      } catch (_) {
        if (seq === pickupSeqRef.current) {
          setHomePickupSuggestions([]);
          setHomeIsSearchingPlaces(false);
        }
      }
    }, 120);
  };

  const handleHomeDropChange = (val) => {
    setHomeDrop(val);
    homeDropFullRef.current = val;
    setHomeActiveSuggestField('drop');

    if (dropSearchDebounceRef.current) clearTimeout(dropSearchDebounceRef.current);

    const clean = (val || '').trim();
    if (!clean) {
      setHomeDropSuggestions([]);
      setHomeIsSearchingPlaces(false);
      return;
    }

    setHomeIsSearchingPlaces(true);
    const seq = ++dropSeqRef.current;

    dropSearchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchGooglePlaces(clean, { userCoords: homePickupCoords || homeDropCoords });
        if (seq === dropSeqRef.current) {
          setHomeDropSuggestions(results || []);
          setHomeIsSearchingPlaces(false);
        }
      } catch (_) {
        if (seq === dropSeqRef.current) {
          setHomeDropSuggestions([]);
          setHomeIsSearchingPlaces(false);
        }
      }
    }, 120);
  };

  const handleSelectHomePickupPlace = async (item) => {
    if (!item) return;
    const fullText = item.full || (item.title + (item.sub ? ', ' + item.sub : ''));
    homePickupFullRef.current = fullText;
    const shortText = getLocationUpToFirstComma(fullText) || item.title;
    setHomePickup(shortText);
    setHomeActiveSuggestField(null);
    setHomePickupSuggestions([]);
    if (setBookingPickup) setBookingPickup(fullText);

    if (item.lat && item.lng) {
      const coords = { lat: Number(item.lat), lng: Number(item.lng), formatted: fullText };
      setHomePickupCoords(coords);
      if (setBookingPickupCoords) setBookingPickupCoords(coords);
      return;
    }

    try {
      if (item.place_id) {
        const details = await fetchPlaceDetails(item.place_id);
        if (details && details.lat && details.lng) {
          const coords = { lat: Number(details.lat), lng: Number(details.lng), formatted: fullText, details };
          setHomePickupCoords(coords);
          if (setBookingPickupCoords) setBookingPickupCoords(coords);
          return;
        }
      }
      const geo = await geocodeAddress(fullText);
      if (geo && geo.lat && geo.lng) {
        const coords = { lat: Number(geo.lat), lng: Number(geo.lng), formatted: fullText };
        setHomePickupCoords(coords);
        if (setBookingPickupCoords) setBookingPickupCoords(coords);
      }
    } catch (_) {}
  };

  const handleSelectHomeDropPlace = async (item) => {
    if (!item) return;
    const fullText = item.full || (item.title + (item.sub ? ', ' + item.sub : ''));
    homeDropFullRef.current = fullText;
    const shortText = getLocationUpToFirstComma(fullText) || item.title;
    setHomeDrop(shortText);
    setHomeActiveSuggestField(null);
    setHomeDropSuggestions([]);
    if (setBookingDestination) setBookingDestination(fullText);

    if (item.lat && item.lng) {
      const coords = { lat: Number(item.lat), lng: Number(item.lng), formatted: fullText };
      setHomeDropCoords(coords);
      if (setBookingDropCoords) setBookingDropCoords(coords);
      return;
    }

    try {
      if (item.place_id) {
        const details = await fetchPlaceDetails(item.place_id);
        if (details && details.lat && details.lng) {
          const coords = { lat: Number(details.lat), lng: Number(details.lng), formatted: fullText, details };
          setHomeDropCoords(coords);
          if (setBookingDropCoords) setBookingDropCoords(coords);
          return;
        }
      }
      const geo = await geocodeAddress(fullText);
      if (geo && geo.lat && geo.lng) {
        const coords = { lat: Number(geo.lat), lng: Number(geo.lng), formatted: fullText };
        setHomeDropCoords(coords);
        if (setBookingDropCoords) setBookingDropCoords(coords);
      }
    } catch (_) {}
  };

  const handleHomeUseCurrentLocation = async (target = 'pickup') => {
    setHomeIsDetectingCurrent(true);
    setHomeActiveSuggestField(null);
    try {
      const pos = await getDeviceLocation(true); // force fresh GPS query
      if (pos) {
        const lat = pos.coords?.latitude ?? pos.lat;
        const lng = pos.coords?.longitude ?? pos.lng;
        if (lat && lng) {
          const coords = { lat: Number(lat), lng: Number(lng) };

          let resolved = pos.address && !pos.address.startsWith('Location (') ? pos.address : null;
          if (!resolved) {
            try {
              const landmark = await fetchNearestLandmarkByCoordinates(coords);
              if (landmark) {
                resolved = landmark.displayName || landmark.name || landmark.formattedAddress;
              }
            } catch (_) {}
          }
          if (!resolved) {
            try {
              const geocodeRes = await geocodeAddress(`${coords.lat},${coords.lng}`);
              if (geocodeRes?.formatted) {
                resolved = geocodeRes.formatted;
              }
            } catch (_) {}
          }

          const fullAddress = resolved ? cleanLocationName(resolved) : `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
          const shortAddress = getLocationUpToFirstComma(fullAddress);
          coords.formatted = fullAddress;

          if (target === 'drop') {
            homeDropFullRef.current = fullAddress;
            setHomeDropCoords(coords);
            if (setBookingDropCoords) setBookingDropCoords(coords);
            setHomeDrop(shortAddress);
            if (setBookingDestination) setBookingDestination(fullAddress);
            if (addToast) addToast(`Destination set: ${shortAddress}`, 'check');
          } else {
            homePickupFullRef.current = fullAddress;
            setHomePickupCoords(coords);
            if (setBookingPickupCoords) setBookingPickupCoords(coords);
            setHomePickup(shortAddress);
            if (setBookingPickup) setBookingPickup(fullAddress);
            if (addToast) addToast(`Pickup set: ${shortAddress}`, 'check');
          }
        } else {
          if (addToast) addToast('Could not retrieve GPS coordinates. Please check location permissions.', 'alert');
        }
      }
    } catch (err) {
      console.warn('[HomeTab] Use current location error:', err);
      if (addToast) addToast('Location permission not granted or GPS unavailable', 'alert');
    } finally {
      setHomeIsDetectingCurrent(false);
    }
  };

  const handleHomeOpenMap = (target) => {
    setHomeMapTarget(target);
    setHomeActiveSuggestField(null);
    setMapModalOpen(true);
  };

  const addMinutesToHomeTime = (mins) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + mins);
    const m = d.getMinutes();
    const rem = m % 15;
    d.setMinutes(m + (rem === 0 ? 0 : (15 - rem)));
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    setHomeSelectedTime(`${hours}:${minutes}`);
    setHomeSelectedDate(getTodayISO());
  };

  const isHomeBookingReady = Boolean(
    (homePickupFullRef.current?.trim() || homePickup?.trim()) &&
    (homeDropFullRef.current?.trim() || homeDrop?.trim()) &&
    homeSelectedDate &&
    homeSelectedTime
  );

  const handleHomeBookDriver = () => {
    const finalPickup = homePickupFullRef.current?.trim() || homePickupCoords?.formatted || homePickup?.trim();
    const finalDrop = homeDropFullRef.current?.trim() || homeDropCoords?.formatted || homeDrop?.trim();
    if (!finalPickup || !finalDrop) {
      if (!finalPickup) {
        setHomeShakingField('pickup');
        setTimeout(() => setHomeShakingField(null), 600);
      } else {
        setHomeShakingField('drop');
        setTimeout(() => setHomeShakingField(null), 600);
      }
      return;
    }

    // Pre-fill fields into shared booking state with complete full location data
    if (setBookingPickup) setBookingPickup(finalPickup);
    if (setBookingPickupCoords) setBookingPickupCoords(homePickupCoords);
    if (setBookingDestination) setBookingDestination(finalDrop);
    if (setBookingDropCoords) setBookingDropCoords(homeDropCoords);
    if (setBookingDate) setBookingDate(homeSelectedDate || getTodayISO());
    if (setBookingTime) setBookingTime(homeSelectedTime || '12:00');

    const isAirport = (finalDrop || '').toLowerCase().includes('airport');
    if (setBookingCategory) setBookingCategory(isAirport ? 'airport' : 'hourly');
    if (setBookingOpen) setBookingOpen(true);
  };
  const searchWrapRef = useRef(null);
  const reviewsSliderRef = useRef(null);
  const isDraggingReviews = useRef(false);
  const reviewsStartX = useRef(0);
  const reviewsScrollLeft = useRef(0);

  // Scroll-linked pull-to-refresh state & refs
  const [pullDist, setPullDist] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isPullTracking = useRef(false);
  const hasVibratedRef = useRef(false);
  const isRefreshingRef = useRef(false);
  isRefreshingRef.current = isRefreshing;
  const pullDistRef = useRef(0);
  pullDistRef.current = pullDist;

  const PULL_THRESHOLD = 46;

  // Scroll-linked pull-to-refresh gesture listeners on scroll container #u-content (strictly only when uTab === 'home')
  useEffect(() => {
    // Only allow pull-to-refresh on user app home page
    if (uTab && uTab !== 'home') {
      setPullDist(0);
      setIsPulling(false);
      setIsRefreshing(false);
      pullDistRef.current = 0;
      return;
    }

    const uc = document.getElementById('u-content');
    if (!uc) return;

    const handleTouchStart = (e) => {
      if (isRefreshingRef.current || (uTab && uTab !== 'home')) return;
      if (uc.scrollTop <= 2 && e.touches.length === 1) {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
        isPullTracking.current = true;
        hasVibratedRef.current = false;
      } else {
        isPullTracking.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPullTracking.current || isRefreshingRef.current) return;
      if (uc.scrollTop > 2) {
        isPullTracking.current = false;
        setIsPulling(false);
        setPullDist(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartY.current;
      const deltaX = currentX - touchStartX.current;

      if (deltaY > 0 && deltaY > Math.abs(deltaX) * 1.1) {
        // Damped distance curve for natural elastic feel
        const damped = Math.min(64, deltaY * 0.42);
        pullDistRef.current = damped;
        setIsPulling(true);
        setPullDist(damped);

        // Haptic pulse when pull threshold is reached
        if (damped >= PULL_THRESHOLD && !hasVibratedRef.current) {
          hasVibratedRef.current = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(18); } catch (_) {}
          }
        } else if (damped < PULL_THRESHOLD && hasVibratedRef.current) {
          hasVibratedRef.current = false;
        }

        if (e.cancelable && damped > 6) {
          e.preventDefault();
        }
      } else if (deltaY < 0) {
        isPullTracking.current = false;
        setIsPulling(false);
        setPullDist(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullTracking.current) return;
      isPullTracking.current = false;
      setIsPulling(false);

      if (pullDistRef.current >= PULL_THRESHOLD && !isRefreshingRef.current) {
        setIsRefreshing(true);
        setPullDist(40);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([14, 25, 14]); } catch (_) {}
        }

        const startTime = Date.now();
        try {
          if (typeof syncTripsFromSupabase === 'function') {
            await syncTripsFromSupabase();
          }
          if (realtime && typeof realtime.reconnect === 'function') {
            realtime.reconnect();
          }
        } catch (err) {
          console.warn('[PullToRefresh] sync error:', err);
        }

        const elapsed = Date.now() - startTime;
        const remainingWait = Math.max(0, 850 - elapsed);
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDist(0);
          pullDistRef.current = 0;
        }, remainingWait);
      } else {
        setPullDist(0);
        pullDistRef.current = 0;
      }
    };

    // Desktop mouse drag support for simulator testing
    let isMouseDown = false;
    let mouseStartY = 0;
    let mouseStartX = 0;

    const handleMouseDown = (e) => {
      if (isRefreshingRef.current || (uTab && uTab !== 'home')) return;
      if (uc.scrollTop <= 2 && e.button === 0) {
        isMouseDown = true;
        mouseStartY = e.clientY;
        mouseStartX = e.clientX;
        hasVibratedRef.current = false;
      }
    };

    const handleMouseMove = (e) => {
      if (!isMouseDown || isRefreshingRef.current) return;
      if (uc.scrollTop > 2) {
        isMouseDown = false;
        setIsPulling(false);
        setPullDist(0);
        return;
      }

      const deltaY = e.clientY - mouseStartY;
      const deltaX = e.clientX - mouseStartX;
      if (deltaY > 0 && deltaY > Math.abs(deltaX) * 1.1) {
        const damped = Math.min(64, deltaY * 0.42);
        pullDistRef.current = damped;
        setIsPulling(true);
        setPullDist(damped);

        if (damped >= PULL_THRESHOLD && !hasVibratedRef.current) {
          hasVibratedRef.current = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(18); } catch (_) {}
          }
        } else if (damped < PULL_THRESHOLD && hasVibratedRef.current) {
          hasVibratedRef.current = false;
        }
      }
    };

    const handleMouseUp = async () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      setIsPulling(false);

      if (pullDistRef.current >= PULL_THRESHOLD && !isRefreshingRef.current) {
        setIsRefreshing(true);
        setPullDist(40);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([14, 25, 14]); } catch (_) {}
        }

        const startTime = Date.now();
        try {
          if (typeof syncTripsFromSupabase === 'function') {
            await syncTripsFromSupabase();
          }
        } catch (err) {
          console.warn('[PullToRefresh] sync error:', err);
        }

        const elapsed = Date.now() - startTime;
        const remainingWait = Math.max(0, 850 - elapsed);
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDist(0);
          pullDistRef.current = 0;
        }, remainingWait);
      } else {
        setPullDist(0);
        pullDistRef.current = 0;
      }
    };

    uc.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    uc.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      uc.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);

      uc.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [uTab, syncTripsFromSupabase]);

  const handleReviewsMouseDown = (e) => {
    if (!reviewsSliderRef.current) return;
    isDraggingReviews.current = true;
    reviewsStartX.current = e.pageX - reviewsSliderRef.current.offsetLeft;
    reviewsScrollLeft.current = reviewsSliderRef.current.scrollLeft;
  };

  const handleReviewsMouseLeave = () => {
    isDraggingReviews.current = false;
  };

  const handleReviewsMouseUp = () => {
    isDraggingReviews.current = false;
  };

  const handleReviewsMouseMove = (e) => {
    if (!isDraggingReviews.current || !reviewsSliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - reviewsSliderRef.current.offsetLeft;
    const walk = (x - reviewsStartX.current) * 1.4;
    reviewsSliderRef.current.scrollLeft = reviewsScrollLeft.current - walk;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure HomeTab lands smoothly at the top on load
  useEffect(() => {
    const uc = document.getElementById('u-content');
    if (uc) {
      uc.scrollTop = 0;
    }
  }, []);

  const isClientTrip = (t) => {
    if (!t) return false;
    if (!user) return true;
    if (isUserTrip && isUserTrip(t, user)) return true;
    const uPhone = String(user.phone || '').replace(/\D/g, '');
    const tPhone = String(t.rider?.phone || '').replace(/\D/g, '');
    if (uPhone && tPhone && (uPhone.endsWith(tPhone.slice(-10)) || tPhone.endsWith(uPhone.slice(-10)))) return true;
    return false;
  };

  const [dismissedTripIds, setDismissedTripIds] = useState(() => {
    try {
      const raw = localStorage.getItem('ridingo_dismissed_home_trips');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) {
      return new Set();
    }
  });
  const [submittedReviews, setSubmittedReviews] = useState({});
  const [tripRatings, setTripRatings] = useState({});
  const [tripHoverRatings, setTripHoverRatings] = useState({});
  const [tripReviews, setTripReviews] = useState({});
  const [tripFeedbackTags, setTripFeedbackTags] = useState({});

  const getStarRatingLabel = (ratingVal) => {
    switch (ratingVal) {
      case 5: return '⭐ 5.0 - Excellent Service!';
      case 4: return '⭐ 4.0 - Good Experience';
      case 3: return '⭐ 3.0 - Average Ride';
      case 2: return '⭐ 2.0 - Needs Improvement';
      case 1: return '⭐ 1.0 - Poor Experience';
      default: return 'Tap a star to rate your driver';
    }
  };

  const handleToggleFeedbackTag = (tripId, tag) => {
    setTripFeedbackTags(prev => {
      const cur = prev[tripId] || [];
      const updated = cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag];
      return { ...prev, [tripId]: updated };
    });
  };

  const handleSubmitCardRating = (trip) => {
    const star = tripRatings[trip.id] || 5;
    const reviewText = tripReviews[trip.id] || '';
    const feedback = tripFeedbackTags[trip.id] || [];

    if (setTrips && trip?.id) {
      setTrips(prev => prev.map(t => (t.id === trip.id ? {
        ...t,
        rating: star,
        userRating: star,
        feedback,
        reviewText,
        ratedAt: Date.now()
      } : t)));
    }

    try {
      const existingRaw = localStorage.getItem('ridingo_trip_reviews');
      const reviews = existingRaw ? JSON.parse(existingRaw) : {};
      reviews[trip.id] = {
        rating: star,
        feedback,
        reviewText,
        at: Date.now()
      };
      localStorage.setItem('ridingo_trip_reviews', JSON.stringify(reviews));
    } catch (_) {}

    setSubmittedReviews(prev => ({ ...prev, [trip.id]: true }));

    if (addToast) {
      const dName = (typeof trip.driver === 'string' ? trip.driver : trip.driver?.name) || trip.driverObj?.name || 'Driver';
      addToast(`Thank you! Review submitted for ${dName}.`, 'check');
    }
  };

  const handleDismissTrip = (tripId) => {
    setDismissedTripIds(prev => {
      const next = new Set([...prev, tripId]);
      try {
        localStorage.setItem('ridingo_dismissed_home_trips', JSON.stringify([...next]));
      } catch (_) {}
      return next;
    });
  };

  const getTripPriority = (status, trip) => {
    if (status === 'inprogress') return 100; // Live running trip strictly top priority!
    if (status === 'completed') return 90;   // Completed trip awaiting review right below live trip!
    if (status === 'ready_to_start' || status === 'pickup_arrived') return 80;
    if (status === 'accepted') {
      const unlocked = isTripTrackingUnlocked ? isTripTrackingUnlocked(trip) : true;
      return unlocked ? 70 : 60;
    }
    if (status === 'requested') return 40;
    return 20; // 'scheduled' or others
  };

  const availableTrips = useMemo(() => {
    return (trips || []).filter(t => {
      if (dismissedTripIds.has(t.id)) return false;
      if (['requested', 'accepted', 'pickup_arrived', 'ready_to_start', 'scheduled', 'inprogress'].includes(t.status)) {
        return isClientTrip(t);
      }
      if (t.status === 'completed') {
        return isClientTrip(t);
      }
      return false;
    }).sort((a, b) => {
      // 1. Live and actively executing trips ALWAYS on top
      const prioA = getTripPriority(a.status, a);
      const prioB = getTripPriority(b.status, b);
      if (prioB !== prioA) {
        return prioB - prioA;
      }
      // 2. Within the same stage, latest booking ordered on top
      const tsA = Number(a.when_ts) || (a.created_at ? new Date(a.created_at).getTime() : 0) || (typeof a.id === 'number' ? a.id : 0) || 0;
      const tsB = Number(b.when_ts) || (b.created_at ? new Date(b.created_at).getTime() : 0) || (typeof b.id === 'number' ? b.id : 0) || 0;
      return tsB - tsA;
    });
  }, [trips, user, isTripTrackingUnlocked, dismissedTripIds]);

  const [selectedTripId, setSelectedTripId] = useState(null);
  const [expandedTripId, setExpandedTripId] = useState(null);
  const hasInitializedExpandRef = useRef(false);
  const userMinimizedTripIdsRef = useRef(new Set());
  const [ticketModalTrip, setTicketModalTrip] = useState(null);

  // Dynamic Offer Banners loaded from Admin Panel / Banner Service
  const [offerBanners, setOfferBanners] = useState(getActiveOfferBanners);

  useEffect(() => {
    const unsub = subscribeToOfferBanners((allBanners) => {
      const active = (allBanners || []).filter(b => b.active !== false);
      if (active.length > 0) {
        setOfferBanners(active);
      }
    });
    return unsub;
  }, []);

  // Offer Banner Direction-Aware Carousel State
  const [[bannerPage, bannerDirection], setBannerPage] = useState([0, 0]);
  const [bannerAutoPlay, setBannerAutoPlay] = useState(true);
  const isDraggingBannerRef = useRef(false);
  const activeBannersCount = offerBanners.length || 1;
  const activeBannerIdx = ((bannerPage % activeBannersCount) + activeBannersCount) % activeBannersCount;
  const currentBanner = offerBanners[activeBannerIdx] || offerBanners[0] || {};

  const paginateBanner = (newDirection) => {
    setBannerPage([bannerPage + newDirection, newDirection]);
  };

  // Auto-advance offer banners with direction
  useEffect(() => {
    if (!bannerAutoPlay || offerBanners.length <= 1) return;
    const interval = setInterval(() => {
      paginateBanner(1);
    }, 4800);
    return () => clearInterval(interval);
  }, [bannerAutoPlay, bannerPage, offerBanners.length]);

  // Popular Destination Suggestions derived dynamically from user's booking history
  const popularDestinationSuggestions = useMemo(() => {
    if (!trips || trips.length === 0) return [];

    const destCounts = {};
    const destDetails = {};

    trips.forEach(t => {
      if (!isClientTrip(t)) return;
      const rawDest = (t.drop_loc || t.drop || '').trim();
      if (!rawDest) return;
      const cleanDest = getLocationUpToFirstComma(rawDest);
      if (!cleanDest || cleanDest.length < 3) return;

      const key = cleanDest.toLowerCase();
      destCounts[key] = (destCounts[key] || 0) + 1;
      if (!destDetails[key]) {
        destDetails[key] = {
          name: cleanDest,
          rawDestination: rawDest,
          pickup: t.pickup ? getLocationUpToFirstComma(t.pickup) : null,
          cat: t.cat || (cleanDest.toLowerCase().includes('airport') ? 'airport' : 'hourly'),
          icon: cleanDest.toLowerCase().includes('airport') ? 'plane' : 'route',
          count: 0
        };
      }
      destDetails[key].count += 1;
    });

    return Object.values(destDetails)
      .filter(item => item.count >= 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [trips, user]);

  useEffect(() => {
    if (!availableTrips || availableTrips.length === 0) {
      setExpandedTripId(null);
      hasInitializedExpandRef.current = false;
      return;
    }

    const liveTrip = availableTrips.find(t => t.status === 'inprogress');
    const unratedCompletedTrip = availableTrips.find(t => t.status === 'completed' && !t.rating && !t.userRating && !submittedReviews[t.id]);
    const prioritizeTrip = liveTrip || unratedCompletedTrip;

    // On initial load:
    if (!hasInitializedExpandRef.current) {
      if (prioritizeTrip) {
        setSelectedTripId(prioritizeTrip.id);
        setExpandedTripId(prioritizeTrip.id);
      } else {
        setSelectedTripId(null);
        setExpandedTripId(null);
      }
      hasInitializedExpandRef.current = true;
    } else {
      // Prioritized trip (live or unrated completed) is in expanding mode unless the user clicked the up arrow to minimize it!
      if (prioritizeTrip && !userMinimizedTripIdsRef.current.has(prioritizeTrip.id)) {
        setExpandedTripId(prioritizeTrip.id);
      } else {
        setExpandedTripId(prev => {
          if (prev === null) return null;
          if (availableTrips.some(t => t.id === prev)) return prev;
          return null;
        });
      }
    }
  }, [availableTrips]);

  // Pre-fetch actual road directions in background so expanding the map card renders 0ms instant road paths
  useEffect(() => {
    if (!Array.isArray(availableTrips) || availableTrips.length === 0) return;
    availableTrips.forEach(t => {
      const normStatus = String(t.status || '').toLowerCase().trim();
      const isApproachingPickup = ['accepted', 'pickup_arrived', 'ready_to_start', 'driver_assigned', 'on_the_way', 'arrived'].includes(normStatus);

      const pCoords = (t.pickupCoords?.lat && t.pickupCoords?.lng)
        ? { lat: Number(t.pickupCoords.lat), lng: Number(t.pickupCoords.lng) }
        : null;
      const dCoords = (t.dropCoords?.lat && t.dropCoords?.lng)
        ? { lat: Number(t.dropCoords.lat), lng: Number(t.dropCoords.lng) }
        : null;
      const drvCoords = (t.driverCoords?.lat && t.driverCoords?.lng)
        ? { lat: Number(t.driverCoords.lat), lng: Number(t.driverCoords.lng) }
        : null;

      const originCoords = isApproachingPickup && drvCoords ? drvCoords : pCoords;
      const destCoords = isApproachingPickup ? pCoords : dCoords;
      const originName = isApproachingPickup ? 'Driver Location' : (t.pickup || 'Pickup Location');
      const destName = isApproachingPickup ? (t.pickup || 'Pickup Location') : (t.drop_loc || t.drop || 'Destination');

      if (originCoords || destCoords || originName || destName) {
        fetchGoogleRoadDirections({
          origin: originName,
          destination: destName,
          originCoords,
          destCoords
        }).then(res => {
          if (res?.points && res.points.length > 2) {
            t.routePoints = res.points;
          }
        }).catch(() => {});
      }
    });
  }, [availableTrips]);

  const handleToggleExpand = (tripId, e) => {
    if (e) e.stopPropagation();
    setExpandedTripId(prev => {
      if (prev === tripId) {
        // User clicked up arrow to minimize
        userMinimizedTripIdsRef.current.add(tripId);
        return null;
      } else {
        // User clicked to expand
        userMinimizedTripIdsRef.current.delete(tripId);
        return tripId;
      }
    });
    setSelectedTripId(tripId);
  };

  const handleOpenTrackingModal = (t, e) => {
    if (e) e.stopPropagation();
    const unlocked = isTripTrackingUnlocked ? isTripTrackingUnlocked(t) : false;
    if (t.status === 'inprogress' || unlocked) {
      if (setActiveTrackingTripId) setActiveTrackingTripId(t.id);
      setLiveTrackingOpen(true);
    } else {
      if (addToast) addToast('Live GPS tracking unlocks 1 hour before scheduled pickup', 'info');
    }
  };

  const handleSelectTrip = (tripId) => {
    setSelectedTripId(tripId);
    setExpandedTripId(tripId);
    if (setActiveTrackingTripId) setActiveTrackingTripId(tripId);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`active-trip-${tripId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  const [sharingTripId, setSharingTripId] = useState(null);

  const handleNativeShareTrip = async (trip) => {
    if (!trip) return;
    setSharingTripId(trip.id);
    if (addToast) addToast('Preparing ticket for sharing...', 'info');

    try {
      const ticketRes = await generateTripTicketImage(trip);
      const driverName =
        (typeof trip.driver === 'string' ? trip.driver : trip.driver?.name) ||
        trip.driverObj?.name ||
        'Assigned Driver';
      const driverPhone =
        trip.driverObj?.phone ||
        (typeof trip.driver === 'object' ? trip.driver?.phone : null) ||
        trip.driverPhone ||
        trip.car?.driverPhone ||
        '';
      const pickupLoc = cleanLocationName(trip.pickup) || 'Pickup Location';
      const dropLoc = cleanLocationName(trip.drop_loc) || 'City Destination';
      const fare = Number(trip.fare) || 750;
      const otp = String(trip.startOtp || trip.otp || '').trim();
      const trackUrl = `https://ridingo.app/track/${trip.id}`;

      const shareText = `🚗 Ridingo Driver Trip Details
Trip ID: ${trip.id}
━━━━━━━━━━━━━━━━━━━━
📍 From (Pickup): ${pickupLoc}
🏁 To (Destination): ${dropLoc}
👤 Assigned Driver: ${driverName}
${driverPhone ? `📞 Driver Mobile: ${driverPhone}\n` : ''}💰 Total Fare: ₹${fare}
${otp ? `🔑 Trip Pickup OTP: ${otp}\n` : ''}━━━━━━━━━━━━━━━━━━━━
Live GPS Tracking: ${trackUrl}`;

      // 1. First Priority: Direct Native WhatsApp image + caption sender (ensures text is the caption, NOT separate message)
      if (Capacitor.isNativePlatform() && ticketRes?.dataUrl) {
        try {
          const sent = await shareTicketImageWithCaption({
            base64Data: ticketRes.dataUrl,
            caption: shareText,
            targetApp: 'whatsapp'
          });
          if (sent) {
            if (addToast) addToast('Ticket shared successfully!', 'check');
            setSharingTripId(null);
            return;
          }
        } catch (nativeShareErr) {
          console.warn('[HomeTab] shareTicketImageWithCaption note:', nativeShareErr);
        }
      }

      // 1b. Mobile Native via Capacitor Filesystem + Share Fallback
      if (Capacitor.isNativePlatform() && ticketRes?.dataUrl) {
        try {
          const base64Data = ticketRes.dataUrl.split(',')[1];
          const fileName = `ridingo_ticket_${trip.id}.png`;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });

          // When sharing an image, do NOT supply 'title' so WhatsApp and Android treat 'text' strictly as the image caption
          await Share.share({
            text: shareText,
            files: [savedFile.uri],
            dialogTitle: 'Share Trip Ticket'
          });
          if (addToast) addToast('Ticket shared successfully!', 'check');
          setSharingTripId(null);
          return;
        } catch (capErr) {
          if (capErr?.message?.toLowerCase().includes('cancel')) {
            setSharingTripId(null);
            return;
          }
          console.warn('[HomeTab] Capacitor native share note:', capErr);
          // Fallback to text share natively if file fails
          try {
            await Share.share({
              title: `Ridingo Ticket · ${trip.id}`,
              text: shareText,
              url: trackUrl,
              dialogTitle: 'Share Trip Details'
            });
            if (addToast) addToast('Trip details shared!', 'check');
            setSharingTripId(null);
            return;
          } catch (capTextErr) {
            console.warn('[HomeTab] Native text share failed:', capTextErr);
          }
        }
      }

      // 2. Web Share API with File (Mobile Chrome, Safari, etc.)
      if (
        ticketRes?.file &&
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [ticketRes.file] })
      ) {
        try {
          // Omit title so browser attaches text strictly as image caption
          await navigator.share({
            files: [ticketRes.file],
            text: shareText
          });
          if (addToast) addToast('Ticket shared successfully!', 'check');
          setSharingTripId(null);
          return;
        } catch (webFileErr) {
          if (webFileErr?.name === 'AbortError') {
            setSharingTripId(null);
            return;
          }
          console.warn('[HomeTab] Web file share note:', webFileErr);
        }
      }

      // 3. Web Share API with Text only
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: `Ridingo Ticket · ${trip.id}`,
            text: shareText,
            url: trackUrl
          });
          if (addToast) addToast('Trip details shared!', 'check');
          setSharingTripId(null);
          return;
        } catch (webTextErr) {
          if (webTextErr?.name === 'AbortError') {
            setSharingTripId(null);
            return;
          }
        }
      }

      // 4. Desktop Fallback: Copy share text to clipboard & download ticket image
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
      if (ticketRes?.dataUrl) {
        const link = document.createElement('a');
        link.download = `ridingo_ticket_${trip.id}.png`;
        link.href = ticketRes.dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      if (addToast) addToast('Ticket saved & trip details copied to clipboard!', 'check');
    } catch (err) {
      console.error('[HomeTab] Share error:', err);
      if (addToast) addToast('Could not open share dialog', 'warn');
    } finally {
      setSharingTripId(null);
    }
  };

  const getFirstLocationWord = (addr, fallback = 'Location') => {
    return getLocationUpToFirstComma(addr, fallback);
  };

  const formatTripDateTime = (t) => {
    let rawStr = '';
    if (t.scheduledDate && t.scheduledTime) {
      rawStr = `${t.scheduledDate} · ${t.scheduledTime}`;
    } else if (t.scheduleDisplay && t.scheduleDisplay !== 'Immediate Pickup') {
      rawStr = t.scheduleDisplay;
    } else if (t.when_ts) {
      const d = new Date(Number(t.when_ts));
      if (!isNaN(d.getTime())) {
        const now = new Date();
        const isToday = now.toDateString() === d.toDateString();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        if (isToday) {
          rawStr = `Today · ${timeStr}`;
        } else {
          const dateStr = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
          rawStr = `${dateStr} · ${timeStr}`;
        }
      }
    } else {
      rawStr = 'Immediate';
    }
    return rawStr.replace(/\s*\([^\)]*\)/g, '').trim();
  };

  const getTripStatusConfig = (status) => {
    const isLive = status === 'inprogress';

    if (isLive) {
      return {
        label: 'Live Trip In Progress',
        miniLabel: 'Live On Trip',
        color: '#22C55E',
        borderColor: 'rgba(34, 197, 94, 0.36)',
        glowColor: 'rgba(34, 197, 94, 0.15)',
        bgSoft: 'rgba(34, 197, 94, 0.12)',
        pulse: true,
        isLive: true
      };
    }

    // All upcoming / pending / scheduled trips are strictly YELLOW (amber gold)
    let label = 'Upcoming Booking';
    let miniLabel = 'Upcoming';
    if (status === 'pickup_arrived') {
      label = 'Driver Arrived';
      miniLabel = 'Driver Arrived';
    } else if (status === 'ready_to_start') {
      label = 'Ready to Start';
      miniLabel = 'Ready to Start';
    } else if (status === 'accepted') {
      label = 'Driver Arriving';
      miniLabel = 'Driver Arriving';
    } else if (status === 'requested') {
      label = 'Finding Driver';
      miniLabel = 'Finding Driver';
    } else if (status === 'scheduled') {
      label = 'Upcoming Booking';
      miniLabel = 'Upcoming';
    }

    return {
      label,
      miniLabel,
      color: '#EAB308',
      borderColor: 'rgba(234, 179, 8, 0.36)',
      glowColor: 'rgba(234, 179, 8, 0.15)',
      bgSoft: 'rgba(234, 179, 8, 0.12)',
      pulse: status !== 'scheduled',
      isLive: false
    };
  };

  const handleCardClick = (t) => {
    const unlocked = isTripTrackingUnlocked ? isTripTrackingUnlocked(t) : false;
    if (t.status === 'inprogress' || unlocked) {
      if (setActiveTrackingTripId) setActiveTrackingTripId(t.id);
      setLiveTrackingOpen(true);
    } else {
      if (addToast) addToast('Live GPS tracking unlocks 1 hour before scheduled pickup', 'info');
      setTicketModalTrip(t);
    }
  };

  const getBadgeConfig = (trip) => {
    const status = trip.status;
    const isLive = status === 'inprogress';

    if (isLive) {
      return {
        text: 'LIVE',
        bg: '#10B981',
        color: '#FFFFFF',
        border: 'none',
        dotColor: '#FFFFFF',
        pulse: true
      };
    }
    // Removed ready, arrived, on way, and other status badges per user request
    return null;
  };

  const handleCancelRequest = (tripOrId) => {
    const tripObj = typeof tripOrId === 'object' ? tripOrId : (trips || []).find(t => t.id === tripOrId);
    if (!tripObj) return;

    const isDriverAssigned = Boolean(
      tripObj.driver ||
      tripObj.driverId ||
      tripObj.driver_id ||
      ['accepted', 'pickup_arrived', 'ready_to_start', 'scheduled', 'on_the_way', 'arrived', 'started', 'in_progress'].includes(tripObj.status)
    );

    if (isDriverAssigned) {
      // Driver accepted: SHOW CANCELLATION POLICY POPUP WITH FINE
      if (setTripToCancel) setTripToCancel(tripObj);
    } else {
      // Driver not accepted: FREE CANCELLATION, NO CANCELLATION POLICY POPUP
      if (cancelTripByUser) {
        cancelTripByUser(tripObj.id, { feeOverride: 0 });
      }
      if (setActiveTrackingTripId) setActiveTrackingTripId(null);
      setLiveTrackingOpen(false);
      addToast('Trip request cancelled freely. No cancellation fee.', 'check');
    }
  };
  const rawFirst = user?.firstName || (user?.name ? user.name.trim().split(' ')[0] : 'there');
  const first = rawFirst ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1) : 'there';

  const openBooking = (cat, destination = null) => {
    if (setBookingDestination) {
      setBookingDestination(destination || '');
    }
    setBookingCategory(cat);
    setBookingOpen(true);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim()) {
      setSearchOpen(true);
    } else {
      setSearchOpen(false);
    }
  };

  const handleClearSearch = (e) => {
    e.stopPropagation();
    setSearchQuery('');
    setSearchOpen(false);
  };

  const handlePickPlace = (placeTitle) => {
    const isAirport = placeTitle.toLowerCase().includes('airport');
    setBookingCategory(isAirport ? 'airport' : 'hourly');
    setBookingDestination(placeTitle);
    setBookingOpen(true);
    setSearchOpen(false);
  };

  const handlePickTrip = (t) => {
    setBookingCategory(t.cat || 'hourly');
    setBookingDestination(t.drop_loc);
    setBookingOpen(true);
    setSearchOpen(false);
  };

  const handlePickSetting = (s) => {
    if (s.action === 'open_notifs') {
      setNotifsOpen(true);
    } else if (s.tab) {
      setUTab(s.tab);
    }
    setSearchOpen(false);
  };

  const handlePickService = (srv) => {
    setBookingCategory(srv.cat);
    setBookingOpen(true);
    setSearchOpen(false);
  };

  const handleMapPick = (addr, details) => {
    const fullAddress = details?.formatted || details?.address || addr;
    const shortAddress = getLocationUpToFirstComma(fullAddress);
    const coordsObj = details && details.lat && details.lng ? {
      lat: Number(details.lat),
      lng: Number(details.lng),
      formatted: fullAddress
    } : null;

    if (homeMapTarget === 'pickup') {
      homePickupFullRef.current = fullAddress;
      setHomePickup(shortAddress);
      if (coordsObj) setHomePickupCoords(coordsObj);
      if (setBookingPickup) setBookingPickup(fullAddress);
      if (coordsObj && setBookingPickupCoords) setBookingPickupCoords(coordsObj);
    } else {
      homeDropFullRef.current = fullAddress;
      setHomeDrop(shortAddress);
      if (coordsObj) setHomeDropCoords(coordsObj);
      if (setBookingDestination) setBookingDestination(fullAddress);
      if (coordsObj && setBookingDropCoords) setBookingDropCoords(coordsObj);
    }
    setMapModalOpen(false);
  };

  const recs = getRecommendations(searchQuery, { trips });
  const hasTripOrSettingRecs = recs.trips.length > 0 || recs.settings.length > 0;

  return (
    <div>
      {/* Top Bar with Brand Logo and Notification Bell (Scrolls naturally with page content) */}
      <div
        className="home-fixed-top-bar"
        style={{
          position: 'relative',
          top: 'auto',
          zIndex: 10,
          background: 'transparent',
          marginLeft: '-18px',
          marginRight: '-18px',
          paddingLeft: '18px',
          paddingRight: '18px',
          paddingTop: '6px',
          paddingBottom: '8px',
          marginBottom: '2px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 800,
              color: 'var(--ink, #0F172A)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15
            }}
          >
            Hi, {first}
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--muted, #64748B)',
              lineHeight: 1.25
            }}
          >
            Need a driver for your own car?
          </p>
        </div>
        <button className="iconbtn" aria-label="Notifications" onClick={() => setNotifsOpen(true)}>
          <Icon name="bell" size={20} />
          {unreadCount > 0 && <span className="dotbadge" />}
        </button>
      </div>

      {/* Minimal Background-Free Pull-to-Refresh Loading Animation */}
      <div
        className="home-ptr-slot"
        style={{
          height: isRefreshing ? 42 : `${pullDist}px`,
          opacity: isRefreshing ? 1 : Math.min(1, Math.max(0, pullDist / 38)),
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: isPulling ? 'none' : 'height 0.32s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.22s ease',
          pointerEvents: 'none',
          width: '100%',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          flexShrink: 0
        }}
        aria-hidden={pullDist === 0 && !isRefreshing}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isRefreshing ? 'none' : `rotate(${Math.min(360, (pullDist / 44) * 360)}deg)`,
            transition: isPulling ? 'none' : 'transform 0.15s ease',
            color: 'var(--ink)'
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className={isRefreshing ? 'ptr-spinning-anim' : ''}
            style={{ display: 'block' }}
          >
            <circle
              cx="12"
              cy="12"
              r="8.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="53.4"
              strokeDashoffset={isRefreshing ? 16 : 53.4 * (1 - Math.min(1, Math.max(0, pullDist / 44)))}
              style={{
                opacity: 0.92,
                transformOrigin: 'center'
              }}
            />
          </svg>
        </div>
      </div>

      {/* Moving Content / Body */}
      <div
        className="home-scroll-body home-responsive-shell"
        style={{
          transition: isPulling ? 'none' : 'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
      >
      {/* Destination Search Bar - Always pinned on top */}
      <div
        id="u-search-wrap"
        ref={searchWrapRef}
        className="search-wrap stagger-2"
        style={{
          position: 'relative',
          zIndex: 20,
          marginTop: '6px',
          marginBottom: '14px'
        }}
      >
        <div className="search-anim-inner">
          <div className="search-box">
            <span className="search-ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              className="search-inp"
              id="u-dest-search"
              placeholder="Search recent trips, settings..."
              autoComplete="off"
              spellCheck="false"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery.trim()) setSearchOpen(true);
              }}
            />
            {searchQuery && (
              <button
                className="search-clr"
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Keyword-based Recommendations Dropdown (Trips, Settings, Services, Places) */}
        {searchOpen && searchQuery.trim() && (
          <div className="search-dropdown" id="u-search-drop">
            {/* 1. Recent Trips Section */}
            {recs.trips.length > 0 && (
              <>
                <div className="search-drop-h">Recent Trips</div>
                {recs.trips.map(t => (
                  <button
                    key={t.id}
                    className="search-item"
                    type="button"
                    onClick={() => handlePickTrip(t)}
                  >
                    <span className="search-item-ic" style={{ background: 'var(--yellow-soft)', color: 'var(--on-yellow-soft, var(--yellow))' }}>
                      <Icon name="route" size={16} />
                    </span>
                    <div className="search-item-meta">
                      <div className="search-item-route">
                        <span className="loc-to" style={{ fontWeight: 700 }}>
                          {cleanLocationName(t.drop_loc)}
                        </span>
                      </div>
                      <span className="search-item-sub">
                        From {cleanLocationName(t.pickup)} · Driver: {t.driver || 'Assigned'}
                      </span>
                    </div>
                    <span className="search-item-badge" style={{ background: 'var(--yellow)', color: 'var(--on-yellow)' }}>
                      Rebook
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* 2. Settings & Preferences Section */}
            {recs.settings.length > 0 && (
              <>
                <div className="search-drop-h">Settings & Features</div>
                {recs.settings.map(s => (
                  <button
                    key={s.id}
                    className="search-item"
                    type="button"
                    onClick={() => handlePickSetting(s)}
                  >
                    <span className="search-item-ic" style={{ background: 'var(--field)', color: 'var(--ink)' }}>
                      <Icon name={s.icon} size={16} />
                    </span>
                    <div className="search-item-meta">
                      <b style={{ fontSize: '14px', color: 'var(--ink)', display: 'block' }}>
                        {s.title}
                      </b>
                      <span className="search-item-sub">{s.sub}</span>
                    </div>
                    <span className="search-item-badge" style={{ background: 'var(--field)', color: 'var(--muted)' }}>
                      {s.badge}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Fallback if no matching trips or settings */}
            {!hasTripOrSettingRecs && (
              <div className="search-empty" style={{ padding: '20px 14px', textAlign: 'center' }}>
                <span className="search-empty-ic" style={{ display: 'inline-flex', marginBottom: '6px', color: 'var(--muted)' }}>
                  <Icon name="search" size={20} />
                </span>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                  No trips or settings matching "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        )}
          
      </div>


      {/* =========================================================
          RUNNING OFFER BANNERS (Landscape Rounded Rectangle)
          Features professional branding design, swipe/drag gesture support,
          direction-aware modern app sliding animation, and direct category navigation.
          ========================================================= */}
      <div
        className="offer-banners-wrap stagger-2"
        style={{
          marginTop: '12px',
          marginBottom: '16px',
          position: 'relative',
          userSelect: 'none'
        }}
        onMouseEnter={() => setBannerAutoPlay(false)}
        onMouseLeave={() => setBannerAutoPlay(true)}
        onTouchStart={() => setBannerAutoPlay(false)}
        onTouchEnd={() => setBannerAutoPlay(true)}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: '20px',
            overflow: 'hidden',
            aspectRatio: '2.5 / 1',
            minHeight: '144px',
            maxHeight: '260px',
            width: '100%',
            boxShadow: 'none',
            border: 'none',
            background: 'transparent',
            cursor: 'grab'
          }}
        >
          <AnimatePresence initial={false} custom={bannerDirection} mode="popLayout">
            <motion.div
              key={bannerPage}
              custom={bannerDirection}
              variants={{
                enter: (direction) => ({
                  x: direction > 0 ? '100%' : '-100%',
                  opacity: 0,
                  scale: 0.96
                }),
                center: {
                  zIndex: 1,
                  x: 0,
                  opacity: 1,
                  scale: 1,
                  transition: {
                    x: { type: 'spring', stiffness: 340, damping: 32, mass: 0.8 },
                    opacity: { duration: 0.22, ease: 'easeOut' },
                    scale: { type: 'spring', stiffness: 340, damping: 32, mass: 0.8 }
                  }
                },
                exit: (direction) => ({
                  zIndex: 0,
                  x: direction < 0 ? '100%' : '-100%',
                  opacity: 0,
                  scale: 0.96,
                  transition: {
                    x: { type: 'spring', stiffness: 340, damping: 32, mass: 0.8 },
                    opacity: { duration: 0.2, ease: 'easeIn' },
                    scale: { duration: 0.2 }
                  }
                })
              }}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragStart={() => {
                isDraggingBannerRef.current = true;
              }}
              onDragEnd={(e, { offset, velocity }) => {
                setTimeout(() => {
                  isDraggingBannerRef.current = false;
                }, 100);
                const swipeThreshold = 25;
                const swipeVelocity = 150;
                if (offset.x < -swipeThreshold || velocity.x < -swipeVelocity) {
                  paginateBanner(1);
                } else if (offset.x > swipeThreshold || velocity.x > swipeVelocity) {
                  paginateBanner(-1);
                }
              }}
              onClick={() => {
                if (isDraggingBannerRef.current) return;
                if (currentBanner.promoCode && addToast) {
                  addToast(`Offer applied: ${currentBanner.promoCode}`, 'check');
                }
                openBooking(currentBanner.category || 'hourly', currentBanner.customDestination || null);
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '20px',
                overflow: 'hidden',
                touchAction: 'pan-y',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none'
              }}
            >
              {(currentBanner.imageMobile || currentBanner.imageTablet || currentBanner.imageUrl) ? (
                /* ========================================================
                   FULLY DESIGNED BANNER SLIDE (Image-First pure graphic)
                   No black stroke, no dark scrim, pure uploaded banner asset
                   ======================================================== */
                <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden' }}>
                  <picture style={{ width: '100%', height: '100%', display: 'block' }}>
                    {currentBanner.imageTablet && (
                      <source media="(min-width: 640px)" srcSet={currentBanner.imageTablet} />
                    )}
                    <img
                      src={currentBanner.imageMobile || currentBanner.imageUrl || currentBanner.imageTablet}
                      alt={currentBanner.serviceName || 'Special Offer Banner'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        borderRadius: '20px',
                        border: 'none',
                        outline: 'none'
                      }}
                    />
                  </picture>

                  {/* Optional CTA Button on the Image ONLY when explicitly enabled */}
                  {currentBanner.showCta && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '14px',
                        zIndex: 2,
                        pointerEvents: 'none'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 800,
                          color: currentBanner.ctaTextColor || '#000000',
                          background: currentBanner.ctaBgColor || '#FFFFFF',
                          padding: '5px 14px',
                          borderRadius: '999px',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{currentBanner.cta || 'Book Now'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback layout when no image is uploaded */
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 850, color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase' }}>
                        {currentBanner.brandTag || 'RIDINGO SPECIAL'}
                      </span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px' }}>•</span>
                      <span style={{ background: currentBanner.tagBg || '#10B981', color: '#FFFFFF', fontSize: '9.5px', fontWeight: 900, padding: '2.5px 8px', borderRadius: '999px' }}>
                        {currentBanner.tag || 'SPECIAL OFFER'}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.25 }}>
                      {currentBanner.headline}
                    </h4>

                    <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.82)', lineHeight: 1.3 }}>
                      {currentBanner.sub}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: currentBanner.ctaTextColor || '#000000', background: currentBanner.ctaBgColor || '#FFFFFF', padding: '4.5px 12px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        {currentBanner.cta || 'Book Now'} ➔
                      </span>
                    </div>
                  </div>

                  <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(12px)', border: '1.5px solid rgba(255, 255, 255, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', flexShrink: 0, marginLeft: '14px', zIndex: 1 }}>
                    <Icon name={currentBanner.icon || 'star'} size={28} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Dots Indicator: Interactive with dynamic active width */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '9px' }}>
          {offerBanners.map((banner, idx) => {
            const isActive = idx === activeBannerIdx;
            return (
              <button
                key={banner.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const dir = idx > activeBannerIdx ? 1 : -1;
                  setBannerPage([idx, dir]);
                }}
                aria-label={`Go to ${banner.tag || banner.headline}`}
                style={{
                  width: isActive ? '22px' : '6px',
                  height: '5px',
                  borderRadius: '999px',
                  background: isActive ? 'var(--solid)' : 'var(--bar)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            );
          })}
        </div>
      </div>


      {/* =========================================================
          RESPONSIVE SPLIT HERO:
          On mobile (< 960px): Offer banners on top, booking card below
          On desktop (>= 960px): Two-column layout with sticky booking card on left
          and offer banner + safe driver assurance card on right
          ========================================================= */}
      <div className="home-hero-split-grid">
        <div className="home-hero-col-booking">
          {/* HERO BOOKING CARD (Exact Copy of Screenshot Design) */}
          <div
            className={`home-booking-hero-card stagger-3 ${homeActiveSuggestField ? 'has-active-dropdown' : ''}`}
            style={{ position: 'relative', zIndex: homeActiveSuggestField ? 999999 : 2 }}
          >
        {/* Background Graphic with Light Line Pattern Only (No Car, No Green Line) */}
        <div className="home-booking-hero-bg" aria-hidden="true">
          <svg width="250" height="150" viewBox="0 0 250 150" fill="none" style={{ position: 'absolute', top: 0, right: 0, pointerEvents: 'none' }}>
            {/* Soft Map Street Grid Lines */}
            <path d="M40 20 L250 10 M10 65 L250 45 M60 140 L250 110 M120 0 L190 150 M40 30 L90 150" stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#EEF2F6'} strokeWidth="2.5" />
            <path d="M80 0 L150 150 M190 0 L250 100" stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#EEF2F6'} strokeWidth="2" />
          </svg>
        </div>

        {/* Header: Title and Subtitle */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 850, color: isDark ? '#FFFFFF' : '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Book a driver
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '13.5px', color: isDark ? '#94A3B8' : '#64748B', fontWeight: 500 }}>
            Tell us your trip details
          </p>
        </div>

        {/* Route Fields (Two Separate Capsules with Dashed Connector Line) */}
        <div style={{ position: 'relative', zIndex: homeActiveSuggestField ? 9999999 : 1, marginBottom: '14px' }}>
          {/* Top-layer Continuous Dashed Route Line connecting Pickup to Destination (with generous gap spacing from pins) */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '24px',
              top: '54px',
              bottom: '54px',
              width: 0,
              borderLeft: isDark ? '2.2px dashed #94A3B8' : '2.2px dashed #94A3B8',
              zIndex: 10,
              pointerEvents: 'none'
            }}
          />

          {/* Pickup Capsule */}
          <div
            className={`home-capsule-input-box ${homeShakingField === 'pickup' ? 'shake-attention' : ''}`}
            style={{ zIndex: homeActiveSuggestField === 'pickup' ? 99999999 : 2, marginBottom: '10px' }}
          >
            {/* Green Location Pin */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#10B981" style={{ flexShrink: 0, position: 'relative', zIndex: 11 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>

            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '11px', color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600, marginBottom: '1px' }} htmlFor="home-pickup">
                Pickup location
              </label>
              <input
                ref={homePickupInputRef}
                id="home-pickup"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: 0,
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: isDark ? '#FFFFFF' : '#0F172A'
                }}
                placeholder="Where should we meet you?"
                value={homePickup}
                onFocus={() => {
                  setHomeActiveSuggestField('pickup');
                  if (homePickup && homePickup.trim().length >= 1) {
                    handleHomePickupChange(homePickup);
                  }
                }}
                onChange={e => handleHomePickupChange(e.target.value)}
                onBlur={() => {
                  if (homePickup && homePickup.includes(',')) {
                    setHomePickup(getLocationUpToFirstComma(homePickup));
                  }
                }}
                autoComplete="off"
              />
            </div>

            {/* Clear 'x' Icon on Right (only when text is filled in pickup box) */}
            {Boolean(homePickup && homePickup.trim()) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHomePickup('');
                  homePickupFullRef.current = '';
                  setHomePickupCoords(null);
                  if (setBookingPickup) setBookingPickup('');
                  if (setBookingPickupCoords) setBookingPickupCoords(null);
                  setHomePickupSuggestions([]);
                }}
                title="Clear pickup location"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #CBD5E1',
                  background: isDark ? '#27272A' : '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {/* Minimal Dropdown for Pickup */}
            {homeActiveSuggestField === 'pickup' && (
              <div
                className="location-suggest-dropdown minimal-dropdown"
                style={{
                  zIndex: 99999999,
                  maxHeight: '280px',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  background: isDark ? '#141416' : '#FFFFFF',
                  border: isDark ? '1px solid #27272A' : '1px solid #E2E8F0',
                  borderRadius: '14px',
                  boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.6)' : '0 12px 32px rgba(0,0,0,0.12)',
                  padding: '4px 0'
                }}
              >
                {/* 1. Use Current Location Action */}
                <button
                  type="button"
                  className="loc-suggest-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleHomeUseCurrentLocation('pickup')}
                >
                  <div className="loc-suggest-icon-bubble" style={{ background: isDark ? '#27272A' : '#F1F5F9', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="7" />
                      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                      <line x1="12" y1="2" x2="12" y2="5" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="5" y2="12" />
                      <line x1="19" y1="12" x2="22" y2="12" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="loc-suggest-title" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      Use Current Location
                    </div>
                    <div className="loc-suggest-sub" style={{ color: isDark ? '#A1A1AA' : '#64748B' }}>
                      {homePickupCoords ? `GPS (${Number(homePickupCoords.lat).toFixed(4)}, ${Number(homePickupCoords.lng).toFixed(4)})` : 'Detect live device GPS location'}
                    </div>
                  </div>
                </button>

                {/* 2. Choose on map Action */}
                <button
                  type="button"
                  className="loc-suggest-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleHomeOpenMap('pickup')}
                >
                  <div className="loc-suggest-icon-bubble" style={{ background: isDark ? '#27272A' : '#F1F5F9', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                      <line x1="9" y1="3" x2="9" y2="18" />
                      <line x1="15" y1="6" x2="15" y2="21" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="loc-suggest-title" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      Choose on map
                    </div>
                    <div className="loc-suggest-sub" style={{ color: isDark ? '#A1A1AA' : '#64748B' }}>
                      Pin pickup location on real-time map
                    </div>
                  </div>
                </button>

                {/* 3. Loading State */}
                {homeIsSearchingPlaces && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', color: isDark ? '#A1A1AA' : '#64748B', fontSize: '12px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Searching places...</span>
                  </div>
                )}

                {/* 4. Places Autocomplete Suggestions */}
                {homePickupSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="loc-suggest-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectHomePickupPlace(item)}
                  >
                    <div className="loc-suggest-icon-bubble" style={{ background: isDark ? '#27272A' : '#F1F5F9', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="loc-suggest-title" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        {highlightMatchGoogleStock(item.title, homePickup)}
                      </div>
                      {item.sub && (
                        <div className="loc-suggest-sub" style={{ color: isDark ? '#A1A1AA' : '#64748B' }}>
                          {item.sub}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Destination Capsule */}
          <div
            className={`home-capsule-input-box ${homeShakingField === 'drop' ? 'shake-attention' : ''}`}
            style={{ zIndex: homeActiveSuggestField === 'drop' ? 99999999 : 1 }}
          >
            {/* Location Pin */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#EF4444" style={{ flexShrink: 0, position: 'relative', zIndex: 11 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>

            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '11px', color: isDark ? '#94A3B8' : '#64748B', fontWeight: 600, marginBottom: '1px' }} htmlFor="home-drop">
                Destination location
              </label>
              <input
                ref={homeDropInputRef}
                id="home-drop"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: 0,
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: isDark ? '#FFFFFF' : '#0F172A'
                }}
                placeholder="Where are you heading to?"
                value={homeDrop}
                onFocus={() => {
                  setHomeActiveSuggestField('drop');
                  if (homeDrop && homeDrop.trim().length >= 1) {
                    handleHomeDropChange(homeDrop);
                  }
                }}
                onChange={e => handleHomeDropChange(e.target.value)}
                onBlur={() => {
                  if (homeDrop && homeDrop.includes(',')) {
                    setHomeDrop(getLocationUpToFirstComma(homeDrop));
                  }
                }}
                autoComplete="off"
              />
            </div>

            {/* Clear 'x' Icon on Right (only when text is filled in destination box) */}
            {Boolean(homeDrop && homeDrop.trim()) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHomeDrop('');
                  homeDropFullRef.current = '';
                  setHomeDropCoords(null);
                  if (setBookingDestination) setBookingDestination('');
                  if (setBookingDropCoords) setBookingDropCoords(null);
                  setHomeDropSuggestions([]);
                }}
                title="Clear destination"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #CBD5E1',
                  background: isDark ? '#27272A' : '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {/* Minimal Dropdown for Destination */}
            {homeActiveSuggestField === 'drop' && (
              <div
                className="location-suggest-dropdown minimal-dropdown"
                style={{
                  zIndex: 99999999,
                  maxHeight: '280px',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  background: isDark ? '#141416' : '#FFFFFF',
                  border: isDark ? '1px solid #27272A' : '1px solid #E2E8F0',
                  borderRadius: '14px',
                  boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.6)' : '0 12px 32px rgba(0,0,0,0.12)',
                  padding: '4px 0'
                }}
              >
                {/* 1. Choose on map Action */}
                <button
                  type="button"
                  className="loc-suggest-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleHomeOpenMap('drop')}
                >
                  <div className="loc-suggest-icon-bubble" style={{ background: isDark ? '#27272A' : '#F1F5F9', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                      <line x1="9" y1="3" x2="9" y2="18" />
                      <line x1="15" y1="6" x2="15" y2="21" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="loc-suggest-title" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      Choose on map
                    </div>
                    <div className="loc-suggest-sub" style={{ color: isDark ? '#A1A1AA' : '#64748B' }}>
                      Pin destination on real-time map
                    </div>
                  </div>
                </button>

                {/* 2. Use Current Location Action */}
                <button
                  type="button"
                  className="loc-suggest-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleHomeUseCurrentLocation('drop')}
                >
                  <div className="loc-suggest-icon-bubble" style={{ background: isDark ? '#27272A' : '#F1F5F9', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="7" />
                      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                      <line x1="12" y1="2" x2="12" y2="5" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="5" y2="12" />
                      <line x1="19" y1="12" x2="22" y2="12" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="loc-suggest-title" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      Use Current Location
                    </div>
                    <div className="loc-suggest-sub" style={{ color: isDark ? '#A1A1AA' : '#64748B' }}>
                      Detect live device GPS location
                    </div>
                  </div>
                </button>

                {/* 3. Loading State */}
                {homeIsSearchingPlaces && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', color: isDark ? '#A1A1AA' : '#64748B', fontSize: '12px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Searching places...</span>
                  </div>
                )}

                {/* 4. Places Autocomplete Suggestions */}
                {homeDropSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="loc-suggest-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectHomeDropPlace(item)}
                  >
                    <div className="loc-suggest-icon-bubble" style={{ background: isDark ? '#27272A' : '#F1F5F9', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="loc-suggest-title" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        {highlightMatchGoogleStock(item.title, homeDrop)}
                      </div>
                      {item.sub && (
                        <div className="loc-suggest-sub" style={{ color: isDark ? '#A1A1AA' : '#64748B' }}>
                          {item.sub}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA Button: Solid Black Container with 'Book a Driver' and White Round Icon with Black Arrow */}
        <button
          type="button"
          onClick={handleHomeBookDriver}
          disabled={!isHomeBookingReady}
          className={`home-book-btn-container ${!isHomeBookingReady ? 'is-disabled' : ''}`}
          aria-label="Book a Driver"
          style={{ background: '#000000', border: '1.5px solid #000000' }}
        >
          <span style={{ flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: '16.5px', fontWeight: 800, letterSpacing: '-0.01em', paddingLeft: '24px' }}>
            Book a Driver
          </span>
          <div className="home-book-btn-circle" style={{ background: '#FFFFFF', color: '#000000' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#000000' }}>
              <line x1="7" y1="17" x2="17" y2="7" stroke="#000000" />
              <polyline points="7 7 17 7 17 17" stroke="#000000" />
            </svg>
          </div>
        </button>
          </div>
        </div>
      </div>
      {availableTrips.length > 0 && (
        <div className="active-trips-section stagger-1" style={{ marginTop: '14px', marginBottom: '20px' }}>
          {(() => {
            const liveTrips = availableTrips.filter(t => t.status === 'inprogress');
            const completedTrips = availableTrips.filter(t => t.status === 'completed');
            const upcomingTrips = availableTrips.filter(t => t.status !== 'inprogress' && t.status !== 'completed');

            const renderTripCard = (trip) => {
              const isLive = trip.status === 'inprogress';
              const isCompleted = trip.status === 'completed';
              const isExpanded = expandedTripId === trip.id;
              const unlocked = isTripTrackingUnlocked ? isTripTrackingUnlocked(trip) : false;
              const badge = getBadgeConfig(trip);
              const fromName = cleanLocationName(trip.pickup);
              const toName = cleanLocationName(trip.drop_loc) || 'As directed by passenger';
              const fromLocation = getLocationUpToFirstComma(trip.pickup, 'Pickup Location');
              const toLocation = getLocationUpToFirstComma(trip.drop_loc, 'Destination');
              const fromCity = fromLocation;
              const toCity = toLocation;
              const dateTimeDisplay = formatTripDateTime(trip);
              const cardOtp = trip.startOtp || trip.otp || trip.car?.startOtp || '4821';
              const driverName =
                (typeof trip.driver === 'string' ? trip.driver : trip.driver?.name) ||
                trip.driverObj?.name ||
                trip.car?.driverName ||
                (trip.status === 'requested' ? 'Finding Driver' : 'Driver Assigned');
              const fareValue = trip.fare || trip.estimatedFare || trip.price || 750;

              const cardContent = (
                <div
                  id={`active-trip-${trip.id}`}
                  onClick={(e) => handleToggleExpand(trip.id, e)}
                  style={{
                    background: 'var(--card)',
                    borderRadius: '22px',
                    border: isLive && isExpanded ? 'none' : isLive ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--line)',
                    boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {/* Upper Section: Location Route (Up to first comma, with ellipsis truncation) + Single OTP Highlight + (LIVE Badge if live) */}
                  <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    {/* Location text in From -> To format (string up to first comma, with ellipsis if exceeding width) */}
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          letterSpacing: '-0.01em',
                          minWidth: 0,
                          flex: '0 1 auto',
                          maxWidth: 'calc(50% - 12px)'
                        }}
                        title={trip.pickup}
                      >
                        {fromLocation}
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--ink)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, opacity: 0.8 }}
                      >
                        <path d="M5 12h14" />
                        <path d="m13 6 6 6-6 6" />
                      </svg>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          letterSpacing: '-0.01em',
                          minWidth: 0,
                          flex: '0 1 auto',
                          maxWidth: 'calc(50% - 12px)'
                        }}
                        title={trip.drop_loc}
                      >
                        {toLocation}
                      </span>
                    </div>

                    {/* Right: Completed Status Badge OR OTP Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isCompleted ? (
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10B981',
                            border: '1.5px solid rgba(16, 185, 129, 0.35)',
                            borderRadius: '10px',
                            padding: '4px 9px',
                            fontSize: '11px',
                            fontWeight: 900,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.12)',
                            flexShrink: 0
                          }}
                          title="Trip Completed"
                        >
                          <Icon name="check" size={12} style={{ color: '#10B981' }} />
                          <span>Completed</span>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              background: 'var(--field)',
                              color: 'var(--ink)',
                              border: '1.5px solid var(--line-strong)',
                              borderRadius: '10px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 900,
                              fontFamily: 'monospace',
                              letterSpacing: '0.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                              flexShrink: 0
                            }}
                            title="Pickup OTP"
                          >
                            <span style={{ fontSize: '9px', fontWeight: 900, color: 'var(--muted)' }}>OTP</span>
                            <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--ink)' }}>{cardOtp}</span>
                          </div>

                          {badge && (
                            <div
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                borderRadius: '12px',
                                padding: '5.5px 11px',
                                fontSize: '11px',
                                fontWeight: 900,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                flexShrink: 0,
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                              }}
                            >
                              <span
                                style={{
                                  width: '5px',
                                  height: '5px',
                                  borderRadius: '50%',
                                  background: '#FFFFFF',
                                  animation: 'pulse-dot 1.5s infinite'
                                }}
                              />
                              <span>{badge.text}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expandable Section: Map Integration & 3 Actions (Track, Share, Cancel) with Apple-Style Physics Spring Animation */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key={`expanded-content-${trip.id}`}
                        initial={{ opacity: 0, height: 0, scale: 0.985 }}
                        animate={{
                          opacity: 1,
                          height: 'auto',
                          scale: 1,
                          transition: {
                            height: { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 },
                            opacity: { duration: 0.22, ease: 'easeOut' },
                            scale: { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }
                          }
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          scale: 0.985,
                          transition: {
                            height: { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 },
                            opacity: { duration: 0.2, ease: 'easeInOut' },
                            scale: { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }
                          }
                        }}
                        style={{ overflow: 'hidden', transformOrigin: 'top center' }}
                      >
                        {isCompleted ? (
                          /* COMPLETED TRIP: Driver Rating, Review & Submit Section in same card */
                          <div style={{ padding: '0 16px 16px' }} onClick={(e) => e.stopPropagation()}>
                            {/* Trip Complete Banner */}
                            <div
                              style={{
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                borderRadius: '16px',
                                padding: '12px 14px',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                              }}
                            >
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: '#10B981',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)'
                                }}
                              >
                                <Icon name="check" size={18} style={{ color: '#FFFFFF' }} />
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <b style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--ink)', display: 'block', lineHeight: 1.25 }}>
                                  Trip Completed Successfully!
                                </b>
                                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                                  Settled Fare: <strong style={{ color: 'var(--ink)' }}>₹{fareValue}</strong> · Driver: <strong style={{ color: 'var(--ink)' }}>{driverName}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Rating & Review Box */}
                            {(trip.rating || trip.userRating || submittedReviews[trip.id]) ? (
                              <div
                                style={{
                                  background: 'var(--field)',
                                  border: '1px solid var(--line)',
                                  borderRadius: '16px',
                                  padding: '14px',
                                  textAlign: 'center',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F59E0B' }}>
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <span key={s} style={{ fontSize: '22px' }}>
                                      {s <= (trip.rating || trip.userRating || tripRatings[trip.id] || 5) ? '★' : '☆'}
                                    </span>
                                  ))}
                                </div>
                                <b style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>
                                  Thank you for rating {driverName}!
                                </b>
                                {(trip.reviewText || tripReviews[trip.id]) && (
                                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', maxWidth: '300px' }}>
                                    "{trip.reviewText || tripReviews[trip.id]}"
                                  </p>
                                )}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', width: '100%' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNativeShareTrip(trip);
                                    }}
                                    style={{
                                      flex: 1,
                                      height: '38px',
                                      borderRadius: '12px',
                                      background: 'var(--card)',
                                      border: '1.5px solid var(--line-strong)',
                                      color: 'var(--ink)',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <Icon name="share" size={13} />
                                    <span>Share Invoice</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDismissTrip(trip.id);
                                    }}
                                    style={{
                                      flex: 1,
                                      height: '38px',
                                      borderRadius: '12px',
                                      background: 'var(--solid)',
                                      border: 'none',
                                      color: 'var(--on-solid)',
                                      fontSize: '12px',
                                      fontWeight: 750,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <span>Done</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{
                                  background: 'var(--card)',
                                  border: '1.5px solid var(--line)',
                                  borderRadius: '16px',
                                  padding: '14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                                }}
                              >
                                {/* Star selector */}
                                <div style={{ textAlign: 'center' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>
                                    Rate your driver
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
                                    {[1, 2, 3, 4, 5].map((starVal) => {
                                      const active = starVal <= (tripHoverRatings[trip.id] || tripRatings[trip.id] || 0);
                                      return (
                                        <button
                                          key={starVal}
                                          type="button"
                                          onMouseEnter={() => setTripHoverRatings(prev => ({ ...prev, [trip.id]: starVal }))}
                                          onMouseLeave={() => setTripHoverRatings(prev => ({ ...prev, [trip.id]: 0 }))}
                                          onClick={() => setTripRatings(prev => ({ ...prev, [trip.id]: starVal }))}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            fontSize: '32px',
                                            lineHeight: 1,
                                            color: active ? '#F59E0B' : 'var(--line-strong, #CBD5E1)',
                                            transform: active ? 'scale(1.15)' : 'scale(1)',
                                            transition: 'all 0.15s ease'
                                          }}
                                          aria-label={`Rate ${starVal} stars`}
                                        >
                                          ★
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: (tripRatings[trip.id] || tripHoverRatings[trip.id]) ? '#D97706' : 'var(--muted)', marginTop: '4px', display: 'block' }}>
                                    {getStarRatingLabel(tripHoverRatings[trip.id] || tripRatings[trip.id] || 0)}
                                  </span>
                                </div>

                                {/* Quick feedback tags */}
                                <div>
                                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                                    Feedback tags
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {['Punctual', 'Smooth Driving', 'Clean Car', 'Polite & Helpful', 'Safe Driver'].map(tag => {
                                      const isSelected = (tripFeedbackTags[trip.id] || []).includes(tag);
                                      return (
                                        <button
                                          key={tag}
                                          type="button"
                                          onClick={() => handleToggleFeedbackTag(trip.id, tag)}
                                          style={{
                                            padding: '4px 10px',
                                            borderRadius: '999px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            border: isSelected ? '1.5px solid var(--solid)' : '1px solid var(--line)',
                                            background: isSelected ? 'var(--solid)' : 'var(--field)',
                                            color: isSelected ? 'var(--on-solid)' : 'var(--ink)',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          {tag}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Review input */}
                                <div>
                                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                                    Write a Review
                                  </span>
                                  <textarea
                                    rows={2}
                                    value={tripReviews[trip.id] || ''}
                                    onChange={(e) => setTripReviews(prev => ({ ...prev, [trip.id]: e.target.value }))}
                                    placeholder={`Share your review for ${driverName}...`}
                                    style={{
                                      width: '100%',
                                      padding: '9px 11px',
                                      borderRadius: '12px',
                                      background: 'var(--field)',
                                      border: '1.5px solid var(--line)',
                                      color: 'var(--ink)',
                                      fontSize: '12.5px',
                                      outline: 'none',
                                      fontFamily: 'inherit',
                                      resize: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>

                                {/* Submit review button */}
                                <button
                                  type="button"
                                  disabled={!(tripRatings[trip.id] > 0)}
                                  onClick={() => handleSubmitCardRating(trip)}
                                  style={{
                                    width: '100%',
                                    height: '42px',
                                    borderRadius: '12px',
                                    background: tripRatings[trip.id] > 0 ? 'var(--solid)' : 'var(--line)',
                                    color: tripRatings[trip.id] > 0 ? 'var(--on-solid)' : 'var(--muted)',
                                    border: 'none',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    cursor: tripRatings[trip.id] > 0 ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '7px',
                                    boxShadow: tripRatings[trip.id] > 0 ? '0 4px 14px rgba(0,0,0,0.18)' : 'none',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <Icon name="check" size={15} />
                                  <span>Submit Review</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Map integration on the card for tracking driver */}
                            <div
                              style={{
                                height: '145px',
                                margin: '0 16px 12px',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                position: 'relative',
                                border: '1px solid var(--line)'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTrackingModal(trip, e);
                              }}
                            >
                              <GraphicLiveMap
                                trip={trip}
                                isModal={false}
                                height={145}
                                onOpenModal={() => handleOpenTrackingModal(trip)}
                              />
                            </div>

                            {/* Action Buttons: 2 equal buttons on Live Trips (Track & Share); 3 buttons on Upcoming Trips (Track, Share & Cancel) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px 14px' }}>
                              {/* 1. Track Button with proper padding space and text alignment */}
                              <button
                                type="button"
                                onClick={(e) => handleOpenTrackingModal(trip, e)}
                                style={{
                                  flex: isLive ? 1 : 1.35,
                                  height: '42px',
                                  padding: '0 14px',
                                  borderRadius: '12px',
                                  background: 'var(--solid)',
                                  color: 'var(--on-solid)',
                                  border: 'none',
                                  fontSize: '12.5px',
                                  fontWeight: 750,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '7px',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
                                  transition: 'transform 0.15s ease'
                                }}
                              >
                                <Icon name="navigation" size={14} style={{ color: 'var(--on-solid)', flexShrink: 0 }} />
                                <span style={{ whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                                  {isLive ? 'Track Live Trip' : 'Track Driver'}
                                </span>
                              </button>

                              {/* 2. Share Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNativeShareTrip(trip);
                                }}
                                style={{
                                  flex: isLive ? 1 : 0.9,
                                  height: '42px',
                                  padding: '0 12px',
                                  borderRadius: '12px',
                                  background: 'var(--card)',
                                  color: 'var(--ink)',
                                  border: '1.5px solid var(--line-strong)',
                                  fontSize: '12.5px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
                                }}
                              >
                                <Icon name="share" size={14} style={{ color: 'var(--ink)', flexShrink: 0 }} />
                                <span>Share</span>
                              </button>

                              {/* 3. Cancel Button - ONLY on Upcoming Trips, NOT on Live Trips */}
                              {!isLive && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelRequest(trip);
                                  }}
                                  style={{
                                    height: '42px',
                                    padding: '0 12px',
                                    borderRadius: '12px',
                                    background: '#EF4444',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.28)'
                                  }}
                                >
                                  <Icon name="x" size={13} style={{ color: '#FFFFFF', flexShrink: 0 }} />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Hairline Divider */}
                  <div style={{ height: '1px', background: 'var(--line)', margin: '0 18px' }} />

                  {/* Lower Section: 3-line info, Share Button & Expand Indicator Arrow (Inverts to Top) */}
                  <div style={{ padding: '13px 18px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2.5px' }}>
                      {/* Line 1: Schedule / Status */}
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: isCompleted ? '#10B981' : 'var(--ink)' }}>
                        {isCompleted ? '✓ Trip Completed · Paid & Settled' : isLive ? 'Live Trip In Progress · En Route' : dateTimeDisplay}
                      </span>

                      {/* Line 2: Driver & Fare */}
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                        {trip.status === 'requested' ? 'Finding Driver' : `Driver: ${driverName}`} · ₹{fareValue}
                      </span>

                      {/* Line 3: Location */}
                      <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%' }} title={`${trip.pickup} → ${trip.drop_loc}`}>
                        {fromLocation} → {toLocation}
                      </span>
                    </div>

                    {/* Actions: Share icon button + Circular expand arrow that inverts to top and minimizes on click */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {/* Share Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNativeShareTrip(trip);
                        }}
                        title="Share Trip Details"
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: 'var(--field)',
                          border: '1.5px solid var(--line-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--ink)',
                          cursor: 'pointer'
                        }}
                      >
                        <Icon name="share" size={15} />
                      </button>

                      {/* Circular Expand/Collapse Arrow: Inverts to Top on Expansion; Clicking Minimizes Card */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleExpand(trip.id, e)}
                        aria-label={isExpanded ? 'Minimize trip card' : 'Expand trip card'}
                        title={isExpanded ? 'Click to minimize' : 'Click to expand'}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: 'var(--field)',
                          border: '1.5px solid var(--line-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--ink)',
                          cursor: 'pointer',
                          padding: 0,
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        {/* Chevron pointing down, inverted to top when expanded */}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );

              // Live trip gets the moving neon green border wrapper with stable DOM hierarchy
              if (isLive) {
                return (
                  <div
                    key={trip.id}
                    className={`live-trip-glow-wrap ${isExpanded ? 'is-expanded' : 'is-minimized'}`}
                    style={{ marginBottom: '0' }}
                  >
                    <div className="live-trip-glow-inner">
                      {cardContent}
                    </div>
                  </div>
                );
              }

              return (
                <div key={trip.id} style={{ marginBottom: '0' }}>
                  {cardContent}
                </div>
              );
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* CATEGORY 1: LIVE TRIP */}
                {liveTrips.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.25)', animation: 'pulse-dot 1.5s infinite' }} />
                        <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink)' }}>
                          Live Trip
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '2px 8px', borderRadius: '999px' }}>
                        GPS Tracking Active
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {liveTrips.map(renderTripCard)}
                    </div>
                  </div>
                )}

                {/* CATEGORY 2: UPCOMING TRIPS */}
                {upcomingTrips.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444' }} />
                        <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink)' }}>
                          Upcoming Trips
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '1.5px 7px',
                            borderRadius: '999px',
                            background: 'var(--solid)',
                            color: 'var(--on-solid)'
                          }}
                        >
                          {upcomingTrips.length}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {upcomingTrips.map(renderTripCard)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}



      {/* Popular Destinations Quick Book - CURATED SWIPE SECTION */}
      <div className="sec stagger-5" style={{ marginTop: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, lineHeight: 1.2 }}>Popular destinations</h3>
        <button
          type="button"
          onClick={() => setDestinationsModalOpen(true)}
          style={{
            background: 'rgba(217, 119, 6, 0.08)',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--yellow-dark, #D97706)',
            fontWeight: 650,
            fontSize: '11.5px',
            cursor: 'pointer'
          }}
        >
          <span>See all ({POPULAR_DESTINATIONS.length})</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      <div
        className="stagger-5"
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '4px',
          marginBottom: '22px',
          marginLeft: '-4px',
          marginRight: '-4px',
          paddingLeft: '4px',
          paddingRight: '4px'
        }}
      >
        {POPULAR_DESTINATIONS.filter((d) => d.featured).map((item) => (
          <div
            key={item.id}
            onClick={() => openBooking(item.bookingCat || 'outstation', item)}
            style={{
              width: '136px',
              height: '112px',
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
              transition: 'transform 0.18s ease'
            }}
          >
            <img
              src={item.img}
              alt={item.name}
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />
            {/* Top Type Pill */}
            <div
              style={{
                position: 'absolute',
                top: '6px',
                left: '6px',
                background: 'rgba(15, 23, 42, 0.78)',
                backdropFilter: 'blur(3px)',
                borderRadius: '999px',
                padding: '2px 6px',
                color: '#FFFFFF',
                fontSize: '8.5px',
                fontWeight: 650,
                letterSpacing: '0.2px'
              }}
            >
              {item.type || item.state}
            </div>

            {/* Gradient Overlay & Text (Only Location Name) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.18) 60%, transparent 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '8px 10px'
              }}
            >
              <b style={{ fontSize: '12.5px', fontWeight: 650, color: '#FFFFFF', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                {item.name}
              </b>
            </div>
          </div>
        ))}
      </div>

      {/* Customer Reviews Section */}
      <div className="sec" style={{ marginTop: '24px' }}>
        <div>
          <h3 style={{ margin: 0, lineHeight: 1.2 }}>Keys in good hands</h3>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Verified stories from car owners</span>
        </div>
        <span
          className="pill"
          style={{
            background: 'var(--yellow)',
            color: '#000000',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '999px',
            boxShadow: '0 2px 10px rgba(255, 199, 10, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          4.9 Rating
        </span>
      </div>

      {/* Review Cards: Manual Horizontal Swipe Testimonial Slider */}
      <div
        ref={reviewsSliderRef}
        className="reviews-slider"
        role="region"
        aria-label="Customer Testimonials"
        onMouseDown={handleReviewsMouseDown}
        onMouseMove={handleReviewsMouseMove}
        onMouseUp={handleReviewsMouseUp}
        onMouseLeave={handleReviewsMouseLeave}
      >
        {REVIEWS.map((r, i) => (
          <div key={i} className="review-card">
            <div className="review-top">
              <div className="review-av">{r.init}</div>
              <div className="review-meta">
                <div className="review-name-row">
                  <b className="review-name">{r.name}</b>
                  <span className="review-check" title="Verified Owner">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                </div>
                <span className="review-car">{r.car}</span>
              </div>
              <div className="review-stars">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--yellow)' }}>
                  <path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z" />
                </svg>
                <span>5.0</span>
              </div>
            </div>
            <p className="review-quote">“{r.quote}”</p>
          </div>
        ))}
      </div>

      {/* Consistent bottom spacing without excess void */}
      <div style={{ height: '8px', width: '100%', flexShrink: 0 }} aria-hidden="true" />
      </div>

      {/* Map Picker Modal */}
      <MapPickerModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        onSelect={handleMapPick}
        targetField={homeMapTarget || 'drop'}
        initialCoords={homeMapTarget === 'pickup' ? homePickupCoords : homeDropCoords}
      />

      {/* Trip Ticket Modal */}
      {ticketModalTrip && (
        <TripTicketModal
          trip={ticketModalTrip}
          isOpen={Boolean(ticketModalTrip)}
          onClose={() => setTicketModalTrip(null)}
          addToast={addToast}
        />
      )}

      {/* Popular Destinations Full Grid Modal */}
      <PopularDestinationsModal
        isOpen={destinationsModalOpen}
        onClose={() => setDestinationsModalOpen(false)}
        onSelectDestination={(cat, dest) => {
          setDestinationsModalOpen(false);
          openBooking(cat, dest);
        }}
      />

      {/* Add / Edit Location Popup Window with Save & Cancel Buttons */}
      {addLocationModalType && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '16px'
          }}
          onClick={handleCancelAddLocation}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '26px',
              padding: '24px 20px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 24px 50px -12px rgba(0, 0, 0, 0.28)',
              position: 'relative',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: addLocationModalType === 'saved' ? '#FEF3C7' : '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: addLocationModalType === 'saved' ? '#EAB308' : '#0F172A',
                flexShrink: 0
              }}>
                {addLocationModalType === 'home' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
                {addLocationModalType === 'work' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                )}
                {addLocationModalType === 'saved' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#EAB308">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                  {addLocationModalType === 'home' ? 'Add Home Location' : addLocationModalType === 'work' ? 'Add Work Location' : 'Add Saved Place'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748B' }}>
                  Save address for quick 1-tap bookings
                </p>
              </div>
            </div>

            {/* Input & Autocomplete */}
            <div style={{ position: 'relative', marginBottom: '18px' }}>
              <input
                type="text"
                value={addLocationInput}
                onChange={(e) => handleAddLocationInputChange(e.target.value)}
                placeholder={addLocationModalType === 'home' ? 'e.g. Indiranagar 100ft Road, Bengaluru' : addLocationModalType === 'work' ? 'e.g. Cyberpark, Kozhikode' : 'e.g. City Center Mall, MG Road'}
                autoFocus
                style={{
                  width: '100%',
                  background: '#F8FAFC',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  fontSize: '14.5px',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />

              {/* Suggestions Dropdown */}
              {addLocationSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
                  zIndex: 10,
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {addLocationSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        const fullText = item.title + (item.sub ? ', ' + item.sub : '');
                        setAddLocationInput(fullText);
                        setAddLocationSuggestions([]);
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        fontSize: '13.5px',
                        color: '#0F172A'
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.title}</div>
                      {item.sub && <div style={{ fontSize: '11.5px', color: '#64748B' }}>{item.sub}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons: Save and Cancel */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelAddLocation}
                style={{
                  padding: '10px 20px',
                  borderRadius: '999px',
                  border: '1.5px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLocation}
                style={{
                  padding: '10px 24px',
                  borderRadius: '999px',
                  border: 'none',
                  background: '#061B16',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(6, 27, 22, 0.28)',
                  transition: 'transform 0.15s ease'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
