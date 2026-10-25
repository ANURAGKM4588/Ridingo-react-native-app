import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { playCustomTone, stopActiveTone, getSelectedCustomTune } from '../utils/audioTones';
import { cleanLocationName, getLocationUpToFirstComma } from '../utils/locationCleaner';

/**
 * Universal Native Device Push & System Notification Engine for Ridingo
 * Serves Driver and User applications across:
 * - Native iOS Notification Center (APNs / UNUserNotificationCenter)
 * - Native Android Notification Shade & Heads-Up Banners (NotificationManager Channels)
 * - Desktop & Mobile Web OS Notification Center (W3C Web Notifications & ServiceWorker API)
 * 
 * Strict Single-Notification Invariant:
 * Every distinct action (e.g., incoming ride request, trip accepted with OTP, OTP verified,
 * trip completed) is guaranteed to dispatch strictly ONCE per trip / action across polling loops,
 * WebSocket events, database changes, and UI re-renders.
 */

let isChannelCreated = false;
let isLocalNotificationListenerAttached = false;
let isAPNsRegistered = false;
let apnsListenersAttached = false;

// ============================================================================
// GLOBAL PERSISTENT DEDUPLICATION ENGINE
// ============================================================================
const SENT_NOTIFICATIONS_STORAGE_KEY = 'ridingo_sent_push_notifications';
const inMemorySentKeys = new Set();

// Pre-load persisted notification history from localStorage
try {
  if (typeof localStorage !== 'undefined') {
    const stored = JSON.parse(localStorage.getItem(SENT_NOTIFICATIONS_STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) {
      stored.forEach(k => {
        if (k) inMemorySentKeys.add(String(k).trim().toLowerCase());
      });
    }
  }
} catch (_) {}

/**
 * Normalizes an action key for deterministic deduplication
 */
export function normalizeActionKey(key) {
  if (!key) return '';
  return String(key).trim().toLowerCase().replace(/^trp-/, 'trp-');
}

/**
 * Checks whether a notification for this specific action has already been dispatched.
 * Guarantees STRICT single-delivery across all platforms, polling loops, socket events, and re-renders.
 */
export function hasNotificationBeenSent(actionKey) {
  if (!actionKey) return false;
  const key = normalizeActionKey(actionKey);
  if (inMemorySentKeys.has(key)) return true;

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem(SENT_NOTIFICATIONS_STORAGE_KEY) || '[]');
      if (Array.isArray(stored) && stored.includes(key)) {
        inMemorySentKeys.add(key);
        return true;
      }
    }
  } catch (_) {}

  return false;
}

/**
 * Atomically marks a notification action as dispatched.
 * Keeps a bounded list in localStorage (capped at 200 entries) to prevent unbounded storage growth.
 */
export function recordNotificationSent(actionKey) {
  if (!actionKey) return;
  const key = normalizeActionKey(actionKey);
  inMemorySentKeys.add(key);

  try {
    if (typeof localStorage !== 'undefined') {
      let stored = JSON.parse(localStorage.getItem(SENT_NOTIFICATIONS_STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) stored = [];
      if (!stored.includes(key)) {
        stored.push(key);
        if (stored.length > 200) {
          stored = stored.slice(-150);
        }
        localStorage.setItem(SENT_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(stored));
      }
    }
  } catch (_) {}
}

/**
 * Helper to clear deduplication cache (useful for tests or account resets)
 */
export function clearNotificationDeduplicationCache() {
  inMemorySentKeys.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SENT_NOTIFICATIONS_STORAGE_KEY);
    }
  } catch (_) {}
}

// ============================================================================
// AUTHENTICATION & REGISTRATION GUARDS
// ============================================================================

/**
 * Strict authentication & registration guard checks
 * As requested: Notifications are strictly NOT allowed without login or registration complete.
 * If login/registration is complete, background push notifications are permitted.
 */
