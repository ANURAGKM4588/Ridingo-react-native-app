import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';

import ridingoBlack from '../../assets/ridingo_black.png';
import ridingoWhite from '../../assets/ridingo_white.png';
import driverLogoDark from '../../assets/logo_drivers_01.png';
import driverLogoLight from '../../assets/logo_drivers_02.png';

/**
 * Ensures all external CDN assets (Google Fonts, Leaflet CSS) are loaded
 * in the environment dynamically so index.html can be removed without losing styles.
 */
function ensureExternalResourcesLoaded() {
  if (typeof document === 'undefined') return;

  const preconnect1Id = 'rg-font-preconnect-1';
  if (!document.getElementById(preconnect1Id)) {
    const link = document.createElement('link');
    link.id = preconnect1Id;
    link.rel = 'preconnect';
    link.href = 'https://fonts.googleapis.com';
    document.head.appendChild(link);
  }

  const preconnect2Id = 'rg-font-preconnect-2';
  if (!document.getElementById(preconnect2Id)) {
    const link = document.createElement('link');
    link.id = preconnect2Id;
    link.rel = 'preconnect';
    link.href = 'https://fonts.gstatic.com';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  const googleFontsId = 'rg-google-fonts';
  if (!document.getElementById(googleFontsId)) {
    const link = document.createElement('link');
    link.id = googleFontsId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=DM+Mono:wght@500&display=swap';
    document.head.appendChild(link);
  }

  const leafletCssId = 'rg-leaflet-css';
  if (!document.getElementById(leafletCssId)) {
    const link = document.createElement('link');
    link.id = leafletCssId;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  if (typeof window !== 'undefined') {
    if (!window.gm_authFailure) {
      window.gm_authFailure = function() {
        console.warn('[GoogleMaps] Google Maps API key notice: Places API or billing is not yet activated on Google Cloud Console. Seamlessly falling back to high-speed local places & Nominatim routing.');
      };
    }

    const gmapsScriptId = 'rg-google-maps-script';
    if (!document.getElementById(gmapsScriptId) && !window.google?.maps) {
      const script = document.createElement('script');
      script.id = gmapsScriptId;
      script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyC4h9iZeICidnBBQSiP0wCJo-TX_GxkxNM&libraries=places,geometry&loading=async';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const gsiScriptId = 'rg-google-gsi-script';
    if (!document.getElementById(gsiScriptId)) {
      const script = document.createElement('script');
      script.id = gsiScriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
          console.info('[PWA] ServiceWorker registered:', reg.scope);
        }).catch(function(err) {
          console.warn('[PWA] ServiceWorker registration notice:', err);
        });
      } catch (_) {}
    }
  }
}

/**
 * AppSplashScreen
 * Pure React Native replication of the splash overlay and initialization logic from index.html.
 *
 * @param {boolean} [isDriverProp] - Explicit flag for Driver app
 * @param {boolean} [isDarkProp] - Explicit flag for Dark mode
 * @param {boolean} [visible=true] - Controls splash visibility and fade-out transition
 * @param {() => void} [onAnimationEnd] - Callback when fade-out animation completes
 */
