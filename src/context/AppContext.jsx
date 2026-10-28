import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { App as CapApp } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { getDeviceLocation, getCachedDeviceLocation } from '../lib/deviceLocation';
import { processPhonePeCashbackTransfer } from '../utils/phonepe';
import { realtime } from '../utils/realtime';
import {
  notifyIncomingRideRequest,
  notifyDriverTripAccepted,
  sendUserNativeNotification,
  requestUserNotificationPermission,
  requestDriverNotificationPermission,
  dismissIncomingRideNotification,
  stopActiveTone,
  isDriverLoginComplete,
  isUserLoginComplete,
  setupNotificationActionListeners
} from '../services/pushNotificationService';
import { cleanLocationName } from '../utils/locationCleaner';
import {
  isUserTrip,
  generateRidingoUserId,
  generateSessionToken,
  getCompoundLoginKey,
  isUpcomingFutureTrip,
  isTripTrackingUnlocked,
  getTripScheduledTimestamp
} from '../services/userService';

const AppContext = createContext(null);

export const DEFAULT_USER = {
  id: 'RDU-10001',
  userId: 'RDU-10001',
  name: 'Arjun Menon',
  phone: '+91 98401 23456',
  email: 'arjun.menon@example.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  notif: true,
  pin: true,
  pinCode: '4821',
  liveShare: true,
  quiet: false,
  acTemp: '22°C',
  acMode: 'Chill',
  acPrecool: true,
  whatsapp: true,
  promo: true,
  sosContacts: [{ name: 'Priya Menon', relation: 'Spouse', phone: '+91 98401 98765' }],
  insuranceTier: 'standard',
  nominee: { name: 'Priya Menon', relation: 'Spouse' },
  languages: ['English', 'Hindi', 'Malayalam'],
  quietCabin: true,
  maskNumber: true,
  locPrivacy: true
};

export const DEFAULT_DRIVER = {
  id: 'DRV-10001',
  name: 'Ravi Kumar',
  phone: '+91 94471 23456',
  email: 'ravi.kumar@ridingo.partner',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  rating: 5.0,
  tripsCount: 0,
  bankName: 'HDFC Bank',
  bankAccount: '•••• 4521',
  upiId: 'ravi.kumar@okhdfcbank',
  dlNumber: 'KL-07-20160049281',
  badgeNumber: 'KL-07-2024-CH08',
  experienceYears: 8,
  services: {
    hourly: true,
    daily: true,
    airport: true,
    outstation: true,
    event: true
  },
  transmissions: {
    manual: true,
    automatic: true,
    imt: true
  },
  blackMarks: 0,
  popups: true,
  sound: true,
  autoQueue: false,
  biometric: true,
  haptic: true
};

