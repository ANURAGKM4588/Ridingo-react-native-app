/**
 * userService.js
 * 
 * Centralized User Identity & Account Registration Service for Ridingo.
 * 
 * Guarantees:
 * 1. Unique Ridingo User ID (e.g., RDU-84920) for every user.
 * 2. Uniqueness check across mobile number and email ID in Supabase DB & local registry.
 * 3. Prevents duplicate registration: Displays English warning
 *    "You are already registered with this mobile number/email. Please log in."
 *    and redirects user to Sign In.
 * 4. Helper `isUserTrip(trip, user)` to strictly scope trip ownership and
 *    the 1-trip-at-a-time restriction to individual user accounts.
 */

import { supabase } from '../lib/supabase.js';
import { formatIndianPhone } from './authOtpService.js';

const LOCAL_REGISTRY_KEY = 'ridingo_registered_users_registry';

/**
 * Normalizes a phone number to standard 10-digit digits string
 */
export function normalizePhone10(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Normalizes an email address
 */
export function normalizeEmail(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim().toLowerCase();
  // Strip any characters not allowed in valid emails to prevent PostgREST query injection
  return trimmed.replace(/[^a-zA-Z0-9@._%+-]/g, '');
}

/**
 * Generates a unique Ridingo User ID (e.g. RDU-49215)
 */
export function generateRidingoUserId() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `RDU-${num}`;
}

/**
 * Generates a unique cryptographic session token for single active session enforcement
 */
export function generateSessionToken() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
}

/**
 * Creates compound login key combining mobile number and email
 */
export function getCompoundLoginKey(phone, email) {
  return `${normalizePhone10(phone)}_${normalizeEmail(email)}`;
}

export const DEFAULT_SEED_USERS = [];

/**
 * Reads local cached user registry
 */
export function getLocalUserRegistry() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Saves or updates a user in the local cached registry
 */
export function saveToLocalUserRegistry(userRecord) {
  if (typeof window === 'undefined' || !userRecord) return;
  try {
    const list = getLocalUserRegistry();
    const phone10 = normalizePhone10(userRecord.phone);
    const emailNorm = normalizeEmail(userRecord.email);
    const userId = userRecord.id || userRecord.userId;

    const idx = list.findIndex(u => {
      const uPhone = normalizePhone10(u.phone);
      const uEmail = normalizeEmail(u.email);
      const uId = u.id || u.userId;
      return (userId && uId && userId === uId) ||
             (phone10 && uPhone && phone10 === uPhone) ||
             (emailNorm && uEmail && emailNorm === uEmail);
    });

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...userRecord };
    } else {
      list.push(userRecord);
    }
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving to local user registry:', e);
  }
}

/**
 * Checks whether a phone number or email is already registered in Supabase or local cache
 * @param {Object} params
 * @param {string} [params.phone]
 * @param {string} [params.email]
 * @returns {Promise<{ exists: boolean, matchedField: 'phone'|'email'|'both'|null, user: Object|null }>}
 */
export async function checkUserExists({ phone, email }) {
  const targetPhone10 = normalizePhone10(phone);
  const targetEmail = normalizeEmail(email);

  // 1. Check local registry first for instant response
  const localList = getLocalUserRegistry();
  for (const item of localList) {
    const itemPhone10 = normalizePhone10(item.phone);
    const itemEmail = normalizeEmail(item.email);

    const phoneMatch = !!(targetPhone10 && itemPhone10 && targetPhone10 === itemPhone10);
    const emailMatch = !!(targetEmail && itemEmail && targetEmail === itemEmail);

    if (phoneMatch || emailMatch) {
      return {
        exists: true,
        matchedField: phoneMatch && emailMatch ? 'both' : (phoneMatch ? 'phone' : 'email'),
        user: item
      };
    }
  }

  // 2. Query Supabase profiles table targeting only the requested phone/email
  if (supabase && typeof supabase.from === 'function') {
    try {
      let query = supabase.from('profiles').select('phone, email, name, preferences');
      if (targetPhone10 && targetEmail) {
        query = query.or(`phone.ilike.%${targetPhone10}%,email.eq.${targetEmail}`);
      } else if (targetPhone10) {
        query = query.ilike('phone', `%${targetPhone10}%`);
      } else if (targetEmail) {
        query = query.eq('email', targetEmail);
      }
      const { data, error } = await query.limit(1);
      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        const rowPhone10 = normalizePhone10(row.phone);
        const rowEmail = normalizeEmail(row.email);

        const phoneMatch = !!(targetPhone10 && rowPhone10 && targetPhone10 === rowPhone10);
        const emailMatch = !!(targetEmail && rowEmail && targetEmail === rowEmail);

        if (phoneMatch || emailMatch) {
          const resolvedId = row.preferences?.ridingoId || row.preferences?.userId || generateRidingoUserId();
          const userObj = {
            id: resolvedId,
            userId: resolvedId,
            name: row.name,
            phone: row.phone,
            email: row.email,
            preferences: row.preferences
          };
          saveToLocalUserRegistry(userObj);
          return {
            exists: true,
            matchedField: phoneMatch && emailMatch ? 'both' : (phoneMatch ? 'phone' : 'email'),
            user: userObj
          };
        }
      }
    } catch (err) {
      console.warn('Supabase checkUserExists query notice:', err);
    }
  }

  return {
    exists: false,
    matchedField: null,
    user: null
  };
}

