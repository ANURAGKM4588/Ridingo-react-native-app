import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Universal Native Device Location Service for Ridingo User & Driver Apps
 * 
 * Provides unified, direct native OS device location access across iOS & Android:
 * Routes all location requests through native device providers (Apple CoreLocation / Android LocationManager),
 * prompting ONLY the native OS permission dialog once.
 */

const activeWatchMap = new Map();

/**
 * Check device location permissions status
 * @returns {Promise<{ location: string, coarseLocation?: string }>}
 */
export async function checkLocationPermissions() {
  try {
    if (Capacitor.isNativePlatform()) {
      return await Geolocation.checkPermissions();
    }
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const res = await navigator.permissions.query({ name: 'geolocation' });
        return { location: res.state, coarseLocation: res.state };
      } catch (_) {}
    }
    return { location: 'prompt', coarseLocation: 'prompt' };
  } catch (err) {
    console.warn('[NativeLocation] Check permissions error:', err);
    return { location: 'prompt', coarseLocation: 'prompt' };
  }
}

/**
 * Request OS-level native location permission
 * Displays ONLY the device default system permission dialog (Allow / Deny)
 * @returns {Promise<{ location: string, coarseLocation?: string }>}
 */
export async function requestLocationPermissions() {
  try {
    if (Capacitor.isNativePlatform()) {
      return await Geolocation.requestPermissions();
    }
    // Web / Desktop / Mobile Browser:
    // Prompt the device's native browser permission popup (Allow / Block)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve({ location: 'granted', coarseLocation: 'granted' }),
          (err) => {
            const isDenied = err.code === 1; // 1 = PERMISSION_DENIED
            resolve({
              location: isDenied ? 'denied' : 'prompt',
              coarseLocation: isDenied ? 'denied' : 'prompt'
            });
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      });
    }
    return { location: 'prompt', coarseLocation: 'prompt' };
  } catch (err) {
    console.warn('[NativeLocation] Request permissions error:', err);
    return { location: 'denied', coarseLocation: 'denied' };
  }
}

/**
 * Request all required device default system permissions (Location & Notifications)
 * Triggers strictly the OS / device default system dialogs (Allow / Deny) with no in-app popups.
 */
export async function requestDevicePermissions() {
  const results = {};

  // 1. Device Location Permission (Native OS popup or Browser Allow/Block prompt)
  try {
    results.location = await requestLocationPermissions();
  } catch (err) {
    console.warn('[NativeLocation] Location request error:', err);
  }

  // 2. Device Notification Permission (Native OS popup or Browser prompt)
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        if (PushNotifications && typeof PushNotifications.requestPermissions === 'function') {
          await PushNotifications.requestPermissions();
        }
      } catch (_) {}

      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        if (LocalNotifications && typeof LocalNotifications.requestPermissions === 'function') {
          await LocalNotifications.requestPermissions();
        }
      } catch (_) {}
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (_) {}
    }
  } catch (notifErr) {
    console.warn('[NativeLocation] Notification request error:', notifErr);
  }

  return results;
}

/**
 * Get current device coordinates
 * On native iOS / Android: routes strictly through @capacitor/geolocation
 * On desktop browser: uses browser geolocation
 * 
 * @param {Object} options
 * @returns {Promise<{ coords: { latitude: number, longitude: number, accuracy: number, heading: number|null, speed: number|null }, timestamp: number }>}
 */
