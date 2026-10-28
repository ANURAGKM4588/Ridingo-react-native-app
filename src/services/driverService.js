/**
 * driverService.js
 * 
 * Centralized Driver Management & Profile Service for Ridingo Ecosystem.
 * Connects User App, Driver App, and CRM Admin Panel.
 */

import { supabase } from '../lib/supabase';

export const LOCAL_DRIVERS_KEY = 'ridingo_registered_drivers_registry';

/**
 * Checks whether the current session has verified administrator privileges.
 */
export function isAdminAuthenticated() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem('ridingo_admin_auth') === 'true' ||
           localStorage.getItem('ridingo_admin_auth') === 'true';
  } catch (_) {
    return false;
  }
}

export const DEFAULT_SEED_DRIVERS = [
  {
    id: 'DRV-8492',
    name: 'Arun Madhavan',
    firstName: 'Arun',
    lastName: 'Madhavan',
    phone: '+91 94471 28392',
    email: 'arun.madhavan@gmail.com',
    homeAddress: 'TC 14/820, Silver Cascade',
    street: 'Vazhuthacaud Junction',
    city: 'Thiruvananthapuram',
    pincode: '695014',
    state: 'Kerala',
    nationality: 'India',
    dlNumber: 'KL-01-20190038291',
    dlPhoto: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    aadharNumber: '4829 1928 4719',
    aadharPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    category: 'new_registration', // 'new_registration' | 'old_registered'
    status: 'pending', // 'pending' | 'approved' | 'rejected' | 'suspended'
    registeredAt: '2026-10-14T10:30:00Z',
    experienceYears: 4,
    rating: 5.0,
    tripsCompleted: 0,
    totalEarnings: 0
  },
  {
    id: 'DRV-9120',
    name: 'Fahad K Mohammed',
    firstName: 'Fahad',
    lastName: 'Mohammed',
    phone: '+91 98952 48190',
    email: 'fahad.k.mohammed@outlook.com',
    homeAddress: 'Skyline Topaz, Flat 4B',
    street: 'Infopark Expressway, Kakkanad',
    city: 'Kochi',
    pincode: '682030',
    state: 'Kerala',
    nationality: 'India',
    dlNumber: 'KL-07-20210049281',
    dlPhoto: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    aadharNumber: '5938 1029 3810',
    aadharPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    category: 'new_registration',
    status: 'pending',
    registeredAt: '2026-10-15T08:15:00Z',
    experienceYears: 2,
    rating: 5.0,
    tripsCompleted: 0,
    totalEarnings: 0
  },
  {
    id: 'DRV-1001',
    name: 'Ravi Kumar',
    firstName: 'Ravi',
    lastName: 'Kumar',
    phone: '+91 98401 23456',
    email: 'ravi.kumar@ridingo.in',
    homeAddress: 'Door 12/481, Near North Railway Station',
    street: 'Ashoka Road, Kaloor',
    city: 'Kochi',
    pincode: '682017',
    state: 'Kerala',
    nationality: 'India',
    dlNumber: 'KL-07-20160049281',
    dlPhoto: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    aadharNumber: '8923 1049 2841',
    aadharPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    category: 'old_registered',
    status: 'approved',
    registeredAt: '2025-04-10T11:00:00Z',
    experienceYears: 7,
    rating: 5.0,
    tripsCompleted: 0,
    totalEarnings: 0
  },
  {
    id: 'DRV-2042',
    name: 'Sujith V Nair',
    firstName: 'Sujith',
    lastName: 'Nair',
    phone: '+91 97450 19283',
    email: 'sujith.nair@gmail.com',
    homeAddress: 'Souparnika, SN Junction',
    street: 'Civil Line Road, Palarivattom',
    city: 'Kochi',
    pincode: '682025',
    state: 'Kerala',
    nationality: 'India',
    dlNumber: 'KL-07-20140029103',
    dlPhoto: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    aadharNumber: '6720 1938 4920',
    aadharPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    category: 'old_registered',
    status: 'approved',
    registeredAt: '2024-11-20T14:20:00Z',
    experienceYears: 9,
    rating: 5.0,
    tripsCompleted: 0,
    totalEarnings: 0
  },
  {
    id: 'DRV-3108',
    name: 'Manoj P V',
    firstName: 'Manoj',
    lastName: 'P V',
    phone: '+91 98470 55123',
    email: 'manoj.pv@gmail.com',
    homeAddress: 'Pranavam, Near Metro Pillar 382',
    street: 'Toll Gate Road, Edappally',
    city: 'Kochi',
    pincode: '682024',
    state: 'Kerala',
    nationality: 'India',
    dlNumber: 'KL-07-20120019284',
    dlPhoto: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    aadharNumber: '7829 1048 5920',
    aadharPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    category: 'old_registered',
    status: 'approved',
    registeredAt: '2024-06-12T09:45:00Z',
    experienceYears: 11,
    rating: 5.0,
    tripsCompleted: 0,
    totalEarnings: 0
  }
];

