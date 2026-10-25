import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';
import MapPickerModal from './MapPickerModal';
import { getDeviceLocation, getCachedDeviceLocation } from '../lib/deviceLocation';
import { searchPlaces } from '../lib/locationService';
import { searchGooglePlaces, calculateTripRouteAndETA, fetchGoogleDistanceMatrix, geocodeAddress, fetchPlaceDetails, initGooglePlacesAutocomplete, formatDurationMeasurement, cleanPlusCode, fetchNearestLandmarkByCoordinates, getPlaceDetailsOnMarkerPlaced } from '../services/googleMapsService';
import { openPhonePeCheckout } from '../utils/phonepe';
import { POPULAR_DESTINATIONS } from '../data/popularDestinations';
import darkMapImg from '../assets/dark_mode_city_map.png';
import lightMapImg from '../assets/minimalist_aerial_city_map.png';
import darkGraphicMapImg from '../assets/graphic_map_bg_dark.jpg';
import lightGraphicMapImg from '../assets/graphic_map_bg_light.jpg';

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
  hourly: { name: 'Hourly', icon: 'clock', unit: 'hr', units: 'hours', min: 2, max: 12, def: 3, rate: 250 },
  daily: { name: 'Full day', icon: 'sun', unit: 'day', units: 'days', min: 1, max: 7, def: 1, rate: 1800 },
  airport: { name: 'Airport', icon: 'plane', flat: 900 },
  outstation: { name: 'Outstation', icon: 'route', unit: 'day', units: 'days', min: 1, max: 10, def: 2, rate: 2200 },
  event: { name: 'Night & events', icon: 'moon', unit: 'hr', units: 'hours', min: 4, max: 10, def: 4, rate: 350 }
};

const CAT_KEYS = ['hourly', 'daily', 'airport', 'outstation', 'event'];

// Dynamic date & time helpers
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

const getShortMapLocation = (val, fallback = '') => {
  const str = (val && typeof val === 'string' && val.trim()) ? val.trim() : fallback;
  if (!str) return '';
  // 1. Take only the portion before the first comma
  const beforeComma = str.split(',')[0].trim();
  // 2. Limit to at most 2 words
  const words = beforeComma.split(/\s+/).filter(Boolean);
  if (words.length > 2) {
    return words.slice(0, 2).join(' ');
  }
  return beforeComma;
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
  return `${monthName} ${parts[2]}`;
};