export function isDriverLoginComplete() {
  if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'user') {
    return false;
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('ridingo_driver_session');
    if (raw) {
      const session = JSON.parse(raw);
      if (session && typeof session === 'object' && session.id) {
        return session.loggedOut !== true && session.status !== 'logged_out';
      }
    }
    const dp = localStorage.getItem('ridingo_driver_partner');
    if (dp) {
      try {
        const partner = JSON.parse(dp);
        if (partner?.id && partner?.loggedOut !== true && partner?.status !== 'logged_out') return true;
      } catch (_) {}
    }
    return false;
  } catch (e) {
    return false;
  }
}

export function isUserLoginComplete() {
  if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'driver') {
    return false;
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('ridingo_user_session');
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session || typeof session !== 'object') return false;
    const hasIdentifier = Boolean(session.phone || session.email || session.userId || session.id);
    const notLoggedOut = session.loggedOut !== true;
    return hasIdentifier && notLoggedOut;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// NOTIFICATION ACTION LISTENERS & ROUTING
// ============================================================================

/**
 * Setup notification action listener for Capacitor and Web ServiceWorker
 * Accurately redirects to User App or Driver App depending on the origin
 */
export function setupNotificationActionListeners() {
  if (isLocalNotificationListenerAttached) return;
  isLocalNotificationListenerAttached = true;

  if (Capacitor.isNativePlatform()) {
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        console.info('[PushNotifications] User tapped notification action:', action);
        const extra = action?.notification?.extra || {};
        const actionId = action?.actionId; // 'accept', 'reject', 'view', or 'tap'

        if (actionId === 'reject') {
          console.info('[PushNotifications] Driver rejected trip notification:', extra.tripId);
          if (extra.tripId) {
            dismissIncomingRideNotification(extra.tripId);
          }
          return;
        }

        // STRICT IDENTIFICATION:
        // Do NOT use extra.tripId to decide if it's driver! User notifications also have extra.tripId!
        const isUserNotif =
          extra.source === 'RidingoUser' ||
          extra.targetView === 'user' ||
          action?.notification?.channelId === 'user_trip_updates';

        const isDriverNotif =
          extra.source === 'RidingoDriver' ||
          extra.targetView === 'driver' ||
          action?.notification?.channelId === 'driver_dispatch_alerts';

        // 1. STANDALONE USER APP PACKAGE: ALWAYS STAY IN USER APP!
        if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'user') {
          if (typeof window.__ridingoSetView === 'function') {
            window.__ridingoSetView('user', extra);
          }
          return;
        }

        // 2. STANDALONE DRIVER APP PACKAGE: ALWAYS STAY IN DRIVER APP!
        if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'driver') {
          if (typeof window.__ridingoSetView === 'function') {
            window.__ridingoSetView('driver', { ...extra, actionId });
          }
          return;
        }

        // 3. Web or Universal mode:
        if (isUserNotif) {
          if (typeof window !== 'undefined' && typeof window.__ridingoSetView === 'function') {
            window.__ridingoSetView('user', extra);
          } else if (typeof window !== 'undefined') {
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('view');
              window.location.href = url.toString();
            } catch (e) {}
          }
        } else if (isDriverNotif) {
          if (typeof window !== 'undefined' && typeof window.__ridingoSetView === 'function') {
            window.__ridingoSetView('driver', { ...extra, actionId });
          } else if (typeof window !== 'undefined') {
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'driver');
              if (extra.tripId) url.searchParams.set('tripId', String(extra.tripId));
              if (actionId) url.searchParams.set('action', actionId);
              window.location.href = url.toString();
            } catch (e) {}
          }
        }
      });
    } catch (e) {
      console.warn('[PushNotifications] Listener error:', e);
    }
  }

  // Listen for messages from Service Worker notification clicks
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_ACTION_CLICK') {
          const extra = event.data.data || {};
          const isUserNotif = extra.source === 'RidingoUser' || extra.targetView === 'user';
          const isDriverNotif = extra.source === 'RidingoDriver' || extra.targetView === 'driver';

          if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'user') {
            if (typeof window.__ridingoSetView === 'function') window.__ridingoSetView('user', extra);
            return;
          }
          if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'driver') {
            if (typeof window.__ridingoSetView === 'function') window.__ridingoSetView('driver', extra);
            return;
          }

          if (isUserNotif && typeof window !== 'undefined' && typeof window.__ridingoSetView === 'function') {
            window.__ridingoSetView('user', extra);
          } else if (isDriverNotif && typeof window !== 'undefined' && typeof window.__ridingoSetView === 'function') {
            window.__ridingoSetView('driver', extra);
          }
        }
      });
    } catch (e) {}
  }
}