/**
 * Generates an official Ridingo Driver Profile ID: DRV-XXXXX
 */
export function generateDriverProfileId() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `DRV-${num}`;
}

/**
 * Checks whether a driver with this mobile number or email is already registered
 * @param {Object} params
 * @param {string} [params.phone]
 * @param {string} [params.email]
 * @returns {Promise<{ exists: boolean, matchedField: 'phone'|'email'|'both'|null, driver: Object|null }>}
 */
export async function checkDriverExists({ phone, email }) {
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
  const rawEmail = email ? String(email).trim().toLowerCase() : '';
  // Sanitize email: allow only valid characters, strip PostgREST filter injection operators
  const cleanEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)
    ? rawEmail.replace(/[^a-zA-Z0-9@._%+-]/g, '')
    : '';

  if (!cleanPhone && !cleanEmail) {
    return { exists: false, matchedField: null, driver: null };
  }

  // 1. Check local driver registry first
  const list = getLocalDriverRegistry();
  for (const d of list) {
    const dPhone = String(d.phone || '').replace(/\D/g, '').slice(-10);
    const dEmail = String(d.email || '').trim().toLowerCase();

    const phoneMatch = !!(cleanPhone && dPhone && cleanPhone === dPhone);
    const emailMatch = !!(cleanEmail && dEmail && cleanEmail === dEmail);

    if (phoneMatch || emailMatch) {
      return {
        exists: true,
        matchedField: phoneMatch && emailMatch ? 'both' : (phoneMatch ? 'phone' : 'email'),
        driver: d
      };
    }
  }

  // 2. Check Supabase drivers table (strictly query targeting the specific phone/email only)
  if (supabase && typeof supabase.from === 'function') {
    try {
      let query = supabase.from('drivers').select('id, name, phone, email, category, status');
      if (cleanPhone && cleanEmail) {
        query = query.or(`phone.ilike.%${cleanPhone}%,email.eq.${cleanEmail}`);
      } else if (cleanPhone) {
        query = query.ilike('phone', `%${cleanPhone}%`);
      } else if (cleanEmail) {
        query = query.eq('email', cleanEmail);
      }
      const { data, error } = await query.limit(1);
      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        const rowPhone = String(row.phone || '').replace(/\D/g, '').slice(-10);
        const rowEmail = String(row.email || '').trim().toLowerCase();

        const phoneMatch = !!(cleanPhone && rowPhone && cleanPhone === rowPhone);
        const emailMatch = !!(cleanEmail && rowEmail && cleanEmail === rowEmail);

        if (phoneMatch || emailMatch) {
          return {
            exists: true,
            matchedField: phoneMatch && emailMatch ? 'both' : (phoneMatch ? 'phone' : 'email'),
            driver: row
          };
        }
      }
    } catch (_) {}
  }

  return { exists: false, matchedField: null, driver: null };
}

/**
 * Loads driver registry from localStorage and Supabase
 */
export function getLocalDriverRegistry() {
  if (typeof window === 'undefined') return DEFAULT_SEED_DRIVERS;
  try {
    const raw = localStorage.getItem(LOCAL_DRIVERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_DRIVERS_KEY, JSON.stringify(DEFAULT_SEED_DRIVERS));
      return DEFAULT_SEED_DRIVERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(LOCAL_DRIVERS_KEY, JSON.stringify(DEFAULT_SEED_DRIVERS));
      return DEFAULT_SEED_DRIVERS;
    }
    return parsed;
  } catch (e) {
    return DEFAULT_SEED_DRIVERS;
  }
}

/**
 * Persists drivers list locally
 */
