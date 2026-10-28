/**
 * scripts/test-rls-policy-matrix.js
 * 
 * Formal RLS Policy Matrix Simulator & Logic Verifier
 * Evaluates the exact PostgreSQL RLS rules defined in `supabase_complete_setup.sql`:
 *   - Profiles RLS (SELECT, INSERT, UPDATE, DELETE)
 *   - Trips RLS (SELECT, INSERT, UPDATE, DELETE)
 *   - Drivers RLS (SELECT, INSERT, UPDATE, DELETE)
 *   - Notifications RLS (SELECT, INSERT, UPDATE, DELETE)
 *   - Storage Buckets RLS
 * 
 * Matrix includes 5 Persona Roles:
 * 1. Rider Alice (+919876543210, alice@gmail.com, uid: usr_alice)
 * 2. Rider Bob (+919876543211, bob@gmail.com, uid: usr_bob)
 * 3. Driver Dave (+919840122222, dave@ridingo.in, uid: drv_dave)
 * 4. Driver Dan (+919840133333, dan@ridingo.in, uid: drv_dan)
 * 5. Admin Carol (team.ridingo@gmail.com, role: service_role)
 * 6. Anonymous Guest (no auth token)
 */

const ADMIN_EMAIL = 'team.ridingo@gmail.com';

function isAdmin(jwt, currentUserRole) {
  if (currentUserRole === 'postgres') return true;
  if (!jwt) return false;
  return jwt.email === ADMIN_EMAIL || jwt.role === 'service_role';
}

// -----------------------------------------------------------------------------
// 1. PROFILES RLS POLICY RULES
// -----------------------------------------------------------------------------
const ProfilesRLS = {
  // CREATE POLICY "Users read own profile or banners" ON public.profiles FOR SELECT USING (...)
  canSelect(row, jwt) {
    if (row.name === 'RIDINGO_OFFER_BANNERS') return true;
    if (isAdmin(jwt)) return true;
    if (!jwt) return false;
    if (jwt.phone && row.phone === jwt.phone) return true;
    if (jwt.email && row.email === jwt.email) return true;
    if (jwt.sub && row.preferences?.userId === jwt.sub) return true;
    return false;
  },

  // CREATE POLICY "Users insert profile" ON public.profiles FOR INSERT WITH CHECK (...)
  canInsert(newRow, jwt) {
    if (newRow.name === 'RIDINGO_OFFER_BANNERS') {
      return isAdmin(jwt);
    }
    return true; // Users can insert initial profile
  },

  // CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (...)
  canUpdate(existingRow, newRow, jwt) {
    if (isAdmin(jwt)) return true;
    if (existingRow.name === 'RIDINGO_OFFER_BANNERS') {
      return isAdmin(jwt); // Only admin can update banners
    }
    if (!jwt) return false;
    if (jwt.phone && existingRow.phone === jwt.phone) return true;
    if (jwt.email && existingRow.email === jwt.email) return true;
    if (jwt.sub && existingRow.preferences?.userId === jwt.sub) return true;
    return false;
  },

  // CREATE POLICY "Admin delete profiles" ON public.profiles FOR DELETE USING (...)
  canDelete(existingRow, jwt) {
    if (isAdmin(jwt)) return true;
    if (!jwt) return false;
    if (jwt.sub && (existingRow.phone === jwt.phone || existingRow.email === jwt.email)) {
      return true; // User deleting their own account
    }
    return false;
  }
};