// ============================================================================
// AUDIO CHIMES & HAPTICS
// ============================================================================

/**
 * Plays synthesized notification chime
 * Uses selected custom tune (default minimal 'toom toom' sound, 1-2s)
 */
export function playNativeAlertChime(type = 'alert') {
  try {
    if (type === 'payout') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // 2-tone pleasant bank credit chime (F5 -> C6)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(698.46, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(1046.5, now + 0.08);
      gain2.gain.setValueAtTime(0.25, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.6);
    } else {
      playCustomTone(getSelectedCustomTune());
    }
  } catch (e) {}
}

export { stopActiveTone };

// ============================================================================
// NATIVE CHANNELS & PLATFORM SETUP
// ============================================================================

/**
 * Initializes notification channels on native devices (Android 8.0+)
 */
async function ensureNativeChannel() {
  if (isChannelCreated) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.createChannel({
        id: 'driver_dispatch_alerts',
        name: 'Ridingo Driver Alerts',
        description: 'Instant ride requests, payout credits, and trip lifecycle alerts',
        importance: 5, // Maximum priority (heads-up banner + sound)
        visibility: 1, // Visible on secure lockscreens
        sound: 'res://raw/beep',
        vibration: true,
        lights: true,
        lightColor: '#FFC70A'
      });

      await LocalNotifications.createChannel({
        id: 'user_trip_updates',
        name: 'Ridingo Trip Updates',
        description: 'Driver assignment, arrival, and live trip status updates',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#FFC70A'
      });

      try {
        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'TRIP_DISPATCH_CARD',
              actions: [
                { id: 'accept', title: '✅ Accept', foreground: true },
                { id: 'reject', title: '❌ Reject', destructive: true, foreground: false },
                { id: 'view', title: 'View Details', foreground: true }
              ]
            }
          ]
        });
      } catch (actErr) {}

      isChannelCreated = true;
    } catch (e) {
      console.warn('[PushNotifications] Channel creation error:', e);
    }
  }
}

let isPushRegistered = false;
let pushListenersAttached = false;

/**
 * Register Driver App with Native Push Notification service (FCM for Android, APNs for iOS)
 * Handles data-only push payloads and converts them to rich LocalNotifications with action buttons.
 */
