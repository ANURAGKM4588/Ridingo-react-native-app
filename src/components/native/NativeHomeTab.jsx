import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import NativeIcon from './NativeIcon';
import { LightTheme, DarkTheme, Typography, Radii, Shadows } from '../../styles/theme';
import { isUserTrip } from '../../services/userService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BANNERS = [
  {
    id: 'hourly-banner',
    category: 'hourly',
    tag: 'RECOMMENDED',
    headline: 'HOURLY DRIVER SERVICE',
    sub: 'Need a driver for a few hours? Book easily on our app.',
    cta: 'Book Now',
    bgColor: '#0B0B0E',
    accentColor: '#FFC70A',
  },
  {
    id: 'airport-banner',
    category: 'airport',
    tag: 'FLAT RATE',
    headline: 'AIRPORT TRANSFERS',
    sub: 'On-time terminal drop & early morning pickup at fixed fares.',
    cta: 'Book Now',
    bgColor: '#0F172A',
    accentColor: '#38BDF8',
  },
  {
    id: 'outstation-banner',
    category: 'outstation',
    tag: 'MULTI-DAY',
    headline: 'WEEKEND ROAD TRIPS',
    sub: 'Verified highway experts for smooth family outstation getaways.',
    cta: 'Explore',
    bgColor: '#142018',
    accentColor: '#10B981',
  },
];

const CATEGORIES = [
  { id: 'hourly', name: 'Hourly Driver', blurb: '2 to 12 hours', icon: 'clock', from: '₹250/hr', badge: 'MOST POPULAR' },
  { id: 'daily', name: 'Full Day', blurb: '10 hours a day', icon: 'sun', from: '₹1,800/day' },
  { id: 'airport', name: 'Airport Transfer', blurb: 'Terminal drop & pickup', icon: 'plane', from: '₹900 flat' },
  { id: 'outstation', name: 'Outstation Trip', blurb: 'Inter-city multi-day', icon: 'route', from: '₹2,200/day' },
  { id: 'event', name: 'Night & Events', blurb: 'Late party / wedding', icon: 'moon', from: '₹350/hr' },
];

const POPULAR_DESTINATIONS = [
  { name: 'Ooty', distance: '270 km', type: 'Hill Station', time: '6 hrs drive' },
  { name: 'Nandi Hills', distance: '60 km', type: 'Sunrise Spot', time: '1.5 hrs drive' },
  { name: 'Coorg', distance: '265 km', type: 'Coffee Country', time: '5.5 hrs drive' },
  { name: 'Chikmagalur', distance: '245 km', type: 'Mountains', time: '5 hrs drive' },
  { name: 'Mysore', distance: '145 km', type: 'Heritage Palace', time: '3 hrs drive' },
];

const REVIEWS = [
  {
    name: 'Arjun Mehta',
    init: 'AM',
    car: 'BMW 330i Gran Limousine',
    tag: 'Hourly Driver',
    quote: 'Handed over my keys for a city dinner. Rajesh drove so smoothly, parked with extreme care, and was waiting right outside when we walked out.',
  },
  {
    name: 'Priya Nair',
    init: 'PN',
    car: 'Hyundai Creta SX(O)',
    tag: 'Airport Transfer',
    quote: 'Needed a 4:30 AM terminal drop. Vikram arrived 10 mins early in uniform, handled our luggage, and drove my family with calm precision.',
  },
  {
    name: 'Karan Singhania',
    init: 'KS',
    car: 'Toyota Fortuner 4x4',
    tag: 'Outstation Trip',
    quote: 'Hired Suresh for a 2-day family trip through the hills. Handled the hairpin bends effortlessly and treated my car like his own.',
  },
  {
    name: 'Dr. Sneha Roy',
    init: 'SR',
    car: 'Honda City ZX',
    tag: 'Full Day Hire',
    quote: 'Booked for back-to-back clinic visits and hospital rounds. Professional, zero mobile distractions while driving, and saved me hours of driving fatigue.',
  },
];