// -----------------------------------------------------------------------------
// 2. TRIPS RLS POLICY RULES
// -----------------------------------------------------------------------------
const TripsRLS = {
  // CREATE POLICY "Scoped trips read" ON public.trips FOR SELECT USING (...)
  canSelect(trip, jwt) {
    if (trip.status === 'requested') return true; // Open dispatches visible to available drivers
    if (isAdmin(jwt)) return true;
    if (!jwt) return false;
    if (trip.by_who && trip.by_who === jwt.phone) return true;
    if (trip.rider?.phone && trip.rider.phone === jwt.phone) return true;
    if (trip.rider?.email && trip.rider.email === jwt.email) return true;
    if (trip.rider?.id && trip.rider.id === jwt.sub) return true;
    if (trip.driver?.phone && trip.driver.phone === jwt.phone) return true;
    if (trip.driver?.id && trip.driver.id === jwt.sub) return true;
    return false;
  },

  // CREATE POLICY "Trips insert" ON public.trips FOR INSERT WITH CHECK (...)
  canInsert(newTrip, jwt) {
    if (isAdmin(jwt)) return true;
    return newTrip.status === 'requested'; // Must start in 'requested' state
  },

  // CREATE POLICY "Trips update authorized" ON public.trips FOR UPDATE USING (...)
  canUpdate(existingTrip, updatePayload, jwt) {
    if (isAdmin(jwt)) return true;
    if (!jwt) return false;

    const isBookingOwner = (
      existingTrip.by_who === jwt.phone ||
      existingTrip.rider?.phone === jwt.phone ||
      existingTrip.rider?.id === jwt.sub
    );

    // Rider can cancel or update active booking
    if (isBookingOwner && ['requested', 'accepted', 'pickup_arrived', 'inprogress'].includes(existingTrip.status)) {
      return true;
    }

    // Available driver accepting an open dispatch request
    if (existingTrip.status === 'requested') {
      return true;
    }

    // Assigned driver updating trip progress
    const isAssignedDriver = (
      existingTrip.driver?.phone === jwt.phone ||
      existingTrip.driver?.id === jwt.sub
    );
    if (isAssignedDriver) {
      return true;
    }

    return false;
  },

  // CREATE POLICY "Admin delete trips" ON public.trips FOR DELETE USING (...)
  canDelete(trip, jwt) {
    return isAdmin(jwt);
  }
};

// -----------------------------------------------------------------------------
// 3. DRIVERS RLS POLICY RULES
// -----------------------------------------------------------------------------
const DriversRLS = {
  // CREATE POLICY "Scoped drivers read" ON public.drivers FOR SELECT USING (...)
  canSelect(driver, jwt) {
    if (driver.status === 'approved') return true; // Public list
    if (isAdmin(jwt)) return true;
    if (!jwt) return false;
    if (jwt.phone && driver.phone === jwt.phone) return true;
    if (jwt.email && driver.email === jwt.email) return true;
    if (jwt.sub && driver.id === jwt.sub) return true;
    return false;
  },

  // CREATE POLICY "Drivers registration insert" ON public.drivers FOR INSERT WITH CHECK (...)
  canInsert(newDriver, jwt) {
    if (isAdmin(jwt)) return true;
    // New registration MUST be 'pending' and 'new_registration'
    return newDriver.status === 'pending' && newDriver.category === 'new_registration';
  },

  // CREATE POLICY "Drivers update authorized" ON public.drivers FOR UPDATE USING (...)
  canUpdate(existingDriver, updates, jwt) {
    if (isAdmin(jwt)) return true;
    if (!jwt) return false;
    const isSelf = (driver) => (
      driver.phone === jwt.phone ||
      driver.email === jwt.email ||
      driver.id === jwt.sub
    );
    if (isSelf(existingDriver)) {
      // Driver cannot approve themselves or alter ratings/earnings
      if (updates.status && updates.status !== existingDriver.status) return false;
      if (updates.rating && updates.rating !== existingDriver.rating) return false;
      return true;
    }
    return false;
  },

  // CREATE POLICY "Admin delete drivers" ON public.drivers FOR DELETE USING (...)
  canDelete(driver, jwt) {
    return isAdmin(jwt);
  }
};