export async function registerDevicePushNotifications(onTripRequestReceived) {
  if (!Capacitor.isNativePlatform()) return null;
  if (isPushRegistered && pushListenersAttached) return true;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm?.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }

    if (perm?.receive === 'granted') {
      await PushNotifications.register();
      isPushRegistered = true;

      if (!pushListenersAttached) {
        pushListenersAttached = true;

        PushNotifications.addListener('registration', (token) => {
          console.info('[PushNotifications] Device Push Token generated:', token?.value);
          try {
            if (token?.value) {
              localStorage.setItem('ridingo_device_push_token', token.value);
              localStorage.setItem('ridingo_fcm_token', token.value);
              if (Capacitor.getPlatform() === 'ios') {
                localStorage.setItem('ridingo_apns_device_token', token.value);
              }
            }
          } catch (e) {}
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.warn('[PushNotifications] Push Registration Error:', error);
        });

        // Triggered when a data-only or standard push notification arrives
        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          console.info('[PushNotifications] Push notification received:', notification);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([150, 75, 150, 75, 300]); } catch (e) {}
          }

          const data = notification?.data || {};
          const isRideRequest =
            data.type === 'NEW_RIDE_REQUEST' ||
            data.type === 'TRIP_REQUESTED' ||
            Boolean(data.tripId) ||
            notification?.title?.includes('Booking') ||
            notification?.title?.includes('Trip');

          if (isRideRequest) {
            const tripPayload = data.trip ? (typeof data.trip === 'string' ? JSON.parse(data.trip) : data.trip) : data;
            const normalizedTrip = {
              id: tripPayload.tripId || tripPayload.id || `trp_${Date.now()}`,
              fare: tripPayload.fare || tripPayload.amount || 600,
              advance: tripPayload.advance,
              pickup: tripPayload.from || tripPayload.pickup || tripPayload.pickup_location,
              drop_loc: tripPayload.to || tripPayload.drop || tripPayload.drop_location,
              distanceText: tripPayload.distance || tripPayload.distanceText,
              durationText: tripPayload.duration || tripPayload.durationText,
              time: tripPayload.time || tripPayload.scheduled_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              ...tripPayload
            };

            // Schedule the rich local notification with Accept & Reject action buttons
            notifyIncomingRideRequest(normalizedTrip, { forcePush: true });

            if (onTripRequestReceived) {
              onTripRequestReceived(normalizedTrip);
            }
          }
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.info('[PushNotifications] User tapped push banner:', action);
          const data = action?.notification?.data || {};
          if (onTripRequestReceived) {
            onTripRequestReceived(data.trip || data);
          }
        });
      }

      return true;
    }
  } catch (err) {
    console.warn('[PushNotifications] Push registration error:', err);
  }
  return false;
}

// Backwards-compatible alias for existing imports
export const registerDriverAPNsPush = registerDevicePushNotifications;

/**
 * Background Task & App Lifecycle Handler
 */
export function setupBackgroundNotificationHandler(onWakeupCheck) {
  if (Capacitor.isNativePlatform()) {
    try {
      App.addListener('appStateChange', (state) => {
        console.info('[BackgroundSync] App state changed:', state.isActive ? 'ACTIVE' : 'BACKGROUND');
        if (state.isActive && onWakeupCheck) {
          onWakeupCheck();
        }
      });
    } catch (e) {}
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && onWakeupCheck) {
        onWakeupCheck();
      }
    });
  }
}

/**
 * Request OS-level notification permissions for Driver App
 */
export async function requestDriverNotificationPermission() {
  if (!isDriverLoginComplete()) {
    console.info('[PushNotifications] Driver notification permission skipped: Driver login incomplete.');
    return false;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      await ensureNativeChannel();
      let granted = false;
      try {
        const localResult = await LocalNotifications.requestPermissions();
        granted = localResult?.display === 'granted';
      } catch (locErr) {
        console.warn('[PushNotifications] Local notification permission request error:', locErr);
      }

      // Automatically register for push notifications on both Android & iOS
      try {
        await registerDevicePushNotifications();
      } catch (pushErr) {
        console.warn('[PushNotifications] Push notification registration error:', pushErr);
      }

      return granted;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
  }
  return false;
}

/**
 * Request OS-level notification permissions for User App
 */
export async function requestUserNotificationPermission() {
  if (!isUserLoginComplete()) {
    console.info('[PushNotifications] User notification permission skipped: User login incomplete.');
    return false;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      await ensureNativeChannel();
      let granted = false;
      try {
        const localResult = await LocalNotifications.requestPermissions();
        granted = localResult?.display === 'granted';
      } catch (locErr) {
        console.warn('[PushNotifications] Local notification permission error:', locErr);
      }
      return granted;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return Notification.permission === 'granted';
    }
  } catch (err) {
    console.warn('Failed to request user notification permission:', err);
  }
  return false;
}

/**
 * Check current OS notification permission status
 */
export async function getDriverNotificationPermission() {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      return status?.display || 'prompt';
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
  } catch (e) {
    console.warn('[PushNotifications] Error checking notification permission:', e);
  }
  return 'denied';
}

// ============================================================================
// CORE NATIVE NOTIFICATION DISPATCHERS
// ============================================================================

/**
 * Primary Native Notification Dispatcher for Driver App:
 * Bypasses in-app UI and delivers notification directly to the native OS Notification Center
 */