export function saveLocalDriverRegistry(drivers) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DRIVERS_KEY, JSON.stringify(drivers));
  } catch (e) {
    console.warn('Failed to save drivers locally:', e);
  }
}

/**
 * Syncs with Supabase `drivers` table
 */
export async function fetchDriversFromSupabase() {
  if (!supabase || typeof supabase.from !== 'function') {
    return getLocalDriverRegistry();
  }
  try {
    const isAdmin = isAdminAuthenticated();
    const selectCols = isAdmin
      ? '*'
      : 'id, name, first_name, last_name, phone, city, state, nationality, avatar, category, status, rating, trips_completed, total_earnings, created_at';
    const { data, error } = await supabase.from('drivers').select(selectCols);
    if (error || !data || data.length === 0) {
      return getLocalDriverRegistry();
    }
    // Format supabase rows
    const local = getLocalDriverRegistry();
    const map = new Map(local.map(d => [d.id, d]));

    data.forEach(row => {
      // Data privacy protection: Only verified administrators can access KYC documents, Aadhar, DL photos, and full residential addresses
      map.set(row.id, {
        id: row.id,
        name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        firstName: row.first_name || row.name?.split(' ')[0] || '',
        lastName: row.last_name || row.name?.split(' ').slice(1).join(' ') || '',
        phone: isAdmin ? row.phone : (row.phone ? `${row.phone.slice(0, 6)}••••` : ''),
        email: isAdmin ? row.email : '',
        homeAddress: isAdmin ? (row.home_address || row.address) : null,
        street: isAdmin ? row.street : null,
        city: row.city || 'Kochi',
        pincode: isAdmin ? (row.pincode || row.pin) : '',
        state: row.state || 'Kerala',
        nationality: row.nationality || 'India',
        dlNumber: isAdmin ? row.dl_number : (row.dl_number ? 'KL-••-••••••••' : null),
        dlPhoto: isAdmin ? row.dl_photo : null,
        aadharNumber: isAdmin ? row.aadhar_number : (row.aadhar_number ? '•••• •••• ••••' : null),
        aadharPhoto: isAdmin ? row.aadhar_photo : null,
        avatar: row.avatar || row.profile_pic,
        category: row.category || (row.status === 'approved' ? 'old_registered' : 'new_registration'),
        status: row.status || 'pending',
        registeredAt: row.created_at || new Date().toISOString(),
        rating: row.rating || 5.0,
        tripsCompleted: row.trips_completed || 0,
        totalEarnings: isAdmin ? (row.total_earnings || 0) : 0
      });
    });

    const merged = Array.from(map.values());
    saveLocalDriverRegistry(merged);
    return merged;
  } catch (e) {
    console.warn('Supabase drivers fetch error, using local:', e);
    return getLocalDriverRegistry();
  }
}

/**
 * Registers a new driver profile (Category: 'new_registration', status: 'pending')
 */