export async function getCurrentDevicePosition(options = {}) {
  const timeoutMs = options.timeout || 8000;
  const maxAge = options.maximumAge !== undefined ? options.maximumAge : 10000;

  // 1. Native Capacitor Geolocation (iOS & Android)
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          throw new Error('Location permission denied. Please allow location access in your device settings.');
        }
      }
      try {
        return await Geolocation.getCurrentPosition({
          enableHighAccuracy: options.enableHighAccuracy !== false,
          timeout: timeoutMs,
          maximumAge: maxAge
        });
      } catch (highErr) {
        // Fallback to coarse accuracy on device if high-accuracy GPS lock timed out
        return await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: timeoutMs + 2000,
          maximumAge: maxAge
        });
      }
    } catch (nativeErr) {
      console.warn('[NativeLocation] Native getCurrentPosition error:', nativeErr);
      throw nativeErr;
    }
  }

  // 2. Desktop Web Browser / Mobile Web Geolocation
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your device/browser'));
      return;
    }

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err1) => {
        // If explicitly denied by user, don't retry - fail with clear error
        if (err1 && err1.code === 1) {
          reject(new Error('Location permission denied. Please enable location permissions in browser settings.'));
          return;
        }

        // If timeout or unavailable, retry with low accuracy (Wi-Fi/cell triangulation)
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err2) => {
            reject(new Error(err2.message || 'Unable to retrieve real device location.'));
          },
          {
            enableHighAccuracy: false,
            timeout: timeoutMs,
            maximumAge: maxAge
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: Math.min(timeoutMs, 6000),
        maximumAge: maxAge
      }
    );
  });
}

/**
 * Continuously watch device position
 * 
 * @param {Object} options
 * @param {Function} onPosition
 * @param {Function} onError
 * @returns {Promise<string|number>} Watch ID for cancellation
 */
export async function watchDevicePosition(options = {}, onPosition, onError) {
  const defaultOpts = {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 3000,
    ...options
  };

  // 1. Native Capacitor Geolocation
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        await Geolocation.requestPermissions().catch(() => {});
      }
      const watchId = await Geolocation.watchPosition(defaultOpts, (pos, err) => {
        if (err) {
          if (onError) onError(err);
        } else if (pos && onPosition) {
          onPosition(pos);
        }
      });
      return watchId;
    } catch (err) {
      console.warn('[NativeLocation] Native watchPosition error:', err);
      if (onError) onError(err);
      throw err;
    }
  }

  // 2. Desktop Web Browser Fallback
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return navigator.geolocation.watchPosition(onPosition, onError, defaultOpts);
  }

  return null;
}

/**
 * Clear an active position watch
 * @param {string|number} watchId
 */
export async function clearDeviceWatch(watchId) {
  if (watchId === null || watchId === undefined) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await Geolocation.clearWatch({ id: String(watchId) });
    } catch (err) {
      console.warn('[NativeLocation] Native clearWatch error:', err);
    }
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.geolocation && typeof watchId === 'number') {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Install transparent runtime Geolocation Shield
 * 
 * Routes location requests directly through native device geolocation on mobile platforms.
 */
export function installNativeGeolocationShield() {
  if (!Capacitor.isNativePlatform() || typeof window === 'undefined' || !window.navigator) {
    return;
  }

  try {
    const interceptedGeolocation = {
      getCurrentPosition: (success, error, options) => {
        getCurrentDevicePosition(options)
          .then((pos) => {
            if (success) {
              success({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy || 10,
                  altitude: pos.coords.altitude || null,
                  altitudeAccuracy: pos.coords.altitudeAccuracy || null,
                  heading: pos.coords.heading || null,
                  speed: pos.coords.speed || null
                },
                timestamp: pos.timestamp || Date.now()
              });
            }
          })
          .catch((err) => {
            if (error) error(err);
          });
      },
      watchPosition: (success, error, options) => {
        const virtualId = Math.floor(Math.random() * 1000000) + 1;
        watchDevicePosition(options, success, error)
          .then((nativeId) => {
            activeWatchMap.set(virtualId, nativeId);
          })
          .catch((err) => {
            if (error) error(err);
          });
        return virtualId;
      },
      clearWatch: (virtualId) => {
        const nativeId = activeWatchMap.get(virtualId);
        if (nativeId) {
          clearDeviceWatch(nativeId);
          activeWatchMap.delete(virtualId);
        }
      }
    };

    try {
      Object.defineProperty(window.navigator, 'geolocation', {
        value: interceptedGeolocation,
        configurable: true,
        writable: true
      });
    } catch (_) {
      window.navigator.geolocation = interceptedGeolocation;
    }
    console.info('[NativeLocation] Native Geolocation Shield installed successfully.');
  } catch (err) {
    console.warn('[NativeLocation] Failed to install Native shield:', err);
  }
}

// Auto-install immediately upon module import on native platforms
installNativeGeolocationShield();