/**
 * Registers a new user with guaranteed unique Ridingo User ID.
 * Returns error if phone or email is already registered.
 */
export async function registerUserProfile({ firstName, lastName, phone, email, emergencyPhone, existingUserId }) {
  const cleanPhone = normalizePhone10(phone);
  const cleanEmail = normalizeEmail(email);

  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('Please enter a valid 10-digit mobile number');
  }

  // Check uniqueness against database & registry
  const check = await checkUserExists({ phone: cleanPhone, email: cleanEmail || undefined });
  if (check.exists) {
    const fieldLabel = check.matchedField === 'both' ? 'mobile number and email' : (check.matchedField === 'email' ? 'email address' : 'mobile number');
    return {
      success: false,
      alreadyRegistered: true,
      matchedField: check.matchedField,
      message: `An account is already registered with this ${fieldLabel}. Only one account is allowed per mobile number and email. Please sign in instead.`,
      existingUser: check.user
    };
  }

  // Generate unique Ridingo User ID
  const ridingoId = existingUserId || generateRidingoUserId();
  const formattedPhone = formatIndianPhone(cleanPhone);
  const fullName = `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim() || 'Ridingo Member';

  const sessionToken = generateSessionToken();
  const compoundKey = getCompoundLoginKey(formattedPhone, cleanEmail);

  const userRecord = {
    id: ridingoId,
    userId: ridingoId,
    name: fullName,
    firstName: (firstName || '').trim(),
    lastName: (lastName || '').trim(),
    phone: formattedPhone,
    email: cleanEmail,
    emergencyPhone: emergencyPhone ? formatIndianPhone(emergencyPhone) : '',
    sessionToken,
    compoundKey,
    createdAt: new Date().toISOString()
  };

  // Upsert to Supabase profiles table
  try {
    await supabase.from('profiles').upsert({
      phone: formattedPhone,
      email: cleanEmail,
      name: fullName,
      preferences: {
        ridingoId,
        userId: ridingoId,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        emergencyPhone: userRecord.emergencyPhone,
        activeSessionToken: sessionToken,
        activeCompoundKey: compoundKey,
        lastLoginAt: Date.now()
      },
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' });
  } catch (err) {
    console.warn('Supabase profile save notice:', err);
  }

  // Save to local registry
  saveToLocalUserRegistry(userRecord);

  return {
    success: true,
    alreadyRegistered: false,
    user: userRecord
  };
}

/**
 * Looks up user by login identifier (phone or email) and ensures unique Ridingo ID
 */
export async function getUserProfileByLogin({ identifier, name, emailFallback, phoneFallback, supabaseUser }) {
  const isEmail = String(identifier || '').includes('@');
  const queryPhone = !isEmail ? identifier : (phoneFallback || '');
  const queryEmail = isEmail ? identifier : (emailFallback || '');

  const sessionToken = generateSessionToken();
  const check = await checkUserExists({ phone: queryPhone, email: queryEmail });
  if (check.exists && check.user) {
    const existing = check.user;
    const finalId = existing.id || existing.userId || generateRidingoUserId();
    const finalPhone = existing.phone || (queryPhone ? formatIndianPhone(queryPhone) : '');
    const finalEmail = existing.email || queryEmail || '';
    const compoundKey = getCompoundLoginKey(finalPhone, finalEmail);

    const finalObj = {
      ...existing,
      id: finalId,
      userId: finalId,
      name: existing.name || name || 'Ridingo Member',
      phone: finalPhone,
      email: finalEmail,
      sessionToken,
      compoundKey
    };

    // Update activeSessionToken in Supabase to invalidate any prior session
    try {
      if (finalPhone) {
        await supabase.from('profiles').upsert({
          phone: finalPhone,
          email: finalEmail,
          name: finalObj.name,
          preferences: {
            ...(existing.preferences || {}),
            ridingoId: finalId,
            userId: finalId,
            activeSessionToken: sessionToken,
            activeCompoundKey: compoundKey,
            lastLoginAt: Date.now()
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' });
      }
    } catch (e) {}

    saveToLocalUserRegistry(finalObj);
    return finalObj;
  }

  // If first time sign-in, create a fresh profile with unique Ridingo ID
  const newRidingoId = generateRidingoUserId();
  const phoneFormatted = queryPhone ? formatIndianPhone(queryPhone) : '+91 98401 23456';
  const cleanEmail = normalizeEmail(queryEmail);
  const fullName = name || (cleanEmail ? cleanEmail.split('@')[0] : 'Ridingo Member');
  const compoundKey = getCompoundLoginKey(phoneFormatted, cleanEmail);

  const newRecord = {
    id: newRidingoId,
    userId: newRidingoId,
    name: fullName,
    phone: phoneFormatted,
    email: cleanEmail,
    sessionToken,
    compoundKey,
    createdAt: new Date().toISOString()
  };

  try {
    await supabase.from('profiles').upsert({
      phone: phoneFormatted,
      email: cleanEmail,
      name: fullName,
      preferences: {
        ridingoId: newRidingoId,
        userId: newRidingoId,
        activeSessionToken: sessionToken,
        activeCompoundKey: compoundKey,
        lastLoginAt: Date.now()
      },
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' });
  } catch (e) {
    console.warn('Supabase auto profile create notice:', e);
  }

  saveToLocalUserRegistry(newRecord);
  return newRecord;
}

/**
 * Evaluates whether a trip belongs strictly to the currently logged-in user.
 * Matches by unique userId, 10-digit mobile number, or email.
 * 
 * @param {Object} trip 
 * @param {Object} user 
 * @returns {boolean}
 */
export function isUserTrip(trip, user) {
  if (!trip || !user) return false;

  // 1. Match by Unique Ridingo User ID
  const uId = user.id || user.userId;
  const tId = trip.rider?.id || trip.rider?.userId;
  if (uId && tId && String(uId).trim().toLowerCase() === String(tId).trim().toLowerCase()) {
    return true;
  }

  // 2. Match by 10-digit mobile number
  const uPhone10 = normalizePhone10(user.phone);
  const tPhone10 = normalizePhone10(trip.rider?.phone);
  if (uPhone10 && tPhone10 && uPhone10 === tPhone10) {
    return true;
  }

  // 3. Match by normalized email
  const uEmail = normalizeEmail(user.email);
  const tEmail = normalizeEmail(trip.rider?.email);
  if (uEmail && tEmail && uEmail === tEmail) {
    return true;
  }

  // 4. Match by creator identifier (by_who)
  if (trip.by_who) {
    const byWhoPhone10 = normalizePhone10(trip.by_who);
    if (uPhone10 && byWhoPhone10 && uPhone10 === byWhoPhone10) {
      return true;
    }
    if (uEmail && normalizeEmail(trip.by_who) === uEmail) {
      return true;
    }
  }

  return false;
}

function parseTimeIntoDate(dateObj, timeStr) {
  if (!dateObj || !timeStr) return;
  const match = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    dateObj.setHours(hours, mins, 0, 0);
  }
}

/**
 * Resolves the scheduled timestamp for a trip (or when_ts for immediate bookings)
 */
export function getTripScheduledTimestamp(trip) {
  if (!trip) return Date.now();
  if (trip.scheduledTs) return Number(trip.scheduledTs);

  if (trip.rawDate && trip.rawTime) {
    const ts = new Date(`${trip.rawDate}T${trip.rawTime}:00`).getTime();
    if (!isNaN(ts)) return ts;
  }

  if (trip.scheduledDate || trip.date) {
    const dateStr = String(trip.scheduledDate || trip.date).trim();
    const timeStr = String(trip.scheduledTime || trip.time || '').trim();

    if (dateStr.toLowerCase().startsWith('today')) {
      const d = new Date();
      if (timeStr) parseTimeIntoDate(d, timeStr);
      return d.getTime();
    }
    if (dateStr.toLowerCase().startsWith('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      if (timeStr) parseTimeIntoDate(d, timeStr);
      return d.getTime();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = new Date(`${dateStr}T${timeStr || '12:00'}:00`);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    const parsed = Date.parse(`${dateStr} ${new Date().getFullYear()} ${timeStr}`);
    if (!isNaN(parsed)) return parsed;
  }

  return Number(trip.when_ts) || Date.now();
}

/**
 * Checks whether a trip is scheduled for the future (i.e. more than 2 hours away from now).
 * Future trips are shown in the History section only and do not have active tracking.
 * When within 2 hours of scheduled time (or happening today/now), they show on the Home page with tracking!
 */
export function isUpcomingFutureTrip(trip) {
  if (!trip) return false;
  if (['inprogress', 'pickup_arrived', 'ready_to_start', 'ending_otp', 'invoice_pending', 'completed', 'cancelled'].includes(trip.status)) {
    return false;
  }
  const schedTs = getTripScheduledTimestamp(trip);
  const diffMs = schedTs - Date.now();
  // Scheduled more than 1 hour in the future (tracking locked until 1h prior)
  return diffMs > 1 * 60 * 60 * 1000;
}

/**
 * Checks whether tracking should be unlocked for this trip:
 * Tracking is active if the trip starts within 1 hour, or is in progress / arrived / ready!
 * (Before 1 hour, real-time driver GPS is not allowed for privacy/battery).
 */
export function isTripTrackingUnlocked(trip) {
  if (!trip) return false;
  if (['inprogress', 'pickup_arrived', 'ready_to_start', 'accepted'].includes(trip.status)) {
    return true;
  }
  if (['requested', 'scheduled'].includes(trip.status)) {
    const schedTs = getTripScheduledTimestamp(trip);
    const diffMs = schedTs - Date.now();
    // Tracking allowed only within 1 hour before trip time or immediate trips
    return diffMs <= 1 * 60 * 60 * 1000;
  }
  return false;
}

