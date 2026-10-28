import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import NativeHomeTab from './NativeHomeTab';
import NativeTripsTab from './NativeTripsTab';
import NativeBottomNav from './NativeBottomNav';
import NativeBookingSheet from './NativeBookingSheet';
import NativeLiveTrackingSheet from './NativeLiveTrackingSheet';
import NativePaymentSheet from './NativePaymentSheet';
import AppSplashScreen from './AppSplashScreen';
import { LightTheme, DarkTheme } from '../../styles/theme';
import nativeStorage from '../../utils/nativeStorage';

export default function NativeUserApp() {
  const [isDark, setIsDark] = useState(() => {
    return nativeStorage.getItem('ridingo_user_theme') === 'dark';
  });

  const [splashVisible, setSplashVisible] = useState(true);

  // Auto-dismiss initial splash overlay
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashVisible(false);
    }, 1400);
    return () => clearTimeout(timer);
  }, []);
  const [activeTab, setActiveTab] = useState('home');

  // Modals state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingCategory, setBookingCategory] = useState('hourly');
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Active / Mock Trips
  const [trips, setTrips] = useState([
    {
      id: 'TRIP-1029',
      cat: 'hourly',
      status: 'inprogress',
      pickup: 'Indiranagar 100ft Road, Stage 2, Bengaluru',
      drop_loc: 'Kempegowda International Airport (BLR), Devanahalli',
      fare: 890,
      baseFare: 750,
      extensionDistanceKm: 7.5,
      extensionFare: 140,
      start_otp: '7291',
      scheduleDisplay: 'Today, 2:30 PM',
      driver: {
        name: 'Suresh Kumar',
        phone: '+919876543210',
        rating: '4.95',
        tripsCount: '2,140',
      },
    },
    {
      id: 'TRIP-1028',
      cat: 'airport',
      status: 'completed',
      pickup: 'Prestige Ozone, Whitefield, Bengaluru',
      drop_loc: 'Terminal 1, Kempegowda Airport, Bengaluru',
      fare: 1250,
      baseFare: 1100,
      extensionDistanceKm: 8,
      extensionFare: 150,
      scheduleDisplay: 'Yesterday, 8:15 AM',
      driver: {
        name: 'Rajesh G.',
        phone: '+919812345678',
        rating: '4.98',
        tripsCount: '1,890',
      },
    },
    {
      id: 'TRIP-1027',
      cat: 'daily',
      status: 'scheduled',
      pickup: 'Koramangala 4th Block, Bengaluru',
      drop_loc: 'Electronic City Phase 1, Hosur Main Road',
      fare: 1800,
      baseFare: 1800,
      scheduledDate: '2026-10-23',
      scheduleDisplay: 'Tomorrow, 9:00 AM',
      start_otp: '3819',
      driver: {
        name: 'Finding Driver...',
        rating: '5.0',
      },
    },
    {
      id: 'TRIP-1025',
      cat: 'outstation',
      status: 'completed',
      pickup: 'Jayanagar 4th Block, Bengaluru',
      drop_loc: 'Mysuru Palace Main Gate, Mysuru',
      fare: 3450,
      baseFare: 3200,
      extensionDistanceKm: 14,
      extensionFare: 250,
      scheduledDate: '2026-09-18',
      scheduleDisplay: '18 Sep 2026 · 6:30 AM',
      driver: {
        name: 'Venkatesh Rao',
        phone: '+919845123456',
        rating: '4.92',
        tripsCount: '3,410',
      },
    },
    {
      id: 'TRIP-1021',
      cat: 'event',
      status: 'completed',
      pickup: 'UB City, Vittal Mallya Road',
      drop_loc: 'Sadashivanagar, Bengaluru',
      fare: 950,
      baseFare: 950,
      scheduledDate: '2026-08-12',
      scheduleDisplay: '12 Aug 2026 · 11:45 PM',
      driver: {
        name: 'Manoj Pillai',
        phone: '+919900112233',
        rating: '4.97',
        tripsCount: '980',
      },
    },
  ]);

  const user = {
    name: 'Anurag',
    firstName: 'Anurag',
    phone: '+91 98765 43210',
  };

  const theme = isDark ? DarkTheme : LightTheme;

  const handleOpenBooking = (category = 'hourly') => {
    setBookingCategory(category);
    setBookingOpen(true);
  };

  const handleOpenLiveTracking = (tripId) => {
    const selected = trips.find(t => t.id === tripId) || trips[0];
    setActiveTrip(selected);
    setTrackingOpen(true);
  };

  const handleSubmitBooking = (bookingData) => {
    const newTrip = {
      id: `TRIP-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'requested',
      pickup: bookingData.pickup,
      drop_loc: bookingData.destination || 'Destination',
      fare: bookingData.estimatedFare,
      start_otp: String(Math.floor(1000 + Math.random() * 9000)),
      eta_minutes: 8,
      driver: {
        name: 'Finding Driver...',
        phone: '',
        rating: '5.0',
        tripsCount: '150',
      },
    };
    setTrips([newTrip, ...trips]);
    setActiveTrip(newTrip);
    setTrackingOpen(true);
  };

  const handleCancelTrip = (trip) => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip request?',
      [
        { text: 'No, Keep Trip', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            setTrips(trips.filter(t => t.id !== trip.id));
            setTrackingOpen(false);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.surface }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.surface}
      />

      {/* Main Tab Screen Content */}
      <View style={styles.screenContainer}>
        {activeTab === 'home' && (
          <NativeHomeTab
            user={user}
            trips={trips}
            onOpenBooking={handleOpenBooking}
            onOpenLiveTracking={handleOpenLiveTracking}
            onOpenNotifications={() => Alert.alert('Notifications', 'No new unread notifications.')}
            isDark={isDark}
          />
        )}

        {activeTab === 'trips' && (
          <NativeTripsTab
            trips={trips}
            user={user}
            isDark={isDark}
            onOpenBooking={handleOpenBooking}
            onOpenLiveTracking={handleOpenLiveTracking}
            onCancelTrip={handleCancelTrip}
          />
        )}

        {activeTab === 'wallet' && (
          <View style={[styles.centerPlaceholder, { backgroundColor: theme.surface }]}>
            <Text style={[styles.placeholderTitle, { color: theme.ink }]}>Ridingo Wallet</Text>
            <Text style={[styles.placeholderSub, { color: theme.muted }]}>Available Balance: ₹1,250</Text>
          </View>
        )}

        {activeTab === 'profile' && (
          <View style={[styles.centerPlaceholder, { backgroundColor: theme.surface }]}>
            <Text style={[styles.placeholderTitle, { color: theme.ink }]}>My Profile</Text>
            <Text style={[styles.placeholderSub, { color: theme.muted }]}>{user.name} · {user.phone}</Text>
            <TouchableOpacity
              style={{
                marginTop: 18,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.line,
              }}
              onPress={() => {
                const next = !isDark;
                setIsDark(next);
                nativeStorage.setItem('ridingo_user_theme', next ? 'dark' : 'light');
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.ink }}>
                Switch to {isDark ? 'Light' : 'Dark'} Mode
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Pure Native Bottom Navigation */}
      <NativeBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDark={isDark}
        visible={!bookingOpen && !trackingOpen && !paymentOpen}
      />

      {/* Pure Native Booking Sheet */}
      <NativeBookingSheet
        visible={bookingOpen}
        category={bookingCategory}
        onClose={() => setBookingOpen(false)}
        onSubmitBooking={handleSubmitBooking}
        isDark={isDark}
      />

      {/* Pure Native Live Tracking Sheet */}
      <NativeLiveTrackingSheet
        visible={trackingOpen}
        trip={activeTrip}
        onClose={() => setTrackingOpen(false)}
        onCancelTrip={handleCancelTrip}
        isDark={isDark}
      />

      {/* Pure Native Payment Sheet */}
      <NativePaymentSheet
        visible={paymentOpen}
        fare={activeTrip?.fare || 450}
        tripId={activeTrip?.id}
        onClose={() => setPaymentOpen(false)}
        isDark={isDark}
      />

      {/* Native Splash Screen Overlay on initial mount */}
      {splashVisible && (
        <AppSplashScreen
          isDark={isDark}
          appType="user"
          visible={splashVisible}
          onAnimationEnd={() => setSplashVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  centerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholderSub: {
    fontSize: 14,
    marginTop: 6,
  },
});
