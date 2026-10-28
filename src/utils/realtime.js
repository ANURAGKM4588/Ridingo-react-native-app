/**
 * Real-Time Communication Hub between User App and Driver App
 * Connects User App and Driver App across:
 * 1. Supabase Cloud Realtime Channel (WebSockets across separate devices & mobile apps)
 * 2. BroadcastChannel ('ridingo_realtime_bus' across browser tabs)
 * 3. localStorage StorageEvent & Persistent Active Request cache
 */

import { supabase } from '../lib/supabase';

const ACTIVE_TRIP_KEY = 'ridingo_active_trip_request';
const ACTIVE_TRIP_REQUESTS_KEY = 'ridingo_active_trip_requests_v1';
const SHARED_TRIPS_KEY = 'ridingo_shared_trips';
const REALTIME_EVENT_KEY = 'ridingo_realtime_event';

class RealtimeHub {
  constructor() {
    this.listeners = new Map();
    this.clientId = 'client_' + Math.random().toString(36).slice(2) + '_' + Date.now();
    this.channel = null;
    this.sbChannel = null;
    this.isSbSubscribed = false;
    this.pendingSbMessages = [];

    if (typeof window !== 'undefined') {
      // 1. Browser BroadcastChannel
      try {
        if ('BroadcastChannel' in window) {
          this.channel = new BroadcastChannel('ridingo_realtime_bus');
          this.channel.onmessage = (event) => {
            if (event?.data && event.data.type && event.data.senderId !== this.clientId) {
              this._dispatchLocal(event.data.type, event.data.payload);
            }
          };
        }
      } catch (e) {
        console.warn('BroadcastChannel initialization fallback:', e);
      }

      // 2. localStorage StorageEvent fallback
      window.addEventListener('storage', (e) => {
        if (e.key === REALTIME_EVENT_KEY && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && data.type && data.senderId !== this.clientId) {
              this._dispatchLocal(data.type, data.payload);
            }
          } catch (err) {}
        }
      });

      // 3. Supabase Cloud Realtime WebSocket Channel with Broadcast & Presence
      this._initSupabaseChannel();