export default function NativeHomeTab({
  user,
  trips = [],
  onOpenBooking,
  onOpenLiveTracking,
  onOpenNotifications,
  isDark = false,
}) {
  const theme = isDark ? DarkTheme : LightTheme;

  // Greeting name
  const userName = user?.firstName || (user?.name ? user.name.split(' ')[0] : 'Arjun');
  const greetingName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Search & Locations
  const [searchQuery, setSearchQuery] = useState('');
  const [pickupLocation, setPickupLocation] = useState('Kadannamanna, Keralam 679324, India');
  const [destinationLocation, setDestinationLocation] = useState('');

  // Quick Saved Locations
  const [savedHome, setSavedHome] = useState('Koramangala 4th Block, Bengaluru');
  const [savedWork, setSavedWork] = useState('');
  const [savedPlaces, setSavedPlaces] = useState('');

  // Add / Edit Location Modal state
  const [modalType, setModalType] = useState(null); // 'home' | 'work' | 'saved' | null
  const [modalAddressInput, setModalAddressInput] = useState('');

  // Banner carousel state
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const bannerScrollRef = useRef(null);

  // Auto slide banner every 4.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => {
        const next = (prev + 1) % BANNERS.length;
        if (bannerScrollRef.current) {
          try {
            bannerScrollRef.current.scrollTo({ x: next * (SCREEN_WIDTH - 32), animated: true });
          } catch (_) {}
        }
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  // Active / Completed Trips review state
  const [dismissedTripIds, setDismissedTripIds] = useState([]);
  const [tripRatings, setTripRatings] = useState({});
  const [tripReviews, setTripReviews] = useState({});
  const [submittedReviews, setSubmittedReviews] = useState({});

  const activeTrips = (trips || []).filter((t) => {
    if (user && isUserTrip && !isUserTrip(t, user)) return false;
    if (dismissedTripIds.includes(t.id)) return false;
    if (['inprogress', 'ready_to_start', 'pickup_arrived', 'accepted', 'requested'].includes(t.status)) return true;
    if (t.status === 'completed') return true;
    return false;
  });

  const handleOpenAddLocation = (type) => {
    setModalType(type);
    if (type === 'home') setModalAddressInput(savedHome);
    else if (type === 'work') setModalAddressInput(savedWork);
    else if (type === 'saved') setModalAddressInput(savedPlaces);
  };

  const handleSaveLocation = () => {
    if (modalType === 'home') setSavedHome(modalAddressInput);
    else if (modalType === 'work') setSavedWork(modalAddressInput);
    else if (modalType === 'saved') setSavedPlaces(modalAddressInput);
    setModalType(null);
  };

  const handleSelectQuickLocation = (loc) => {
    if (!loc) return;
    setDestinationLocation(loc);
    if (onOpenBooking) {
      onOpenBooking('hourly');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.surface }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Bar with Bold 32px Greeting & Notification Bell */}
      <View style={styles.topBar}>
        <View style={styles.greetingWrap}>
          <Text style={[styles.greetingTitle, { color: theme.ink }]}>
            Hi, {greetingName}
          </Text>
          <Text style={[styles.greetingSub, { color: theme.muted }]}>
            Need a driver for your own car?
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.bellButton, { backgroundColor: theme.card, borderColor: theme.line }]}
          onPress={onOpenNotifications}
          activeOpacity={0.7}
          accessibilityLabel="Notifications"
        >
          <NativeIcon name="bell" size={20} color={theme.ink} />
          <View style={[styles.bellBadge, { backgroundColor: theme.yellow }]} />
        </TouchableOpacity>
      </View>

      {/* 2. Destination Search Bar */}
      <TouchableOpacity
        style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.line }]}
        activeOpacity={0.85}
        onPress={() => onOpenBooking && onOpenBooking('hourly')}
      >
        <NativeIcon name="search" size={18} color={theme.muted} style={styles.searchIcon} />
        <TextInput
          placeholder="Search recent trips, settings..."
          placeholderTextColor={theme.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { color: theme.ink }]}
          editable={false}
        />
      </TouchableOpacity>

      {/* 3. Offer Banner Carousel */}
      <View style={styles.carouselContainer}>
        <ScrollView
          ref={bannerScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
            setActiveBannerIdx(page);
          }}
          contentContainerStyle={styles.carouselContent}
        >
          {BANNERS.map((banner) => (
            <TouchableOpacity
              key={banner.id}
              activeOpacity={0.92}
              style={[
                styles.bannerCard,
                { backgroundColor: banner.bgColor },
                isDark ? styles.bannerDarkBorder : null,
              ]}
              onPress={() => onOpenBooking && onOpenBooking(banner.category)}
            >
              <View style={styles.bannerLeftCol}>
                <View style={styles.bannerBadgeRow}>
                  <Text style={styles.bannerBrandTag}>ON-DEMAND DRIVER SERVICE</Text>
                </View>

                <Text style={styles.bannerHeadline}>{banner.headline}</Text>
                <Text style={styles.bannerSub}>{banner.sub}</Text>

                <View style={[styles.bannerCtaPill, { backgroundColor: banner.accentColor }]}>
                  <Text style={styles.bannerCtaText}>{banner.cta}</Text>
                  <NativeIcon name="chevronRight" size={14} color="#000000" />
                </View>
              </View>

              {/* Graphic Icon Artwork */}
              <View style={styles.bannerGraphic}>
                <View style={[styles.graphicRing, { borderColor: banner.accentColor }]}>
                  <NativeIcon name="clock" size={32} color={banner.accentColor} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Carousel Pagination Dots */}
        <View style={styles.dotsRow}>
          {BANNERS.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === activeBannerIdx
                  ? [styles.activeDot, { backgroundColor: theme.solid }]
                  : { backgroundColor: theme.bar },
              ]}
            />
          ))}
        </View>
      </View>

      {/* 4. "Book a driver" Bento Route Card */}
      <View style={[styles.bookingHeroCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
        {/* Subtle Map Vector Background Graphic */}
        <View style={styles.heroBackgroundSvg} pointerEvents="none">
          {Platform.OS === 'web' ? (
            <svg width="220" height="130" viewBox="0 0 220 130" style={{ position: 'absolute', top: 0, right: 0 }}>
              <path
                d="M20 15 L220 10 M5 55 L220 40 M40 120 L220 95 M90 0 L150 130"
                stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#EEF2F6'}
                strokeWidth="2"
              />
              <path
                d="M130 35 Q 160 45, 220 60"
                stroke="#00D09C"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
                opacity={isDark ? 0.7 : 0.9}
              />
              <g transform="translate(120, 24) scale(0.62) rotate(18)">
                <rect x="0" y="8" width="56" height="24" rx="9" fill={isDark ? '#334155' : '#CBD5E1'} />
                <rect x="2" y="6" width="52" height="24" rx="8" fill={isDark ? '#1E293B' : '#FFFFFF'} />
                <rect x="12" y="9" width="30" height="18" rx="4" fill={isDark ? '#020617' : '#0F172A'} />
                <rect x="16" y="11" width="22" height="14" rx="3" fill="#38BDF8" opacity={0.65} />
                <rect x="19" y="11" width="16" height="14" rx="2" fill={isDark ? '#334155' : '#FFFFFF'} />
                <circle cx="53" cy="11" r="2.5" fill="#FDE047" />
                <circle cx="53" cy="25" r="2.5" fill="#FDE047" />
              </g>
            </svg>
          ) : (
            <Svg width="220" height="130" viewBox="0 0 220 130">
              <Path
                d="M20 15 L220 10 M5 55 L220 40 M40 120 L220 95 M90 0 L150 130"
                stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#EEF2F6'}
                strokeWidth="2"
              />
              <Path
                d="M130 35 Q 160 45, 220 60"
                stroke="#00D09C"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
                opacity={isDark ? 0.7 : 0.9}
              />
              <G transform="translate(120, 24) scale(0.62) rotate(18)">
                <Rect x="0" y="8" width="56" height="24" rx="9" fill={isDark ? '#334155' : '#CBD5E1'} />
                <Rect x="2" y="6" width="52" height="24" rx="8" fill={isDark ? '#1E293B' : '#FFFFFF'} />
                <Rect x="12" y="9" width="30" height="18" rx="4" fill={isDark ? '#020617' : '#0F172A'} />
                <Rect x="16" y="11" width="22" height="14" rx="3" fill="#38BDF8" opacity={0.65} />
                <Rect x="19" y="11" width="16" height="14" rx="2" fill={isDark ? '#334155' : '#FFFFFF'} />
                <Circle cx="53" cy="11" r="2.5" fill="#FDE047" />
                <Circle cx="53" cy="25" r="2.5" fill="#FDE047" />
              </G>
            </Svg>
          )}
        </View>

        {/* Header */}
        <View style={styles.bookingCardHeader}>
          <Text style={[styles.bookingCardTitle, { color: theme.ink }]}>Book a driver</Text>
          <Text style={[styles.bookingCardSubtitle, { color: theme.muted }]}>
            Tell us your trip details
          </Text>
        </View>

        {/* Route Fields with Connector Line */}
        <View style={styles.routeContainer}>
          {/* Vertical Dashed Connector Line */}
          <View style={styles.dashedLine} />

          {/* Pickup Capsule */}
          <TouchableOpacity
            style={[styles.capsuleInputBox, { backgroundColor: theme.surface, borderColor: theme.line }]}
            activeOpacity={0.88}
            onPress={() => onOpenBooking && onOpenBooking('hourly')}
          >
            <View style={styles.pinWrap}>
              <NativeIcon name="pinFilled" size={20} color="#10B981" />
            </View>
            <View style={styles.capsuleTextCol}>
              <Text style={[styles.capsuleFieldLabel, { color: theme.muted }]}>Pickup location</Text>
              <Text style={[styles.capsuleFieldValue, { color: theme.ink }]} numberOfLines={1}>
                {pickupLocation}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.capsuleActionBtn, { backgroundColor: theme.card, borderColor: theme.line }]}
              onPress={() => setPickupLocation('Current GPS Location Detected')}
            >
              <NativeIcon name="crosshair" size={16} color={theme.ink} />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Destination Capsule */}
          <TouchableOpacity
            style={[styles.capsuleInputBox, { backgroundColor: theme.surface, borderColor: theme.line }]}
            activeOpacity={0.88}
            onPress={() => onOpenBooking && onOpenBooking('hourly')}
          >
            <View style={styles.pinWrap}>
              <NativeIcon name="pinFilled" size={20} color="#EF4444" />
            </View>
            <View style={styles.capsuleTextCol}>
              <Text style={[styles.capsuleFieldLabel, { color: theme.muted }]}>Destination location</Text>
              <Text
                style={[
                  styles.capsuleFieldValue,
                  { color: destinationLocation ? theme.ink : theme.muted },
                ]}
                numberOfLines={1}
              >
                {destinationLocation || 'Where are you heading to?'}
              </Text>
            </View>
            <View style={[styles.capsuleActionBtn, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <NativeIcon name="map" size={16} color={theme.ink} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Address Chips: Home, Work, Saved */}
        <View style={styles.chipsRow}>
          {/* Home Chip */}
          <TouchableOpacity
            style={[styles.quickChip, { backgroundColor: theme.surface, borderColor: theme.line }]}
            activeOpacity={0.8}
            onPress={() => (savedHome ? handleSelectQuickLocation(savedHome) : handleOpenAddLocation('home'))}
            onLongPress={() => handleOpenAddLocation('home')}
          >
            <View style={[styles.chipIconBox, { backgroundColor: theme.card }]}>
              <NativeIcon name="home" size={16} color={theme.ink} />
            </View>
            <View style={styles.chipTextCol}>
              <Text style={[styles.chipTitle, { color: theme.ink }]}>Home</Text>
              <Text style={[styles.chipSub, { color: theme.muted }]} numberOfLines={1}>
                {savedHome ? savedHome.split(',')[0] : 'Add'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Work Chip */}
          <TouchableOpacity
            style={[styles.quickChip, { backgroundColor: theme.surface, borderColor: theme.line }]}
            activeOpacity={0.8}
            onPress={() => (savedWork ? handleSelectQuickLocation(savedWork) : handleOpenAddLocation('work'))}
            onLongPress={() => handleOpenAddLocation('work')}
          >
            <View style={[styles.chipIconBox, { backgroundColor: theme.card }]}>
              <NativeIcon name="work" size={16} color={theme.ink} />
            </View>
            <View style={styles.chipTextCol}>
              <Text style={[styles.chipTitle, { color: theme.ink }]}>Work</Text>
              <Text style={[styles.chipSub, { color: theme.muted }]} numberOfLines={1}>
                {savedWork ? savedWork.split(',')[0] : 'Add'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Saved Places Chip */}
          <TouchableOpacity
            style={[styles.quickChip, { backgroundColor: theme.surface, borderColor: theme.line }]}
            activeOpacity={0.8}
            onPress={() => (savedPlaces ? handleSelectQuickLocation(savedPlaces) : handleOpenAddLocation('saved'))}
            onLongPress={() => handleOpenAddLocation('saved')}
          >
            <View style={[styles.chipIconBox, { backgroundColor: theme.card }]}>
              <NativeIcon name="star" size={16} color="#EAB308" filled />
            </View>
            <View style={styles.chipTextCol}>
              <Text style={[styles.chipTitle, { color: theme.ink }]}>Saved</Text>
              <Text style={[styles.chipSub, { color: theme.muted }]} numberOfLines={1}>
                {savedPlaces ? savedPlaces.split(',')[0] : 'Places'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[styles.bookingCtaBtn, { backgroundColor: theme.solid }]}
          activeOpacity={0.88}
          onPress={() => onOpenBooking && onOpenBooking('hourly')}
        >
          <Text style={[styles.bookingCtaText, { color: theme.onSolid }]}>
            Confirm Details & Choose Vehicle
          </Text>
          <NativeIcon name="chevronRight" size={18} color={theme.onSolid} />
        </TouchableOpacity>
      </View>

      {/* 5. Active Trip Banner (if any trip active) */}
      {activeTrips.length > 0 && (
        <View style={styles.activeTripsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveIndicatorRow}>
              <View style={[styles.liveDot, { backgroundColor: theme.accentGreen }]} />
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Live Trip</Text>
            </View>
            <Text style={[styles.liveBadge, { color: theme.accentGreen, backgroundColor: theme.accentGreenSoft }]}>
              GPS Active
            </Text>
          </View>

          {activeTrips.map((trip) => {
            const isCompleted = trip.status === 'completed';
            const isSubmitted = submittedReviews[trip.id] || trip.rating || trip.userRating;
            const currentRating = tripRatings[trip.id] || 5;
            const driverName = (typeof trip.driver === 'string' ? trip.driver : trip.driver?.name) || 'Ravi Kumar';

            if (isCompleted) {
              return (
                <View
                  key={trip.id}
                  style={[styles.activeTripCard, { backgroundColor: theme.card, borderColor: '#10B981', borderWidth: 1.5 }]}
                >
                  <View style={styles.activeTripHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <View style={{ backgroundColor: '#10B981', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>COMPLETED</Text>
                        </View>
                        <Text style={[styles.tripRoute, { color: theme.ink, flex: 1 }]} numberOfLines={1}>
                          {trip.pickup || 'Pickup'} ➔ {trip.drop_loc || 'Drop-off'}
                        </Text>
                      </View>
                      <Text style={[styles.tripStatusText, { color: theme.muted }]}>
                        Driver: {driverName} · ₹{trip.fare || 750}
                      </Text>
                    </View>
                  </View>

                  {isSubmitted ? (
                    <View style={{ marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center' }}>
                      <Text style={{ color: '#F59E0B', fontSize: 18, marginBottom: 4 }}>★★★★★</Text>
                      <Text style={{ color: theme.ink, fontWeight: '700', fontSize: 13 }}>Thank you for reviewing {driverName}!</Text>
                      <TouchableOpacity
                        style={[styles.trackButton, { backgroundColor: theme.solid, marginTop: 8 }]}
                        onPress={() => setDismissedTripIds(prev => [...prev, trip.id])}
                      >
                        <Text style={[styles.trackButtonText, { color: theme.onSolid }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: theme.ink, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>
                        Rate Your Driver Experience
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity
                            key={star}
                            onPress={() => setTripRatings(prev => ({ ...prev, [trip.id]: star }))}
                          >
                            <Text style={{ fontSize: 24, color: star <= currentRating ? '#F59E0B' : theme.line }}>
                              ★
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TextInput
                        value={tripReviews[trip.id] || ''}
                        onChangeText={(txt) => setTripReviews(prev => ({ ...prev, [trip.id]: txt }))}
                        placeholder={`Write a review for ${driverName}...`}
                        placeholderTextColor={theme.muted}
                        style={{
                          borderWidth: 1,
                          borderColor: theme.line,
                          borderRadius: 8,
                          padding: 8,
                          fontSize: 12,
                          color: theme.ink,
                          backgroundColor: theme.surface,
                          marginBottom: 10,
                        }}
                      />

                      <TouchableOpacity
                        style={[styles.trackButton, { backgroundColor: '#10B981' }]}
                        onPress={() => {
                          const star = tripRatings[trip.id] || 5;
                          const rev = tripReviews[trip.id] || '';
                          setSubmittedReviews(prev => ({ ...prev, [trip.id]: { rating: star, review: rev } }));
                        }}
                      >
                        <NativeIcon name="check" size={14} color="#FFFFFF" />
                        <Text style={[styles.trackButtonText, { color: '#FFFFFF' }]}>Submit Review</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={trip.id}
                style={[styles.activeTripCard, { backgroundColor: theme.card, borderColor: theme.line }]}
                activeOpacity={0.9}
                onPress={() => onOpenLiveTracking && onOpenLiveTracking(trip.id)}
              >
                <View style={styles.activeTripHeader}>
                  <View>
                    <Text style={[styles.tripRoute, { color: theme.ink }]}>
                      {trip.pickup || 'Current Location'} ➔ {trip.drop_loc || 'Destination'}
                    </Text>
                    <Text style={[styles.tripStatusText, { color: theme.muted }]}>
                      {trip.status === 'inprogress' ? 'Trip in progress' : 'Driver en route'} · ₹{trip.fare || 450}
                    </Text>
                  </View>
                  <NativeIcon name="chevronRight" size={18} color={theme.muted} />
                </View>

                <TouchableOpacity
                  style={[styles.trackButton, { backgroundColor: theme.solid }]}
                  onPress={() => onOpenLiveTracking && onOpenLiveTracking(trip.id)}
                >
                  <NativeIcon name="navigation" size={14} color={theme.onSolid} />
                  <Text style={[styles.trackButtonText, { color: theme.onSolid }]}>Track Driver on Map</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 6. Services Header */}
      <View style={styles.servicesHeader}>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>
          Hire a verified driver
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>
          Trained on luxury sedans, automatics, & manual SUVs
        </Text>
      </View>

      {/* 7. Hourly Driver Hero Bento Card */}
      <TouchableOpacity
        style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.line }]}
        activeOpacity={0.88}
        onPress={() => onOpenBooking && onOpenBooking('hourly')}
      >
        <View style={styles.heroCardTop}>
          <View style={[styles.recommendedBadge, { backgroundColor: theme.yellow }]}>
            <Text style={styles.recommendedBadgeText}>MOST POPULAR</Text>
          </View>
          <Text style={[styles.heroPrice, { color: theme.ink }]}>₹250/hr</Text>
        </View>

        <View style={styles.heroCardBody}>
          <View style={[styles.categoryIconWrap, { backgroundColor: theme.surface }]}>
            <NativeIcon name="clock" size={26} color={theme.ink} />
          </View>
          <View style={styles.heroTextContent}>
            <Text style={[styles.categoryTitle, { color: theme.ink }]}>Hourly Driver</Text>
            <Text style={[styles.categoryBlurb, { color: theme.muted }]}>
              Pay strictly for the hours you use. Perfect for dining, shopping & hospital visits.
            </Text>
          </View>
        </View>

        <View style={[styles.heroCardFooter, { borderTopColor: theme.line }]}>
          <Text style={[styles.bookNowText, { color: theme.ink }]}>Book Hourly Driver</Text>
          <NativeIcon name="chevronRight" size={16} color={theme.ink} />
        </View>
      </TouchableOpacity>

      {/* 8. Grid for Other Categories */}
      <View style={styles.categoryGrid}>
        {CATEGORIES.filter((c) => c.id !== 'hourly').map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.gridCard, { backgroundColor: theme.card, borderColor: theme.line }]}
            activeOpacity={0.88}
            onPress={() => onOpenBooking && onOpenBooking(cat.id)}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: theme.surface }]}>
              <NativeIcon name={cat.icon} size={20} color={theme.ink} />
            </View>
            <Text style={[styles.gridTitle, { color: theme.ink }]}>{cat.name}</Text>
            <Text style={[styles.gridBlurb, { color: theme.muted }]}>{cat.blurb}</Text>
            <Text style={[styles.gridPrice, { color: theme.ink }]}>{cat.from}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 9. Curated Weekend Road Trips (Popular Destinations) */}
      <View style={styles.destinationsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Curated Road Trips</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>Weekend getaways with private chauffeur</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationsRow}>
          {POPULAR_DESTINATIONS.map((dest, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.destinationCard, { backgroundColor: theme.card, borderColor: theme.line }]}
              activeOpacity={0.88}
              onPress={() => {
                setDestinationLocation(dest.name);
                onOpenBooking && onOpenBooking('outstation');
              }}
            >
              <View style={[styles.destTypeTag, { backgroundColor: 'rgba(15, 23, 42, 0.78)' }]}>
                <Text style={styles.destTypeText}>{dest.type}</Text>
              </View>
              <View style={styles.destBottomContent}>
                <Text style={[styles.destName, { color: '#FFFFFF' }]}>{dest.name}</Text>
                <Text style={styles.destDistance}>{dest.distance} · {dest.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 10. Customer Reviews Section */}
      <View style={styles.reviewsSection}>
        <View style={styles.sectionHeaderRowBetween}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Keys in good hands</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>Verified stories from car owners</Text>
          </View>
          <View style={[styles.ratingPill, { backgroundColor: theme.yellow }]}>
            <Text style={styles.ratingPillText}>★ 4.9</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsRow}>
          {REVIEWS.map((r, i) => (
            <View
              key={i}
              style={[styles.reviewCard, { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <View style={styles.reviewTopRow}>
                <View style={[styles.reviewAvatar, { backgroundColor: theme.solid }]}>
                  <Text style={[styles.reviewAvatarText, { color: theme.onSolid }]}>{r.init}</Text>
                </View>
                <View style={styles.reviewMeta}>
                  <View style={styles.reviewNameRow}>
                    <Text style={[styles.reviewName, { color: theme.ink }]}>{r.name}</Text>
                    <View style={styles.verifiedCheck}>
                      <NativeIcon name="check" size={10} color="#10B981" strokeWidth={3} />
                    </View>
                  </View>
                  <Text style={[styles.reviewCar, { color: theme.muted }]}>{r.car}</Text>
                </View>
                <Text style={styles.reviewStars}>★★★★★</Text>
              </View>
              <Text style={[styles.reviewQuote, { color: theme.ink }]}>“{r.quote}”</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Bottom Padding for Tab Bar */}
      <View style={{ height: 90 }} />

      {/* 11. Pure Native Add / Edit Location Modal */}
      <Modal
        visible={Boolean(modalType)}
        transparent
        animationType="fade"
        onRequestClose={() => setModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>
              {modalType === 'home' ? 'Add Home Location' : modalType === 'work' ? 'Add Work Location' : 'Add Saved Place'}
            </Text>
            <Text style={[styles.modalSub, { color: theme.muted }]}>
              Save address for quick 1-tap bookings
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surface, color: theme.ink, borderColor: theme.line }]}
              placeholder="Enter complete building or street address..."
              placeholderTextColor={theme.muted}
              value={modalAddressInput}
              onChangeText={setModalAddressInput}
              autoFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, { borderColor: theme.line }]}
                onPress={() => setModalType(null)}
              >
                <Text style={[styles.modalBtnSecondaryText, { color: theme.ink }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: theme.solid }]}
                onPress={handleSaveLocation}
              >
                <Text style={[styles.modalBtnPrimaryText, { color: theme.onSolid }]}>Save Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
  },

  // 1. Top Bar & Hero Greeting
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  greetingSub: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 4,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.card,
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // 2. Search Box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 20,
    ...Shadows.card,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },

  // 3. Offer Banner Carousel
  carouselContainer: {
    marginBottom: 20,
  },
  carouselContent: {
    gap: 12,
  },
  bannerCard: {
    width: SCREEN_WIDTH - 32,
    height: 156,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  bannerDarkBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bannerLeftCol: {
    flex: 1,
    zIndex: 2,
    justifyContent: 'center',
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerBrandTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFC70A',
    letterSpacing: 0.8,
  },
  bannerHeadline: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
    lineHeight: 22,
  },
  bannerSub: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
    maxWidth: 210,
    lineHeight: 16,
  },
  bannerCtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  bannerCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  bannerGraphic: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  graphicRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 5,
    borderRadius: 3,
  },
  activeDot: {
    width: 22,
  },

  // 4. "Book a driver" Bento Route Card
  bookingHeroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.card,
  },
  heroBackgroundSvg: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 0,
  },
  bookingCardHeader: {
    marginBottom: 16,
    zIndex: 1,
  },
  bookingCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  bookingCardSubtitle: {
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: 3,
  },
  routeContainer: {
    position: 'relative',
    zIndex: 1,
    marginBottom: 14,
  },
  dashedLine: {
    position: 'absolute',
    left: 26,
    top: 50,
    bottom: 50,
    width: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#94A3B8',
    zIndex: 2,
  },
  capsuleInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  pinWrap: {
    marginRight: 10,
  },
  capsuleTextCol: {
    flex: 1,
    marginRight: 8,
  },
  capsuleFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  capsuleFieldValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  capsuleActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quick Address Chips
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    zIndex: 1,
  },
  quickChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  chipIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTextCol: {
    flex: 1,
  },
  chipTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },

  // CTA Button
  bookingCtaBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
    ...Shadows.card,
  },
  bookingCtaText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // 5. Active Trips Section
  activeTripsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  liveBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  activeTripCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    ...Shadows.card,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripRoute: {
    fontSize: 15,
    fontWeight: '700',
  },
  tripStatusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  trackButton: {
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trackButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // 6. Services Header
  servicesHeader: {
    marginBottom: 14,
  },

  // 7. Hero Hourly Bento Card
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    ...Shadows.card,
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
  },
  heroPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  categoryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  categoryBlurb: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  heroCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  bookNowText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // 8. Grid for other categories
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    ...Shadows.card,
  },
  gridIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  gridBlurb: {
    fontSize: 11,
    marginVertical: 2,
  },
  gridPrice: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  // 9. Destinations
  destinationsSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  destinationsRow: {
    gap: 12,
  },
  destinationCard: {
    width: 148,
    height: 120,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    ...Shadows.card,
  },
  destTypeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  destTypeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  destBottomContent: {},
  destName: {
    fontSize: 14,
    fontWeight: '800',
  },
  destDistance: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },

  // 10. Reviews
  reviewsSection: {
    marginBottom: 20,
  },
  sectionHeaderRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ratingPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  ratingPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  reviewsRow: {
    gap: 12,
  },
  reviewCard: {
    width: SCREEN_WIDTH - 64,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    ...Shadows.card,
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reviewAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  reviewMeta: {
    flex: 1,
  },
  reviewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewName: {
    fontSize: 13,
    fontWeight: '700',
  },
  verifiedCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCar: {
    fontSize: 11,
    fontWeight: '500',
  },
  reviewStars: {
    color: '#FFC70A',
    fontSize: 14,
  },
  reviewQuote: {
    fontSize: 12.5,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // 11. Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...Shadows.floating,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '850',
  },
  modalSub: {
    fontSize: 12.5,
    marginTop: 2,
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