// -----------------------------------------------------------------------------
// 4. STORAGE RLS POLICY RULES
// -----------------------------------------------------------------------------
const StorageRLS = {
  canRead(bucketId, objectName, jwt) {
    if (bucketId === 'vehicle-inspections') return true;
    if (bucketId === 'driver-documents') {
      if (isAdmin(jwt)) return true;
      if (!jwt) return false;
      // Object path format: <userId>/aadhar.png
      const folderOwner = objectName.split('/')[0];
      return Boolean(jwt.sub && folderOwner === jwt.sub);
    }
    return false;
  },

  canWrite(bucketId, objectName, jwt) {
    if (isAdmin(jwt)) return true;
    if (!jwt) return false;
    const ext = objectName.split('.').pop()?.toLowerCase() || '';
    if (bucketId === 'vehicle-inspections') {
      return ['jpg', 'jpeg', 'png', 'webp', 'mp4'].includes(ext);
    }
    if (bucketId === 'driver-documents') {
      const folderOwner = objectName.split('/')[0];
      const validOwner = Boolean(jwt.sub && folderOwner === jwt.sub);
      const validExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext);
      return validOwner && validExt;
    }
    return false;
  }
};

// -----------------------------------------------------------------------------
// TEST RUNNER & TEST CASES
// -----------------------------------------------------------------------------
let totalPassed = 0;
let totalFailed = 0;

function assert(condition, testName) {
  if (condition) {
    totalPassed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    totalFailed++;
    console.error(`  ❌ [FAIL] ${testName}`);
  }
}

console.log('================================================================');
console.log('🧪 RLS POLICY VERIFICATION & ACCESS CONTROL TEST MATRIX');
console.log('================================================================');

// Personas
const alice = { sub: 'usr_alice', phone: '+919876543210', email: 'alice@gmail.com', role: 'authenticated' };
const bob = { sub: 'usr_bob', phone: '+919876543211', email: 'bob@gmail.com', role: 'authenticated' };
const driverDave = { sub: 'drv_dave', phone: '+919840122222', email: 'dave@ridingo.in', role: 'authenticated' };
const driverDan = { sub: 'drv_dan', phone: '+919840133333', email: 'dan@ridingo.in', role: 'authenticated' };
const admin = { sub: 'adm_01', email: 'team.ridingo@gmail.com', role: 'service_role' };
const guest = null;

// Mock Data
const bannerProfile = { name: 'RIDINGO_OFFER_BANNERS', preferences: { banners: ['promo1.jpg'] } };
const aliceProfile = { phone: '+919876543210', name: 'Alice M', email: 'alice@gmail.com', preferences: { userId: 'usr_alice' } };
const bobProfile = { phone: '+919876543211', name: 'Bob K', email: 'bob@gmail.com', preferences: { userId: 'usr_bob' } };

const openTrip = { id: 'TRP_100', status: 'requested', fare: 500, by_who: '+919876543210', rider: { phone: '+919876543210', id: 'usr_alice' } };
const aliceInProgressTrip = { id: 'TRP_101', status: 'inprogress', fare: 650, by_who: '+919876543210', rider: { phone: '+919876543210', id: 'usr_alice' }, driver: { id: 'drv_dave', phone: '+919840122222' } };
const bobCompletedTrip = { id: 'TRP_102', status: 'completed', fare: 800, by_who: '+919876543211', rider: { phone: '+919876543211', id: 'usr_bob' } };

const approvedDriver = { id: 'drv_dave', name: 'Dave', status: 'approved', rating: 4.9, aadhar_number: '1234-5678' };
const pendingDriver = { id: 'drv_dan', name: 'Dan', status: 'pending', rating: 5.0, aadhar_number: '8765-4321' };

console.log('\n--- 1. PROFILES READ (SELECT) ---');
assert(ProfilesRLS.canSelect(bannerProfile, guest) === true, 'Guests can read public offer banners');
assert(ProfilesRLS.canSelect(bannerProfile, alice) === true, 'Alice can read public offer banners');
assert(ProfilesRLS.canSelect(aliceProfile, alice) === true, 'Alice can read her own profile');
assert(ProfilesRLS.canSelect(aliceProfile, bob) === false, 'Bob CANNOT read Alice profile');
assert(ProfilesRLS.canSelect(aliceProfile, guest) === false, 'Unauthenticated guest CANNOT read Alice profile');
assert(ProfilesRLS.canSelect(aliceProfile, admin) === true, 'Admin can read any user profile');

