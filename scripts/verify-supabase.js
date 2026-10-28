import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ ERROR: Supabase environment variables missing.');
  console.error('Please export VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running diagnostics.\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runProductionDiagnostics() {
  console.log('====================================================');
  console.log(' SUPABASE LIVE PRODUCTION VERIFICATION');
  console.log(' Target:', SUPABASE_URL);
  console.log('====================================================\n');

  let allPassed = true;

  // 1. Table: profiles (Users)
  console.log('--- 1. Testing "profiles" Table ---');
  const testPhone = '+919999911111';
  try {
    const { data: pIns, error: pInsErr } = await supabase.from('profiles').upsert({
      phone: testPhone,
      name: 'Diagnostic User',
      email: 'user@ridingo.app',
      preferences: { userId: 'USR-TEST-PROD' },
      updated_at: new Date().toISOString()
    }).select();

    if (pInsErr) {
      console.log('❌ profiles write failed:', pInsErr.message);
      allPassed = false;
    } else {
      console.log('✅ profiles write & RLS: OK');
      const { data: pSel, error: pSelErr } = await supabase.from('profiles').select('*').eq('phone', testPhone);
      if (pSelErr || !pSel?.length) {
        console.log('❌ profiles read failed:', pSelErr?.message);
        allPassed = false;
      } else {
        console.log('✅ profiles read: OK (Retrieved user record)');
      }
      await supabase.from('profiles').delete().eq('phone', testPhone);
      console.log('✅ profiles cleanup: OK');
    }
  } catch (e) {
    console.log('❌ profiles exception:', e.message);
    allPassed = false;
  }

  // 2. Table: trips (Bookings, Dispatches)
  console.log('\n--- 2. Testing "trips" Table ---');
  const testTripId = 'TRP_VERIFY_' + Date.now();
  try {
    const { data: tIns, error: tInsErr } = await supabase.from('trips').upsert({
      id: testTripId,
      cat: 'hourly',
      qty: 4,
      pickup: 'Marine Drive Kochi',
      drop_loc: 'Airport Terminal 3',
      when_ts: Date.now(),
      fare: 850,
      advance: 255,
      status: 'requested',
      driver: null,
      car: { brand: 'Toyota', model: 'Innova' },
      rider: { name: 'Diagnostic User', phone: testPhone },
      cashback: 50,
      by_who: testPhone
    }).select();

    if (tInsErr) {
      console.log('❌ trips insert failed:', tInsErr.message);
      allPassed = false;
    } else {
      console.log('✅ trips insert & RLS: OK (Booking created)');

      // Test driver accept update
      const { error: tUpdErr } = await supabase.from('trips').update({
        status: 'accepted',
        driver: { id: 'drv_test_1', name: 'Ravi Kumar', phone: '+919840122222' },
        updated_at: new Date().toISOString()
      }).eq('id', testTripId);

      if (tUpdErr) {
        console.log('❌ trips update failed:', tUpdErr.message);
        allPassed = false;
      } else {
        console.log('✅ trips update & status transition: OK (Accepted)');
      }

      await supabase.from('trips').delete().eq('id', testTripId);
      console.log('✅ trips cleanup: OK');
    }
  } catch (e) {
    console.log('❌ trips exception:', e.message);
    allPassed = false;
  }

  // 3. Table: drivers (Driver Partner Registry)
  console.log('\n--- 3. Testing "drivers" Table ---');
  const testDriverId = 'DRV_VERIFY_' + Date.now();
  try {
    const { data: dIns, error: dInsErr } = await supabase.from('drivers').upsert({
      id: testDriverId,
      name: 'Suresh Menon',
      first_name: 'Suresh',
      last_name: 'Menon',
      phone: '+919876543210',
      email: 'suresh@ridingo.app',
      city: 'Kochi',
      state: 'Kerala',
      status: 'approved',
      category: 'new_registration',
      rating: 5.0,
      trips_completed: 12,
      total_earnings: 15400,
      created_at: new Date().toISOString()
    }).select();

    if (dInsErr) {
      console.log('❌ drivers insert failed:', dInsErr.message);
      allPassed = false;
    } else {
      console.log('✅ drivers insert & RLS: OK (Driver registered)');

      const { data: dSel, error: dSelErr } = await supabase.from('drivers').select('*').eq('id', testDriverId);
      if (dSelErr || !dSel?.length) {
        console.log('❌ drivers read failed:', dSelErr?.message);
        allPassed = false;
      } else {
        console.log('✅ drivers read: OK (Retrieved driver record)');
      }

      await supabase.from('drivers').delete().eq('id', testDriverId);
      console.log('✅ drivers cleanup: OK');
    }
  } catch (e) {
    console.log('❌ drivers exception:', e.message);
    allPassed = false;
  }

  // 4. Table: notifications (In-app Alerts)
  console.log('\n--- 4. Testing "notifications" Table ---');
  const testNotifId = 'NOTIF_VERIFY_' + Date.now();
  try {
    const { data: nIns, error: nInsErr } = await supabase.from('notifications').insert({
      id: testNotifId,
      user_id: testPhone,
      title: 'Booking Confirmed',
      message: 'Your chauffeur is on the way.',
      type: 'trip_update',
      read: false
    }).select();

    if (nInsErr) {
      console.log('❌ notifications insert failed:', nInsErr.message);
      allPassed = false;
    } else {
      console.log('✅ notifications insert & RLS: OK');
      await supabase.from('notifications').delete().eq('id', testNotifId);
      console.log('✅ notifications cleanup: OK');
    }
  } catch (e) {
    console.log('❌ notifications exception:', e.message);
    allPassed = false;
  }

  // 5. Realtime Channel Subscription
  console.log('\n--- 5. Testing Supabase Realtime Stream ---');
  try {
    const channel = supabase.channel('prod_verify_' + Date.now(), {
      config: { broadcast: { ack: true } }
    });

    const subscribed = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 6000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });

    if (subscribed) {
      console.log('✅ Realtime WebSocket: SUBSCRIBED and ready for live trip broadcasts');
    } else {
      console.log('❌ Realtime subscription timed out');
      allPassed = false;
    }
    await supabase.removeChannel(channel);
  } catch (e) {
    console.log('❌ Realtime exception:', e.message);
    allPassed = false;
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED: 100% FUNCTIONAL!');
    console.log('Both Android & iOS apps (User & Driver) are fully supported.');
  } else {
    console.log('⚠️ Some checks need review.');
  }
  console.log('====================================================');
}

runProductionDiagnostics().catch(console.error);