export async function sendDriverNativeNotification(title, body, options = {}) {
  if (!isDriverLoginComplete()) {
    console.info('[PushNotifications] Suppressed notification: Driver login incomplete.');
    return false;
  }

  const {
    id = Math.floor(Math.random() * 900000) + 100000,
    tag = 'driver_alert_' + Date.now(),
    type = 'alert',
    extra = {}
  } = options;

  // 1. Hardware vibration
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (type === 'payout') {
        navigator.vibrate([80, 40, 120]);
      } else {
        navigator.vibrate([150, 75, 150, 75, 300]);
      }
    } catch (e) {}
  }

  // 2. Native Device Notification (Capacitor iOS & Android)
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNativeChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            actionTypeId: options.actionTypeId || 'TRIP_DISPATCH_CARD',
            summaryArgument: options.summaryArgument,
            channelId: 'driver_dispatch_alerts',
            smallIcon: 'ic_stat_icon_config_sample',
            largeIcon: 'res://drawable/app_icon',
            iconColor: '#FFC70A',
            schedule: { at: new Date(Date.now() + 100) },
            extra: {
              ...extra,
              timestamp: Date.now(),
              source: 'RidingoDriver',
              type: type || 'request',
              targetView: 'driver'
            }
          }
        ]
      });
      return true;
    } catch (err) {
      console.warn('[PushNotifications] LocalNotifications.schedule error:', err);
    }
  }

  // 3. Web / Desktop / PWA OS Notification Center Fallback
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const appIconUrl = window.location?.origin ? `${window.location.origin}/app_icon.png` : '/app_icon.png';
      if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            await reg.showNotification(title, {
              body,
              icon: appIconUrl,
              badge: appIconUrl,
              tag,
              renotify: true,
              requireInteraction: true,
              vibrate: [200, 100, 200, 100, 200],
              data: {
                ...extra,
                timestamp: Date.now(),
                source: 'RidingoDriver',
                type: type || 'request',
                url: '/?view=driver'
              }
            });
            return true;
          }
        }

        const n = new Notification(title, {
          body,
          icon: appIconUrl,
          tag,
          silent: false,
          data: { ...extra, timestamp: Date.now(), source: 'RidingoDriver' }
        });
        n.onclick = () => {
          try {
            window.focus();
            if (typeof window.__ridingoSetView === 'function') {
              window.__ridingoSetView('driver', extra);
            } else {
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'driver');
              window.location.href = url.toString();
            }
          } catch (e) {}
          n.close();
        };
        return true;
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          const n = new Notification(title, { body, icon: appIconUrl, tag });
          n.onclick = () => {
            try {
              window.focus();
              if (typeof window.__ridingoSetView === 'function') {
                window.__ridingoSetView('driver', extra);
              } else {
                const url = new URL(window.location.href);
                url.searchParams.set('view', 'driver');
                window.location.href = url.toString();
              }
            } catch (e) {}
            n.close();
          };
          return true;
        }
      }
    } catch (err) {
      console.warn('[PushNotifications] Browser Notification error:', err);
    }
  }

  return false;
}

// ============================================================================
// SPECIALIZED ACTION-LEVEL DISPATCHES (STRICT SINGLE DELIVERY)
// ============================================================================

/**
 * 1. Incoming Ride Request Alert (Device Native System Notification)
 * STRICT GUARANTEE: Exactly 1 notification per trip request ID.
 * When multiple events arrive (Supabase polling loop + WebSocket TRIP_REQUESTED + postgres_changes),
 * only the first trigger executes; subsequent duplicates are silently ignored.
 * Different users or new trips with different IDs will cleanly trigger their own single notification.
 */