export const getDeviceDriverId = (driver) => {
  if (driver?.id && !driver.isDefault && String(driver.id) !== 'ravi_1') {
    return String(driver.id);
  }
  if (typeof window === 'undefined') {
    return String(driver?.id || driver?.phone || 'driver_default');
  }
  try {
    let deviceDriverId = localStorage.getItem('ridingo_device_driver_id');
    if (!deviceDriverId) {
      const platform = (typeof window.Capacitor !== 'undefined' && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || 'web';
      deviceDriverId = `driver_${platform}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('ridingo_device_driver_id', deviceDriverId);
    }
    return deviceDriverId;
  } catch (_) {
    return String(driver?.id || driver?.phone || 'driver_default');
  }
};

export const INITIAL_TRIPS = [];

export const INITIAL_UTX = [];

export const INITIAL_UNOTES = [];

// Automatic Clean-Slate Reset: Clears prior testing data from localStorage to ensure fresh genuine new-user state
if (typeof window !== 'undefined') {
  try {
    const CLEAN_SLATE_KEY = 'ridingo_clean_slate_fresh_v7';
    if (!localStorage.getItem(CLEAN_SLATE_KEY)) {
      localStorage.removeItem('ridingo_cached_trips');
      localStorage.removeItem('ridingo_user_session');
      localStorage.removeItem('ridingo_driver_session');
      localStorage.removeItem('ridingo_accepted_trips');
      localStorage.removeItem('ridingo_settled_trips');
      localStorage.removeItem('ridingo_declined_trips');
      localStorage.removeItem('ridingo_active_tracking_trip_id');
      localStorage.removeItem('ridingo_live_tracking_open');
      localStorage.removeItem('ridingo_has_onboarded');
      localStorage.removeItem('ridingo_user_notified_accepted_trips');
      localStorage.removeItem('ridingo_registered_users_registry');
      localStorage.removeItem('ridingo_driver_balance');
      localStorage.removeItem('ridingo_driver_tx');
      localStorage.removeItem('ridingo_active_trip_requests_v1');
      localStorage.removeItem('ridingo_active_trip_request');
      localStorage.removeItem('ridingo_shared_trips');
      localStorage.setItem(CLEAN_SLATE_KEY, 'true');
    }
  } catch (_) {}
}

export function AppProvider({ children }) {
  // User state: null on fresh install or logged out
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ridingo_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Driver Partner state: null on fresh install or logged out
  const [driverPartner, setDriverPartner] = useState(() => {
    try {
      const saved = localStorage.getItem('ridingo_driver_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const driverPartnerRef = useRef(driverPartner);
  useEffect(() => {
    driverPartnerRef.current = driverPartner;
  }, [driverPartner]);

  // App navigation state (User App, Driver App, or CRM Admin Panel)
  const determineView = () => {
    if (typeof window !== 'undefined') {
      // 1. ABSOLUTE EXPLICIT TARGET CHECK (Primary Source of Truth from standalone build):
      if (window.RIDINGO_TARGET === 'driver') {
        return 'driver';
      }
      if (window.RIDINGO_TARGET === 'user') {
        return 'user';
      }

      // 2. Class check for standalone apps if RIDINGO_TARGET not yet defined
      if (
        (typeof document !== 'undefined' && document.body?.classList?.contains('standalone-driver')) ||
        (typeof document !== 'undefined' && document.documentElement?.classList?.contains('standalone-driver'))
      ) {
        return 'driver';
      }

      if (
        typeof document !== 'undefined' &&
        document.body?.classList?.contains('standalone-user') &&
        !document.body?.classList?.contains('standalone-driver') &&
        !document.documentElement?.classList?.contains('standalone-driver')
      ) {
        return 'user';
      }

      // 2. Web dev server / browser preview (when running on localhost):
      const search = window.location.search.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const port = window.location.port;

      if (
        search.includes('app=admin') ||
        search.includes('view=admin') ||
        path.includes('/admin') ||
        path.includes('/admin.in') ||
        path.includes('ridingo/admin') ||
        hash.includes('admin') ||
        window.location.hostname.startsWith('admin.')
      ) {
        return 'admin';
      }

      if (
        port === '5174' ||
        search.includes('app=driver') ||
        search.includes('view=driver') ||
        path.includes('/driver') ||
        hash.includes('driver')
      ) {
        return 'driver';
      }

      if (
        port === '5173' ||
        search.includes('app=user') ||
        search.includes('view=user') ||
        path.includes('/user') ||
        hash.includes('user')
      ) {
        return 'user';
      }
    }
    return 'user';
  };

  const [view, setView] = useState(determineView);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const switchAppView = (targetView, extra = {}) => {
    // HARD LOCK: Standalone User App package NEVER switches away from 'user'!
    if (window.RIDINGO_TARGET === 'user') {
      if (targetView !== 'user') {
        console.info('[AppContext] Suppressed cross-app switch in User App. Target requested:', targetView);
        if (extra?.tripId) {
          setActiveTrackingTripId(extra.tripId);
          setLiveTrackingOpen(true);
        }
        return;
      }
    }

    // HARD LOCK: Standalone Driver App package NEVER switches away from 'driver'!
    if (window.RIDINGO_TARGET === 'driver') {
      if (targetView !== 'driver') {
        console.info('[AppContext] Suppressed cross-app switch in Driver App. Target requested:', targetView);
        return;
      }
    }

    if (targetView === 'driver') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'driver');
        window.history.pushState({}, '', url.toString());
      } catch (e) {}
      setView('driver');
      if (extra?.tripId) {
        setTrips(prev => {
          const matched = prev.find(t => t.id === extra.tripId);
          if (matched && matched.status === 'requested') {
            setIncomingTripRequest(matched);
          } else if (extra.fare) {
            setIncomingTripRequest({
              id: extra.tripId,
              fare: extra.fare,
              advance: extra.advance,
              pickup: cleanLocationName(extra.pickup),
              drop_loc: cleanLocationName(extra.drop),
              distanceText: extra.distance,
              durationText: extra.duration,
              status: 'requested',
              when_ts: Date.now()
            });
          }
          return prev;
        });
      }
    } else if (targetView === 'user') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        window.history.pushState({}, '', url.toString());
      } catch (e) {}
      setView('user');
      if (extra?.tripId) {
        setActiveTrackingTripId(extra.tripId);
        setLiveTrackingOpen(true);
      }
    } else if (targetView === 'admin') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'admin');
        window.history.pushState({}, '', url.toString());
      } catch (e) {}
      setView('admin');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__ridingoSetView = switchAppView;
    try {
      setupNotificationActionListeners();
    } catch (e) {}

    const handleUrlChange = () => {
      const detected = determineView();
      setView(detected);
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
      delete window.__ridingoSetView;
    };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('standalone-app');
      document.body.classList.add('standalone-app');
      if (view === 'driver') {
        document.documentElement.classList.add('standalone-driver');
        document.documentElement.classList.remove('standalone-user');
        document.body.classList.add('standalone-driver');
        document.body.classList.remove('standalone-user');
      } else {
        document.documentElement.classList.add('standalone-user');
        document.documentElement.classList.remove('standalone-driver');
        document.body.classList.add('standalone-user');
        document.body.classList.remove('standalone-driver');
      }
    }
  }, [view]);
  const [uTab, setUTab] = useState('home'); // 'home' | 'history' | 'wallet' | 'profile'
  const [dTab, setDTab] = useState('dash');
  const [tripsFilter, setTripsFilter] = useState('all');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingCategory, setBookingCategory] = useState('hourly');
  const [bookingDestination, setBookingDestination] = useState('');
  const [bookingPickup, setBookingPickup] = useState('');
  const [bookingPickupCoords, setBookingPickupCoords] = useState(null);
  const [bookingDropCoords, setBookingDropCoords] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [liveTrackingOpen, setLiveTrackingOpen] = useState(() => {
    try {
      return localStorage.getItem('ridingo_live_tracking_open') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('ridingo_user_session');
      return !saved;
    } catch (e) {
      return true;
    }
  });
  const [driverOnboardingOpen, setDriverOnboardingOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('ridingo_driver_session');
      return !saved;
    } catch (e) {
      return true;
    }
  });
  const [legalModal, setLegalModal] = useState({ open: false, tab: 'terms' });

  const openLegal = (tab = 'terms') => setLegalModal({ open: true, tab });
  const closeLegal = () => setLegalModal(prev => ({ ...prev, open: false }));

  // Instant Cache Rehydration: Restore trip history and active bookings immediately on frame 0
  const [trips, setTrips] = useState(() => {
    try {
      const saved = localStorage.getItem('ridingo_cached_trips');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [tripsLoaded, setTripsLoaded] = useState(() => {
    try {
      const saved = localStorage.getItem('ridingo_cached_trips');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return true;
      }
    } catch (_) {}
    return false;
  });
  const [activeTrackingTripId, setActiveTrackingTripId] = useState(() => {
    try {
      return localStorage.getItem('ridingo_active_tracking_trip_id') || null;
    } catch (_) {
      return null;
    }
  });
  const [utx, setUtx] = useState(INITIAL_UTX);
  const [unotes, setUnotes] = useState(INITIAL_UNOTES);
  const [driverOnline, setDriverOnline] = useState(true);
  const [incomingTripRequest, setIncomingTripRequest] = useState(null);
  const [driverBalance, setDriverBalance] = useState(() => {
    try {
      const savedDriver = localStorage.getItem('ridingo_driver_session');
      const driverId = savedDriver ? JSON.parse(savedDriver)?.id : null;
      if (!driverId) return 0;
      const saved = localStorage.getItem(`ridingo_driver_balance_${driverId}`);
      return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 0;
    } catch (_) {
      return 0;
    }
  });
  const [driverTx, setDriverTx] = useState(() => {
    try {
      const savedDriver = localStorage.getItem('ridingo_driver_session');
      const driverId = savedDriver ? JSON.parse(savedDriver)?.id : null;
      if (!driverId) return [];
      const saved = localStorage.getItem(`ridingo_driver_tx_${driverId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  // Re-hydrate driver balance & transactions on driver account switch or sign in/out
  useEffect(() => {
    const driverId = driverPartner?.id;
    if (!driverId) {
      setDriverBalance(0);
      setDriverTx([]);
      return;
    }
    try {
      const savedBal = localStorage.getItem(`ridingo_driver_balance_${driverId}`);
      setDriverBalance(savedBal !== null && !isNaN(Number(savedBal)) ? Number(savedBal) : 0);
      const savedTx = localStorage.getItem(`ridingo_driver_tx_${driverId}`);
      setDriverTx(savedTx ? JSON.parse(savedTx) : []);
    } catch (_) {
      setDriverBalance(0);
      setDriverTx([]);
    }
  }, [driverPartner?.id]);

  useEffect(() => {
    const driverId = driverPartner?.id;
    if (driverId) {
      try {
        localStorage.setItem(`ridingo_driver_balance_${driverId}`, String(driverBalance));
      } catch (_) {}
    }
  }, [driverBalance, driverPartner?.id]);

  useEffect(() => {
    const driverId = driverPartner?.id;
    if (driverId) {
      try {
        localStorage.setItem(`ridingo_driver_tx_${driverId}`, JSON.stringify(driverTx));
      } catch (_) {}
    }
  }, [driverTx, driverPartner?.id]);

  const [toasts, setToasts] = useState([]);
  const [tripToCancel, setTripToCancel] = useState(null);
  const [tripCompleteModalOpen, setTripCompleteModalOpen] = useState(false);
  const [completedTripData, setCompletedTripData] = useState(null);
  const [termsConfirmationBanner, setTermsConfirmationBanner] = useState(null);

  // Saved addresses state (Home, Work, Saved Places)
  const [savedHomeLoc, setSavedHomeLoc] = useState(() => {
    try { return localStorage.getItem('ridingo_saved_home') || ''; } catch (_) { return ''; }
  });
  const [savedWorkLoc, setSavedWorkLoc] = useState(() => {
    try { return localStorage.getItem('ridingo_saved_work') || ''; } catch (_) { return ''; }
  });
  const [savedPlacesLoc, setSavedPlacesLoc] = useState(() => {
    try { return localStorage.getItem('ridingo_saved_places') || ''; } catch (_) { return ''; }
  });

  // Multiple Saved Places List: [{ id, title, address }]
  const [savedPlacesList, setSavedPlacesList] = useState(() => {
    try {
      const raw = localStorage.getItem('ridingo_saved_places_list');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const legacy = localStorage.getItem('ridingo_saved_places');
      if (legacy && legacy.trim()) {
        const initial = [{ id: 'place-legacy', title: 'Saved Place', address: legacy.trim() }];
        try { localStorage.setItem('ridingo_saved_places_list', JSON.stringify(initial)); } catch (_) {}
        return initial;
      }
      return [];
    } catch (_) {
      return [];
    }
  });

  const addSavedPlace = (title, address) => {
    const cleanAddr = (address || '').trim();
    if (!cleanAddr) return null;
    const cleanTitle = (title || '').trim() || cleanAddr.split(',')[0] || 'Saved Place';
    const newPlace = {
      id: 'place-' + Date.now(),
      title: cleanTitle,
      address: cleanAddr
    };
    setSavedPlacesList(prev => {
      const filtered = prev.filter(p => p.address.toLowerCase() !== cleanAddr.toLowerCase());
      const updated = [newPlace, ...filtered];
      try { localStorage.setItem('ridingo_saved_places_list', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    setSavedPlacesLoc(cleanAddr);
    try { localStorage.setItem('ridingo_saved_places', cleanAddr); } catch (_) {}
    return newPlace;
  };

  const updateSavedPlace = (id, title, address) => {
    const cleanAddr = (address || '').trim();
    if (!cleanAddr) return;
    const cleanTitle = (title || '').trim() || cleanAddr.split(',')[0] || 'Saved Place';
    setSavedPlacesList(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, title: cleanTitle, address: cleanAddr } : p);
      try { localStorage.setItem('ridingo_saved_places_list', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
    setSavedPlacesLoc(cleanAddr);
    try { localStorage.setItem('ridingo_saved_places', cleanAddr); } catch (_) {}
  };

  const removeSavedPlace = (id) => {
    setSavedPlacesList(prev => {
      const updated = prev.filter(p => p.id !== id);
      try { localStorage.setItem('ridingo_saved_places_list', JSON.stringify(updated)); } catch (_) {}
      const nextSingle = updated.length > 0 ? updated[0].address : '';
      setSavedPlacesLoc(nextSingle);
      try { localStorage.setItem('ridingo_saved_places', nextSingle); } catch (_) {}
      return updated;
    });
  };

  const updateSavedLocation = (type, value, title = '') => {
    const trimmed = (value || '').trim();
    if (type === 'home') {
      setSavedHomeLoc(trimmed);
      try { localStorage.setItem('ridingo_saved_home', trimmed); } catch (_) {}
    } else if (type === 'work') {
      setSavedWorkLoc(trimmed);
      try { localStorage.setItem('ridingo_saved_work', trimmed); } catch (_) {}
    } else if (type === 'saved' || type === 'places') {
      setSavedPlacesLoc(trimmed);
      try { localStorage.setItem('ridingo_saved_places', trimmed); } catch (_) {}
      if (trimmed) {
        addSavedPlace(title || 'Saved Place', trimmed);
      }
    }
  };

  useEffect(() => {
    if (termsConfirmationBanner) {
      const timer = setTimeout(() => {
        setTermsConfirmationBanner(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [termsConfirmationBanner]);

  // Push notification deduplication set for User App
  const notifiedAcceptedTripsRef = useRef(new Set());
  // Accepted trip tracking to eliminate incoming ride popup glitch on Driver App
  const acceptedTripIdsRef = useRef(new Set());
  // Settled trip tracking to prevent duplicate payment settlement or loop
  const settledTripIdsRef = useRef(new Set());

  // Normalization helper for consistent trip ID matching
  const normalizeTripKey = (id) => String(id || '').trim().toLowerCase().replace(/^trp-/, '');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ridingo_accepted_trips') || '[]');
      if (Array.isArray(saved)) {
        saved.forEach(id => acceptedTripIdsRef.current.add(id));
      }
    } catch (_) {}
    try {
      const savedSettled = JSON.parse(localStorage.getItem('ridingo_settled_trips') || '[]');
      if (Array.isArray(savedSettled)) {
        savedSettled.forEach(id => settledTripIdsRef.current.add(id));
      }
    } catch (_) {}
    try {
      const savedNotified = JSON.parse(localStorage.getItem('ridingo_user_notified_accepted_trips') || '[]');
      if (Array.isArray(savedNotified)) {
        savedNotified.forEach(id => {
          const k = normalizeTripKey(id);
          if (k) notifiedAcceptedTripsRef.current.add(k);
        });
      }
    } catch (_) {}
  }, []);

  // Synchronous cache persistence for instant UI state restoration upon app launch / refresh
  useEffect(() => {
    try {
      if (Array.isArray(trips) && trips.length > 0) {
        // Strip out oversized base64 strings so local storage stays lightning-fast and never exceeds quota
        const light = trips.slice(0, 35).map(t => {
          const item = { ...t };
          if (item.videoUrl && String(item.videoUrl).startsWith('data:')) item.videoUrl = null;
          if (item.vehicleDetails?.videoUrl && String(item.vehicleDetails.videoUrl).startsWith('data:')) {
            item.vehicleDetails = { ...item.vehicleDetails, videoUrl: null };
          }
          return item;
        });
        localStorage.setItem('ridingo_cached_trips', JSON.stringify(light));
      }
    } catch (e) {
      console.warn('[Cache] Could not persist trips to localStorage:', e);
    }
  }, [trips]);

  useEffect(() => {
    try {
      if (activeTrackingTripId) {
        localStorage.setItem('ridingo_active_tracking_trip_id', activeTrackingTripId);
      } else {
        localStorage.removeItem('ridingo_active_tracking_trip_id');
      }
    } catch (_) {}
  }, [activeTrackingTripId]);

  useEffect(() => {
    try {
      localStorage.setItem('ridingo_live_tracking_open', String(liveTrackingOpen));
    } catch (_) {}
  }, [liveTrackingOpen]);

  const notifyUserTripAccepted = (tripId, driverName = 'Ravi Kumar', driverPhone = '+91 94471 23456', targetOtp = '4821') => {
    const key = normalizeTripKey(tripId);
    if (!key) return;

    // Strict deduplication check 1: In-memory ref
    if (notifiedAcceptedTripsRef.current.has(key)) return;

    // Strict deduplication check 2: Persistent localStorage
    let persisted = [];
    try {
      persisted = JSON.parse(localStorage.getItem('ridingo_user_notified_accepted_trips') || '[]');
      if (!Array.isArray(persisted)) persisted = [];
    } catch (_) {
      persisted = [];
    }

    if (persisted.some(id => normalizeTripKey(id) === key)) {
      notifiedAcceptedTripsRef.current.add(key);
      return;
    }

    // Atomically register before firing to prevent any race condition
    notifiedAcceptedTripsRef.current.add(key);
    try {
      persisted.push(key);
      if (persisted.length > 50) persisted = persisted.slice(-50);
      localStorage.setItem('ridingo_user_notified_accepted_trips', JSON.stringify(persisted));
    } catch (_) {}

    const isUserDevice = typeof window !== 'undefined' && window.RIDINGO_TARGET !== 'driver';
    if (!isUserDevice) return;

    // Calculate deterministic notification ID from tripId to ensure OS-level deduplication
    const numericPortion = parseInt(key.replace(/\D/g, '') || '1001', 10);
    const stableNotificationId = 30000 + (numericPortion % 60000);

    sendUserNativeNotification(
      `Driver Allocated: ${driverName}`,
      `${driverName} (${driverPhone}) is en route to your pickup. Your 4-digit Pickup OTP is ${targetOtp}.`,
      {
        id: stableNotificationId,
        tag: `user_trip_allocated_${key}`,
        extra: { tripId: key, driverName, driverPhone, otp: targetOtp }
      }
    );
  };

  // Monotonic Lifecycle Status Rank: Trip state must NEVER regress or rewind on network poll
  const TRIP_STATUS_RANK = {
    'requested': 1,
    'accepted': 2,
    'pickup_arrived': 3,
    'ready_to_start': 4,
    'inprogress': 5,
    'ending_otp': 6,
    'invoice_pending': 7,
    'completed': 8,
    'cancelled': 9
  };

  const mergeTripUpdates = (localTrip, remoteTrip) => {
    if (!localTrip) return remoteTrip;
    if (!remoteTrip) return localTrip;

    // Terminal completed/cancelled states can NEVER be overwritten by earlier states
    if (localTrip.status === 'completed' && remoteTrip.status !== 'completed') {
      return localTrip;
    }
    if (localTrip.status === 'cancelled' && remoteTrip.status !== 'cancelled') {
      return localTrip;
    }

    const localRank = TRIP_STATUS_RANK[localTrip.status] || 0;
    const remoteRank = TRIP_STATUS_RANK[remoteTrip.status] || 0;

    // Never downgrade local status to an older remote snapshot
    const resolvedStatus = localRank >= remoteRank ? localTrip.status : remoteTrip.status;

    return {
      ...remoteTrip,
      ...localTrip,
      status: resolvedStatus,
      vehicleDetails: localTrip.vehicleDetails || remoteTrip.vehicleDetails,
      car_photos: localTrip.car_photos || remoteTrip.car_photos,
      videoUrl: localTrip.videoUrl || remoteTrip.videoUrl,
      conditionPhotos: localTrip.conditionPhotos || remoteTrip.conditionPhotos,
      driver: localTrip.driver || remoteTrip.driver,
      driverObj: localTrip.driverObj || remoteTrip.driverObj,
      startOtp: localTrip.startOtp || remoteTrip.startOtp,
      finalSettlement: localTrip.finalSettlement || remoteTrip.finalSettlement,
      completedAt: localTrip.completedAt || remoteTrip.completedAt,
      startedAt: localTrip.startedAt || remoteTrip.startedAt,
      driverCoords: localTrip.driverCoords || remoteTrip.driverCoords,
      driverHeading: localTrip.driverHeading || remoteTrip.driverHeading,
      driverSpeed: localTrip.driverSpeed || remoteTrip.driverSpeed
    };
  };

  // Helper to map Supabase public.trips database row to App Trip Object
  const mapSupabaseRowToTrip = (row) => {
    if (!row) return null;
    const carObj = row.car || {};
    const driverObj = (typeof row.driver === 'object' && row.driver !== null)
      ? row.driver
      : (typeof row.driver === 'string' && row.driver.startsWith('{'))
        ? (() => { try { return JSON.parse(row.driver); } catch (_) { return null; } })()
        : (row.driver ? { name: row.driver } : null);
    const driverName = driverObj?.name || (typeof row.driver === 'string' ? row.driver : null);
    const driverId = driverObj?.deviceDriverId || driverObj?.id || null;

    return {
      id: row.id,
      cat: row.cat || 'hourly',
      qty: Number(row.qty) || 2,
      pickup: cleanLocationName(row.pickup) || 'Pickup Location',
      drop_loc: cleanLocationName(row.drop_loc) || 'Drop Location',
      trans: carObj.trans || row.trans || 'Automatic',
      car: {
        model: carObj.model || 'Sedan',
        trans: carObj.trans || row.trans || 'Automatic',
        plate: carObj.plate || 'KL 07 AB 4821',
        ...carObj
      },
      when_ts: Number(row.when_ts) || Date.now(),
      scheduledDate: carObj.scheduledDate || null,
      scheduledTime: carObj.scheduledTime || null,
      scheduleDisplay: carObj.scheduledDate ? `${carObj.scheduledDate} · ${carObj.scheduledTime}` : 'Immediate Pickup',
      fare: Number(row.fare) || 600,
      advance: Number(row.advance) || 180,
      status: row.status || 'requested',
      startOtp: row.otp || carObj.startOtp || row.startOtp || '4821',
      endOtp: carObj.endOtp || row.endOtp || '8392',
      conditionPhotos: row.conditionPhotos || (Array.isArray(row.car_photos) ? row.car_photos : { front: null, left: null, back: null, top: null }),
      car_photos: row.car_photos || (Array.isArray(row.conditionPhotos) ? row.conditionPhotos : null),
      vehicleDetails: row.vehicleDetails || {
        brand: row.vehicle_brand || carObj.brand,
        model: row.vehicle_model || carObj.model,
        regNumber: row.vehicle_number || carObj.plate,
        photos: row.car_photos || [],
        videoUrl: row.vehicle_video || row.videoUrl || null
      },
      videoUrl: row.vehicle_video || row.videoUrl || null,
      conditionScratches: row.conditionScratches || [],
      conditionNotes: '',
      conditionVerified: !!row.conditionVerified,
      paymentGateway: 'PhonePe',
      paymentId: row.paymentId || 'pay_ppe_' + row.id,
      driver: driverName,
      driverObj: driverObj,
      driver_id: driverId,
      rider: row.rider || { name: 'Customer', phone: '+91 98401 23456' },
      cashback: Number(row.cashback) || 20,
      pickupCoords: carObj.pickupCoords || null,
      dropCoords: carObj.dropCoords || null,
      driverCoords: driverObj?.location || row.driver_location || row.driverCoords || null,
      driverHeading: driverObj?.location?.heading || row.driverHeading || 0,
      driverSpeed: driverObj?.location?.speed || row.driverSpeed || 0,
      scheduledTs: row.scheduled_ts || row.scheduledTs || null,
      rawDate: row.raw_date || row.rawDate || null,
      rawTime: row.raw_time || row.rawTime || null
    };
  };

  // Sync trips from Supabase database table with strict authorization scoping
  const syncTripsFromSupabase = async () => {
    try {
      if (!supabase || typeof supabase.from !== 'function') return;

      const isCurrentDriverApp =
        window.RIDINGO_TARGET === 'driver' ||
        viewRef.current === 'driver' ||
        (typeof window !== 'undefined' && (
          window.location.search.includes('view=driver') ||
          window.location.search.includes('app=driver') ||
          window.location.hash.includes('driver') ||
          window.location.pathname.includes('/driver')
        ));

      const isCurrentAdmin =
        viewRef.current === 'admin' ||
        (typeof window !== 'undefined' && (
          sessionStorage.getItem('ridingo_admin_auth') === 'true' ||
          localStorage.getItem('ridingo_admin_auth') === 'true'
        ));

      let query = supabase.from('trips').select('*').order('when_ts', { ascending: false }).limit(25);

      if (isCurrentAdmin) {
        // Authenticated admin can view platform trips for dispatch telemetry
      } else if (isCurrentDriverApp) {
        // Driver App: query open 'requested' trips for dispatches AND trips assigned to this driver
        const rawDriverId = getDeviceDriverId(driverPartnerRef.current || driverPartner || DEFAULT_DRIVER);
        const myDriverId = String(rawDriverId || '').replace(/[^a-zA-Z0-9_\-\.]/g, '');
        query = query.or(`status.eq.requested,status.eq.accepted,status.eq.pickup_arrived,status.eq.ready_to_start,status.eq.inprogress,driver_id.eq.${myDriverId},driver->>id.eq.${myDriverId}`);
      } else {
        // User App: STRICT SCOPING - Users must NOT access or view other users' private trip data!
        const currentUser = userRef.current || user;
        if (!currentUser) {
          // Unauthenticated user: do not download any trips from cloud database
          return;
        }
        const userPhone10 = currentUser.phone ? String(currentUser.phone).replace(/\D/g, '').slice(-10) : '';
        const rawUserId = currentUser.id || currentUser.userId || '';
        const userId = String(rawUserId).replace(/[^a-zA-Z0-9_\-\.]/g, '');
        if (userPhone10 && userId) {
          query = query.or(`by_who.ilike.%${userPhone10}%,rider->>phone.ilike.%${userPhone10}%,rider->>id.eq.${userId},rider->>userId.eq.${userId}`);
        } else if (userPhone10) {
          query = query.or(`by_who.ilike.%${userPhone10}%,rider->>phone.ilike.%${userPhone10}%`);
        } else if (userId) {
          query = query.or(`rider->>id.eq.${userId},rider->>userId.eq.${userId}`);
        } else {
          return;
        }
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapSupabaseRowToTrip).filter(Boolean);
        setTrips(prev => {
          const mapById = new Map();
          prev.forEach(t => mapById.set(t.id, t));
          mapped.forEach(t => {
            if (mapById.has(t.id)) {
              const localT = mapById.get(t.id);
              mapById.set(t.id, mergeTripUpdates(localT, t));
            } else {
              mapById.set(t.id, t);
            }
          });
          return Array.from(mapById.values());
        });

        // Check for active 'requested' trips created within 15 minutes that have not been declined or accepted
        let declinedTripIds = [];
        let acceptedTripIds = [];
        let settledTripIds = [];
        try {
          declinedTripIds = JSON.parse(localStorage.getItem('ridingo_declined_trips') || '[]');
          acceptedTripIds = JSON.parse(localStorage.getItem('ridingo_accepted_trips') || '[]');
          settledTripIds = JSON.parse(localStorage.getItem('ridingo_settled_trips') || '[]');
        } catch (_) {}

        const activeReqs = mapped.filter(t =>
          t.status === 'requested' &&
          Math.abs(Date.now() - t.when_ts) < 15 * 60 * 1000 &&
          !declinedTripIds.includes(t.id) &&
          !acceptedTripIds.includes(t.id) &&
          !acceptedTripIdsRef.current.has(t.id) &&
          !settledTripIds.includes(t.id) &&
          !settledTripIdsRef.current.has(t.id)
        );
        const isCurrentDriverApp =
          window.RIDINGO_TARGET === 'driver' ||
          viewRef.current === 'driver' ||
          (typeof window !== 'undefined' && (
            window.location.search.includes('view=driver') ||
            window.location.search.includes('app=driver') ||
            window.location.hash.includes('driver') ||
            window.location.pathname.includes('/driver')
          ));

        if (activeReqs.length > 0 && isCurrentDriverApp) {
          setIncomingTripRequest(activeReqs[0]);
          if (isDriverLoginComplete()) {
            notifyIncomingRideRequest(activeReqs[0], {
              onAccept: (tripId) => acceptTrip(tripId),
              onViewMore: (trip) => {
                if (typeof window.__ridingoSetView === 'function') {
                  window.__ridingoSetView('driver', { tripId: trip?.id });
                }
              }
            });
          }
        } else if (!isCurrentDriverApp) {
          // User app must never have incoming driver trip request modal or sounds
          setIncomingTripRequest(null);
        } else {
          // If previous request was explicitly handled, accepted, declined, settled, or expired, clear it
          setIncomingTripRequest(prev => {
            if (prev) {
              const matchingTripInMapped = mapped.find(t => t.id === prev.id);
              const isHandled = matchingTripInMapped && matchingTripInMapped.status !== 'requested';
              const isDeclined = declinedTripIds.includes(prev.id);
              const isAccepted = acceptedTripIds.includes(prev.id) || acceptedTripIdsRef.current.has(prev.id);
              const isSettled = settledTripIds.includes(prev.id) || settledTripIdsRef.current.has(prev.id);
              const isExpired = prev.when_ts && (Date.now() - prev.when_ts > 15 * 60 * 1000);

              if (isHandled || isDeclined || isAccepted || isSettled || isExpired) {
                dismissIncomingRideNotification(prev.id);
                stopActiveTone();
                return null;
              }
            }
            return prev;
          });
        }

        // Notify User App if trip was accepted & auto-close tracking if trip ended or completed
        if (typeof window !== 'undefined' && window.RIDINGO_TARGET !== 'driver') {
          mapped.forEach(t => {
            if (t.status === 'accepted' && Math.abs(Date.now() - t.when_ts) < 2 * 60 * 60 * 1000) {
              const dName = (typeof t.driver === 'string' ? t.driver : t.driver?.name) || 'Ravi Kumar';
              const dPhone = t.driverObj?.phone || '+91 94471 23456';
              const otp = t.startOtp || '4821';
              notifyUserTripAccepted(t.id, dName, dPhone, otp);
            }
          });

          if (activeTrackingTripId) {
            const curTracked = mapped.find(t => t.id === activeTrackingTripId);
            if (curTracked && ['completed', 'cancelled', 'invoice_pending', 'ending_otp'].includes(curTracked.status)) {
              setLiveTrackingOpen(false);
              setActiveTrackingTripId(null);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Supabase] Sync trips error:', err);
    } finally {
      setTripsLoaded(true);
    }
  };

  // Subscribe to real-time communication between User and Driver apps
  useEffect(() => {
    // Proactively request notification permissions on user device if logged in
    if (typeof window !== 'undefined' && window.RIDINGO_TARGET !== 'driver') {
      try {
        if (isUserLoginComplete()) {
          requestUserNotificationPermission();
        }
      } catch (e) {}
    }

    // 1. Initial sync from Supabase database
    syncTripsFromSupabase();

    // 2. Continuous 3.5s polling loop to guarantee sandboxed iOS app sync
    const pollInterval = setInterval(() => {
      syncTripsFromSupabase();
    }, 3500);

    const unbindReq = realtime.on('TRIP_REQUESTED', (newTrip) => {
      setTrips(prev => {
        const exists = prev.some(t => t.id === newTrip.id);
        if (exists) {
          return prev.map(t => (t.id === newTrip.id ? { ...t, ...newTrip } : t));
        }
        return [newTrip, ...prev]; // Preserve all existing requests!
      });
      const isCurrentDriverApp =
        window.RIDINGO_TARGET === 'driver' ||
        viewRef.current === 'driver' ||
        (typeof window !== 'undefined' && (
          window.location.search.includes('view=driver') ||
          window.location.search.includes('app=driver') ||
          window.location.hash.includes('driver') ||
          window.location.pathname.includes('/driver')
        ));

      if (isCurrentDriverApp) {
        setIncomingTripRequest(newTrip);
        setDriverOnline(true);
        // Dispatch background push notification immediately if driver backgroundPush setting is enabled
        if (driverPartner?.backgroundPush !== false && isDriverLoginComplete()) {
          notifyIncomingRideRequest(newTrip, {
            onAccept: (tripId) => acceptTrip(tripId),
            onViewMore: (trip) => {
              if (typeof window.__ridingoSetView === 'function') {
                window.__ridingoSetView('driver', { tripId: trip?.id });
              }
            }
          });
        }
      }
    });

    // 4. Instant push sync via Supabase Realtime publication on public.trips table
    let pgChannel = null;
    try {
      if (supabase && typeof supabase.channel === 'function') {
        pgChannel = supabase
          .channel('public-trips-db-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'trips' },
            (payload) => {
              console.info('[Supabase Realtime] Database change:', payload.eventType, payload.new?.id);
              if (payload.new) {
                const tripObj = mapSupabaseRowToTrip(payload.new);
                if (tripObj) {
                  setTrips(prev => {
                    const mapById = new Map();
                    prev.forEach(t => mapById.set(t.id, t));
                    if (mapById.has(tripObj.id)) {
                      const localT = mapById.get(tripObj.id);
                      mapById.set(tripObj.id, mergeTripUpdates(localT, tripObj));
                    } else {
                      mapById.set(tripObj.id, tripObj);
                    }
                    return Array.from(mapById.values());
                  });

                  if (tripObj.status === 'requested') {
                    const isCurrentDriverApp =
                      window.RIDINGO_TARGET === 'driver' ||
                      (view === 'driver' && window.RIDINGO_TARGET !== 'user');

                    if (isCurrentDriverApp) {
                      let declinedTripIds = [];
                      try {
                        declinedTripIds = JSON.parse(localStorage.getItem('ridingo_declined_trips') || '[]');
                      } catch (_) {}
                      if (!declinedTripIds.includes(tripObj.id) && !acceptedTripIdsRef.current.has(tripObj.id) && !settledTripIdsRef.current.has(tripObj.id)) {
                        setIncomingTripRequest(tripObj);
                        if (driverPartner?.backgroundPush !== false && isDriverLoginComplete()) {
                          notifyIncomingRideRequest(tripObj, {
                            onAccept: (tripId) => acceptTrip(tripId),
                            onViewMore: (trip) => {
                              if (typeof window.__ridingoSetView === 'function') {
                                window.__ridingoSetView('driver', { tripId: trip?.id });
                              }
                            }
                          });
                        }
                      }
                    }
                  } else if (tripObj.status === 'accepted') {
                    const myDriverId = getDeviceDriverId(driverPartnerRef.current || driverPartner || DEFAULT_DRIVER);
                    const isAcceptedByMe = tripObj.driver_id && String(tripObj.driver_id) === String(myDriverId);
                    const currentUser = userRef.current;
                    const isTripForMe = currentUser && isUserTrip(tripObj, currentUser);

                    if (isAcceptedByMe) {
                      setIncomingTripRequest(prev => (prev?.id === tripObj.id ? null : prev));
                      dismissIncomingRideNotification(tripObj.id);
                      stopActiveTone();
                    } else if (isTripForMe) {
                      // User App: Strictly open tracking and notify ONLY if this trip belongs to the logged-in user
                      setIncomingTripRequest(prev => (prev?.id === tripObj.id ? null : prev));
                      dismissIncomingRideNotification(tripObj.id);
                      stopActiveTone();
                      setActiveTrackingTripId(tripObj.id);
                      setLiveTrackingOpen(true);
                      if (window.RIDINGO_TARGET !== 'driver') {
                        const driverName = (typeof tripObj.driver === 'string' ? tripObj.driver : tripObj.driver?.name) || 'Ravi Kumar';
                        const driverPhone = tripObj.driverObj?.phone || '+91 94471 23456';
                        const otp = tripObj.startOtp || '4821';
                        notifyUserTripAccepted(tripObj.id, driverName, driverPhone, otp);
                      }
                    } else {
                      // Trip is for another user, do not trigger UI popups or alerts
                      dismissIncomingRideNotification(tripObj.id);
                    }
                  } else if (tripObj.status === 'completed') {
                    const myDriverId = getDeviceDriverId(driverPartnerRef.current || driverPartner || DEFAULT_DRIVER);
                    const isMyTripAsDriver = tripObj.driver_id && String(tripObj.driver_id) === String(myDriverId);
                    const currentUser = userRef.current;
                    const isTripForMe = currentUser && isUserTrip(tripObj, currentUser);

                    setIncomingTripRequest(prev => (prev?.id === tripObj.id ? null : prev));
                    dismissIncomingRideNotification(tripObj.id);
                    stopActiveTone();

                    if (isTripForMe) {
                      setTrips(prev => prev.map(t => (t.id === tripObj.id ? { ...t, ...tripObj, status: 'completed' } : t)));
                      const dName = (typeof tripObj.driver === 'string' ? tripObj.driver : tripObj.driver?.name) || tripObj.driverObj?.name || 'Driver';
                      addNotification(
                        'Trip Completed! How was your ride?',
                        `Your trip with ${dName} is complete. Tap to rate your driver and share your experience.`,
                        'star',
                        {
                          category: 'trip_rating',
                          tripId: tripObj.id,
                          trip: tripObj,
                          driverName: dName,
                          canRate: true
                        }
                      );
                      setCompletedTripData(tripObj);
                      setTripCompleteModalOpen(true);
                      setLiveTrackingOpen(false);
                      setActiveTrackingTripId(null);
                    } else if (isMyTripAsDriver) {
                      setTrips(prev => prev.map(t => (t.id === tripObj.id ? { ...t, ...tripObj, status: 'completed' } : t)));
                    }
                  } else if (tripObj.status === 'invoice_pending' || tripObj.status === 'ending_otp') {
                    const currentUser = userRef.current;
                    const isTripForMe = currentUser && isUserTrip(tripObj, currentUser);
                    if (isTripForMe) {
                      setTrips(prev => prev.map(t => (t.id === tripObj.id ? { ...t, ...tripObj } : t)));
                      setCompletedTripData(tripObj);
                      setTripCompleteModalOpen(true);
                      setLiveTrackingOpen(false);
                      setActiveTrackingTripId(null);
                    }
                  } else if (tripObj.status === 'cancelled') {
                    const myDriverId = getDeviceDriverId(driverPartnerRef.current || driverPartner || DEFAULT_DRIVER);
                    const isMyTripAsDriver = tripObj.driver_id && String(tripObj.driver_id) === String(myDriverId);
                    const currentUser = userRef.current;
                    const isTripForMe = currentUser && isUserTrip(tripObj, currentUser);

                    setIncomingTripRequest(prev => (prev?.id === tripObj.id ? null : prev));
                    dismissIncomingRideNotification(tripObj.id);
                    stopActiveTone();

                    if (isTripForMe || isMyTripAsDriver) {
                      setTrips(prev => prev.map(t => (t.id === tripObj.id ? { ...t, status: 'cancelled' } : t)));
                      if (activeTrackingTripId === tripObj.id) {
                        setLiveTrackingOpen(false);
                        setActiveTrackingTripId(null);
                      }
                    }
                  }
                }
              }
            }
          )
          .subscribe((status) => {
            console.info('[Supabase Realtime] postgres_changes status:', status);
          });
      }
    } catch (err) {
      console.warn('[Supabase Realtime] Listener error:', err);
    }

    // App state resume listener for background sync (when user switches to Driver App on same device)
    let appStateHandle = null;
    try {
      CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          realtime.reconnect();
          syncTripsFromSupabase();
        }
      }).then(h => { appStateHandle = h; });
    } catch (e) {}

    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        syncTripsFromSupabase();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);

    const unbindAcc = realtime.on('TRIP_ACCEPTED', ({ tripId, driver, startOtp, otp, driverCoords }) => {
      const driverName = driver?.name || 'Ravi Kumar';
      const driverPhone = driver?.phone || '+91 94471 23456';
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      
      // Determine the exact booking OTP (never fall back to a random default)
      const foundTrip = trips.find(t => isMatch(t.id));
      const targetOtp = startOtp || otp || foundTrip?.startOtp || foundTrip?.car?.startOtp || foundTrip?.otp || '4821';
      const currentUser = userRef.current;
      const isTripForUser = currentUser && foundTrip && isUserTrip(foundTrip, currentUser);

      setTrips(prev =>
        prev.map(t => {
          if (isMatch(t.id)) {
            const finalOtp = startOtp || otp || t.startOtp || t.car?.startOtp || t.otp || targetOtp;
            return {
              ...t,
              status: 'accepted',
              driver: driverName,
              driverObj: driver,
              startOtp: finalOtp,
              ...(driverCoords ? { driverCoords } : {})
            };
          }
          return t;
        })
      );
      setIncomingTripRequest(prev => (prev && isMatch(prev.id) ? null : prev));
      dismissIncomingRideNotification(tripId);
      stopActiveTone();

      // Only notify and transition to live tracking if this trip belongs to the logged-in customer
      if (isTripForUser) {
        // 1. In-App Notification (Deduplicated so user notification tray only has 1 entry)
        const noteTag = `trip-acc-${tripId}`;
        setUnotes(prev => {
          if (prev.some(n => n.tag === noteTag || (n.extra?.tripId && normalizeTripKey(n.extra.tripId) === normalizeTripKey(tripId)))) {
            return prev;
          }
          return [
            {
              id: 'notif-' + Date.now(),
              ts: Date.now(),
              title: 'Driver Allocated',
              body: `${driverName} is on the way to your pickup. Share Pickup OTP: ${targetOtp} upon arrival.`,
              icon: 'car',
              read: false,
              tag: noteTag,
              extra: { tripId, driverName, otp: targetOtp }
            },
            ...prev
          ];
        });
        addToast(`Driver allocated! ${driverName} accepted your ride.`, 'check');

        // 2. Native Device Default System Push Notification for User App (Strictly Once)
        if (typeof window !== 'undefined' && window.RIDINGO_TARGET !== 'driver') {
          setActiveTrackingTripId(tripId);
          setLiveTrackingOpen(true);
          notifyUserTripAccepted(tripId, driverName, driverPhone, targetOtp);
        }
      }
    });

    const unbindArr = realtime.on('ARRIVED_PICKUP', ({ tripId }) => {
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      let targetOtp = '4821';
      const foundTrip = trips.find(t => isMatch(t.id));
      const currentUser = userRef.current;
      const isTripForUser = currentUser && foundTrip && isUserTrip(foundTrip, currentUser);

      setTrips(prev =>
        prev.map(t => {
          if (isMatch(t.id)) {
            targetOtp = t.startOtp || targetOtp;
            return { ...t, status: 'pickup_arrived' };
          }
          return t;
        })
      );

      if (isTripForUser) {
        addNotification(
          'Driver Arrived at Pickup',
          `Your driver is at your pickup location. Please share your 4-digit OTP: ${targetOtp}.`,
          'car'
        );
        addToast('Driver has arrived at pickup location.', 'info');
      }
    });

    const unbindOtp1 = realtime.on('START_OTP_VERIFIED', ({ tripId }) => {
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      setTrips(prev =>
        prev.map(t => (isMatch(t.id) ? { ...t, status: 'ready_to_start' } : t))
      );
      addToast('Pickup OTP verified. Trip ready to start.', 'check');
    });

    const unbindCond = realtime.on('CONDITION_VERIFIED', ({ tripId, photos, scratches }) => {
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      setTrips(prev =>
        prev.map(t => (isMatch(t.id) ? { ...t, status: 'ready_to_start', conditionPhotos: photos, conditionScratches: scratches } : t))
      );
      addToast('Vehicle condition check verified.', 'check');
    });

    const unbindStart = realtime.on('TRIP_STARTED', ({ tripId }) => {
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      const foundTrip = trips.find(t => isMatch(t.id));
      const currentUser = userRef.current;
      const isTripForUser = currentUser && foundTrip && isUserTrip(foundTrip, currentUser);

      setTrips(prev =>
        prev.map(t => (isMatch(t.id) ? { ...t, status: 'inprogress', startedAt: Date.now() } : t))
      );

      if (isTripForUser) {
        addNotification(
          'Trip in Progress',
          'Your driver has started the trip. Live GPS route tracking is active.',
          'map'
        );
        addToast('Trip started. Live tracking active.', 'check');
      }
    });

    const unbindEndReq = realtime.on('END_OTP_REQUESTED', ({ tripId }) => {
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      const foundTrip = trips.find(t => isMatch(t.id));
      const currentUser = userRef.current;
      const isTripForUser = currentUser && foundTrip && isUserTrip(foundTrip, currentUser);

      setTrips(prev =>
        prev.map(t => (isMatch(t.id) ? { ...t, status: 'invoice_pending', endedAt: Date.now() } : t))
      );

      if (isTripForUser) {
        setLiveTrackingOpen(false);
        setActiveTrackingTripId(null);
        setUTab('home');
        addNotification(
          'Arrived at Destination',
          'Trip ended at destination. Driver is finalizing invoice.',
          'flag'
        );
        addToast('Destination reached. Trip ended.', 'check');
      }
    });

    const unbindRideEnded = realtime.on('RIDE_ENDED', ({ tripId }) => {
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      const foundTrip = trips.find(t => isMatch(t.id));
      const currentUser = userRef.current;
      const isTripForUser = currentUser && foundTrip && isUserTrip(foundTrip, currentUser);

      setTrips(prev =>
        prev.map(t => (isMatch(t.id) ? { ...t, status: 'invoice_pending', endedAt: Date.now() } : t))
      );

      if (isTripForUser) {
        setLiveTrackingOpen(false);
        setActiveTrackingTripId(null);
        setUTab('home');
      }
    });

    // Local driver decline does not dismiss pop-up or tone on other drivers' devices
    // realtime.on('TRIP_DECLINED') intentionally omitted to allow other drivers to accept

    const handleTripCancelled = ({ tripId }) => {
      const isMatch = (id) => String(id) === String(tripId) || normalizeTripKey(id) === normalizeTripKey(tripId);
      const foundTrip = trips.find(t => isMatch(t.id));
      const currentUser = userRef.current;
      const currentDriver = driverPartnerRef.current;
      const myDriverId = getDeviceDriverId(currentDriver || DEFAULT_DRIVER);
      const isTripForUser = currentUser && foundTrip && isUserTrip(foundTrip, currentUser);
      const isTripForDriver = currentDriver && (foundTrip?.driver_id === myDriverId || foundTrip?.driverObj?.id === myDriverId);

      setIncomingTripRequest(prev => (prev && isMatch(prev.id) ? null : prev));
      dismissIncomingRideNotification(tripId);
      stopActiveTone();

      if (isTripForUser || isTripForDriver) {
        setTrips(prev => prev.filter(t => !isMatch(t.id)));
        setActiveTrackingTripId(prev => (prev && isMatch(prev) ? null : prev));
        setLiveTrackingOpen(false);
      }
    };
    const unbindCancel = realtime.on('TRIP_CANCELLED', handleTripCancelled);
    const unbindRideCancel = realtime.on('RIDE_CANCELLED', handleTripCancelled);

    const handleTripCompleted = ({ tripId, ...details }) => {
      const isMatch = (id) => id === tripId || normalizeTripKey(id) === normalizeTripKey(tripId);
      const foundTrip = trips.find(t => isMatch(t.id));
      const currentUser = userRef.current;
      const isTripForUser = currentUser && foundTrip && isUserTrip(foundTrip, currentUser);

      setTrips(prev =>
        prev.map(t => (isMatch(t.id) ? {
          ...t,
          status: 'completed',
          fare: details.fare || t.fare,
          baseFare: details.baseFare || t.baseFare || t.fare,
          extensionDistanceKm: details.extensionDistanceKm ?? t.extensionDistanceKm,
          extensionFare: details.extensionFare ?? t.extensionFare,
          waitingMinutes: details.waitingMinutes ?? t.waitingMinutes,
          waitingFare: details.waitingFare ?? t.waitingFare,
          advancePaid: details.advancePaid ?? t.advancePaid,
          balancePaid: details.balancePaid ?? t.balancePaid,
          invoiceText: details.invoiceText || t.invoiceText,
          completedAt: details.timestamp || Date.now()
        } : t))
      );

      if (isTripForUser) {
        setTrips(currentTrips => {
          const found = currentTrips.find(t => isMatch(t.id));
          const compTrip = found ? { ...found, ...details, status: 'completed' } : { id: tripId, ...details, status: 'completed' };
          setCompletedTripData(compTrip);

          const dName = (typeof compTrip.driver === 'string' ? compTrip.driver : compTrip.driver?.name) || compTrip.driverObj?.name || 'Driver';
          addNotification(
            'Trip Completed! How was your ride?',
            `Your trip with ${dName} is complete. Tap to rate your driver and share your experience.`,
            'star',
            {
              category: 'trip_rating',
              tripId,
              trip: compTrip,
              driverName: dName,
              canRate: true
            }
          );
          return currentTrips;
        });
        setTripCompleteModalOpen(true);
        setLiveTrackingOpen(false);
        setActiveTrackingTripId(null);
        setUTab('home');
      }
    };

    const unbindComp = realtime.on('TRIP_COMPLETED', handleTripCompleted);
    const unbindRideComp = realtime.on('RIDE_COMPLETED', handleTripCompleted);

    const unbindLoc = realtime.on('LOCATION_UPDATE', (telemetry) => {
      if (!telemetry?.tripId) return;
      setTrips(prev =>
        prev.map(t => {
          if (t.id === telemetry.tripId) {
            return {
              ...t,
              driverCoords: { lat: Number(telemetry.lat), lng: Number(telemetry.lng) },
              driverHeading: Number(telemetry.heading) || 0,
              driverSpeed: Number(telemetry.speed) || 0,
              lastLocationTs: telemetry.timestamp || Date.now()
            };
          }
          return t;
        })
      );
    });

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisChange);
      if (appStateHandle && typeof appStateHandle.remove === 'function') {
        appStateHandle.remove();
      }
      if (pgChannel && typeof supabase.removeChannel === 'function') {
        try { supabase.removeChannel(pgChannel); } catch (e) {}
      }
      unbindReq();
      unbindAcc();
      unbindArr();
      unbindOtp1();
      unbindCond();
      unbindStart();
      unbindEndReq();
      unbindRideEnded();
      unbindCancel();
      if (typeof unbindRideCancel === 'function') unbindRideCancel();
      unbindComp();
      unbindRideComp();
      unbindLoc();
    };
  }, []);

  const markAllNotifsRead = () => {
    setUnotes(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markNotifRead = (id) => {
    setUnotes(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const deleteNotif = (id) => {
    setUnotes(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifs = () => {
    setUnotes([]);
  };

  const addNotification = (title, body, icon = 'bell', extra = {}) => {
    const newNote = {
      id: 'notif-' + Date.now(),
      ts: Date.now(),
      title,
      body,
      icon,
      read: false,
      ...extra
    };
    setUnotes(prev => [newNote, ...prev]);
  };

  // Toast helper
  const addToast = (msg, icon = 'check') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  // Separate theme states: User App & Driver App are independent apps
  const [userTheme, setUserTheme] = useState(() => {
    try {
      return localStorage.getItem('ridingo_user_theme') || localStorage.getItem('ridingo_theme_pref') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  const [driverTheme, setDriverTheme] = useState(() => {
    try {
      return localStorage.getItem('ridingo_driver_theme') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  // Track system OS color scheme preference
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e) => setSystemIsDark(e.matches);
    media.addEventListener?.('change', handleMediaChange);
    return () => media.removeEventListener?.('change', handleMediaChange);
  }, []);

  const userThemeVal = userTheme === 'system' ? (systemIsDark ? 'dark' : 'light') : userTheme;
  const driverThemeVal = driverTheme === 'system' ? (systemIsDark ? 'dark' : 'light') : driverTheme;

  // Persist userTheme
  useEffect(() => {
    try {
      localStorage.setItem('ridingo_user_theme', userTheme);
      localStorage.setItem('ridingo_theme_pref', userTheme);
    } catch (e) {}
  }, [userTheme]);

  // Persist driverTheme
  useEffect(() => {
    try {
      localStorage.setItem('ridingo_driver_theme', driverTheme);
    } catch (e) {}
  }, [driverTheme]);

  // Pre-warm real device GPS location in background
  useEffect(() => {
    getDeviceLocation(false).catch(() => {});
  }, []);

  // Backward compatibility alias for single theme
  const theme = view === 'driver' ? driverTheme : userTheme;
  const setTheme = (val) => {
    if (view === 'driver') {
      setDriverTheme(val);
    } else {
      setUserTheme(val);
    }
  };

  // Sync root (document.documentElement / Capacitor) for standalone view or active tab
  useEffect(() => {
    try {
      const isStandaloneDriver = typeof document !== 'undefined' && (
        document.body?.classList?.contains('standalone-driver') ||
        window.location.search.includes('app=driver')
      );
      const activeThemeVal = (isStandaloneDriver || view === 'driver') ? driverThemeVal : userThemeVal;
      const isDark = activeThemeVal === 'dark';

      document.documentElement.setAttribute('data-theme', activeThemeVal);
      document.documentElement.style.colorScheme = activeThemeVal;
      document.body.setAttribute('data-theme', activeThemeVal);

      // Meta theme-color strictly matches app background color (var(--surface))
      const appBgColor = isDark ? '#0D0E12' : '#F2F2F7';
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', appBgColor);
      }

      // Capacitor StatusBar strictly matches app background
      if (window.Capacitor?.isPluginAvailable('StatusBar')) {
        StatusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' }).catch(() => {});
        StatusBar.setBackgroundColor({ color: appBgColor }).catch(() => {});
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      }
    } catch (e) {}
  }, [userThemeVal, driverThemeVal, view]);

  // Capacitor Android Back Button handler
  useEffect(() => {
    let backListener = null;
    try {
      if (window.Capacitor?.isPluginAvailable('App')) {
        CapApp.addListener('backButton', ({ canGoBack }) => {
          if (bookingOpen) {
            setBookingOpen(false);
          } else if (liveTrackingOpen) {
            setLiveTrackingOpen(false);
          } else if (notifsOpen) {
            setNotifsOpen(false);
          } else if (onboardingOpen) {
            setOnboardingOpen(false);
          } else if (uTab !== 'home') {
            setUTab('home');
          } else if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        }).then(h => {
          backListener = h;
        }).catch(() => {});
      }
    } catch (e) {}

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, [bookingOpen, onboardingOpen, uTab]);

  const scrollUserToTop = () => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('u-content');
      if (el) el.scrollTop = 0;
      window.requestAnimationFrame(() => {
        const el2 = document.getElementById('u-content');
        if (el2) el2.scrollTop = 0;
      });
    }
  };

  const scrollDriverToTop = () => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('d-content');
      if (el) el.scrollTop = 0;
      window.requestAnimationFrame(() => {
        const el2 = document.getElementById('d-content');
        if (el2) el2.scrollTop = 0;
      });
    }
  };

  // User session sync
  const loginDemo = () => {
    setUser(DEFAULT_USER);
    try {
      localStorage.setItem('ridingo_user_session', JSON.stringify(DEFAULT_USER));
      localStorage.setItem('ridingo_has_onboarded', 'true');
    } catch (e) {}
    setUTab('home');
    scrollUserToTop();
    setOnboardingOpen(false);
    addToast('Signed in as Arjun Menon', 'check');
    try {
      requestUserNotificationPermission();
    } catch (e) {}
  };

  const loginWithDetails = (userData = {}) => {
    const isGoogle = userData.provider === 'google' || !!userData.idToken;
    const computedName = userData.name || (userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : 'Ridingo Member');
    const ridingoId = userData.userId || userData.id || generateRidingoUserId();
    const cleanPhone = userData.phone
      ? (userData.phone.startsWith('+91') ? userData.phone : `+91 ${userData.phone}`)
      : '';
    const cleanEmail = userData.email || '';
    const compoundKey = getCompoundLoginKey(cleanPhone, cleanEmail);
    const sessionToken = userData.sessionToken || generateSessionToken();

    const updated = {
      ...DEFAULT_USER,
      ...userData,
      id: ridingoId,
      userId: ridingoId,
      name: computedName,
      firstName: userData.firstName || computedName.split(' ')[0],
      lastName: userData.lastName || (computedName.split(' ').slice(1).join(' ') || ''),
      email: cleanEmail,
      avatar: userData.avatar || DEFAULT_USER.avatar,
      phone: cleanPhone,
      sessionToken,
      compoundKey,
      emergencyPhone: userData.emergencyPhone || '',
      isAuthenticated: true,
      isDemo: false,
      authProvider: userData.provider || (isGoogle ? 'google' : (userData.authMethod || 'phone'))
    };
    setUser(updated);
    try {
      localStorage.setItem('ridingo_user_session', JSON.stringify(updated));
      localStorage.setItem('ridingo_has_onboarded', 'true');
    } catch (e) {}

    // Enforce single active session in Supabase: invalidate any prior session on other devices
    if (supabase && cleanPhone) {
      supabase.from('profiles').upsert({
        phone: cleanPhone,
        email: cleanEmail,
        name: computedName,
        preferences: {
          ridingoId,
          userId: ridingoId,
          activeSessionToken: sessionToken,
          activeCompoundKey: compoundKey,
          lastLoginAt: Date.now()
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' }).then(() => {}).catch(() => {});
    }

    setUTab('home');
    scrollUserToTop();
    setOnboardingOpen(false);
    addToast(`Welcome, ${updated.firstName || updated.name || 'User'}!`, 'check');
    try {
      requestUserNotificationPermission();
    } catch (e) {}
  };

  // Single Active Session Verification: Checks if account was logged in from another device
  useEffect(() => {
    if (!user?.phone || !user?.sessionToken || user?.isDemo) return;
    let isVerifying = false;

    const verifySingleSession = async () => {
      if (isVerifying || !supabase) return;
      isVerifying = true;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('phone', user.phone)
          .single();

        if (!error && data?.preferences?.activeSessionToken) {
          if (data.preferences.activeSessionToken !== user.sessionToken) {
            console.warn('[Session] Session invalidated: Account logged in on another device.');
            setUser(null);
            try {
              localStorage.removeItem('ridingo_user_session');
            } catch (e) {}
            addToast('Signed out: Your account was logged in on another device. Only 1 active session is allowed.', 'alert');
          }
        }
      } catch (e) {
      } finally {
        isVerifying = false;
      }
    };

    const sessionTimer = setInterval(verifySingleSession, 12000);
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        verifySingleSession();
      }
    };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      clearInterval(sessionTimer);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [user?.phone, user?.sessionToken, user?.isDemo]);

  // Single Active Session Verification for Driver Partner
  useEffect(() => {
    if (!driverPartner?.phone || !driverPartner?.sessionToken || driverPartner?.isDemo || driverPartner?.phone === DEFAULT_DRIVER.phone) return;
    let isVerifying = false;

    const verifyDriverSession = async () => {
      if (isVerifying || !supabase) return;
      isVerifying = true;
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('metadata')
          .eq('phone', driverPartner.phone)
          .single();

        if (!error && data?.metadata?.activeSessionToken) {
          if (data.metadata.activeSessionToken !== driverPartner.sessionToken) {
            console.warn('[Driver Session] Session invalidated: Driver account logged in on another device.');
            setDriverPartner(null);
            try {
              localStorage.removeItem('ridingo_driver_session');
            } catch (e) {}
            addToast('Signed out: Driver account logged in on another device. Only 1 active session allowed.', 'alert');
          }
        }
      } catch (e) {
      } finally {
        isVerifying = false;
      }
    };

    const driverSessionTimer = setInterval(verifyDriverSession, 12000);
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        verifyDriverSession();
      }
    };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      clearInterval(driverSessionTimer);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [driverPartner?.phone, driverPartner?.sessionToken, driverPartner?.isDemo]);

  const updateUserProfile = (updates) => {
    setUser(prev => {
      const next = { ...(prev || DEFAULT_USER), ...updates };
      try {
        localStorage.setItem('ridingo_user_session', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const updateDriverPartner = (updates) => {
    setDriverPartner(prev => {
      const next = { ...(prev || DEFAULT_DRIVER), ...updates };
      try {
        localStorage.setItem('ridingo_driver_session', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const loginDriverDemo = () => {
    const demoDriver = { ...DEFAULT_DRIVER, isDemo: true, id: getDeviceDriverId(DEFAULT_DRIVER) };
    setDriverPartner(demoDriver);
    try {
      localStorage.setItem('ridingo_driver_session', JSON.stringify(demoDriver));
    } catch (e) {}
    setDTab('dash');
    scrollDriverToTop();
    setDriverOnboardingOpen(false);
    addToast('Signed in as Ravi Kumar (Demo)', 'check');
    try {
      requestDriverNotificationPermission();
    } catch (e) {}
  };

  const loginDriverWithDetails = (driverData = {}) => {
    const sessionToken = driverData.sessionToken || generateSessionToken();
    const cleanPhone = driverData.phone
      ? driverData.phone.startsWith('+91') ? driverData.phone : `+91 ${driverData.phone}`
      : DEFAULT_DRIVER.phone;
    const cleanEmail = driverData.email || DEFAULT_DRIVER.email;
    const compoundKey = getCompoundLoginKey(cleanPhone, cleanEmail);

    const updated = {
      ...DEFAULT_DRIVER,
      ...driverData,
      phone: cleanPhone,
      email: cleanEmail,
      sessionToken,
      compoundKey
    };
    setDriverPartner(updated);
    try {
      localStorage.setItem('ridingo_driver_session', JSON.stringify(updated));
    } catch (e) {}

    // Sync driver session token to Supabase drivers table
    if (supabase && updated.id) {
      supabase.from('drivers').update({
        phone: cleanPhone,
        email: cleanEmail,
        metadata: {
          activeSessionToken: sessionToken,
          compoundKey,
          lastLoginAt: Date.now()
        },
        updated_at: new Date().toISOString()
      }).eq('id', updated.id).then(() => {}).catch(() => {});
    }

    setDTab('dash');
    scrollDriverToTop();
    setDriverOnboardingOpen(false);
    addToast(`Welcome, ${updated.name || 'Driver Partner'}!`, 'check');
    try {
      requestDriverNotificationPermission();
    } catch (e) {}
  };

  const logoutDriver = () => {
    setDriverPartner(null);
    try {
      localStorage.removeItem('ridingo_driver_session');
    } catch (e) {}
    setDTab('dash');
    scrollDriverToTop();
    setDriverOnboardingOpen(true);
    addToast('Signed out of Driver Partner account', 'info');
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('ridingo_user_session');
      localStorage.setItem('ridingo_has_onboarded', 'true');
    } catch (e) {}
    setUTab('home');
    scrollUserToTop();
    setOnboardingOpen(true);
    addToast('Logged out', 'info');
  };

  const resetDemo = () => {
    setUser(null);
    setDriverPartner(null);
    try {
      localStorage.removeItem('ridingo_cached_trips');
      localStorage.removeItem('ridingo_user_session');
      localStorage.removeItem('ridingo_driver_session');
      localStorage.removeItem('ridingo_accepted_trips');
      localStorage.removeItem('ridingo_settled_trips');
      localStorage.removeItem('ridingo_declined_trips');
      localStorage.removeItem('ridingo_active_tracking_trip_id');
      localStorage.removeItem('ridingo_live_tracking_open');
      localStorage.removeItem('ridingo_has_onboarded');
      localStorage.removeItem('ridingo_user_notified_accepted_trips');
      localStorage.removeItem('ridingo_registered_users_registry');
      localStorage.removeItem('ridingo_driver_balance');
      localStorage.removeItem('ridingo_driver_tx');
    } catch (e) {}
    setTrips([]);
    setUtx([]);
    setDriverBalance(0);
    setDriverTx([]);
    setBookingOpen(false);
    setOnboardingOpen(true);
    setDriverOnboardingOpen(true);
    setActiveTrackingTripId(null);
    setLiveTrackingOpen(false);
    setUTab('home');
    setDTab('dash');
    addToast('App reset. Clean fresh state active.', 'check');
  };

  const bookRide = (cat = 'hourly', qty = 2, pickup = 'Edappally Toll, Kochi', drop = 'City Route', fare = 600, advanceAmount, phonepePaymentId, schedule) => {
    const tripId = 'TRP-' + Math.floor(1000 + Math.random() * 9000);
    const pId = String(phonepePaymentId || ('pay_ppe_' + Date.now().toString(36)));
    const safeFare = Number(fare) || 600;
    const adv = advanceAmount !== undefined ? Number(advanceAmount) : Math.round(safeFare * 0.3);
    const cb = Math.round(safeFare * 0.05);
    const safeCat = String(cat || 'hourly');
    const safePickup = cleanLocationName((typeof pickup === 'string' && pickup.trim()) || 'Edappally Toll, Kochi');
    const safeDrop = cleanLocationName((typeof drop === 'string' && drop.trim()) || (safeCat === 'airport' ? 'Cochin International Airport (COK)' : 'City Route'));
    const scheduledDate = schedule?.date || null;
    const scheduledTime = schedule?.time || null;
    const tripTrans = schedule?.trans || 'Automatic';
    const rawDate = schedule?.rawDate || null;
    const rawTime = schedule?.rawTime || null;
    const scheduledTs = schedule?.scheduledTs || getTripScheduledTimestamp({ scheduledDate, scheduledTime, rawDate, rawTime, when_ts: Date.now() });

    const startOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const endOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const newTrip = {
      id: tripId,
      cat: safeCat,
      qty: Number(qty) || 2,
      pickup: safePickup,
      drop_loc: safeDrop,
      trans: tripTrans,
      car: { trans: tripTrans },
      when_ts: Date.now(),
      scheduledDate,
      scheduledTime,
      rawDate,
      rawTime,
      scheduledTs,
      scheduleDisplay: scheduledDate ? `${scheduledDate} · ${scheduledTime}` : 'Immediate Pickup',
      fare: safeFare,
      advance: adv,
      status: 'requested',
      startOtp,
      endOtp,
      conditionPhotos: { front: null, left: null, back: null, top: null },
      conditionScratches: [],
      conditionNotes: '',
      conditionVerified: false,
      paymentGateway: 'PhonePe',
      paymentId: pId,
      driver: null,
      rider: {
        id: user?.id || user?.userId || 'RDU-GUEST',
        userId: user?.id || user?.userId || 'RDU-GUEST',
        name: user?.name || 'Customer',
        phone: user?.phone || '+91 98401 23456',
        email: user?.email || ''
      },
      cashback: cb,
      cashbackStatus: 'pending',
      pickupCoords: schedule?.pickupCoords || null,
      dropCoords: schedule?.dropCoords || null,
      pickupDetails: schedule?.pickupDetails || null,
      dropDetails: schedule?.dropDetails || null,
      flightNo: schedule?.flightNo || null,
      airportType: schedule?.airportType || null,
      driverEarlyBuffer: schedule?.driverEarlyBuffer || null,
      distanceKm: schedule?.distanceKm || 12.4,
      distanceText: schedule?.distanceText || '12.4 km',
      durationMins: schedule?.durationMins || 28,
      durationText: schedule?.durationText || '28 mins',
      eta: schedule?.eta || null
    };

    // Record 30% advance payment in user transactions
    const newTx = {
      ts: Date.now(),
      type: 'trip',
      amount: -adv,
      title: `Ride Advance · ${safeCat.toUpperCase()}`,
      sub: `PhonePe (${pId.slice(0, 14)}) · Just now`,
      gateway: 'PhonePe',
      paymentId: pId
    };

    // Helper to persist full trip record in Supabase database
    const persistTripToSupabase = async (tripObj) => {
      try {
        if (!supabase || typeof supabase.from !== 'function') return;
        const row = {
          id: tripObj.id,
          cat: tripObj.cat,
          qty: tripObj.qty,
          pickup: tripObj.pickup,
          drop_loc: tripObj.drop_loc,
          when_ts: tripObj.when_ts,
          done_ts: 0,
          fare: tripObj.fare,
          advance: tripObj.advance,
          status: tripObj.status || 'requested',
          driver: null,
          otp: tripObj.startOtp,
          car: {
            model: tripObj.car?.model || 'Sedan',
            trans: tripObj.trans || tripObj.car?.trans || 'Automatic',
            plate: tripObj.car?.plate || 'KL 07 AB 4821',
            startOtp: tripObj.startOtp,
            endOtp: tripObj.endOtp,
            scheduledDate: tripObj.scheduledDate,
            scheduledTime: tripObj.scheduledTime,
            pickupCoords: tripObj.pickupCoords,
            dropCoords: tripObj.dropCoords,
            distanceKm: tripObj.distanceKm || null,
            distanceText: tripObj.distanceText || null,
            durationText: tripObj.durationText || null,
            eta: tripObj.eta || null
          },
          rider: tripObj.rider || { name: user?.name || 'Customer', phone: user?.phone || '+91 98401 23456' },
          cashback: tripObj.cashback || 0,
          by_who: user?.phone || 'user'
        };
        const { error } = await supabase.from('trips').upsert(row);
        if (error) {
          console.warn('[Supabase] Persist trip error:', error);
        } else {
          console.info('[Supabase] Trip stored in database:', tripObj.id);
        }
      } catch (e) {
        console.warn('[Supabase] Persist error:', e);
      }
    };

    setUtx(prev => [newTx, ...(Array.isArray(prev) ? prev : [])]);
    // Retain all existing requests and prepend new booking
    setTrips(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return [newTrip, ...arr.filter(t => t.id !== newTrip.id)];
    });
    setIncomingTripRequest(newTrip);

    // 1. Broadcast over WebSocket channel
    realtime.requestRide(newTrip);
    // 2. Persist in cloud Supabase table (accessible to sandboxed iOS apps)
    persistTripToSupabase(newTrip);

    setBookingOpen(false);
    setActiveTrackingTripId(newTrip.id);
    setLiveTrackingOpen(true);
    setUTab('home');
    addToast(`Booked ${safeCat.toUpperCase()} driver! ₹${adv} advance paid via PhonePe.`, 'check');
  };

  const updateTripStatusInSupabase = async (tripId, status, extra = {}) => {
    try {
      if (!supabase || typeof supabase.from !== 'function') return;
      const safeExtra = { ...extra };
      delete safeExtra.driver_location;
      delete safeExtra.driverCoords;
      delete safeExtra.driverHeading;
      delete safeExtra.driverSpeed;

      const { data, error } = await supabase.from('trips').update({
        status,
        updated_at: new Date().toISOString(),
        ...safeExtra
      }).eq('id', tripId).select();
      if (error) {
        console.warn('[Supabase] Status update error, retrying without extra:', error.message);
        await supabase.from('trips').update({
          status,
          updated_at: new Date().toISOString()
        }).eq('id', tripId);
      } else {
        console.info('[Supabase] Status update success:', tripId, status);
      }
    } catch (e) {
      console.warn('[Supabase] Status update error:', e);
    }
  };

  const acceptTrip = (tripId) => {
    // Record in persistent accepted tracking to prevent any popup glitch
    acceptedTripIdsRef.current.add(tripId);
    try {
      const existing = JSON.parse(localStorage.getItem('ridingo_accepted_trips') || '[]');
      if (!existing.includes(tripId)) {
        existing.push(tripId);
        localStorage.setItem('ridingo_accepted_trips', JSON.stringify(existing));
      }
    } catch (_) {}

    // Immediately clear from active requests storage to prevent popup re-triggering
    realtime.clearActiveTrip(tripId, 'accepted');

    const driver = driverPartner || DEFAULT_DRIVER;
    const driverId = getDeviceDriverId(driver);
    const driverObj = {
      ...driver,
      id: driverId,
      deviceDriverId: driverId
    };
    const currentTrip = trips.find(t => t.id === tripId);
    const targetOtp = currentTrip?.startOtp || currentTrip?.car?.startOtp || currentTrip?.otp || '4821';

    // 1. Capture real driver mobile GPS location immediately
    let initialDriverCoords = null;
    try {
      const cached = getCachedDeviceLocation();
      if (cached?.lat && cached?.lng) {
        initialDriverCoords = { lat: Number(cached.lat), lng: Number(cached.lng) };
      }
    } catch (_) {}

    if (!initialDriverCoords && currentTrip?.pickupCoords?.lat && currentTrip?.pickupCoords?.lng) {
      // Realistic starting position ~1.2km from passenger pickup for instant direction line
      initialDriverCoords = {
        lat: Number(currentTrip.pickupCoords.lat) - 0.0105,
        lng: Number(currentTrip.pickupCoords.lng) - 0.0082
      };
    } else if (!initialDriverCoords) {
      initialDriverCoords = { lat: 10.0155, lng: 76.3115 };
    }

    setTrips(prev =>
      prev.map(t => {
        if (t.id === tripId) {
          return {
            ...t,
            status: 'accepted',
            driver: driver.name,
            driver_id: driverId,
            driverObj,
            driverCoords: initialDriverCoords,
            driverHeading: 45,
            driverSpeed: 28,
            startOtp: targetOtp
          };
        }
        return t;
      })
    );
    setIncomingTripRequest(null);
    dismissIncomingRideNotification(tripId);
    stopActiveTone();

    // Driver-specific confirmation feedback
    addToast('Ride accepted. Proceeding to pickup location.', 'check');

    // Single native push notification for driver confirming trip accept with customer OTP
    notifyDriverTripAccepted({
      ...(currentTrip || {}),
      id: tripId,
      startOtp: targetOtp
    });

    // Broadcast across realtime bus & update Supabase (User app will receive TRIP_ACCEPTED strictly once)
    realtime.acceptRide(tripId, driverObj, targetOtp, initialDriverCoords);
    realtime.updateDriverLocation({
      tripId,
      lat: initialDriverCoords.lat,
      lng: initialDriverCoords.lng,
      heading: 45,
      speed: 28
    });

    updateTripStatusInSupabase(tripId, 'accepted', {
      driver: {
        ...driverObj,
        location: initialDriverCoords
      }
    });

    // Query hardware GPS asynchronously for freshest live fix
    getDeviceLocation(true).then(fresh => {
      if (fresh?.lat && fresh?.lng) {
        const liveGps = { lat: Number(fresh.lat), lng: Number(fresh.lng) };
        setTrips(prev =>
          prev.map(t => (t.id === tripId ? { ...t, driverCoords: liveGps } : t))
        );
        realtime.updateDriverLocation({
          tripId,
          lat: liveGps.lat,
          lng: liveGps.lng,
          heading: fresh.heading || 45,
          speed: fresh.speed || 28
        });
      }
    }).catch(() => {});
  };

  const arrivedAtPickup = (tripId) => {
    const myDriverId = getDeviceDriverId(driverPartnerRef.current || driverPartner || DEFAULT_DRIVER);
    const target = (trips || []).find(t => t.id === tripId);
    if (target && target.driver_id && String(target.driver_id) !== String(myDriverId)) {
      addToast('Unauthorized: This trip is assigned to another driver', 'alert');
      return;
    }
    let targetOtp = '4821';
    setTrips(prev =>
      prev.map(t => {
        if (t.id === tripId) {
          targetOtp = t.startOtp || targetOtp;
          return { ...t, status: 'pickup_arrived' };
        }
        return t;
      })
    );
    realtime.arrivedAtPickup(tripId);
    updateTripStatusInSupabase(tripId, 'pickup_arrived');
    addToast('Arrived at pickup location! Enter customer OTP to start ride.', 'info');
  };

  const verifyStartOtp = (tripId) => {
    setTrips(prev =>
      prev.map(t => (t.id === tripId ? { ...t, status: 'ready_to_start' } : t))
    );
    realtime.verifyStartOtp(tripId);
    updateTripStatusInSupabase(tripId, 'ready_to_start');
    addToast('Pickup OTP verified! Ready to start trip.', 'check');
  };

  const submitConditionCheck = (tripId, { photos, scratches, notes }) => {
    setTrips(prev =>
      prev.map(t => (t.id === tripId ? {
        ...t,
        status: 'ready_to_start',
        conditionPhotos: photos,
        conditionScratches: scratches || [],
        conditionNotes: notes || '',
        conditionVerified: true
      } : t))
    );
    realtime.verifyConditionCheck(tripId, photos, scratches);
    addToast('Car condition verified! You can now start the trip.', 'check');
  };

  const startTrip = (tripId, extra = {}) => {
    const myDriverId = getDeviceDriverId(driverPartnerRef.current || driverPartner || DEFAULT_DRIVER);
    const target = (trips || []).find(t => t.id === tripId);
    if (target && target.driver_id && String(target.driver_id) !== String(myDriverId)) {
      addToast('Unauthorized: This trip is assigned to another driver', 'alert');
      return;
    }
    setTrips(prev =>
      prev.map(t => (t.id === tripId ? {
        ...t,
        status: 'inprogress',
        startedAt: Date.now(),
        ...extra
      } : t))
    );
    realtime.startRide(tripId);
    updateTripStatusInSupabase(tripId, 'inprogress', extra);
    addToast('Trip started! Live GPS sharing activated.', 'check');
  };

  const requestEndTrip = (tripId) => {
    const myDriverId = getDeviceDriverId(driverPartnerRef.current || driverPartner || DEFAULT_DRIVER);
    const target = (trips || []).find(t => t.id === tripId);
    if (target && target.driver_id && String(target.driver_id) !== String(myDriverId)) {
      addToast('Unauthorized: This trip is assigned to another driver', 'alert');
      return;
    }
    // End trip directly without requiring customer OTP
    setTrips(prev =>
      prev.map(t => (t.id === tripId ? { ...t, status: 'invoice_pending', endedAt: Date.now() } : t))
    );
    realtime.requestEndTrip(tripId, null);
    updateTripStatusInSupabase(tripId, 'invoice_pending', { done_ts: Date.now() });
    // Immediately remove and close tracking popup on User App when trip ends
    setLiveTrackingOpen(false);
    setActiveTrackingTripId(null);
    setUTab('home');
    addToast('Destination reached! Trip ended. Please view invoice.', 'check');
  };

  const verifyEndOtp = (tripId) => {
    // Retained for direct workflow transition
    setTrips(prev =>
      prev.map(t => (t.id === tripId ? { ...t, status: 'invoice_pending', endedAt: Date.now() } : t))
    );
    // Immediately remove and close tracking popup on User App when trip ends
    setLiveTrackingOpen(false);
    setActiveTrackingTripId(null);
    setUTab('home');
  };

  const settleTripPayment = (tripId, {
    amount,
    fare,
    tip = 0,
    driverEarnings: explicitDriverEarnings,
    method = 'PhonePe UPI',
    isCash = false,
    baseFare,
    extensionDistanceKm,
    extensionFare,
    waitingMinutes,
    waitingFare,
    advancePaid,
    balancePaid,
    invoiceText,
    sharedToPhone,
    sharedToEmail
  } = {}) => {
    if (settledTripIdsRef.current.has(tripId)) {
      console.info('[settleTripPayment] Trip already settled, preventing duplicate:', tripId);
      return;
    }
    settledTripIdsRef.current.add(tripId);
    try {
      const existing = JSON.parse(localStorage.getItem('ridingo_settled_trips') || '[]');
      if (!existing.includes(tripId)) {
        existing.push(tripId);
        localStorage.setItem('ridingo_settled_trips', JSON.stringify(existing));
      }
    } catch (_) {}

    realtime.clearActiveTrip(tripId, 'completed');

    const tripFare = Number(fare) || Number(amount) || 750;
    const companyCommission = Math.round(tripFare * 0.30); // 30% platform fee
    const driverEarnings = Number(explicitDriverEarnings) || (Math.round(tripFare * 0.70) + Number(tip || 0)); // 70% driver payout + tip

    if (isCash) {
      // PENALTY: Increment Black Mark for accepting cash
      setDriverPartner(prev => ({
        ...prev,
        blackMarks: (prev?.blackMarks || 0) + 1
      }));
      addToast('Violation: 1 Black Mark issued for cash transaction!', 'warn');
    } else {
      addToast(`₹${driverEarnings} credited to Driver Wallet!`, 'check');
    }

    // Update driver partner wallet and persist to localStorage
    setDriverBalance(prev => {
      const nextBal = (Number(prev) || 0) + driverEarnings;
      try {
        localStorage.setItem('ridingo_driver_balance', String(nextBal));
      } catch (_) {}
      return nextBal;
    });

    const newTxItem = {
      id: 'tx-' + Date.now(),
      title: `Trip Earnings · ${method}`,
      sub: `Net 70% (₹${Math.round(tripFare * 0.70)}) + Tip (₹${tip}) · Settled`,
      amount: driverEarnings,
      type: 'fare',
      gateway: 'PhonePe Escrow',
      ts: Date.now(),
      time: new Date().toISOString()
    };

    setDriverTx(prev => {
      const nextTxList = [newTxItem, ...(Array.isArray(prev) ? prev : [])];
      try {
        localStorage.setItem('ridingo_driver_tx', JSON.stringify(nextTxList));
      } catch (_) {}
      return nextTxList;
    });

    // Mark trip complete directly without any end OTP
    setTrips(prev =>
      prev.map(t => (t.id === tripId ? {
        ...t,
        status: 'completed',
        completedAt: Date.now(),
        fare: tripFare,
        baseFare: baseFare || t.baseFare || t.fare,
        extensionDistanceKm: extensionDistanceKm ?? t.extensionDistanceKm,
        extensionFare: extensionFare ?? t.extensionFare,
        waitingMinutes: waitingMinutes ?? t.waitingMinutes,
        waitingFare: waitingFare ?? t.waitingFare,
        advancePaid: advancePaid ?? t.advancePaid,
        balancePaid: balancePaid ?? t.balancePaid,
        invoiceText: invoiceText || t.invoiceText,
        sharedToPhone,
        sharedToEmail,
        finalSettlement: {
          total: amount || tripFare,
          driverEarnings,
          commission: companyCommission,
          tip,
          method,
          isCash,
          baseFare,
          extensionDistanceKm,
          extensionFare,
          waitingMinutes,
          waitingFare,
          advancePaid,
          balancePaid,
          invoiceText,
          sharedToPhone,
          sharedToEmail
        }
      } : t))
    );

    realtime.completeRide(tripId, {
      amount: amount || tripFare,
      fare: tripFare,
      baseFare,
      extensionDistanceKm,
      extensionFare,
      waitingMinutes,
      waitingFare,
      advancePaid,
      balancePaid,
      invoiceText,
      tip,
      isCash
    });
    updateTripStatusInSupabase(tripId, 'completed', {
      done_ts: Date.now(),
      fare: amount || tripFare,
      base_fare: baseFare,
      extension_km: extensionDistanceKm,
      extension_fare: extensionFare,
      waiting_minutes: waitingMinutes,
      waiting_fare: waitingFare
    });

    // Auto-redirect User App to home if currently viewing this completed trip
    setLiveTrackingOpen(false);
    setActiveTrackingTripId(null);
    setUTab('home');
  };

  // Driver decline logic: Declining a trip locally does NOT affect other drivers
  const declineTrip = (tripId) => {
    // 1. Remove from incoming popup & active alert sound locally
    setIncomingTripRequest(prev => (prev?.id === tripId ? null : prev));
    stopActiveTone();
    dismissIncomingRideNotification(tripId);

    // 2. Mark as declined in driver's local history so it won't pop up again for this driver
    try {
      const declined = JSON.parse(localStorage.getItem('ridingo_declined_trips') || '[]');
      if (!declined.includes(tripId)) {
        declined.push(tripId);
        localStorage.setItem('ridingo_declined_trips', JSON.stringify(declined));
      }
    } catch (_) {}

    // 3. Remove locally from this driver's visible trips list
    setTrips(prev => prev.filter(t => t.id !== tripId));

    // Notice: Do NOT emit realtime.declineRide here so the trip remains active for other drivers!
    addToast('Trip request declined and removed from your queue', 'info');
  };

  // User/Customer cancel ride logic: Cancels the trip globally for all drivers with platform cancellation fee deduction
  const cancelTripByUser = (tripId, { feeOverride } = {}) => {
    const currentUser = userRef.current || user;
    if (!currentUser) {
      addToast('Please sign in to manage bookings', 'alert');
      return;
    }

    const targetTrip = (trips || []).find(t => t.id === tripId);
    if (!targetTrip) {
      addToast('Trip not found', 'alert');
      return;
    }

    // Strict authorization: Only the customer who owns the booking can cancel it
    if (!isUserTrip(targetTrip, currentUser)) {
      addToast('Unauthorized: You can only cancel your own bookings', 'alert');
      console.warn('[Security] Unauthorized trip cancellation attempt blocked for trip:', tripId);
      return;
    }

    const isDriverAssigned = targetTrip && (
      Boolean(targetTrip.driver) ||
      Boolean(targetTrip.driverId) ||
      Boolean(targetTrip.driver_id) ||
      ['accepted', 'pickup_arrived', 'ready_to_start', 'scheduled', 'on_the_way', 'arrived', 'started', 'in_progress'].includes(targetTrip.status)
    );

    // Platform cancellation policy:
    // - Trip NOT accepted by any driver: 100% FREE CANCELLATION (cancelFee = 0, full refund of advance)
    // - Trip ACCEPTED by driver: ₹100 driver cancellation penalty / platform fee applies
    const cancelFee = typeof feeOverride === 'number' ? feeOverride : (isDriverAssigned ? 100 : 0);
    const advancePaid = Number(targetTrip?.advance) || 0;
    const refundAmount = Math.max(0, advancePaid - cancelFee);

    // Update wallet transactions (utx) with cancellation fee & refund
    if (advancePaid > 0) {
      if (refundAmount > 0) {
        setUtx(prev => [
          {
            id: 'tx-ref-' + Date.now(),
            ts: Date.now(),
            type: 'refund',
            amount: refundAmount,
            title: `Trip Refund · ${tripId}`,
            sub: cancelFee > 0
              ? `₹${advancePaid} advance minus ₹${cancelFee} cancellation fine`
              : `₹${advancePaid} full advance refund (free cancellation)`,
            gateway: 'PhonePe Escrow'
          },
          ...prev
        ]);
      }
      if (cancelFee > 0) {
        const shortfall = cancelFee - advancePaid;
        if (shortfall > 0) {
          setUtx(prev => [
            {
              id: 'tx-fee-' + Date.now(),
              ts: Date.now(),
              type: 'fee',
              amount: -shortfall,
              title: `Cancellation Fine · ${tripId}`,
              sub: `Driver cancellation fine (exceeded advance)`,
              gateway: 'Ridingo Platform'
            },
            ...prev
          ]);
        }
      }
    } else if (cancelFee > 0) {
      setUtx(prev => [
        {
          id: 'tx-fee-' + Date.now(),
          ts: Date.now(),
          type: 'fee',
          amount: -cancelFee,
          title: `Cancellation Fine · ${tripId}`,
          sub: 'Cancellation fine (driver accepted)',
          gateway: 'Ridingo Platform'
        },
        ...prev
      ]);
    }

    setIncomingTripRequest(prev => (prev?.id === tripId ? null : prev));
    setTrips(prev => prev.map(t => (t.id === tripId ? {
      ...t,
      status: 'cancelled',
      cancelledBy: 'user',
      cancellationFee: cancelFee,
      refundAmount,
      cancelledAt: Date.now()
    } : t)));
    setActiveTrackingTripId(null);
    setLiveTrackingOpen(false);
    stopActiveTone();
    dismissIncomingRideNotification(tripId);

    realtime.cancelRide(tripId, { cancellationFee: cancelFee, refundAmount });
    updateTripStatusInSupabase(tripId, 'cancelled', {
      done_ts: Date.now()
    });

    addToast(
      refundAmount > 0
        ? `Booking cancelled. ₹${cancelFee} cancellation fee deducted, ₹${refundAmount} refunded.`
        : `Booking cancelled. ₹${cancelFee} cancellation fee applied.`,
      'info'
    );
  };

  const completeTrip = (tripId) => {
    settleTripPayment(tripId);
  };

  const userBalance = Math.max(0, Array.isArray(utx)
    ? utx.reduce((a, t) => a + (Number(t?.amount) || 0), 0)
    : 0);

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        userTheme,
        setUserTheme,
        userThemeVal,
        userIsDark: userThemeVal === 'dark',
        driverTheme,
        setDriverTheme,
        driverThemeVal,
        driverIsDark: driverThemeVal === 'dark',
        user,
        setUser,
        updateUserProfile,
        driverPartner,
        setDriverPartner,
        updateDriverPartner,
        loginDemo,
        loginWithDetails,
        logout,
        loginDriverDemo,
        loginDriverWithDetails,
        logoutDriver,
        scrollUserToTop,
        scrollDriverToTop,
        resetDemo,
        view,
        setView,
        uTab,
        setUTab,
        dTab,
        setDTab,
        trips,
        setTrips,
        tripsLoaded,
        tripsFilter,
        setTripsFilter,
        utx,
        setUtx,
        userBalance,
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
        notifsOpen,
        setNotifsOpen,
        unotes,
        setUnotes,
        markAllNotifsRead,
        markNotifRead,
        deleteNotif,
        clearAllNotifs,
        addNotification,
        bookRide,
        isUserTrip,
        acceptTrip,
        declineTrip,
        cancelTripByUser,
        arrivedAtPickup,
        verifyStartOtp,
        submitConditionCheck,
        startTrip,
        requestEndTrip,
        verifyEndOtp,
        settleTripPayment,
        incomingTripRequest,
        setIncomingTripRequest,
        completeTrip,
        driverOnline,
        setDriverOnline,
        driverBalance,
        setDriverBalance,
        driverTx,
        setDriverTx,
        toasts,
        addToast,
        liveTrackingOpen,
        setLiveTrackingOpen,
        activeTrackingTripId,
        setActiveTrackingTripId,
        onboardingOpen,
        setOnboardingOpen,
        driverOnboardingOpen,
        setDriverOnboardingOpen,
        legalModal,
        setLegalModal,
        openLegal,
        closeLegal,
        syncTripsFromSupabase,
        acceptedTripIdsRef,
        settledTripIdsRef,
        tripToCancel,
        setTripToCancel,
        tripCompleteModalOpen,
        setTripCompleteModalOpen,
        completedTripData,
        setCompletedTripData,
        termsConfirmationBanner,
        setTermsConfirmationBanner,
        isUpcomingFutureTrip,
        isTripTrackingUnlocked,
        getTripScheduledTimestamp,
        savedHomeLoc,
        setSavedHomeLoc,
        savedWorkLoc,
        setSavedWorkLoc,
        savedPlacesLoc,
        setSavedPlacesLoc,
        savedPlacesList,
        setSavedPlacesList,
        addSavedPlace,
        updateSavedPlace,
        removeSavedPlace,
        updateSavedLocation
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