      // Auto-reconnect on visibility change / app resume
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.reconnect();
          }
        });
      }
    }
  }

  _initSupabaseChannel() {
    try {
      if (supabase && typeof supabase.channel === 'function') {
        if (this.sbChannel) {
          try { supabase.removeChannel(this.sbChannel); } catch (e) {}
        }
        this.isSbSubscribed = false;
        this.sbChannel = supabase.channel('ridingo_dispatch_bus', {
          config: {
            broadcast: { self: false, ack: true },
            presence: { key: this.clientId }
          }
        });
        this.sbChannel
          .on('broadcast', { event: 'dispatch' }, ({ payload }) => {
            if (payload && payload.type && payload.senderId !== this.clientId) {
              this._dispatchLocal(payload.type, payload.data);
            }
          })
          .subscribe((status) => {
            console.info('[Realtime] Supabase subscription status:', status);
            if (status === 'SUBSCRIBED') {
              this.isSbSubscribed = true;
              // Flush any buffered messages that were emitted before WebSocket connected
              while (this.pendingSbMessages.length > 0) {
                const msg = this.pendingSbMessages.shift();
                this.sbChannel.send(msg).catch(() => {});
              }
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              this.isSbSubscribed = false;
            }
          });
      }
    } catch (err) {
      console.warn('Supabase Realtime bus initialization error:', err);
    }
  }

  reconnect() {
    console.info('[Realtime] Resyncing realtime channels on app resume...');
    this._initSupabaseChannel();
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);

    // Return unbind function
    return () => {
      const set = this.listeners.get(type);
      if (set) {
        set.delete(callback);
      }
    };
  }

  _dispatchLocal(type, payload) {
    // Automatically manage persistent active trip storage
    if (type === 'TRIP_REQUESTED' && payload) {
      this._persistActiveTrip(payload);
    } else if (['TRIP_ACCEPTED', 'TRIP_DECLINED', 'TRIP_CANCELLED', 'TRIP_COMPLETED', 'RIDE_COMPLETED', 'RIDE_CANCELLED'].includes(type)) {
      const statusMap = {
        'TRIP_ACCEPTED': 'accepted',
        'TRIP_DECLINED': 'declined',
        'TRIP_CANCELLED': 'cancelled',
        'RIDE_CANCELLED': 'cancelled',
        'TRIP_COMPLETED': 'completed',
        'RIDE_COMPLETED': 'completed'
      };
      this._clearActiveTrip(payload?.tripId || payload?.id, statusMap[type] || 'accepted');
    }

    const set = this.listeners.get(type);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`Error in realtime listener for ${type}:`, e);
        }
      });
    }
  }

  emit(type, payload) {
    // 1. Dispatch locally in active context
    this._dispatchLocal(type, payload);

    // 2. Broadcast via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage({
          type,
          payload,
          senderId: this.clientId,
          timestamp: Date.now()
        });
      } catch (e) {}
    }

    // 3. Broadcast via localStorage storage event
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_EVENT_KEY,
          JSON.stringify({
            type,
            payload,
            senderId: this.clientId,
            ts: Date.now(),
            rand: Math.random()
          })
        );
      } catch (e) {}
    }

    // 4. Broadcast via Supabase Cloud Realtime Channel
    if (this.sbChannel && typeof this.sbChannel.send === 'function') {
      const msg = {
        type: 'broadcast',
        event: 'dispatch',
        payload: {
          type,
          data: payload,
          senderId: this.clientId,
          timestamp: Date.now()
        }
      };

      if (this.isSbSubscribed) {
        this.sbChannel.send(msg).catch(() => {
          this.pendingSbMessages.push(msg);
        });
      } else {
        // Channel is still establishing connection - buffer message so it is guaranteed to send on SUBSCRIBED
        this.pendingSbMessages.push(msg);
      }
    }
  }

  // Active Trip Persistence in localStorage
  _persistActiveTrip(trip) {
    if (typeof localStorage === 'undefined' || !trip) return;
    try {
      const now = Date.now();
      const expiresAt = now + 15 * 60 * 1000; // 15 minutes validity

      // 1. Single active trip backwards compatibility
      const singleRecord = {
        trip,
        timestamp: now,
        expiresAt
      };
      localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(singleRecord));

      // 2. Persistent list of multiple active requests
      const rawReqs = localStorage.getItem(ACTIVE_TRIP_REQUESTS_KEY);
      let reqList = [];
      if (rawReqs) {
        try {
          reqList = JSON.parse(rawReqs);
        } catch (e) {
          reqList = [];
        }
      }
      // Keep unexpired unaccepted requests and merge/prepend current trip
      reqList = Array.isArray(reqList)
        ? reqList.filter(r => r?.trip?.id && r.trip.id !== trip.id && (r.expiresAt ? now < r.expiresAt : true))
        : [];
      reqList.unshift({ trip, timestamp: now, expiresAt });
      localStorage.setItem(ACTIVE_TRIP_REQUESTS_KEY, JSON.stringify(reqList.slice(0, 50)));

      // 3. Shared trips cache - retain all requests without purging other pending requests!
      const raw = localStorage.getItem(SHARED_TRIPS_KEY);
      let list = raw ? JSON.parse(raw) : [];
      list = [trip, ...list.filter(t => t.id !== trip.id)].slice(0, 30);
      localStorage.setItem(SHARED_TRIPS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  _clearActiveTrip(tripId, newStatus = 'accepted') {
    if (typeof localStorage === 'undefined') return;
    try {
      // 1. Clear or update active requests list
      let remainingActive = [];
      const rawReqs = localStorage.getItem(ACTIVE_TRIP_REQUESTS_KEY);
      if (rawReqs) {
        try {
          const reqList = JSON.parse(rawReqs);
          if (Array.isArray(reqList)) {
            remainingActive = tripId ? reqList.filter(r => r?.trip?.id !== tripId) : [];
            localStorage.setItem(ACTIVE_TRIP_REQUESTS_KEY, JSON.stringify(remainingActive));
          }
        } catch (e) {}
      }

      // 2. Clear or advance single ACTIVE_TRIP_KEY
      const raw = localStorage.getItem(ACTIVE_TRIP_KEY);
      if (raw) {
        const record = JSON.parse(raw);
        if (!tripId || record?.trip?.id === tripId) {
          // If other active requests remain, point to the latest one
          const nextLatest = remainingActive.find(r => r?.trip?.status === 'requested');
          if (nextLatest) {
            localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(nextLatest));
          } else {
            localStorage.removeItem(ACTIVE_TRIP_KEY);
          }
        }
      }

      // 3. Update status in shared trips cache
      if (tripId) {
        const rawShared = localStorage.getItem(SHARED_TRIPS_KEY);
        if (rawShared) {
          try {
            let list = JSON.parse(rawShared);
            if (Array.isArray(list)) {
              list = list.map(t => (t.id === tripId ? { ...t, status: newStatus } : t));
              localStorage.setItem(SHARED_TRIPS_KEY, JSON.stringify(list));
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  clearActiveTrip(tripId, newStatus = 'accepted') {
    this._clearActiveTrip(tripId, newStatus);
  }

  getActiveTripRequests() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const now = Date.now();
      const raw = localStorage.getItem(ACTIVE_TRIP_REQUESTS_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const valid = list
            .filter(r => r?.trip && (!r.expiresAt || now < r.expiresAt) && r.trip.status === 'requested')
            .map(r => r.trip);
          if (valid.length > 0) return valid;
        }
      }
      // Direct single record fallback without recursion
      const singleRaw = localStorage.getItem(ACTIVE_TRIP_KEY);
      if (singleRaw) {
        const rec = JSON.parse(singleRaw);
        if (rec?.trip && (!rec.expiresAt || now < rec.expiresAt) && rec.trip.status === 'requested') {
          return [rec.trip];
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  getActiveTripRequest() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(ACTIVE_TRIP_KEY);
      if (raw) {
        const record = JSON.parse(raw);
        if (record && record.expiresAt && Date.now() < record.expiresAt && record.trip && record.trip.status === 'requested') {
          return record.trip;
        }
        localStorage.removeItem(ACTIVE_TRIP_KEY);
      }
      // Fallback to latest in list
      const rawList = localStorage.getItem(ACTIVE_TRIP_REQUESTS_KEY);
      if (rawList) {
        const list = JSON.parse(rawList);
        if (Array.isArray(list)) {
          const valid = list.find(r => r?.trip && (!r.expiresAt || Date.now() < r.expiresAt) && r.trip.status === 'requested');
          if (valid?.trip) return valid.trip;
        }
      }
    } catch (e) {}
    return null;
  }

  getSharedTrips() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SHARED_TRIPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // Convenience helper methods
  requestRide(trip) {
    if (!trip) return;
    this._persistActiveTrip(trip);
    this.emit('TRIP_REQUESTED', trip);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('RIDINGO_SHOW_CUSTOM_DRIVER_NOTIFICATION', { detail: { trip } }));
      window.dispatchEvent(new CustomEvent('RIDINGO_TRIP_REQUESTED', { detail: { trip } }));
    }
  }

  acceptRide(tripId, driver, startOtp, driverCoords = null) {
    this._clearActiveTrip(tripId, 'accepted');
    this.emit('TRIP_ACCEPTED', { tripId, driver, startOtp, driverCoords, timestamp: Date.now() });
  }

  declineRide(tripId) {
    this._clearActiveTrip(tripId, 'declined');
    this.emit('TRIP_DECLINED', { tripId, timestamp: Date.now() });
  }

  cancelRide(tripId) {
    this._clearActiveTrip(tripId, 'cancelled');
    this.emit('TRIP_CANCELLED', { tripId, timestamp: Date.now() });
    this.emit('RIDE_CANCELLED', { tripId, timestamp: Date.now() });
  }

  arrivedAtPickup(tripId) {
    this.emit('ARRIVED_PICKUP', { tripId, timestamp: Date.now() });
  }

  verifyStartOtp(tripId) {
    this.emit('START_OTP_VERIFIED', { tripId, timestamp: Date.now() });
  }

  verifyConditionCheck(tripId, photos, scratches) {
    this.emit('CONDITION_VERIFIED', { tripId, photos, scratches, timestamp: Date.now() });
  }

  startRide(tripId) {
    this.emit('TRIP_STARTED', { tripId, timestamp: Date.now() });
    this.emit('RIDE_STARTED', { tripId, timestamp: Date.now() });
  }

  requestEndTrip(tripId, endOtp) {
    this.emit('END_OTP_REQUESTED', { tripId, endOtp, timestamp: Date.now() });
    this.emit('RIDE_ENDED', { tripId, endOtp, timestamp: Date.now() });
  }

  // Live GPS Telemetry Stream (Driver App -> User App)
  updateDriverLocation({ tripId, lat, lng, heading = 0, speed = 0 }) {
    this.emit('LOCATION_UPDATE', {
      tripId,
      lat,
      lng,
      heading,
      speed,
      timestamp: Date.now()
    });
  }

  completeRide(tripId, details = {}) {
    this._clearActiveTrip(tripId, 'completed');
    this.emit('TRIP_COMPLETED', { tripId, ...details, timestamp: Date.now() });
    this.emit('RIDE_COMPLETED', { tripId, ...details, timestamp: Date.now() });
  }
}

/**
 * Secure 4-digit OTP Generator using WebCrypto API
 */
export function generateSecureOtp(length = 4) {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const min = Math.pow(10, length - 1);
      const max = Math.pow(10, length) - 1;
      return String(min + (array[0] % (max - min + 1)));
    }
  } catch (e) {}
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

export const realtime = new RealtimeHub();
export default realtime;