export default function BookingSheet() {
  const {
    bookingOpen,
    setBookingOpen,
    bookingCategory,
    setBookingCategory,
    bookingDestination,
    setBookingDestination,
    bookingPickup,
    setBookingPickup,
    bookingPickupCoords,
    setBookingPickupCoords,
    bookingDropCoords,
    setBookingDropCoords,
    bookingDate,
    setBookingDate,
    bookingTime,
    setBookingTime,
    user,
    userBalance,
    setUtx,
    bookRide,
    addToast,
    trips,
    isUserTrip,
    setActiveTrackingTripId,
    setLiveTrackingOpen,
    setTermsConfirmationBanner,
    theme
  } = useApp();

  const activeOngoingTrip = (trips || []).find(t =>
    isUserTrip(t, user) &&
    ['requested', 'accepted', 'pickup_arrived', 'ready_to_start', 'inprogress'].includes(t.status)
  );

  const [cat, setCat] = useState('hourly');
  const [qty, setQty] = useState(3);
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayISO);
  const [selectedTime, setSelectedTime] = useState(getDefaultTime);
  const [trans, setTrans] = useState(null); // No default selection for gearbox
  const isDateManuallySelectedRef = useRef(false);
  const isTimeManuallySelectedRef = useRef(false);
  const [airportType, setAirportType] = useState('pickup'); // 'pickup' | 'drop'
  const [flightNo, setFlightNo] = useState('');
  const [driverEarlyBuffer, setDriverEarlyBuffer] = useState('30m'); // '15m' | '30m' | '45m' | 'exact'
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedTrip, setConfirmedTrip] = useState(null);
  const [hasReviewedTerms, setHasReviewedTerms] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isShakingTerms, setIsShakingTerms] = useState(false);
  const [shakingLocationField, setShakingLocationField] = useState(null); // 'pickup' | 'drop' | null
  // Sequential Animation & Scroll Expand States
  const [animPickupPin, setAnimPickupPin] = useState(false);
  const [animPickupBox, setAnimPickupBox] = useState(false);
  const [animTrail, setAnimTrail] = useState(false);
  const [animDropPin, setAnimDropPin] = useState(false);
  const [animDropBox, setAnimDropBox] = useState(false);
  const [showPopupSheet, setShowPopupSheet] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isScrollReady, setIsScrollReady] = useState(false);
  const animTimersRef = useRef([]);

  const clearAnimTimers = () => {
    animTimersRef.current.forEach(t => clearTimeout(t));
    animTimersRef.current = [];
  };

  // Initial Load Sequential Pin Flow (pickup pin -> pickup box -> route trail -> destination pin -> destination box)
  const playForwardSequence = () => {
    clearAnimTimers();
    setAnimPickupPin(false);
    setAnimPickupBox(false);
    setAnimTrail(false);
    setAnimDropPin(false);
    setAnimDropBox(false);

    // Step 1: Pickup pin (120ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimPickupPin(true);
    }, 120));

    // Step 2: Pickup text box (280ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimPickupBox(true);
    }, 280));

    // Step 3: Route trail & popup sheet slide up (420ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimTrail(true);
      setShowPopupSheet(true);
    }, 420));

    // Step 4: Destination pin bounces into view (560ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimDropPin(true);
    }, 560));

    // Step 5: Destination text box (720ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimDropBox(true);
    }, 720));
  };

  // Sequential Pin & Text Box bounce animation during sheet minimization (matches page open flow)
  const playMinimizingPinSequence = () => {
    clearAnimTimers();
    setAnimPickupPin(false);
    setAnimPickupBox(false);
    setAnimTrail(false);
    setAnimDropPin(false);
    setAnimDropBox(false);

    // Step 1: Pickup pin bounces in as sheet slides down (60ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimPickupPin(true);
    }, 60));

    // Step 2: Pickup text box callout bounces in milliseconds later (180ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimPickupBox(true);
    }, 180));

    // Step 3: Route trail line reveals (280ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimTrail(true);
    }, 280));

    // Step 4: Destination pin bounces into view milliseconds later (400ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimDropPin(true);
    }, 400));

    // Step 5: Destination text box callout bounces in milliseconds later (520ms)
    animTimersRef.current.push(setTimeout(() => {
      setAnimDropBox(true);
    }, 520));
  };

  const fullscreenViewRef = useRef(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalGestureRef = useRef(false);
  const currentDragProgressRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const isTransitioningRef = useRef(false);

  const applyDragProgress = (progress) => {
    currentDragProgressRef.current = progress;
    if (fullscreenViewRef.current) {
      fullscreenViewRef.current.style.setProperty('--drag-progress', progress.toFixed(4));
    }
  };

  // Clean, continuous slide expand & minimize functions (pure ease-in-out, zero vibration)
  const expandSheet = () => {
    if (isTransitioningRef.current || isSheetExpanded) return;
    isTransitioningRef.current = true;
    setIsSheetExpanded(true);
    setIsDragging(false);
    applyDragProgress(1);

    // Content scrolling is strictly unlocked ONLY after sheet fully expands to full screen
    setTimeout(() => {
      setIsScrollReady(true);
      isTransitioningRef.current = false;
    }, 420);
  };

  const minimizeSheet = () => {
    if (isTransitioningRef.current || !isSheetExpanded) return;
    isTransitioningRef.current = true;
    // Immediately lock content scrolling so the content stays fixed at top during slide down
    setIsScrollReady(false);
    setIsSheetExpanded(false);
    setIsDragging(false);
    applyDragProgress(0);

    // Replay sequential pin and text box bounce animation during minimization
    playMinimizingPinSequence();

    // CRITICAL: Only reset scrollTop AFTER slide down animation has completed!
    // This prevents content jumping or frame drop during minimization.
    setTimeout(() => {
      if (scrollBodyRef.current) {
        scrollBodyRef.current.scrollTop = 0;
      }
      isTransitioningRef.current = false;
    }, 420);
  };

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (theme === 'dark') {
      setIsDarkMode(true);
    } else if (theme === 'light') {
      setIsDarkMode(false);
    }
    const checkTheme = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDarkMode(dark);
    };
    const observer = new MutationObserver(checkTheme);
    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    return () => observer.disconnect();
  }, [theme]);

  const termsSectionRef = useRef(null);
  const scrollBodyRef = useRef(null);
  const isTopEdgeDragRef = useRef(false);

  const isInteractiveElement = (target) => {
    return Boolean(
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('.bk-trip-type-pill-btn') ||
      target.closest('.bk-ref-trip-pill') ||
      target.closest('.home-date-card-3col') ||
      target.closest('.bk-date-card') ||
      target.closest('.bk-date-nav-btn') ||
      target.closest('.bk-date-month-pill') ||
      target.closest('.bk-date-strip') ||
      target.closest('.bk-gearbox-pill-btn') ||
      target.closest('.bk-ref-gearbox-card') ||
      target.closest('.bk-ref-flight-input-tab') ||
      target.closest('.bk-ref-pay-capsule') ||
      target.closest('.bk-map-round-btn') ||
      target.closest('.bk-route-card') ||
      target.closest('.location-suggest-dropdown') ||
      target.closest('.loc-suggest-item') ||
      target.closest('.bk-map-pin-callout') ||
      target.closest('.bk-map-pin-pickup') ||
      target.closest('.bk-map-pin-drop')
    );
  };

  // Two-stage Bottom Sheet Gestures: Pointer Drag linked directly to expansion & button fade-out
  const handleSheetPointerDown = (e) => {
    if (isTransitioningRef.current) return;
    if (isInteractiveElement(e.target)) return;

    const clientY = e.clientY;
    const clientX = e.clientX;
    const isTopEdge = clientY <= 130 ||
      Boolean(e.target.closest('.bk-map-top-bar'));

    if (isSheetExpanded) {
      if (isTopEdge) {
        isTopEdgeDragRef.current = true;
      } else {
        isTopEdgeDragRef.current = false;
        if (scrollBodyRef.current && scrollBodyRef.current.scrollTop > 4) {
          return;
        }
      }
    } else {
      isTopEdgeDragRef.current = false;
    }

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    dragStartTimeRef.current = performance.now();
    isDraggingRef.current = true;
    isHorizontalGestureRef.current = false;
    currentDragProgressRef.current = isSheetExpanded ? 1 : 0;
  };

  const handleSheetPointerMove = (e) => {
    if (!isDraggingRef.current || isTransitioningRef.current) return;

    const deltaX = Math.abs(e.clientX - dragStartXRef.current);
    const deltaY = e.clientY - dragStartYRef.current;

    // Strict: Disallow horizontal drag. If drag has more horizontal movement than vertical, lock and ignore
    if (isHorizontalGestureRef.current || (deltaX > Math.abs(deltaY) && deltaX > 6)) {
      isHorizontalGestureRef.current = true;
      return;
    }

    // In Stage 2: if user moves upwards, ignore and let normal scrolling handle it
    if (isSheetExpanded && deltaY < 0) {
      return;
    }

    // In Stage 1: if user moves downwards, ignore
    if (!isSheetExpanded && deltaY > 0) {
      return;
    }

    const maxTravel = Math.max(window.innerHeight * 0.33, 190);
    let progress = isSheetExpanded ? 1 - (deltaY / maxTravel) : (-deltaY / maxTravel);
    progress = Math.max(0, Math.min(1, progress));

    if (!isDragging && Math.abs(deltaY) > 2) {
      setIsDragging(true);
    }

    applyDragProgress(progress);
  };

  const handleSheetPointerUp = (e) => {
    if (e.pointerId) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (isHorizontalGestureRef.current) {
      isHorizontalGestureRef.current = false;
      applyDragProgress(isSheetExpanded ? 1 : 0);
      return;
    }

    const deltaY = e.clientY - dragStartYRef.current;
    const deltaTime = Math.max(performance.now() - dragStartTimeRef.current, 1);
    const velocityY = deltaY / deltaTime; // px per ms

    const currentProg = currentDragProgressRef.current;
    const wasTopEdge = isTopEdgeDragRef.current;
    isTopEdgeDragRef.current = false;

    if (!isSheetExpanded) {
      // Swiping up to expand: fluid drag threshold
      if (currentProg > 0.18 || velocityY < -0.25 || deltaY < -30) {
        expandSheet();
      } else {
        applyDragProgress(0);
      }
    } else {
      // Swiping down to minimize from expanded sheet:
      const shouldMinimize = wasTopEdge
        ? (deltaY >= 15 || velocityY > 0.12 || currentProg < 0.95)
        : (deltaY >= 25 || velocityY > 0.18 || currentProg < 0.90);

      if (shouldMinimize) {
        minimizeSheet();
      } else {
        applyDragProgress(1);
      }
    }
  };

  const handleSheetTouchStart = (e) => {
    if (isTransitioningRef.current || !e.touches || !e.touches[0]) return;
    if (isInteractiveElement(e.target)) return;

    const clientY = e.touches[0].clientY;
    const clientX = e.touches[0].clientX;
    const isTopEdge = clientY <= 130 ||
      Boolean(e.target.closest('.bk-map-top-bar'));

    if (isSheetExpanded) {
      if (isTopEdge) {
        isTopEdgeDragRef.current = true;
      } else {
        isTopEdgeDragRef.current = false;
        if (scrollBodyRef.current && scrollBodyRef.current.scrollTop > 4) {
          return;
        }
      }
    } else {
      isTopEdgeDragRef.current = false;
    }

    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    dragStartTimeRef.current = performance.now();
    isDraggingRef.current = true;
    isHorizontalGestureRef.current = false;
    currentDragProgressRef.current = isSheetExpanded ? 1 : 0;
  };

  const handleSheetTouchMove = (e) => {
    if (!isDraggingRef.current || isTransitioningRef.current || !e.touches || !e.touches[0]) return;

    const deltaX = Math.abs(e.touches[0].clientX - dragStartXRef.current);
    const deltaY = e.touches[0].clientY - dragStartYRef.current;

    // Strict: Disallow horizontal drag. If drag has more horizontal movement than vertical, lock and ignore
    if (isHorizontalGestureRef.current || (deltaX > Math.abs(deltaY) && deltaX > 6)) {
      isHorizontalGestureRef.current = true;
      return;
    }

    if (isSheetExpanded && deltaY < 0) return;
    if (!isSheetExpanded && deltaY > 0) return;

    if (isSheetExpanded && isTopEdgeDragRef.current && deltaY > 0) {
      if (e.cancelable) e.preventDefault();
    }

    const maxTravel = Math.max(window.innerHeight * 0.33, 190);
    let progress = isSheetExpanded ? 1 - (deltaY / maxTravel) : (-deltaY / maxTravel);
    progress = Math.max(0, Math.min(1, progress));

    if (!isDragging && Math.abs(deltaY) > 2) {
      setIsDragging(true);
    }

    applyDragProgress(progress);
  };

  const handleSheetTouchEnd = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (isHorizontalGestureRef.current) {
      isHorizontalGestureRef.current = false;
      applyDragProgress(isSheetExpanded ? 1 : 0);
      return;
    }

    const clientY = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : dragStartYRef.current;
    const deltaY = clientY - dragStartYRef.current;
    const deltaTime = Math.max(performance.now() - dragStartTimeRef.current, 1);
    const velocityY = deltaY / deltaTime;

    const currentProg = currentDragProgressRef.current;
    const wasTopEdge = isTopEdgeDragRef.current;
    isTopEdgeDragRef.current = false;

    if (!isSheetExpanded) {
      if (currentProg > 0.18 || velocityY < -0.25 || deltaY < -30) {
        expandSheet();
      } else {
        applyDragProgress(0);
      }
    } else {
      const shouldMinimize = wasTopEdge
        ? (deltaY >= 15 || velocityY > 0.12 || currentProg < 0.95)
        : (deltaY >= 25 || velocityY > 0.18 || currentProg < 0.90);

      if (shouldMinimize) {
        minimizeSheet();
      } else {
        applyDragProgress(1);
      }
    }
  };

  // Monitor theme changes for dynamic light / dark graphic map
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const triggerWaitingSectionShake = () => {
    // 1. Light tactile vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([35, 45, 35]);
      } catch (_) {}
    }
    // 2. Trigger subtle shake animation
    setIsShakingTerms(true);
    setTimeout(() => {
      setIsShakingTerms(false);
    }, 550);
    // 3. Smooth scroll into view
    if (termsSectionRef.current) {
      termsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (addToast) addToast('Please review waiting charges & additional trip policy before paying.', 'info');
  };

  const triggerLocationShake = (field) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([35, 45, 35]);
      } catch (_) {}
    }
    setShakingLocationField(field);
    setTimeout(() => {
      setShakingLocationField(null);
    }, 550);

    if (field === 'pickup') {
      if (pickupInputRef.current) {
        pickupInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pickupInputRef.current.focus();
      }
      if (addToast) addToast('Please enter your pickup location (From) before paying.', 'alert');
    } else if (field === 'drop') {
      if (dropInputRef.current) {
        dropInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dropInputRef.current.focus();
      }
      if (addToast) addToast('Please enter your destination location (To) before paying.', 'alert');
    }
  };

  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState('drop');
  const [isDetectingCurrent, setIsDetectingCurrent] = useState(false);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [activeSuggestField, setActiveSuggestField] = useState(null); // 'pickup' | 'drop' | null
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords, setDropCoords] = useState(null);
  const [pickupDetails, setPickupDetails] = useState(null);
  const [dropDetails, setDropDetails] = useState(null);
  const pickupInputRef = useRef(null);
  const dropInputRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const searchSeqRef = useRef(0);
  const [tripTelemetry, setTripTelemetry] = useState({
    distanceKm: null,
    distanceText: '--',
    durationMins: null,
    durationText: '--',
    etaText: '--',
    isCalculated: false
  });

  // Dynamically calculate Google Maps real trip distance and estimated time (ETA)
  // ONLY calculates when BOTH pickup and destination are selected with coordinates (from list, GPS, or map).
  // If user only types arbitrary text (e.g. 'kallachi') without picking from suggestions, it will NOT calculate (shows '--').
  useEffect(() => {
    let isCancelled = false;
    const pText = pickup?.trim();
    const dText = drop?.trim();

    if (!pText || !dText) {
      setTripTelemetry({
        distanceKm: null,
        distanceText: '--',
        durationMins: null,
        durationText: '--',
        etaText: '--',
        isCalculated: false
      });
      return;
    }

    const calculateRoute = async () => {
      try {
        let pCoords = pickupCoords;
        let dCoords = dropCoords;

        // Automatically resolve genuine Google coordinates if either coordinate is not yet set
        if (!pCoords?.lat && pText) {
          const resolvedP = await geocodeAddress(pText);
          if (resolvedP?.lat) {
            pCoords = resolvedP;
            if (!isCancelled) {
              setPickupCoords(resolvedP);
              setPickupDetails(resolvedP);
            }
          }
        }

        if (!dCoords?.lat && dText) {
          const resolvedD = await geocodeAddress(dText);
          if (resolvedD?.lat) {
            dCoords = resolvedD;
            if (!isCancelled) {
              setDropCoords(resolvedD);
              setDropDetails(resolvedD);
            }
          }
        }

        if (!pCoords?.lat || !dCoords?.lat) return;

        // 1. Google Maps Distance Matrix API: Real-time driving distance and duration
        const matrixRes = await fetchGoogleDistanceMatrix({
          origin: pText,
          destination: dText,
          originCoords: pCoords,
          destCoords: dCoords
        });
        if (!isCancelled && matrixRes) {
          setTripTelemetry({
            ...matrixRes,
            isCalculated: true
          });
          return;
        }
      } catch (matrixErr) {
        console.warn('[BookingSheet] Distance Matrix API error, trying route calculation:', matrixErr);
      }

      try {
        const res = await calculateTripRouteAndETA({
          origin: pText,
          destination: dText,
          originCoords: pickupCoords,
          destCoords: dropCoords
        });
        if (!isCancelled && res) {
          setTripTelemetry({
            ...res,
            isCalculated: true
          });
        }
      } catch (e) {
        console.warn('Route telemetry error:', e);
      }
    };

    const isFast = Boolean(pickupCoords && dropCoords);
    const timer = setTimeout(calculateRoute, isFast ? 50 : 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [pickup, drop, pickupCoords, dropCoords]);

  // Unified Place Selection Handler: Extracts full address details and populates fields automatically
  const handleSelectPickupPlace = async (item) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setActiveSuggestField(null);
    setPickupSuggestions([]);

    const rawChosen = item.full || (item.title + (item.sub ? `, ${item.sub}` : ''));
    const chosen = cleanPlusCode(rawChosen);
    setPickup(chosen);

    if (item.place_id && !item.isMock) {
      try {
        const details = await fetchPlaceDetails(item.place_id);
        if (details?.lat && details?.lng) {
          const coords = {
            lat: Number(details.lat),
            lng: Number(details.lng),
            name: cleanPlusCode(details.name) || item.title,
            formatted: cleanPlusCode(details.formatted_address || chosen),
            city: details.city || '',
            state: details.state || '',
            postalCode: details.postalCode || '',
            source: 'google'
          };
          setPickupCoords(coords);
          setPickupDetails(details);
          addToast(`Pickup confirmed: ${details.name || details.city || item.title}`, 'pin');
          return;
        }
      } catch (err) {
        console.warn('Place details error:', err);
      }
    }

    // Always prioritize Google geocodeAddress (Google Places searchText) for genuine coordinates
    try {
      const coords = await geocodeAddress(chosen);
      if (coords && coords.lat && coords.lng) {
        const cObj = { ...coords, name: cleanPlusCode(item.title), formatted: chosen, source: 'google' };
        setPickupCoords(cObj);
        setPickupDetails(cObj);
        addToast(`Pickup confirmed: ${item.title}`, 'pin');
        return;
      }
    } catch (geoErr) {
      console.warn('Pickup geocoding error:', geoErr);
    }

    if (item.lat && item.lng) {
      const coords = {
        lat: Number(item.lat),
        lng: Number(item.lng),
        name: cleanPlusCode(item.title),
        formatted: chosen,
        city: item.sub?.split(',')?.[0]?.trim() || '',
        state: 'Kerala',
        source: item.source || 'fallback'
      };
      setPickupCoords(coords);
      setPickupDetails(coords);
      addToast(`Pickup confirmed: ${item.title}`, 'pin');
    }
  };

  const handleSelectDropPlace = async (item) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setActiveSuggestField(null);
    setDropSuggestions([]);

    const rawChosen = item.full || (item.title + (item.sub ? `, ${item.sub}` : ''));
    const chosen = cleanPlusCode(rawChosen);
    setDrop(chosen);

    if (item.place_id && !item.isMock) {
      try {
        const details = await fetchPlaceDetails(item.place_id);
        if (details?.lat && details?.lng) {
          const coords = {
            lat: Number(details.lat),
            lng: Number(details.lng),
            name: cleanPlusCode(details.name) || item.title,
            formatted: cleanPlusCode(details.formatted_address || chosen),
            city: details.city || '',
            state: details.state || '',
            postalCode: details.postalCode || '',
            source: 'google'
          };
          setDropCoords(coords);
          setDropDetails(details);
          addToast(`Destination confirmed: ${details.name || details.city || item.title}`, 'pin');
          return;
        }
      } catch (err) {
        console.warn('Place details error:', err);
      }
    }

    // Always prioritize Google geocodeAddress (Google Places searchText) for genuine coordinates
    try {
      const coords = await geocodeAddress(chosen);
      if (coords && coords.lat && coords.lng) {
        const cObj = { ...coords, name: item.title, formatted: chosen, source: 'google' };
        setDropCoords(cObj);
        setDropDetails(cObj);
        addToast(`Destination confirmed: ${item.title}`, 'pin');
        return;
      }
    } catch (geoErr) {
      console.warn('Destination geocoding error:', geoErr);
    }

    if (item.lat && item.lng) {
      const coords = {
        lat: Number(item.lat),
        lng: Number(item.lng),
        name: item.title,
        formatted: chosen,
        city: item.sub?.split(',')?.[0]?.trim() || '',
        state: 'Kerala',
        source: item.source || 'fallback'
      };
      setDropCoords(coords);
      setDropDetails(coords);
      addToast(`Destination confirmed: ${item.title}`, 'pin');
    }
  };

  const handlePickupChange = (val) => {
    setPickup(val);
    setPickupCoords(null); // Clear selection until picked from dropdown list
    setPickupDetails(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const clean = (val || '').trim();
    if (clean.length >= 1) {
      setActiveSuggestField('pickup');
      const currentSeq = ++searchSeqRef.current;
      searchDebounceRef.current = setTimeout(() => {
        searchGooglePlaces(
          clean,
          (results) => {
            if (currentSeq === searchSeqRef.current) {
              setPickupSuggestions(results || []);
            }
          },
          { userCoords: dropCoords || pickupCoords }
        );
      }, 60);
    } else {
      setPickupSuggestions([]);
      setActiveSuggestField(null);
    }
  };

  const handleDropChange = (val) => {
    setDrop(val);
    setDropCoords(null); // Clear selection until picked from dropdown list
    setDropDetails(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const clean = (val || '').trim();
    if (clean.length >= 1) {
      setActiveSuggestField('drop');
      const currentSeq = ++searchSeqRef.current;
      searchDebounceRef.current = setTimeout(() => {
        searchGooglePlaces(
          clean,
          (results) => {
            if (currentSeq === searchSeqRef.current) {
              setDropSuggestions(results || []);
            }
          },
          { userCoords: pickupCoords || dropCoords }
        );
      }, 60);
    } else {
      setDropSuggestions([]);
      setActiveSuggestField(null);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (!e.target.closest('.loc-input-wrap') && !e.target.closest('.location-suggest-dropdown')) {
        setActiveSuggestField(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Sync category with parent selection
  useEffect(() => {
    if (bookingCategory && CATS[bookingCategory]) {
      setCat(bookingCategory);
      setQty(CATS[bookingCategory].def || 1);
    }
  }, [bookingCategory, bookingOpen]);

  // Sync destination & Google Maps coordinates when selected from popular destinations, home search, or landmark
  useEffect(() => {
    if (bookingDestination) {
      let destName = '';
      let destAddress = '';
      let destLat = null;
      let destLng = null;
      let destCity = '';

      if (typeof bookingDestination === 'object' && bookingDestination !== null) {
        destName = bookingDestination.name || bookingDestination.title || '';
        destAddress = bookingDestination.destAddress || bookingDestination.address || bookingDestination.formatted || '';
        destLat = bookingDestination.lat;
        destLng = bookingDestination.lng;
        destCity = bookingDestination.city || bookingDestination.state || '';
      } else if (typeof bookingDestination === 'string') {
        destAddress = bookingDestination.trim();
        const matched = POPULAR_DESTINATIONS.find(
          d => d.destAddress === destAddress || d.name === destAddress || destAddress.toLowerCase().includes(d.name.toLowerCase())
        );
        if (matched) {
          destName = matched.name;
          destLat = matched.lat;
          destLng = matched.lng;
          destCity = matched.state || '';
        }
      }

      const displayDrop = destAddress || destName || (typeof bookingDestination === 'string' ? bookingDestination : '');
      if (displayDrop) {
        setDrop(displayDrop);
      }

      if (destLat && destLng) {
        const coords = {
          lat: Number(destLat),
          lng: Number(destLng),
          name: destName || displayDrop,
          formatted: displayDrop,
          city: destCity || 'Kerala',
          state: 'Kerala'
        };
        setDropCoords(coords);
        setDropDetails(coords);
      } else if (displayDrop) {
        // Fallback geocode to resolve exact Google Map coordinates
        geocodeAddress(displayDrop).then(coords => {
          if (coords) {
            const cObj = { ...coords, name: destName || displayDrop, formatted: displayDrop };
            setDropCoords(cObj);
            setDropDetails(cObj);
          }
        }).catch(() => {});
      }
    }
  }, [bookingDestination, bookingOpen]);

  // Reset form states when booking sheet opens - pre-fills from Home page if provided
  useEffect(() => {
    if (bookingOpen) {
      setIsSuccess(false);
      setConfirmedTrip(null);

      // Pre-fill or clean pickup location
      if (bookingPickup) {
        setPickup(bookingPickup);
        if (bookingPickupCoords) {
          setPickupCoords(bookingPickupCoords);
          setPickupDetails(bookingPickupCoords);
        }
      } else {
        setPickup('');
        setPickupCoords(null);
        setPickupDetails(null);
      }

      // Pre-fill or clean destination location
      if (!bookingDestination) {
        setDrop('');
        setDropCoords(null);
        setDropDetails(null);
      } else if (bookingDropCoords) {
        setDropCoords(bookingDropCoords);
        setDropDetails(bookingDropCoords);
      }

      // Pre-fill or reset date
      if (bookingDate) {
        setSelectedDate(bookingDate);
        isDateManuallySelectedRef.current = true;
      } else {
        setSelectedDate(getTodayISO());
        isDateManuallySelectedRef.current = false;
      }

      // Pre-fill or reset time
      if (bookingTime) {
        setSelectedTime(bookingTime);
        isTimeManuallySelectedRef.current = true;
      } else {
        setSelectedTime(getDefaultTime());
        isTimeManuallySelectedRef.current = false;
      }

      setTrans(null); // No default gearbox selection
      setFlightNo('');
      setPickupSuggestions([]);
      setDropSuggestions([]);
      setActiveSuggestField(null);
      setTripTelemetry({
        distanceKm: null,
        distanceText: '--',
        durationMins: null,
        durationText: '--',
        etaText: '--',
        isCalculated: false
      });

      // Sequential Animation Flow on Initial Load:
      setShowPopupSheet(false);
      setIsSheetExpanded(false);
      setIsScrollReady(false);
      playForwardSequence();

      return () => {
        clearAnimTimers();
      };
    } else {
      clearAnimTimers();
      setAnimPickupPin(false);
      setAnimPickupBox(false);
      setAnimTrail(false);
      setAnimDropPin(false);
      setAnimDropBox(false);
      setShowPopupSheet(false);
      setIsSheetExpanded(false);
      setIsScrollReady(false);
    }
  }, [bookingOpen]);

  const handleUseCurrentLocation = async () => {
    setIsDetectingCurrent(true);

    // Instant detection from local cache with 0ms delay
    const cached = getCachedDeviceLocation();
    if (cached && cached.address) {
      const cleanAddr = cleanPlusCode(cached.address);
      setPickup(cleanAddr);
      if (cached.lat && cached.lng) {
        const cObj = {
          lat: Number(cached.lat),
          lng: Number(cached.lng),
          name: cleanAddr.split(',')[0].trim(),
          formatted: cleanAddr,
          city: cached.city || cleanAddr.split(',')[0].trim(),
          state: 'Kerala'
        };
        setPickupCoords(cObj);
        setPickupDetails(cObj);
      }
      const short = cleanAddr.split(',')[0].trim();
      addToast(`Pickup set to device location: ${short}`, 'check');
      setIsDetectingCurrent(false);
      return;
    }

    try {
      const loc = await getDeviceLocation(false);
      if (loc && loc.address) {
        const cleanAddr = cleanPlusCode(loc.address);
        setPickup(cleanAddr);
        if (loc.lat && loc.lng) {
          const cObj = {
            lat: Number(loc.lat),
            lng: Number(loc.lng),
            name: cleanAddr.split(',')[0].trim(),
            formatted: cleanAddr,
            city: loc.city || cleanAddr.split(',')[0].trim(),
            state: 'Kerala'
          };
          setPickupCoords(cObj);
          setPickupDetails(cObj);
        }
        const short = cleanAddr.split(',')[0].trim();
        addToast(`Pickup set to device location: ${short}`, 'check');
      } else {
        addToast('Could not resolve device address', 'alert');
      }
    } catch (err) {
      console.warn('GPS location error:', err);
      addToast('GPS unavailable. Please check location permissions.', 'alert');
    } finally {
      setIsDetectingCurrent(false);
    }
  };

  const currentCat = CATS[cat] || CATS.hourly;
  const isFlat = !!currentCat.flat;

  // Fare & Advance calculation
  const fare = isFlat ? currentCat.flat : (currentCat.rate || 250) * qty;
  const adv = Math.ceil(fare * 0.3);
  const remaining = fare - adv;
  const cashbackAmount = Math.max(1, Math.round(adv * 0.05));
  const cleanBalance = Math.max(0, Number(userBalance) || 0);
  const hasSufficientWalletBal = cleanBalance >= adv;

  // Minimal Invoice Breakdown (No tax, needful info only)
  const platformFee = 40;
  const otherFee = 30; // Safety & dispatch fee
  const tripBaseFare = Math.max(0, fare - platformFee - otherFee);
  const rateDesc = isFlat
    ? 'Fixed route rate'
    : `₹${currentCat.rate || 250}/${currentCat.unit || 'hr'}`;

  const handleQtyChange = (delta) => {
    setQty(prev => {
      const next = prev + delta;
      if (next < (currentCat.min || 1)) return prev;
      if (next > (currentCat.max || 12)) return prev;
      return next;
    });
  };

  const handleTimeStep = (deltaMinutes) => {
    isTimeManuallySelectedRef.current = true;
    const parts = (selectedTime || '18:00').split(':');
    let totalMins = parseInt(parts[0] || '18', 10) * 60 + parseInt(parts[1] || '0', 10) + deltaMinutes;
    if (totalMins < 0) totalMins += 24 * 60;
    totalMins = totalMins % (24 * 60);
    const newH = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const newM = String(totalMins % 60).padStart(2, '0');
    setSelectedTime(`${newH}:${newM}`);
  };

  const handleCategorySelect = (selectedKey) => {
    setCat(selectedKey);
    setBookingCategory(selectedKey);
    const c = CATS[selectedKey];
    setQty(c.def || 1);
  };

  const handleMapSelect = (addr, details) => {
    if (mapPickerTarget === 'pickup') {
      setPickup(addr);
      if (details && details.lat && details.lng) {
        const cObj = {
          lat: Number(details.lat),
          lng: Number(details.lng),
          name: details.name || addr.split(',')[0].trim(),
          formatted: details.address || addr,
          city: details.city || addr.split(',')[0].trim(),
          state: details.state || 'Kerala',
          placeId: details.placeId || null,
          isPoi: !!details.isPoi,
          isLandmark: !!details.isLandmark
        };
        setPickupCoords(cObj);
        setPickupDetails(cObj);
      } else {
        geocodeAddress(addr).then(coords => {
          if (coords) {
            const cObj = {
              ...coords,
              name: addr.split(',')[0].trim(),
              formatted: addr,
              city: addr.split(',')[0].trim(),
              state: 'Kerala'
            };
            setPickupCoords(cObj);
            setPickupDetails(cObj);
          }
        });
      }
      const labelName = details?.name || addr.split(',')[0].trim();
      addToast(`Pickup set: ${labelName}`, 'check');
    } else {
      setDrop(addr);
      if (details && details.lat && details.lng) {
        const cObj = {
          lat: Number(details.lat),
          lng: Number(details.lng),
          name: details.name || addr.split(',')[0].trim(),
          formatted: details.address || addr,
          city: details.city || addr.split(',')[0].trim(),
          state: details.state || 'Kerala',
          placeId: details.placeId || null
        };
        setDropCoords(cObj);
        setDropDetails(cObj);
      } else {
        geocodeAddress(addr).then(coords => {
          if (coords) {
            const cObj = {
              ...coords,
              name: addr.split(',')[0].trim(),
              formatted: addr,
              city: addr.split(',')[0].trim(),
              state: 'Kerala'
            };
            setDropCoords(cObj);
            setDropDetails(cObj);
          }
        });
      }
      const labelName = details?.name || addr.split(',')[0].trim();
      addToast(`Destination set: ${labelName}`, 'check');
    }
    setMapPickerOpen(false);
  };

  const openMap = (target) => {
    setMapPickerTarget(target);
    setMapPickerOpen(true);
  };

  const todayISO = getTodayISO();
  const tomorrowISO = getTomorrowISO();
  const isToday = selectedDate === todayISO;
  const isTomorrow = selectedDate === tomorrowISO;
  const isCustomDate = !isToday && !isTomorrow;

  const dateStr = formatDateDisplay(selectedDate);
  const timeStr = formatTime12h(selectedTime);

  const addMinutesToTime = (minutes) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    setSelectedTime(`${h}:${m}`);
  };

  const dateStripRef = useRef(null);

  // Generate 60 days of selectable dates for the carousel strip
  const dateList = React.useMemo(() => {
    const list = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    for (let i = 0; i < 60; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${year}-${month}-${day}`;
      list.push({
        iso,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthYear: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
    }

    // Ensure selectedDate is included if it was picked from calendar in the future
    if (selectedDate && !list.some(item => item.iso === selectedDate)) {
      const parts = selectedDate.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      list.push({
        iso: selectedDate,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthYear: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
      list.sort((a, b) => a.iso.localeCompare(b.iso));
    }

    return list;
  }, [selectedDate]);

  // Current Month-Year label for the pill button (e.g., "Oct 2026")
  const currentMonthYearLabel = React.useMemo(() => {
    if (!selectedDate) return 'Select Date';
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [selectedDate]);

  const scrollDateStrip = (direction) => {
    if (!dateStripRef.current) return;
    const scrollAmount = direction === 'left' ? -220 : 220;
    dateStripRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  // Auto-scroll the date card into view when selected
  useEffect(() => {
    if (dateStripRef.current && selectedDate) {
      const activeEl = dateStripRef.current.querySelector(`[data-date="${selectedDate}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDate]);

  // Live background auto-update: Keeps default date and time fresh every minute/day
  // If the user manually picks a date or time, it locks their choice and does NOT auto-change
  useEffect(() => {
    const syncLiveDateAndTime = () => {
      // 1. Live Date sync (resets when day changes if user has not picked a date manually)
      if (!isDateManuallySelectedRef.current) {
        const liveToday = getTodayISO();
        setSelectedDate(prev => (prev !== liveToday ? liveToday : prev));
      }

      // 2. Live Time sync (updates every minute to the current rounded 15-min slot if user has not picked time manually)
      if (!isTimeManuallySelectedRef.current) {
        const liveDefaultTime = getDefaultTime();
        setSelectedTime(prev => (prev !== liveDefaultTime ? liveDefaultTime : prev));
      }
    };

    // Run every 20 seconds to keep live time and date exact
    const intervalId = setInterval(syncLiveDateAndTime, 20000);

    const handleVisChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncLiveDateAndTime();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisChange);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisChange);
      }
    };
  }, []);

  const handleSubmit = async () => {
    try {
      const cleanPickup = pickup?.trim();
      if (!cleanPickup) {
        triggerLocationShake('pickup');
        addToast('Please enter pickup location', 'alert');
        return;
      }

      const cleanDrop = drop?.trim();
      if (!cleanDrop) {
        triggerLocationShake('drop');
        addToast('Please enter destination location', 'alert');
        return;
      }

      if (cat === 'airport' && !flightNo?.trim()) {
        addToast('Please enter flight number', 'alert');
        return;
      }

      if (!selectedDate) {
        addToast('Please select trip date', 'alert');
        return;
      }

      if (!selectedTime) {
        addToast('Please select pickup time', 'alert');
        return;
      }

      if (!trans) {
        addToast('Please select vehicle gearbox', 'alert');
        return;
      }

      let pCoords = pickupCoords;
      if (!pCoords) {
        pCoords = await geocodeAddress(cleanPickup);
        if (!pCoords) {
          pCoords = { lat: 11.2588, lng: 75.7804, name: cleanPickup, formatted: cleanPickup, source: 'default' };
        }
        setPickupCoords(pCoords);
      }

      let dCoords = dropCoords;
      if (!dCoords) {
        dCoords = await geocodeAddress(cleanDrop);
        if (!dCoords) {
          dCoords = { lat: 11.2600, lng: 75.7900, name: cleanDrop, formatted: cleanDrop, source: 'default' };
        }
        setDropCoords(dCoords);
      }

      const pickupLoc = cleanPickup;
      const dropLoc = cleanDrop;

      // Trigger PhonePe payment options popup sheet (navigates to payment page)
      openPhonePeCheckout({
        amount: adv,
        fare: fare,
        category: currentCat.name,
        qty: qty,
        unit: qty === 1 ? currentCat.unit : currentCat.units,
        pickup: pickupLoc,
        drop: dropLoc,
        prefill: {
          name: user?.name || 'ANURAG',
          contact: user?.phone || '8156938843'
        },
        notes: {
          scheduled_date: dateStr,
          scheduled_time: timeStr
        },
        onSuccess: (paymentRes) => {
          const pId = paymentRes?.phonepe_payment_id || paymentRes?.phonepe_transaction_id || paymentRes?.razorpay_payment_id || ('pay_ppe_' + Date.now().toString(36));
          const methodLabel = paymentRes?.method || 'PhonePe';
          setBookingOpen(false);
          bookRide(cat, qty, pickupLoc, dropLoc, fare, adv, pId, {
            date: dateStr,
            time: timeStr,
            rawDate: selectedDate,
            rawTime: selectedTime,
            trans,
            pickupCoords,
            dropCoords,
            pickupDetails,
            dropDetails,
            flightNo: cat === 'airport' ? flightNo : null,
            airportType: cat === 'airport' ? airportType : null,
            driverEarlyBuffer: cat === 'airport' ? driverEarlyBuffer : null,
            distanceKm: tripTelemetry.isCalculated ? tripTelemetry.distanceKm : null,
            distanceText: tripTelemetry.isCalculated ? tripTelemetry.distanceText : null,
            durationMins: tripTelemetry.isCalculated ? tripTelemetry.durationMins : null,
            durationText: tripTelemetry.isCalculated ? tripTelemetry.durationText : null,
            eta: tripTelemetry.isCalculated ? tripTelemetry.etaText : null
          });
          addToast(`Paid ₹${adv} via ${methodLabel}! Driver scheduled for ${dateStr} · ${timeStr}.`, 'check');
        },
        onDismiss: () => {
          // User closed payment sheet
        }
      });
    } catch (err) {
      console.error('Ride checkout initiation error:', err);
      addToast('Unable to open payment sheet. Please try again.', 'alert');
    }
  };

  const resetBookingForm = () => {
    setIsSuccess(false);
    setConfirmedTrip(null);
    setPickup('');
    setDrop('');
    setPickupCoords(null);
    setDropCoords(null);
    setPickupDetails(null);
    setDropDetails(null);
    setPickupSuggestions([]);
    setDropSuggestions([]);
    setActiveSuggestField(null);
    setTripTelemetry({
      distanceKm: null,
      distanceText: '--',
      durationMins: null,
      durationText: '--',
      etaText: '--',
      isCalculated: false
    });
    setFlightNo('');
    setDriverEarlyBuffer('30m');
    setAirportType('pickup');
    setCat('hourly');
    setQty(3);
    setSelectedDate(getTodayISO());
    setSelectedTime(getDefaultTime());
    isDateManuallySelectedRef.current = false;
    isTimeManuallySelectedRef.current = false;
    setTrans(null);
    setShakingLocationField(null);
    if (setBookingDestination) {
      setBookingDestination('');
    }
    if (setBookingPickup) {
      setBookingPickup('');
    }
    if (setBookingPickupCoords) {
      setBookingPickupCoords(null);
    }
    if (setBookingDropCoords) {
      setBookingDropCoords(null);
    }
    if (setBookingDate) {
      setBookingDate('');
    }
    if (setBookingTime) {
      setBookingTime('');
    }
    if (setBookingCategory) {
      setBookingCategory(null);
    }
    clearAnimTimers();
    setAnimPickupPin(false);
    setAnimPickupBox(false);
    setAnimTrail(false);
    setAnimDropPin(false);
    setAnimDropBox(false);
    setShowPopupSheet(false);
    setIsSheetExpanded(false);
    setIsScrollReady(false);
  };

  const handleClose = () => {
    resetBookingForm();
    setBookingOpen(false);
  };

  if (!bookingOpen) return null;

  return (
    <div
      ref={fullscreenViewRef}
      className={`booking-fullscreen-view ${isDragging ? 'is-dragging' : ''}`}
      id="u-layer"
      role="dialog"
      aria-modal="true"
      style={{
        '--drag-progress': isSheetExpanded ? 1 : 0
      }}
    >
      {isSuccess && confirmedTrip ? (
        /* ---------- Request Sent Confirmation View ---------- */
        <div className="sheet booking-fullscreen-inner" role="region">
          <div className="sheet-sticky-top" style={{ borderBottom: '1px solid var(--line)', padding: 'max(14px, env(safe-area-inset-top, 0px)) 20px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>Booking Confirmed</h3>
                <button
                  type="button"
                  className="iconbtn"
                  onClick={handleClose}
                  aria-label="Back"
                  style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--field)', border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}
                >
                  <Icon name="arrow-left" size={18} />
                </button>
              </div>
            </div>

            <div className="sheet-scroll-body" style={{ padding: '24px 20px 36px' }}>
              <div className="ok">
                <span className="ok-ic">
                  <Icon name="check" size={32} />
                </span>
                <h3>Request sent</h3>
                <p>We sent your request to drivers near you. You will get a notification when a driver accepts.</p>

                <div className="cbwin">
                  <Icon name="gift" size={20} /> You got ₹{confirmedTrip.cashback} cashback
                </div>

                <div className="kv" style={{ textAlign: 'left', marginBottom: '16px' }}>
                  <div>
                    <span>Trip ID</span>
                    <b>{confirmedTrip?.id || 'TRP-1090'}</b>
                  </div>
                  <div>
                    <span>When</span>
                    <b>{dateStr} · {timeStr}</b>
                  </div>
                  <div>
                    <span>Advance paid</span>
                    <b>₹{confirmedTrip?.advance || adv}</b>
                  </div>
                  <div>
                    <span>Wallet balance</span>
                    <b>₹{(Number(userBalance) || 0).toLocaleString('en-IN')}</b>
                  </div>
                </div>

                <button className="btn solid block" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ---------- Booking Screen (Reference Image UI) ---------- */
          <>
            {/* 1. Full Screen Graphic Map Layer (Locked in place so pickup/destination flow remains static during transition) */}
            <div className="bk-map-canvas-layer">
              <img
                src={isDarkMode ? darkMapImg : lightMapImg}
                alt="Map Preview"
                className="bk-map-bg-img"
                key={isDarkMode ? 'map-dark' : 'map-light'}
                onError={(e) => {
                  if (!e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = '1';
                    e.currentTarget.src = isDarkMode ? darkGraphicMapImg : lightGraphicMapImg;
                  } else if (e.currentTarget.dataset.fallback === '1') {
                    e.currentTarget.dataset.fallback = '2';
                    e.currentTarget.src = isDarkMode ? '/map/dark_mode_city_map.png' : '/map/minimalist_aerial_city_map.png';
                  } else if (e.currentTarget.dataset.fallback === '2') {
                    e.currentTarget.dataset.fallback = '3';
                    e.currentTarget.src = isDarkMode ? '/map/Dark Mode City Map.png' : '/map/Minimalist Aerial City Map.png';
                  }
                }}
              />

              {/* Graphic Route Overlay with Pins & Callout Badges (Centered Responsive Stage) */}
              <div className="bk-map-route-layer">
                <div className="bk-map-route-stage">
                  <svg
                    className="bk-map-route-svg"
                    viewBox="0 0 350 120"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <filter id="routeShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
                      </filter>
                    </defs>
                    {/* Animated Route Trail following the exact path */}
                    {animTrail && (
                      <path
                        d="M 32 36 C 85 44, 165 72, 225 78 C 255 81, 280 80, 305 76"
                        pathLength="100"
                        fill="none"
                        stroke={isDarkMode ? '#FFFFFF' : '#000000'}
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#routeShadow)"
                        className="anim-route-trail"
                      />
                    )}
                  </svg>

                  {/* 1. Sequentially displayed Pickup Standard Location Pin Icon (tip at 32, 36) */}
                  {animPickupPin && (
                    <div
                      className="anim-bounce-in bk-map-pin-pickup"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        expandSheet();
                        setActiveSuggestField('pickup');
                        setTimeout(() => pickupInputRef.current?.focus(), 150);
                      }}
                      title="Edit pickup location"
                      style={{ cursor: 'pointer' }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill={isDarkMode ? '#FFFFFF' : '#000000'}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                  )}

                  {/* 2. Followed by Pickup Location Callout Badge (Beside pickup pin on same line) */}
                  {animPickupBox && (
                    <div
                      className="bk-map-pin-callout anim-bounce-in bk-map-callout-pickup"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        expandSheet();
                        setActiveSuggestField('pickup');
                        setTimeout(() => pickupInputRef.current?.focus(), 150);
                      }}
                      title="Edit pickup location"
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="bk-map-callout-type">Pickup</div>
                      <div className="bk-map-callout-address">
                        {getShortMapLocation(pickup, 'Indiranagar')}
                      </div>
                    </div>
                  )}

                  {/* 3. Destination Standard Location Pin Icon (tip at 305, 76) */}
                  {animDropPin && (
                    <div
                      className="anim-bounce-in bk-map-pin-drop"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        expandSheet();
                        setActiveSuggestField('drop');
                        setTimeout(() => dropInputRef.current?.focus(), 150);
                      }}
                      title="Edit destination location"
                      style={{ cursor: 'pointer' }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill={isDarkMode ? '#FFFFFF' : '#000000'}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                  )}

                  {/* 4. Followed by Destination Location Callout Badge (Beside destination pin to the left) */}
                  {animDropBox && (
                    <div
                      className="bk-map-pin-callout anim-bounce-in bk-map-callout-drop"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        expandSheet();
                        setActiveSuggestField('drop');
                        setTimeout(() => dropInputRef.current?.focus(), 150);
                      }}
                      title="Edit destination location"
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="bk-map-callout-type">Destination</div>
                      <div className="bk-map-callout-address">
                        {getShortMapLocation(drop, 'Cheranalloor Rd')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Navigation Bar: Static Header (Merges seamlessly when sheet expands) */}
            <div
              className={`bk-map-top-bar ${isSheetExpanded ? 'header-static-solid header-merged' : ''}`}
              onPointerDown={isSheetExpanded ? handleSheetPointerDown : undefined}
              onPointerMove={isSheetExpanded ? handleSheetPointerMove : undefined}
              onPointerUp={isSheetExpanded ? handleSheetPointerUp : undefined}
              onPointerCancel={isSheetExpanded ? handleSheetPointerUp : undefined}
              onTouchStart={isSheetExpanded ? handleSheetTouchStart : undefined}
              onTouchMove={isSheetExpanded ? handleSheetTouchMove : undefined}
              onTouchEnd={isSheetExpanded ? handleSheetTouchEnd : undefined}
            >
              <button
                type="button"
                className="bk-map-round-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                aria-label="Back to home"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              <div className="bk-map-top-titles">
                <h1>Book a Driver</h1>
                <p>Professional driver on demand</p>
              </div>
            </div>

            {/* 2. Slide-up & Expandable Popup Page Sheet (Two-Stage Modal) */}
            <div
              className={`bk-bottom-popup-sheet ${showPopupSheet ? 'visible' : ''} ${isSheetExpanded ? 'expanded' : ''} ${isScrollReady ? 'scroll-ready' : ''}`}
              role="region"
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={handleSheetPointerUp}
              onPointerCancel={handleSheetPointerUp}
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
            >
              {/* Sheet grabber handle (visible in Stage 1, vanishes smoothly during drag transition) */}
              {!isSheetExpanded && (
                <div
                  className="bk-popup-handle-bar-wrap"
                  role="slider"
                  aria-label="Drag up to expand sheet"
                  title="Drag up to view all details"
                >
                  <div className="bk-popup-handle-bar" />
                </div>
              )}

              {/* Scrollable details: seamless smooth scroll */}
              <div
                ref={scrollBodyRef}
                className="bk-popup-scroll-body"
              >
                {/* Location Route Search Card (Google Maps stock autocomplete dropdown) */}
                <div className="bk-route-card" style={{ marginBottom: '14px', position: 'relative', zIndex: activeSuggestField ? 9999 : 2 }}>
                  <div className="bk-route-timeline">
                    <div className="bk-timeline-dot pickup">
                      <div className="bk-timeline-dot-inner" />
                    </div>
                    <div className="bk-timeline-dashed-line" />
                    <div className="bk-timeline-dot drop">
                      <div className="bk-timeline-dot-inner" style={{ background: '#EF4444' }} />
                    </div>
                  </div>

                  <div className="bk-route-fields">
                    {/* Pickup Input Section */}
                    <div className="bk-route-section loc-input-wrap" style={{ position: 'relative', zIndex: activeSuggestField === 'pickup' ? 99999 : 1 }}>
                      <div className="bk-route-header">
                        <label className="bk-route-label" htmlFor="bk-pickup-input">PICKUP LOCATION</label>
                        <button
                          type="button"
                          className="bk-route-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMapPickerTarget('pickup');
                            setMapPickerOpen(true);
                          }}
                          title="Choose pickup on map"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                            <line x1="9" y1="3" x2="9" y2="18" />
                            <line x1="15" y1="6" x2="15" y2="21" />
                          </svg>
                          <span>Map</span>
                        </button>
                      </div>

                      <div className="bk-route-input-wrap">
                        <input
                          ref={pickupInputRef}
                          id="bk-pickup-input"
                          type="text"
                          className="bk-route-input"
                          placeholder="Enter pickup location"
                          value={pickup}
                          onChange={(e) => handlePickupChange(e.target.value)}
                          onFocus={() => {
                            if (!isSheetExpanded) expandSheet();
                            setActiveSuggestField('pickup');
                            if (pickup?.trim()?.length >= 1) {
                              handlePickupChange(pickup);
                            }
                          }}
                          autoComplete="off"
                        />
                        {pickup && (
                          <button
                            type="button"
                            className="bk-route-end-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickup('');
                              setPickupCoords(null);
                              setPickupSuggestions([]);
                            }}
                            aria-label="Clear pickup"
                          >
                            <Icon name="x" size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="bk-route-end-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseCurrentLocation();
                          }}
                          title="Use current GPS location"
                          disabled={isDetectingCurrent}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="3" />
                            <line x1="12" y1="2" x2="12" y2="5" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                            <line x1="2" y1="12" x2="5" y2="12" />
                            <line x1="19" y1="12" x2="22" y2="12" />
                          </svg>
                        </button>

                        {/* Google Maps Stock Location Suggestions Dropdown for Pickup */}
                        {activeSuggestField === 'pickup' && Boolean(pickup?.trim()?.length >= 1) && pickupSuggestions.length > 0 && (
                          <div className="location-suggest-dropdown" style={{ zIndex: 99999, maxHeight: '250px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            {pickupSuggestions.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="loc-suggest-item"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectPickupPlace(item)}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#70757a" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13.5px', color: isDarkMode ? '#FFFFFF' : '#202124', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {highlightMatchGoogleStock(item.title, pickup)}
                                  </div>
                                  {item.sub && (
                                    <div style={{ fontSize: '11.5px', color: isDarkMode ? '#94A3B8' : '#70757a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                      {item.sub}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '6px 14px', borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}>
                              <span style={{ fontSize: '11px', color: isDarkMode ? '#94A3B8' : '#70757a', marginRight: '4px' }}>powered by Google</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bk-route-divider" />

                    {/* Destination Input Section */}
                    <div className="bk-route-section loc-input-wrap" style={{ position: 'relative', zIndex: activeSuggestField === 'drop' ? 99999 : 1 }}>
                      <div className="bk-route-header">
                        <label className="bk-route-label" htmlFor="bk-drop-input">DESTINATION LOCATION</label>
                        <button
                          type="button"
                          className="bk-route-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMapPickerTarget('drop');
                            setMapPickerOpen(true);
                          }}
                          title="Choose destination on map"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                            <line x1="9" y1="3" x2="9" y2="18" />
                            <line x1="15" y1="6" x2="15" y2="21" />
                          </svg>
                          <span>Map</span>
                        </button>
                      </div>

                      <div className="bk-route-input-wrap">
                        <input
                          ref={dropInputRef}
                          id="bk-drop-input"
                          type="text"
                          className="bk-route-input"
                          placeholder="Enter destination location"
                          value={drop}
                          onChange={(e) => handleDropChange(e.target.value)}
                          onFocus={() => {
                            if (!isSheetExpanded) expandSheet();
                            setActiveSuggestField('drop');
                            if (drop?.trim()?.length >= 1) {
                              handleDropChange(drop);
                            }
                          }}
                          autoComplete="off"
                        />
                        {drop && (
                          <button
                            type="button"
                            className="bk-route-end-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrop('');
                              setDropCoords(null);
                              setDropSuggestions([]);
                            }}
                            aria-label="Clear destination"
                          >
                            <Icon name="x" size={14} />
                          </button>
                        )}

                        {/* Google Maps Stock Location Suggestions Dropdown for Destination */}
                        {activeSuggestField === 'drop' && Boolean(drop?.trim()?.length >= 1) && dropSuggestions.length > 0 && (
                          <div className="location-suggest-dropdown" style={{ zIndex: 99999, maxHeight: '250px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            {dropSuggestions.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="loc-suggest-item"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectDropPlace(item)}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#70757a" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13.5px', color: isDarkMode ? '#FFFFFF' : '#202124', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {highlightMatchGoogleStock(item.title, drop)}
                                  </div>
                                  {item.sub && (
                                    <div style={{ fontSize: '11.5px', color: isDarkMode ? '#94A3B8' : '#70757a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                      {item.sub}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '6px 14px', borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}>
                              <span style={{ fontSize: '11px', color: isDarkMode ? '#94A3B8' : '#70757a', marginRight: '4px' }}>powered by Google</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Distance and Estimated Arrival Bar */}
                <div className="bk-ref-telemetry-card">
                  <div className="bk-ref-telem-item">
                    <div className="bk-ref-telem-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19 8 5" />
                        <path d="M20 19 16 5" />
                        <line x1="12" y1="7" x2="12" y2="9" />
                        <line x1="12" y1="13" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="bk-ref-telem-meta">
                      <span className="bk-ref-telem-label" style={{ whiteSpace: 'nowrap' }}>Total distance</span>
                      <span className="bk-ref-telem-val" style={{ whiteSpace: 'nowrap' }}>
                        {tripTelemetry.isCalculated && tripTelemetry.distanceText && tripTelemetry.distanceText !== '--'
                          ? tripTelemetry.distanceText
                          : '503.3 km'}
                      </span>
                    </div>
                  </div>

                  <div className="bk-ref-telem-divider" />

                  <div className="bk-ref-telem-item">
                    <div className="bk-ref-telem-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="bk-ref-telem-meta">
                      <span className="bk-ref-telem-label" style={{ whiteSpace: 'nowrap' }}>Estimated arrival</span>
                      <span className="bk-ref-telem-val" style={{ whiteSpace: 'nowrap' }}>
                        {tripTelemetry.isCalculated && tripTelemetry.durationMins
                          ? formatDurationMeasurement(tripTelemetry.durationMins)
                          : '11 hrs 25 mins'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trip type selector */}
                <div className="bk-ref-section-title">Trip type</div>
                <div className="bk-ref-trip-types">
                  {[
                    { id: 'hourly', label: 'Hourly', icon: <Icon name="clock" size={16} /> },
                    { id: 'daily', label: 'Full day', icon: <Icon name="sun" size={16} /> },
                    { id: 'airport', label: 'Airport', icon: <Icon name="plane" size={16} /> },
                    {
                      id: 'outstation',
                      label: 'Outstation',
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19 8 5" />
                          <path d="M20 19 16 5" />
                          <line x1="12" y1="7" x2="12" y2="9" />
                          <line x1="12" y1="13" x2="12" y2="15" />
                        </svg>
                      )
                    }
                  ].map(t => {
                    const isActive = cat === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`bk-ref-trip-pill ${isActive ? 'active' : ''}`}
                        onClick={() => handleCategorySelect(t.id)}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Driver Duration & Pickup Time side by side (Half & Half) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  {/* Left Half: Driver duration OR Flight Number (if Airport ride) */}
                  <div style={{ minWidth: 0 }}>
                    {cat === 'airport' ? (
                      <>
                        <div className="bk-ref-duration-header" style={{ marginBottom: '8px' }}>
                          <div className="bk-ref-section-title" style={{ margin: 0, fontSize: '14px' }}>
                            Flight number
                          </div>
                        </div>

                        <div className="bk-ref-flight-input-tab">
                          <div className="bk-ref-flight-icon-wrap">
                            <Icon name="plane" size={16} />
                          </div>
                          <input
                            type="text"
                            className="bk-ref-flight-input"
                            value={flightNo}
                            onChange={(e) => setFlightNo(e.target.value.toUpperCase())}
                            placeholder="e.g. 6E 2145"
                            aria-label="Enter Flight Number"
                          />
                          {flightNo && (
                            <button
                              type="button"
                              className="bk-ref-flight-clear-btn"
                              onClick={() => setFlightNo('')}
                              aria-label="Clear flight number"
                            >
                              <Icon name="x" size={13} />
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bk-ref-duration-header" style={{ marginBottom: '8px' }}>
                          <div className="bk-ref-section-title" style={{ margin: 0, fontSize: '14px' }}>
                            Driver duration
                          </div>
                        </div>

                        <div className="bk-ref-duration-stepper" style={{ marginBottom: 0 }}>
                          <button
                            type="button"
                            className="bk-ref-step-btn minus"
                            onClick={() => handleQtyChange(-1)}
                            disabled={qty <= (currentCat.min || 1)}
                            aria-label="Decrease hours"
                          >
                            <Icon name="minus" size={15} />
                          </button>
                          <div className="bk-ref-step-center">
                            <div className="bk-ref-step-val" style={{ fontSize: '14px' }}>
                              {qty} {qty === 1 ? currentCat.unit : currentCat.units}
                            </div>
                            <div className="bk-ref-step-min" style={{ fontSize: '10.5px' }}>
                              Min {currentCat.min || 3}h
                            </div>
                          </div>
                          <button
                            type="button"
                            className="bk-ref-step-btn plus"
                            onClick={() => handleQtyChange(1)}
                            disabled={qty >= (currentCat.max || 12)}
                            aria-label="Increase hours"
                          >
                            <Icon name="plus" size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Half: Pickup time (same design as duration setter) */}
                  <div style={{ minWidth: 0, position: 'relative' }}>
                    <div className="bk-ref-duration-header" style={{ marginBottom: '8px' }}>
                      <div className="bk-ref-section-title" style={{ margin: 0, fontSize: '14px' }}>
                        Pickup time
                      </div>
                    </div>

                    <div className="bk-ref-duration-stepper" style={{ marginBottom: 0, position: 'relative' }}>
                      <button
                        type="button"
                        className="bk-ref-step-btn minus"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTimeStep(-15);
                        }}
                        aria-label="Decrease time by 15 minutes"
                      >
                        <Icon name="minus" size={15} />
                      </button>

                      <div
                        className="bk-ref-step-center"
                        style={{ cursor: 'pointer', flex: 1, position: 'relative' }}
                        onClick={() => {
                          const el = document.getElementById('bk-time-input');
                          if (el && typeof el.showPicker === 'function') {
                            try { el.showPicker(); } catch (err) { el.focus(); }
                          }
                        }}
                      >
                        <div className="bk-ref-step-val" style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
                          {timeStr}
                        </div>
                        <div className="bk-ref-step-min" style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                          Set time
                        </div>
                      </div>

                      <button
                        type="button"
                        className="bk-ref-step-btn plus"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTimeStep(15);
                        }}
                        aria-label="Increase time by 15 minutes"
                      >
                        <Icon name="plus" size={15} />
                      </button>

                      <input
                        id="bk-time-input"
                        type="time"
                        value={selectedTime}
                        onChange={(e) => {
                          if (e.target.value) {
                            isTimeManuallySelectedRef.current = true;
                            setSelectedTime(e.target.value);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: '36px',
                          right: '36px',
                          bottom: 0,
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 1,
                          pointerEvents: 'none'
                        }}
                        aria-label="Select Pickup Time"
                      />
                    </div>
                  </div>
                </div>

                {/* When do you need the driver? (Date selection matching reference image) */}
                <div style={{ marginBottom: '24px' }}>
                  {/* Header: Title + Subtitle on Left, Month-Year Pill on Right */}
                  <div className="bk-date-header-row">
                    <div className="bk-date-title-wrap">
                      <div className="bk-date-main-title">
                        When do you need the driver?
                      </div>
                      <div className="bk-date-sub-title">
                        Select your preferred date
                      </div>
                    </div>

                    {/* Month Year Pill Button (e.g., Oct 2026 ⌄) */}
                    <div
                      className="bk-date-month-pill"
                      onClick={() => {
                        const el = document.getElementById('bk-header-date-input');
                        if (el && typeof el.showPicker === 'function') {
                          try { el.showPicker(); } catch (_) { el.focus(); }
                        } else if (el) {
                          el.focus();
                        }
                      }}
                      title="Choose month or custom date"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>{currentMonthYearLabel}</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>

                      {/* Native date picker input */}
                      <input
                        id="bk-header-date-input"
                        type="date"
                        min={todayISO}
                        value={selectedDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            isDateManuallySelectedRef.current = true;
                            setSelectedDate(e.target.value);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 1,
                          pointerEvents: 'none'
                        }}
                        aria-label="Select Date"
                      />
                    </div>
                  </div>

                  {/* Date Strip Carousel with < and > Buttons */}
                  <div className="bk-date-carousel-row">
                    {/* Left Navigation Arrow */}
                    <button
                      type="button"
                      className="bk-date-nav-btn"
                      onClick={() => scrollDateStrip('left')}
                      aria-label="Previous dates"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>

                    {/* Horizontal Date Cards Strip (Without Tick Badge) */}
                    <div className="bk-date-strip" ref={dateStripRef}>
                      {dateList.map((item) => {
                        const isSelected = selectedDate === item.iso;
                        return (
                          <div
                            key={item.iso}
                            data-date={item.iso}
                            className={`bk-date-card ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              isDateManuallySelectedRef.current = true;
                              setSelectedDate(item.iso);
                            }}
                          >
                            <span className="bk-date-card-day">{item.dayName}</span>
                            <span className="bk-date-card-num">{item.dayNum}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Navigation Arrow */}
                    <button
                      type="button"
                      className="bk-date-nav-btn"
                      onClick={() => scrollDateStrip('right')}
                      aria-label="Next dates"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Vehicle gearbox (Reference Image Design - Black & White) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <div className="bk-ref-section-title" style={{ margin: 0 }}>Vehicle gearbox</div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}
                    title="Select vehicle transmission type"
                    onClick={() => addToast && addToast('Manual, Automatic, or IMT based on your car type', 'info')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                </div>

                <div className="bk-ref-gearbox-grid">
                  {[
                    {
                      id: 'Manual',
                      title: 'Manual',
                      desc: (
                        <>
                          Full control,<br />better mileage
                        </>
                      ),
                      icon: (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="6" y1="5" x2="6" y2="19" />
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="18" y1="5" x2="18" y2="19" />
                          <line x1="6" y1="12" x2="18" y2="12" />
                          <circle cx="6" cy="5" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                          <circle cx="18" cy="5" r="1.5" fill="currentColor" />
                          <circle cx="6" cy="19" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                          <circle cx="18" cy="19" r="1.5" fill="currentColor" />
                        </svg>
                      )
                    },
                    {
                      id: 'Automatic',
                      title: 'Automatic',
                      desc: (
                        <>
                          Smooth &amp;<br />comfortable
                        </>
                      ),
                      icon: (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 4a8 8 0 0 1 7.8 6.2" />
                          <polyline points="20 6 20 10 16 10" />
                          <path d="M12 20a8 8 0 0 1-7.8-6.2" />
                          <polyline points="4 18 4 14 8 14" />
                          <path d="m9 15 3-6 3 6" />
                          <path d="M10 13h4" />
                        </svg>
                      )
                    },
                    {
                      id: 'IMT',
                      title: 'IMT',
                      desc: (
                        <>
                          Manual feel,<br />clutch-free
                        </>
                      ),
                      icon: (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3.2" />
                          <path d="M10.2 2.8h3.6a1 1 0 0 1 .98.8l.38 1.83a6.8 6.8 0 0 1 1.83 1.06l1.7-.82a1 1 0 0 1 1.25.32l1.8 3.12a1 1 0 0 1-.26 1.27l-1.46 1.21a6.8 6.8 0 0 1 0 2.16l1.46 1.21a1 1 0 0 1 .26 1.27l-1.8 3.12a1 1 0 0 1-1.25.32l-1.7-.82a6.8 6.8 0 0 1-1.83 1.06l-.38 1.83a1 1 0 0 1-.98.8h-3.6a1 1 0 0 1-.98-.8l-.38-1.83a6.8 6.8 0 0 1-1.83-1.06l-1.7.82a1 1 0 0 1-1.25-.32l-1.8-3.12a1 1 0 0 1 .26-1.27l1.46-1.21a6.8 6.8 0 0 1 0-2.16l-1.46-1.21a1 1 0 0 1-.26-1.27l1.8-3.12a1 1 0 0 1 1.25-.32l1.7.82a6.8 6.8 0 0 1 1.83-1.06l.38-1.83a1 1 0 0 1 .98-.8z" />
                        </svg>
                      )
                    }
                  ].map(item => {
                    const isActive = trans === item.id;
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setTrans(prev => prev === item.id ? null : item.id)}
                        className={`bk-ref-gearbox-card ${isActive ? 'active' : ''}`}
                      >
                        <div className="bk-gearbox-top-row">
                          <div className="bk-gearbox-icon-circle">
                            {item.icon}
                          </div>
                          <div className="bk-gearbox-radio">
                            {isActive && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        </div>

                        <div className="bk-gearbox-bottom-wrap">
                          <div className="bk-gearbox-title">{item.title}</div>
                          <div className="bk-gearbox-desc">{item.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fare & Invoice Section Title */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '10px' }}>
                  <div className="bk-ref-section-title" style={{ margin: 0 }}>Fare details &amp; invoice</div>
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      color: 'var(--muted, #64748B)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                    title="View fare policy & waiting terms"
                    aria-label="View fare policy and waiting terms"
                  >
                    <span>Policy &amp; Terms</span>
                    <Icon name="info" size={14} />
                  </button>
                </div>

                {/* Fare Invoice Breakdown Card */}
                <div className="bk-fare-card">
                  {/* Driver Trip Fare */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--ink, #0F172A)', fontWeight: 600 }}>
                        Driver trip fare
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted, #64748B)', marginTop: '1px' }}>
                        Rate: {rateDesc}
                      </span>
                    </div>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0F172A)', fontFamily: 'var(--font-mono, monospace)' }}>
                      ₹{tripBaseFare}
                    </span>
                  </div>

                  {/* Platform Fee */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--ink, #0F172A)', fontWeight: 600 }}>
                        Platform fee
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted, #64748B)', marginTop: '1px' }}>
                        App service &amp; 24/7 matching
                      </span>
                    </div>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0F172A)', fontFamily: 'var(--font-mono, monospace)' }}>
                      ₹{platformFee}
                    </span>
                  </div>

                  {/* Safety & Operational Fee */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--ink, #0F172A)', fontWeight: 600 }}>
                        Safety &amp; Operational fee
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted, #64748B)', marginTop: '1px' }}>
                        Ride safety &amp; operational dispatch
                      </span>
                    </div>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0F172A)', fontFamily: 'var(--font-mono, monospace)' }}>
                      ₹{otherFee}
                    </span>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'var(--line, #E2E8F0)', margin: '2px 0 0' }} />

                  {/* Total Fare */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--ink, #0F172A)' }}>
                        Total Trip Fare
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted, #64748B)', marginTop: '1px' }}>
                        Driver gets ₹{remaining} after trip
                      </span>
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--ink, #0F172A)', fontFamily: 'var(--font-display, var(--font-mono, monospace))' }}>
                      ₹{fare}
                    </span>
                  </div>

                  {/* Advance Split Pill Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(2, 132, 199, 0.06)',
                      border: '1px solid rgba(2, 132, 199, 0.16)',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      marginTop: '2px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Advance (30%)
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0369A1' }}>
                        ₹{adv}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #64748B)', fontWeight: 500 }}>
                      Remaining ₹{remaining} after trip
                    </div>
                  </div>
                </div>

                {/* Waiting & Additional Trip Section (Single-Line Design) */}
                <div className="bk-waiting-card">
                  {/* Row 1: Waiting Charge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 0 }}>
                      <div className="bk-waiting-icon-clock">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                        Waiting Charge
                      </span>
                      <span className="bk-waiting-badge-free">
                        60m Free
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--ink)' }}>
                        ₹2<span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted, #64748B)' }}>/min</span>
                      </span>
                      <span className="bk-waiting-subtext">
                        (after 60m)
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="bk-waiting-divider" />

                  {/* Row 2: Additional Trip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 0 }}>
                      <div className="bk-waiting-icon-extra">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 19 8.5 5" />
                          <path d="M19 19 15.5 5" />
                          <path d="M12 6v3" />
                          <path d="M12 15v3" />
                        </svg>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                        Additional Trip
                      </span>
                      <span className="bk-waiting-badge-extra">
                        Extra Km
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--ink)' }}>
                        ₹18<span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted, #64748B)' }}>/km</span>
                      </span>
                      <span className="bk-waiting-subtext">
                        (extra route)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment & Conditions Acceptance Notification */}
                <div
                  className="bk-terms-notice"
                  onClick={() => setShowTermsModal(true)}
                  style={{ cursor: 'pointer', marginBottom: '8px' }}
                >
                  <div className="bk-terms-notice-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </div>
                  <span className="bk-terms-notice-text">
                    By completing payment, you accept waiting and extra route terms.{' '}
                    <span style={{ textDecoration: 'underline', fontWeight: 600, color: 'var(--ink, #0F172A)' }}>
                      View policy
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Static Bottom Action Bar (Fixed at bottom of screen, completely static, 0 frame jumps) */}
            {showPopupSheet && (
              <div className="bk-static-footer">
                <div
                  className="bk-ref-pay-capsule"
                  onClick={() => handleSubmit()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  aria-label={`Pay Now (30%) ₹${adv}`}
                >
                  <span className="bk-ref-pay-single-line">
                    Pay Now (30%) ₹{adv}
                  </span>

                  <div className="bk-ref-pay-arrow-btn" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      {/* Waiting Charges & Trip Terms Review Modal */}
      {showTermsModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100080,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="bk-terms-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(234, 88, 12, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon name="info" size={18} color="#EA580C" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--ink, #0F172A)' }}>
                    Waiting Charges & Terms
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--muted, #64748B)' }}>
                    Please review waiting charges before paying
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--field, #F1F5F9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--muted, #64748B)'
                }}
                aria-label="Close dialog"
              >
                <Icon name="x" size={15} />
              </button>
            </div>

            {/* Terms Content List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', lineHeight: 1.45, marginBottom: '20px' }}>
              <div className="bk-terms-box-1">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Icon name="clock" size={15} color="#0284C7" />
                  <b style={{ fontSize: '13px', color: '#0F172A' }}>60 Minutes Free Waiting</b>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                  Your trip booking includes <b>60 minutes of complimentary waiting time</b> after the driver arrives at your pickup location.
                </p>
              </div>

              <div className="bk-terms-box-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Icon name="alert-circle" size={15} color="#DC2626" />
                  <b style={{ fontSize: '13px', color: '#991B1B' }}>Additional Waiting: ₹2 / min</b>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#7F1D1D' }}>
                  Beyond the initial 60 minutes free window, waiting charges accrue at <b>₹2 per minute (₹120/hr)</b> and will be included in the final bill.
                </p>
              </div>

              <div className="bk-terms-box-3">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Icon name="route" size={15} color="#166534" />
                  <b style={{ fontSize: '13px', color: '#166534' }}>Distance Extension & Tolls</b>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#14532D' }}>
                  Extra travel distance beyond the scheduled route is charged at ₹18/km. Parking and toll charges are payable as actuals.
                </p>
              </div>
            </div>

            {/* Review & Accept Button */}
            <button
              type="button"
              className="bk-submit-btn"
              onClick={() => {
                setHasReviewedTerms(true);
                setShowTermsModal(false);
                if (addToast) addToast('Waiting charges terms accepted. Pay Now is unlocked!', 'check');
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Icon name="check" size={16} />
              <span>I Review & Accept Terms</span>
            </button>
          </div>
        </div>
      )}

      <MapPickerModal
        isOpen={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onSelect={handleMapSelect}
        targetField={mapPickerTarget}
      />
    </div>
  );
}