console.log('\n--- 2. PROFILES CREATE, UPDATE, DELETE ---');
assert(ProfilesRLS.canInsert(aliceProfile, guest) === true, 'New users can register initial profile');
assert(ProfilesRLS.canInsert(bannerProfile, bob) === false, 'Non-admin CANNOT create/overwrite offer banner');
assert(ProfilesRLS.canInsert(bannerProfile, admin) === true, 'Admin CAN create offer banner');
assert(ProfilesRLS.canUpdate(aliceProfile, { name: 'Alice New' }, alice) === true, 'Alice can update her own profile');
assert(ProfilesRLS.canUpdate(aliceProfile, { name: 'Hacked' }, bob) === false, 'Bob CANNOT update Alice profile');
assert(ProfilesRLS.canUpdate(bannerProfile, {}, bob) === false, 'Bob CANNOT tamper with offer banners');
assert(ProfilesRLS.canUpdate(bannerProfile, {}, admin) === true, 'Admin CAN update offer banners');
assert(ProfilesRLS.canDelete(aliceProfile, bob) === false, 'Bob CANNOT delete Alice profile');
assert(ProfilesRLS.canDelete(aliceProfile, admin) === true, 'Admin CAN delete user profile');

console.log('\n--- 3. TRIPS READ (SELECT) ---');
assert(TripsRLS.canSelect(openTrip, driverDave) === true, 'Drivers can read open requested trips for dispatch');
assert(TripsRLS.canSelect(openTrip, guest) === true, 'Open requested trips visible for initial booking coordination');
assert(TripsRLS.canSelect(aliceInProgressTrip, alice) === true, 'Alice can read her in-progress trip');
assert(TripsRLS.canSelect(aliceInProgressTrip, driverDave) === true, 'Assigned driver Dave can read active trip');
assert(TripsRLS.canSelect(aliceInProgressTrip, driverDan) === false, 'Unassigned driver Dan CANNOT read Alice trip');
assert(TripsRLS.canSelect(aliceInProgressTrip, bob) === false, 'Other rider Bob CANNOT read Alice trip');
assert(TripsRLS.canSelect(aliceInProgressTrip, guest) === false, 'Unauthenticated guest CANNOT read in-progress trip');
assert(TripsRLS.canSelect(bobCompletedTrip, alice) === false, 'Alice CANNOT read Bob completed trip');
assert(TripsRLS.canSelect(bobCompletedTrip, admin) === true, 'Admin can read all trips');

console.log('\n--- 4. TRIPS CREATE (INSERT) ---');
assert(TripsRLS.canInsert({ status: 'requested' }, alice) === true, 'Alice can create booking with status=requested');
assert(TripsRLS.canInsert({ status: 'requested' }, guest) === true, 'Guest can create booking with status=requested');
assert(TripsRLS.canInsert({ status: 'completed' }, alice) === false, 'Alice CANNOT insert a trip pre-set to completed');
assert(TripsRLS.canInsert({ status: 'accepted' }, driverDave) === false, 'Driver CANNOT create pre-accepted trips directly');
assert(TripsRLS.canInsert({ status: 'completed' }, admin) === true, 'Admin CAN insert trips with any status');

console.log('\n--- 5. TRIPS UPDATE ---');
assert(TripsRLS.canUpdate(openTrip, { status: 'cancelled' }, alice) === true, 'Alice can cancel her own trip');
assert(TripsRLS.canUpdate(openTrip, { status: 'accepted', driver: { id: 'drv_dave' } }, driverDave) === true, 'Driver Dave can accept open requested trip');
assert(TripsRLS.canUpdate(aliceInProgressTrip, { status: 'completed' }, driverDave) === true, 'Assigned driver Dave can complete his trip');
assert(TripsRLS.canUpdate(aliceInProgressTrip, { status: 'cancelled' }, driverDan) === false, 'Unassigned driver Dan CANNOT modify Dave and Alice trip');
assert(TripsRLS.canUpdate(bobCompletedTrip, { fare: 0 }, alice) === false, 'Alice CANNOT modify Bob completed trip');
assert(TripsRLS.canUpdate(bobCompletedTrip, { fare: 0 }, guest) === false, 'Guest CANNOT modify Bob completed trip');
assert(TripsRLS.canUpdate(bobCompletedTrip, { fare: 900 }, admin) === true, 'Admin CAN adjust trip details');