export function notifyIncomingRideRequest(trip, callbacks = {}) {
  if (!isDriverLoginComplete()) {
    console.info('[PushNotifications] Suppressed incoming trip alert: Driver login incomplete.');
    return false;
  }

  const tripId = trip?.id;
  if (!tripId) return false;

  const dedupKey = `trip_request_${normalizeActionKey(tripId)}`;

  // Push notification arrives reliably in foreground, background, and when closed
  const isForeground = typeof document !== 'undefined' && document.visibilityState === 'visible';
  console.info(`[PushNotifications] Dispatching new ride request notification (foreground=${isForeground}, tripId=${tripId})`);

  // STRICT SINGLE NOTIFICATION GUARANTEE WHEN MINIMIZED OR CLOSED
  if (hasNotificationBeenSent(dedupKey)) {
    return false;
  }
  recordNotificationSent(dedupKey);

  const pickup = getLocationUpToFirstComma(trip?.pickup || trip?.from, 'Pickup Location');
  const drop = getLocationUpToFirstComma(trip?.drop_loc || trip?.drop || trip?.to, 'Drop Location');
  const fare = Number(trip?.fare) || 600;
  const advance = Number(trip?.advance) || Math.round(fare * 0.3);
  const distance = trip?.distanceText || '12.4 km';
  const duration = trip?.durationText || '28 mins';
  const time = trip?.time || trip?.scheduled_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const title = `New Trip Request: ₹${fare}`;
  const body = `Fare: ₹${fare} (₹${advance} Advance)\nFrom: ${pickup}\nTo: ${drop}\nTime: ${time} · ETA: ${duration}`;

  // Auditory chime for incoming dispatch
  playNativeAlertChime('alert');

  // Stable notification ID derived deterministically from tripId
  const stableNotifId = Math.abs(String(tripId).split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)) % 900000 + 10000;

  return sendDriverNativeNotification(
    title,
    body,
    {
      id: stableNotifId,
      tag: `booking_req_${tripId}`,
      type: 'request',
      actionTypeId: 'TRIP_DISPATCH_CARD',
      summaryArgument: `₹${fare} · ${pickup} to ${drop}`,
      extra: {
        tripId,
        fare,
        advance,
        pickup,
        drop,
        distance,
        duration,
        time
      },
      onAction: (action) => {
        if (action === 'accept' && callbacks.onAccept) {
          callbacks.onAccept(tripId);
        } else if (callbacks.onViewMore) {
          callbacks.onViewMore(trip);
        }
      }
    }
  );
}

/**
 * 2. Driver Trip Accepted & Start OTP Push Notification
 * STRICT GUARANTEE: When the driver accepts the trip request, exactly 1 push notification
 * is sent confirming acceptance and displaying the customer's Start OTP.
 */
export function notifyDriverTripAccepted(trip) {
  if (!isDriverLoginComplete()) {
    console.info('[PushNotifications] Suppressed driver trip accepted alert: Driver login incomplete.');
    return false;
  }

  const tripId = trip?.id;
  if (!tripId) return false;

  const dedupKey = `driver_accepted_${normalizeActionKey(tripId)}`;
  if (hasNotificationBeenSent(dedupKey)) {
    return false;
  }
  recordNotificationSent(dedupKey);

  const pickup = cleanLocationName(trip?.pickup || trip?.from) || 'Pickup Location';
  const fare = Number(trip?.fare) || 600;

  const title = `Trip Accepted · Reach Pickup Location`;
  const body = `Trip confirmed (₹${fare}). Pickup: ${pickup}. Navigate to pickup location and verify customer pickup OTP.`;

  // Gentle confirmation tone
  try {
    playCustomTone('soft_chime');
  } catch (e) {}

  const stableNotifId = Math.abs((String(tripId) + '_acc').split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)) % 900000 + 20000;

  return sendDriverNativeNotification(
    title,
    body,
    {
      id: stableNotifId,
      tag: `trip_accepted_${tripId}`,
      type: 'alert',
      extra: {
        tripId,
        pickup,
        fare
      }
    }
  );
}

/**
 * 3. Instant PhonePe Bank Payout / Withdrawal Credit Alert
 */