export async function registerDriverProfile(driverData) {
  // Strict uniqueness enforcement for mobile and email
  const existsCheck = await checkDriverExists({ phone: driverData.phone, email: driverData.email });
  if (existsCheck.exists) {
    const field = existsCheck.matchedField === 'both' ? 'mobile number and email' : (existsCheck.matchedField === 'email' ? 'email address' : 'mobile number');
    return {
      alreadyRegistered: true,
      message: `An account is already registered with this ${field}. Only one account is allowed per driver partner. Please sign in instead.`,
      driver: existsCheck.driver
    };
  }

  const driverId = driverData.id || generateDriverProfileId();
  const newDriver = {
    id: driverId,
    name: driverData.name || `${driverData.firstName || ''} ${driverData.lastName || ''}`.trim() || 'Driver Partner',
    firstName: driverData.firstName || driverData.name?.split(' ')[0] || '',
    lastName: driverData.lastName || driverData.name?.split(' ').slice(1).join(' ') || '',
    phone: driverData.phone || '',
    email: driverData.email || '',
    homeAddress: driverData.homeAddress || '',
    street: driverData.street || '',
    city: driverData.city || 'Kochi',
    pincode: driverData.pincode || '',
    state: driverData.state || 'Kerala',
    nationality: driverData.nationality || 'India',
    dlNumber: driverData.dlNumber || '',
    dlPhoto: driverData.dlPhoto || null,
    aadharNumber: driverData.aadharNumber || '',
    aadharPhoto: driverData.aadharPhoto || null,
    avatar: driverData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(driverData.name || driverId)}`,
    category: 'new_registration',
    status: 'pending',
    registeredAt: new Date().toISOString(),
    experienceYears: driverData.experienceYears || 3,
    rating: 5.0,
    tripsCompleted: 0,
    totalEarnings: 0
  };

  const list = getLocalDriverRegistry();
  const updated = [newDriver, ...list.filter(d => d.id !== driverId && d.email !== newDriver.email)];
  saveLocalDriverRegistry(updated);

  // Sync to Supabase
  if (supabase && typeof supabase.from === 'function') {
    try {
      await supabase.from('drivers').upsert({
        id: newDriver.id,
        name: newDriver.name,
        email: newDriver.email,
        phone: newDriver.phone,
        home_address: newDriver.homeAddress,
        street: newDriver.street,
        city: newDriver.city,
        pincode: newDriver.pincode,
        state: newDriver.state,
        nationality: newDriver.nationality,
        dl_number: newDriver.dlNumber,
        aadhar_number: newDriver.aadharNumber,
        category: 'new_registration',
        status: 'pending',
        created_at: newDriver.registeredAt
      });
    } catch (e) {
      console.warn('Supabase driver upsert notice:', e);
    }
  }

  // Dispatch email notification alert to team.ridingo@gmail.com
  try {
    const alertRecord = {
      recipient: 'team.ridingo@gmail.com',
      subject: `New Driver KYC Registration Request: ${newDriver.name} (${newDriver.city})`,
      driverId: newDriver.id,
      name: newDriver.name,
      phone: newDriver.phone,
      email: newDriver.email,
      city: newDriver.city,
      pincode: newDriver.pincode,
      dlNumber: newDriver.dlNumber,
      aadharNumber: newDriver.aadharNumber,
      status: 'pending',
      timestamp: newDriver.registeredAt
    };
    const notifs = JSON.parse(localStorage.getItem('ridingo_admin_notifications') || '[]');
    notifs.unshift(alertRecord);
    localStorage.setItem('ridingo_admin_notifications', JSON.stringify(notifs.slice(0, 50)));

    if (supabase && typeof supabase.from === 'function') {
      supabase.from('notifications').insert({
        user_id: 'team.ridingo@gmail.com',
        type: 'driver_registration_alert',
        title: alertRecord.subject,
        message: `New driver partner application from ${newDriver.name} (${newDriver.phone}, ${newDriver.city}). Review pending KYC document proofs.`,
        created_at: newDriver.registeredAt
      }).then(() => {}).catch(() => {});
    }
  } catch (alertErr) {
    console.warn('Admin notification notice:', alertErr);
  }

  return newDriver;
}

/**
 * Approve driver KYC: converts from 'new_registration' to 'old_registered' with status 'approved'
 */
export async function approveDriverKyc(driverId) {
  if (!isAdminAuthenticated()) {
    throw new Error('Unauthorized: Executive administrative privileges required to approve driver KYC.');
  }

  const list = getLocalDriverRegistry();
  const updated = list.map(d => {
    if (d.id === driverId) {
      return {
        ...d,
        category: 'old_registered',
        status: 'approved',
        approvedAt: new Date().toISOString()
      };
    }
    return d;
  });
  saveLocalDriverRegistry(updated);

  if (supabase && typeof supabase.from === 'function') {
    try {
      await supabase.from('drivers').update({
        category: 'old_registered',
        status: 'approved'
      }).eq('id', driverId);
    } catch (e) {
      console.warn('Supabase approve error:', e);
    }
  }

  return updated;
}

/**
 * Reject driver KYC
 */
export async function rejectDriverKyc(driverId, reason = '') {
  if (!isAdminAuthenticated()) {
    throw new Error('Unauthorized: Executive administrative privileges required to reject driver KYC.');
  }

  const list = getLocalDriverRegistry();
  const updated = list.map(d => {
    if (d.id === driverId) {
      return {
        ...d,
        status: 'rejected',
        rejectReason: reason,
        rejectedAt: new Date().toISOString()
      };
    }
    return d;
  });
  saveLocalDriverRegistry(updated);

  if (supabase && typeof supabase.from === 'function') {
    try {
      await supabase.from('drivers').update({
        status: 'rejected',
        reject_reason: reason
      }).eq('id', driverId);
    } catch (e) {
      console.warn('Supabase reject error:', e);
    }
  }

  return updated;
}

/**
 * Suspend or Activate Driver
 */
export async function toggleSuspendDriver(driverId) {
  if (!isAdminAuthenticated()) {
    throw new Error('Unauthorized: Executive administrative privileges required to change driver suspension status.');
  }

  const list = getLocalDriverRegistry();
  let nextStatus = 'suspended';
  const updated = list.map(d => {
    if (d.id === driverId) {
      nextStatus = d.status === 'suspended' ? (d.category === 'old_registered' ? 'approved' : 'pending') : 'suspended';
      return {
        ...d,
        status: nextStatus
      };
    }
    return d;
  });
  saveLocalDriverRegistry(updated);

  if (supabase && typeof supabase.from === 'function') {
    try {
      await supabase.from('drivers').update({
        status: nextStatus
      }).eq('id', driverId);
    } catch (e) {}
  }

  return updated;
}

/**
 * CRM Telemetry & Calculation Utility
 */
export function calculateCrmTelemetry(trips = [], drivers = []) {
  const totalTrips = trips.length;
  const completedTrips = trips.filter(t => t.status === 'completed' || t.status === 'done');
  const cancelledTrips = trips.filter(t => t.status === 'cancelled' || t.status === 'user_cancelled');
  const activeTrips = trips.filter(t => ['requested', 'accepted', 'arrived', 'driving', 'in_progress', 'live'].includes(t.status));

  // Gross Volume in ₹
  const totalGmv = completedTrips.reduce((acc, t) => acc + (Number(t.fare) || 0), 0);
  const requestedGmv = trips.reduce((acc, t) => acc + (Number(t.fare) || 0), 0);

  // Platform commission (15%)
  const commissionRate = 0.15;
  const netCommission = Math.round(totalGmv * commissionRate);
  const driverPayouts = totalGmv - netCommission;

  const avgFare = completedTrips.length > 0 ? Math.round(totalGmv / completedTrips.length) : (trips.length > 0 ? Math.round(requestedGmv / trips.length) : 550);

  const newRegistrationsCount = drivers.filter(d => d.category === 'new_registration' || d.status === 'pending').length;
  const oldRegisteredCount = drivers.filter(d => d.category === 'old_registered' || d.status === 'approved').length;

  return {
    totalTrips,
    completedCount: completedTrips.length,
    cancelledCount: cancelledTrips.length,
    activeCount: activeTrips.length,
    totalGmv,
    requestedGmv,
    netCommission,
    driverPayouts,
    avgFare,
    completionRate: totalTrips > 0 ? Math.round((completedTrips.length / totalTrips) * 100) : 100,
    newRegistrationsCount,
    oldRegisteredCount,
    totalDrivers: drivers.length
  };
}

/**
 * Scopes a trip specifically to an authenticated driver partner
 * Matches by Unique Driver ID (DRV-XXXXX), mobile phone, or email.
 */
export function isDriverTrip(trip, driver) {
  if (!trip || !driver) return false;
  const dId = String(driver.id || driver.driverId || '').trim().toLowerCase();
  const tDriverId = String(trip.driver_id || trip.driverObj?.id || trip.driver?.id || trip.driverObj?.deviceDriverId || '').trim().toLowerCase();
  if (dId && tDriverId && dId === tDriverId) {
    return true;
  }
  const cleanPhone = driver.phone ? String(driver.phone).replace(/\D/g, '').slice(-10) : '';
  const tPhone = (trip.driver?.phone || trip.driverObj?.phone) ? String(trip.driver?.phone || trip.driverObj?.phone).replace(/\D/g, '').slice(-10) : '';
  if (cleanPhone && tPhone && cleanPhone === tPhone) {
    return true;
  }
  const cleanEmail = driver.email ? String(driver.email).trim().toLowerCase() : '';
  const tEmail = (trip.driver?.email || trip.driverObj?.email) ? String(trip.driver?.email || trip.driverObj?.email).trim().toLowerCase() : '';
  if (cleanEmail && tEmail && cleanEmail === tEmail) {
    return true;
  }
  return false;
}