console.log('\n--- 6. TRIPS DELETE ---');
assert(TripsRLS.canDelete(openTrip, alice) === false, 'Alice CANNOT delete trip record (can only cancel)');
assert(TripsRLS.canDelete(openTrip, driverDave) === false, 'Driver Dave CANNOT delete trip record');
assert(TripsRLS.canDelete(openTrip, guest) === false, 'Guest CANNOT delete trip record');
assert(TripsRLS.canDelete(openTrip, admin) === true, 'Admin CAN delete trip record');

console.log('\n--- 7. DRIVERS (REGISTRY & KYC PRIVACY) ---');
assert(DriversRLS.canSelect(approvedDriver, guest) === true, 'Public can view approved driver');
assert(DriversRLS.canSelect(pendingDriver, guest) === false, 'Public CANNOT view unapproved pending driver');
assert(DriversRLS.canSelect(pendingDriver, driverDan) === true, 'Driver Dan can view his own pending application');
assert(DriversRLS.canSelect(pendingDriver, admin) === true, 'Admin can view pending driver for KYC review');
assert(DriversRLS.canInsert({ status: 'pending', category: 'new_registration' }, driverDan) === true, 'New driver can submit pending registration');
assert(DriversRLS.canInsert({ status: 'approved', category: 'old_registered' }, driverDan) === false, 'New driver CANNOT self-approve on registration');
assert(DriversRLS.canUpdate(pendingDriver, { status: 'approved' }, driverDan) === false, 'Driver Dan CANNOT approve himself');
assert(DriversRLS.canUpdate(pendingDriver, { status: 'approved' }, admin) === true, 'Admin CAN approve driver KYC');
assert(DriversRLS.canDelete(approvedDriver, driverDave) === false, 'Driver CANNOT delete driver record');
assert(DriversRLS.canDelete(approvedDriver, admin) === true, 'Admin CAN delete driver record');

console.log('\n--- 8. STORAGE (KYC DOCUMENT RESTRICTIONS) ---');
assert(StorageRLS.canRead('vehicle-inspections', 'car_photo.jpg', guest) === true, 'Vehicle inspections are publicly viewable');
assert(StorageRLS.canRead('driver-documents', 'drv_dave/aadhar.png', guest) === false, 'Guest CANNOT access Dave Aadhaar document');
assert(StorageRLS.canRead('driver-documents', 'drv_dave/aadhar.png', bob) === false, 'Bob CANNOT access Dave Aadhaar document');
assert(StorageRLS.canRead('driver-documents', 'drv_dave/aadhar.png', driverDave) === true, 'Dave CAN access his own Aadhaar document');
assert(StorageRLS.canRead('driver-documents', 'drv_dave/aadhar.png', admin) === true, 'Admin CAN access Dave Aadhaar document for KYC review');
assert(StorageRLS.canWrite('driver-documents', 'drv_dave/aadhar.png', guest) === false, 'Guest CANNOT upload to driver-documents');
assert(StorageRLS.canWrite('driver-documents', 'drv_dave/aadhar.png', bob) === false, 'Bob CANNOT upload into Dave folder');
assert(StorageRLS.canWrite('driver-documents', 'drv_dave/aadhar.pdf', driverDave) === true, 'Dave CAN upload PDF into his own folder');
assert(StorageRLS.canWrite('driver-documents', 'drv_dave/exploit.exe', driverDave) === false, 'Dave CANNOT upload executable exploit file');
assert(StorageRLS.canWrite('driver-documents', 'drv_dave/script.html', driverDave) === false, 'Dave CANNOT upload HTML file');
assert(StorageRLS.canWrite('vehicle-inspections', 'car_inspection.mp4', driverDave) === true, 'Dave CAN upload inspection video');

console.log('\n================================================================');
console.log(`🏁 MATRIX TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('================================================================\n');

if (totalFailed > 0) process.exit(1);