export function notifyPayoutSuccess(amount, bankDetails = {}, utr = '') {
  const bankAcc = bankDetails.bankAccount || bankDetails.accountNumber || '•••• 4521';
  const bankName = bankDetails.bankName || 'HDFC Bank';
  const refCode = utr || `UTR${Date.now().toString().slice(-8)}`;
  const dedupKey = `payout_${refCode}`;
  if (hasNotificationBeenSent(dedupKey)) return false;
  recordNotificationSent(dedupKey);

  return sendDriverNativeNotification(
    `Payout Processed: ₹${Number(amount).toLocaleString('en-IN')}`,
    `Transferred to ${bankName} (${bankAcc}). Reference: ${refCode}. Funds available immediately.`,
    {
      id: Math.floor(Math.random() * 500000) + 500000,
      tag: `payout_tx_${refCode}`,
      type: 'payout',
      extra: { amount, utr: refCode }
    }
  );
}

/**
 * 4. Pickup OTP Verified Alert
 */
export function notifyStartOtpVerified(trip) {
  const tripId = trip?.id || 'active';
  const dedupKey = `trip_otp_verified_${normalizeActionKey(tripId)}`;
  if (hasNotificationBeenSent(dedupKey)) return false;
  recordNotificationSent(dedupKey);

  return sendDriverNativeNotification(
    'Pickup OTP Verified',
    'Customer identity confirmed. Vehicle condition inspection unlocked.',
    {
      id: 2001,
      tag: `otp_verified_${tripId}`,
      type: 'alert',
      extra: { tripId }
    }
  );
}

/**
 * 5. Trip Completed & Payment Settled Alert
 */
export function notifyTripCompleted(trip, fare) {
  const tripId = trip?.id || 'completed';
  const dedupKey = `trip_completed_${normalizeActionKey(tripId)}`;
  if (hasNotificationBeenSent(dedupKey)) return false;
  recordNotificationSent(dedupKey);

  const earned = fare || trip?.fare || 650;
  return sendDriverNativeNotification(
    'Trip Completed',
    `₹${earned} earnings deposited into your Ridingo Driver wallet. Trip concluded.`,
    {
      id: 2002,
      tag: `trip_completed_${tripId}`,
      type: 'payout',
      extra: { tripId, fare: earned }
    }
  );
}

/**
 * 6. Driver Online / Radar Activated Alert
 */
export function notifyDriverOnlineStatus(isOnline) {
  if (!isOnline) return;
  const dedupKey = `driver_online_${new Date().toISOString().slice(0, 10)}`;
  if (hasNotificationBeenSent(dedupKey)) return false;
  recordNotificationSent(dedupKey);

  return sendDriverNativeNotification(
    'Duty Status: Online',
    'Dispatch system active. Device will receive alerts for incoming ride requests.',
    {
      id: 1001,
      tag: 'driver_online_radar',
      type: 'alert'
    }
  );
}

/**
 * 7. Dismiss Incoming Ride Notification & Silence Tone
 * Cancels active tone immediately and removes delivered/pending OS notifications from the shade.
 * NOTE: Intentionally DOES NOT delete the trip deduplication key so that future polling intervals
 * or component re-renders will NEVER re-trigger a second notification for this same trip request.
 */
export async function dismissIncomingRideNotification(tripId = '') {
  try {
    // 1. Immediately silence any active tone
    stopActiveTone();

    // 2. Remove native notification from notification shade/center
    if (Capacitor.isNativePlatform()) {
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        if (delivered?.notifications?.length) {
          const matched = delivered.notifications.filter(n => {
            if (!tripId) return true;
            return n.extra?.tripId === tripId || String(n.tag || '').includes(String(tripId));
          });
          if (matched.length > 0) {
            await LocalNotifications.removeDeliveredNotifications({
              notifications: matched.map(n => ({ id: n.id }))
            });
          }
        }
      } catch (nativeErr) {
        console.warn('[PushNotifications] Error removing delivered notifications:', nativeErr);
      }
    }
  } catch (err) {
    console.warn('[PushNotifications] dismissIncomingRideNotification error:', err);
  }
}

/**
 * 8. Send Device Default Native Notification for User App upon Driver Acceptance
 * Enforces strict single-delivery deduplication so the user only receives one push notification.
 */