export default function AppSplashScreen({
  isDriver: isDriverProp,
  isDark: isDarkProp,
  visible = true,
  onAnimationEnd,
}) {
  // Ensure external fonts & CSS are linked immediately on mount
  useEffect(() => {
    ensureExternalResourcesLoaded();
  }, []);

  // Compute Driver vs User App status matching index.html logic
  const isDriver = (() => {
    if (typeof isDriverProp === 'boolean') return isDriverProp;
    if (typeof window !== 'undefined') {
      if (window.RIDINGO_TARGET === 'driver') return true;
      if (window.RIDINGO_TARGET === 'user') return false;
      const port = window.location.port || '';
      const search = (window.location.search || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (
        port === '5174' ||
        search.includes('app=driver') ||
        search.includes('view=driver') ||
        path.includes('/driver') ||
        hash.includes('driver')
      ) {
        return true;
      }
      if (typeof document !== 'undefined') {
        const dataApp = document.documentElement?.getAttribute('data-app');
        if (dataApp === 'driver' || document.documentElement?.classList?.contains('standalone-driver')) {
          return true;
        }
      }
    }
    return false;
  })();

  // Compute Dark Mode preference matching index.html logic
  const isDark = (() => {
    if (typeof isDarkProp === 'boolean') return isDarkProp;
    if (typeof window !== 'undefined') {
      try {
        const pref = isDriver
          ? (localStorage.getItem('ridingo_driver_theme') || 'light')
          : (localStorage.getItem('ridingo_user_theme') || localStorage.getItem('ridingo_theme_pref') || 'light');
        if (pref === 'dark') return true;
        if (pref === 'light') return false;
        if (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return true;
        }
      } catch (_) {}
      if (typeof document !== 'undefined') {
        const attr = document.documentElement?.getAttribute('data-theme');
        if (attr === 'dark') return true;
        if (attr === 'light') return false;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }
    }
    return false;
  })();

  // Synchronize document attributes & meta theme-color if running in web
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const themeVal = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', themeVal);
      document.documentElement.style.colorScheme = themeVal;
      document.documentElement.setAttribute('data-app', isDriver ? 'driver' : 'user');

      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', isDark ? '#0A0A0B' : '#FFFFFF');
      }
    }
  }, [isDark, isDriver]);

  // Animation values for Logo Enter, Shimmer Loader, and Fade Out
  const [overlayOpacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [logoScale] = useState(() => new Animated.Value(0.94));
  const [shimmerProgress] = useState(() => new Animated.Value(0));

  // 1. Logo Enter Animation: 0.5s cubic-bezier(0.16, 1, 0.3, 1) both
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [logoOpacity, logoScale]);

  // 2. Shimmer Loader Animation: 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: 1300,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      try {
        loop.stop();
      } catch (_) {}
    };
  }, [shimmerProgress]);

  // 3. Fade Out Transition: Trigger after 1100ms or when visible prop becomes false
  useEffect(() => {
    const autoDismiss = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 450,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        if (onAnimationEnd) onAnimationEnd();
      });
    }, 1100);

    return () => clearTimeout(autoDismiss);
  }, [overlayOpacity, onAnimationEnd]);

  useEffect(() => {
    if (!visible) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 450,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        if (onAnimationEnd) onAnimationEnd();
      });
    }
  }, [visible, overlayOpacity, onAnimationEnd]);

  // Shimmer width is 140px. Shimmer goes from left: -45% (-63px) to 110% (154px)
  const shimmerLeft = shimmerProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-63, 31.5, 154],
  });

  const shimmerWidth = shimmerProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [49, 77, 49], // 35% (49px) -> 55% (77px) -> 35% (49px)
  });

  // Logo source selection matching bundled assets
  const logoSource = isDriver
    ? (isDark ? driverLogoDark : driverLogoLight)
    : (isDark ? ridingoWhite : ridingoBlack);

  const logoAlt = isDriver ? 'Ridingo Driver' : 'Ridingo';

  return (
    <Animated.View
      nativeID="app-splash-screen"
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.appSplashOverlay,
        isDark ? styles.appSplashOverlayDark : styles.appSplashOverlayLight,
        { opacity: overlayOpacity },
      ]}
    >
      <View style={styles.appSplashContent}>
        {/* Animated Brand Logo */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Image
            source={logoSource}
            style={[
              styles.appSplashLogo,
              isDriver ? styles.logoDriver : styles.logoUser,
            ]}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={logoAlt}
          />
        </Animated.View>

        {/* Loader Track */}
        <View
          style={[
            styles.appSplashLoaderTrack,
            isDark ? styles.appSplashLoaderTrackDark : styles.appSplashLoaderTrackLight,
          ]}
        >
          {/* Shimmer Fill */}
          <Animated.View
            style={[
              styles.appSplashLoaderFill,
              {
                left: shimmerLeft,
                width: shimmerWidth,
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // .app-splash-overlay
  appSplashOverlay: {
    ...Platform.select({
      web: {
        position: 'fixed',
      },
      default: {
        position: 'absolute',
      },
    }),
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Light Mode Background: #FFFFFF
  appSplashOverlayLight: {
    backgroundColor: '#FFFFFF',
  },
  // Dark Mode Background: #090A0E
  appSplashOverlayDark: {
    backgroundColor: '#090A0E',
  },

  // .app-splash-content
  appSplashContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    transform: [{ translateY: -8 }],
  },

  // Base Logo Styles (.app-splash-logo)
  appSplashLogo: {
    alignSelf: 'center',
  },

  // User App Logo: height 48px, max-width 240px
  logoUser: {
    height: 48,
    width: 240,
  },

  // Driver App Logo: height 38px, max-width 210px
  logoDriver: {
    height: 38,
    width: 210,
  },

  // .app-splash-loader-track: width 140px, height 3px, border-radius 999px
  appSplashLoaderTrack: {
    width: 140,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  // Light Mode Loader Track: rgba(0, 0, 0, 0.08)
  appSplashLoaderTrackLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  // Dark Mode Loader Track: rgba(255, 255, 255, 0.12)
  appSplashLoaderTrackDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },

  // .app-splash-loader-fill
  appSplashLoaderFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: '#FFC70A', // fallback base color
    ...Platform.select({
      ios: {
        shadowColor: '#FFC70A',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 0 10px rgba(255, 199, 10, 0.55)',
        backgroundImage: 'linear-gradient(90deg, #FFC70A 0%, #FFA800 100%)',
      },
    }),
  },
});