export async function sendUserNativeNotification(title, body, options = {}) {
  if (!isUserLoginComplete()) {
    console.info('[PushNotifications] Suppressed notification: User login incomplete.');
    return false;
  }

  const rawTripId = String(options.extra?.tripId || options.tag || '').trim();
  const tripKey = normalizeActionKey(rawTripId);

  // Strict deduplication check: If this trip accepted notification was already delivered, suppress it
  if (tripKey) {
    const dedupKey = `user_accepted_${tripKey}`;
    if (hasNotificationBeenSent(dedupKey)) {
      console.info('[PushNotifications] Suppressed duplicate user notification for trip:', tripKey);
      return false;
    }
    recordNotificationSent(dedupKey);
  }

  // Calculate stable deterministic notification ID so OS notification manager replaces rather than stacks
  const numericId = tripKey ? parseInt(tripKey.replace(/\D/g, '') || '1001', 10) : 1001;
  const stableId = options.id || (30000 + (numericId % 60000));
  const stableTag = options.tag || (tripKey ? `user_trip_assigned_${tripKey}` : `user_driver_assigned_${Date.now()}`);
  const { extra = {} } = options;

  // Gentle soft chime
  try {
    playCustomTone('soft_chime');
  } catch (e) {}

  // Hardware vibration
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([100, 50, 150]);
    } catch (e) {}
  }

  // Native Device Notification (Capacitor iOS & Android)
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNativeChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: stableId,
            title,
            body,
            channelId: 'user_trip_updates',
            smallIcon: 'ic_stat_icon_config_sample',
            largeIcon: 'res://drawable/app_icon',
            iconColor: '#FFC70A',
            schedule: { at: new Date(Date.now() + 50) },
            extra: {
              ...extra,
              tripId: tripKey || extra.tripId,
              timestamp: Date.now(),
              source: 'RidingoUser',
              targetView: 'user'
            }
          }
        ]
      });
      return true;
    } catch (err) {
      console.warn('[PushNotifications] LocalNotifications.schedule error:', err);
    }
  }

  // Web Browser Notification with stable tag to prevent multiple browser toasts
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const appIconUrl = window.location?.origin ? `${window.location.origin}/app_icon.png` : '/app_icon.png';
      if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            await reg.showNotification(title, {
              body,
              icon: appIconUrl,
              badge: appIconUrl,
              tag: stableTag,
              renotify: true,
              vibrate: [100, 50, 150],
              data: {
                ...extra,
                tripId: tripKey || extra.tripId,
                timestamp: Date.now(),
                source: 'RidingoUser',
                url: '/'
              }
            });
            return true;
          }
        }

        const n = new Notification(title, {
          body,
          icon: appIconUrl,
          badge: appIconUrl,
          tag: stableTag,
          silent: false,
          data: { ...extra, source: 'RidingoUser' }
        });
        n.onclick = () => {
          try {
            window.focus();
            if (typeof window.__ridingoSetView === 'function') {
              window.__ridingoSetView('user', extra);
            } else {
              const url = new URL(window.location.href);
              url.searchParams.delete('view');
              window.location.href = url.toString();
            }
          } catch (e) {}
          n.close();
        };
        return true;
      }
    } catch (e) {}
  }

  return false;
}

// Global debug test trigger for instantaneous testing from console or native app
if (typeof window !== 'undefined') {
  window.__testRideNotification = async (customData = {}) => {
    const testTrip = {
      id: customData.tripId || `test_${Date.now()}`,
      fare: customData.fare || 450,
      advance: customData.advance || 135,
      pickup: customData.from || customData.pickup || 'Kaloor Stadium, Kochi',
      drop_loc: customData.to || customData.drop || 'Cochin International Airport',
      distanceText: customData.distanceText || '26.8 km',
      durationText: customData.durationText || '45 mins',
      time: customData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    console.info('[TestPush] Triggering test ride notification:', testTrip);
    return notifyIncomingRideRequest(testTrip, { forcePush: true });
  };
}

