import { Appearance, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Ridingo React Native Custom Notification Engine for Driver App
 * 
 * Strict UI Specifications:
 * 1. Dynamic Theme Switching:
 *    - Light Mode: Pure White Background (#FFFFFF) with Pure Black Text (#000000)
 *    - Dark Mode: Pure Black Background (#000000) with Pure White Text (#FFFFFF)
 * 2. Information Displayed:
 *    - Pickup Location & Destination / Drop Location
 *    - Fare Amount (₹) & Advance Payment details
 *    - Route Distance & ETA duration
 * 3. Action Buttons:
 *    - Green Accept Button (#16A34A / #22C55E)
 *    - Red Decline Button (#DC2626 / #EF4444)
 * 4. Background Execution & Platform Architecture:
 *    - iOS: UNNotificationCategory ('TRIP_DISPATCH_CATEGORY') with native Destructive (Red) & Foreground (Green) actions
 *    - Android: Custom Layout & Background Action Event Receiver via @notifee/react-native & Firebase Headless JS
 *    - Universal Fallback: Expo Notifications (TaskManager background task) & Browser Web Notification
 */

export const NOTIFICATION_CHANNELS = {
  TRIP_DISPATCH: 'ridingo_trip_dispatch_channel',
  TRIP_ALERTS: 'ridingo_trip_alerts_channel'
};

export const NOTIFICATION_CATEGORIES = {
  TRIP_DISPATCH: 'TRIP_DISPATCH_CATEGORY'
};

export const NOTIFICATION_ACTIONS = {
  ACCEPT: 'ACTION_ACCEPT_TRIP',
  DECLINE: 'ACTION_DECLINE_TRIP'
};

// Strict Theme Color Palettes
export const NOTIFICATION_THEMES = {
  light: {
    background: '#FFFFFF',       // Strict White Background
    cardBackground: '#F8FAFC',
    textPrimary: '#000000',      // Strict Black Text
    textSecondary: '#334155',    // Dark Slate
    accent: '#0F172A',
    borderColor: '#E2E8F0',
    acceptColor: '#16A34A',      // Emerald Green
    declineColor: '#DC2626'      // Crimson Red
  },
  dark: {
    background: '#000000',       // Strict Black Background
    cardBackground: '#111827',
    textPrimary: '#FFFFFF',      // Strict White Text
    textSecondary: '#CBD5E1',    // Light Slate
    accent: '#F8FAFC',
    borderColor: '#1F2937',
    acceptColor: '#22C55E',      // Vibrant Green
    declineColor: '#EF4444'      // Vibrant Red
  }
};

/**
 * Resolves current theme colors based on device system appearance
 */
export function getNotificationThemeColors() {
  let isDark = false;
  try {
    if (Appearance && typeof Appearance.getColorScheme === 'function') {
      isDark = Appearance.getColorScheme() === 'dark';
    } else if (typeof window !== 'undefined' && window.matchMedia) {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  } catch (_) {}

  return {
    isDark,
    theme: isDark ? NOTIFICATION_THEMES.dark : NOTIFICATION_THEMES.light
  };
}

/**
 * 1. Initialize Notification Categories & Channels
 * Configures iOS UNNotificationCategory with Green/Red actions and Android Heads-Up Notification Channel.
 */
export async function setupTripNotificationEngine() {
  // 1. Try Notifee native module
  try {
    const notifee = (await import('@notifee/react-native')).default;
    const { AndroidImportance, AndroidVisibility } = await import('@notifee/react-native');

    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.TRIP_DISPATCH,
        name: 'Ridingo Trip Requests',
        description: 'Urgent incoming trip dispatches with custom light/dark layout and action buttons',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        vibrationPattern: [300, 150, 300, 150, 400],
        lights: true,
        lightColor: '#FFC70A',
        sound: 'default'
      });
    }

    if (Platform.OS === 'ios') {
      await notifee.setNotificationCategories([
        {
          id: NOTIFICATION_CATEGORIES.TRIP_DISPATCH,
          actions: [
            {
              id: NOTIFICATION_ACTIONS.ACCEPT,
              title: 'Accept Trip',
              foreground: true
            },
            {
              id: NOTIFICATION_ACTIONS.DECLINE,
              title: 'Decline',
              destructive: true
            }
          ]
        }
      ]);
    }

    console.info('[NotificationEngine] Notifee Channels & Categories initialized successfully');
    return true;
  } catch (notifeeErr) {
    // 2. Fallback to Expo Notifications if Notifee is unavailable
    try {
      const Notifications = await import('expo-notifications');
      if (Notifications && typeof Notifications.setNotificationCategoryAsync === 'function') {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.TRIP_DISPATCH, {
            name: 'Ridingo Trip Requests',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FFC70A',
            sound: 'default',
            showBadge: true
          });
        }

        await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.TRIP_DISPATCH, [
          {
            identifier: NOTIFICATION_ACTIONS.ACCEPT,
            buttonTitle: '✓ Accept Trip',
            options: {
              opensAppToForeground: true
            }
          },
          {
            identifier: NOTIFICATION_ACTIONS.DECLINE,
            buttonTitle: '✕ Decline',
            options: {
              isDestructive: true,
              opensAppToForeground: false
            }
          }
        ]);
        console.info('[NotificationEngine] Expo Notifications Categories initialized successfully');
        return true;
      }
    } catch (_) {}
  }
  return false;
}

/**
 * 2. Display Custom Light/Dark Mode Trip Notification
 * Strict UI:
 * - Light Mode: White background (#FFFFFF) with Black text (#000000)
 * - Dark Mode: Black background (#000000) with White text (#FFFFFF)
 * - Pickup, Drop, Distance, ETA, and Fare Amount (₹)
 * - Green Accept Button (#16A34A) & Red Decline Button (#DC2626)
 */
export async function displayCustomTripNotification(tripData = {}) {
  const tripId = tripData.tripId || tripData.id || `trip_${Date.now()}`;
  const fare = Number(tripData.fare || tripData.driverPayout || 600);
  const advance = Number(tripData.advance || Math.round(fare * 0.3));
  const pickup = tripData.pickup || tripData.from || 'Customer Pickup';
  const drop = tripData.drop || tripData.drop_loc || tripData.destination || 'City Destination';
  const distance = tripData.distance || tripData.distanceText || '12.4 km';
  const duration = tripData.duration || tripData.durationText || '28 mins';
  const customer = tripData.customerName || 'Customer';

  // STRICT USER SPECIFICATION:
  // When the app is OPEN, do NOT show the trip request push notification!
  // It only needs to appear when the app is MINIMIZED (background) or CLOSED (not in recent apps).
  let isAppForeground = false;
  try {
    const { AppState } = await import('react-native');
    if (AppState && AppState.currentState === 'active' && !tripData.forceNotification) {
      isAppForeground = true;
    }
  } catch (_) {}

  if (isAppForeground) {
    console.info('[NotificationEngine] Driver app is currently OPEN in foreground. Suppressing trip request push notification (driver sees incoming UI directly).');
    return false;
  }

  const { isDark, theme } = getNotificationThemeColors();

  // 1. Try Notifee native module
  try {
    const notifee = (await import('@notifee/react-native')).default;
    const { AndroidImportance, AndroidVisibility, AndroidStyle } = await import('@notifee/react-native');

    const formattedHtmlText = `
      <div style="background-color: ${theme.background}; color: ${theme.textPrimary}; padding: 8px;">
        <p><b style="color: ${theme.textPrimary}; font-size: 16px;">₹${fare} Total</b> <span style="color: ${theme.textSecondary}; font-size: 13px;">(₹${advance} Advance Paid)</span></p>
        <p><b style="color: ${theme.textPrimary};">📍 Pickup:</b> <span style="color: ${theme.textSecondary};">${pickup}</span></p>
        <p><b style="color: ${theme.textPrimary};">🏁 Drop:</b> <span style="color: ${theme.textSecondary};">${drop}</span></p>
        <p style="color: ${theme.textSecondary}; font-size: 12px;">Route: ${distance} · ETA: ${duration} (${customer})</p>
      </div>
    `.trim();

    const plainTextBody = `Total: ₹${fare} (₹${advance} Advance)\n📍 Pickup: ${pickup}\n🏁 Drop: ${drop}\nRoute: ${distance} · ETA: ${duration}`;
    const acceptActionTitle = `<font color="${theme.acceptColor}"><b>✓ ACCEPT ₹${fare}</b></font>`;
    const declineActionTitle = `<font color="${theme.declineColor}"><b>✕ DECLINE</b></font>`;

    await notifee.displayNotification({
      id: String(tripId),
      title: `🚗 New Trip Request: ₹${fare}`,
      subtitle: `${pickup} ➔ ${drop}`,
      body: plainTextBody,
      data: {
        tripId: String(tripId),
        fare: String(fare),
        advance: String(advance),
        pickup,
        drop,
        distance,
        duration,
        type: 'TRIP_REQUEST'
      },
      ios: {
        categoryId: NOTIFICATION_CATEGORIES.TRIP_DISPATCH,
        sound: 'default',
        critical: true,
        interruptionLevel: 'timeSensitive',
        foregroundPresentationOptions: {
          badge: true,
          sound: true,
          banner: true,
          list: true
        }
      },
      android: {
        channelId: NOTIFICATION_CHANNELS.TRIP_DISPATCH,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        color: theme.background,
        smallIcon: 'ic_stat_ridingo',
        largeIcon: 'https://ridingo.app/app_icon.png',
        style: {
          type: AndroidStyle.BIGTEXT,
          text: formattedHtmlText,
          title: `<font color="${theme.textPrimary}"><b>🚗 New Trip Request · ₹${fare}</b></font>`,
          summary: `${distance} · ₹${fare}`
        },
        actions: [
          {
            title: acceptActionTitle,
            icon: 'https://ridingo.app/icons/accept-check.png',
            pressAction: {
              id: NOTIFICATION_ACTIONS.ACCEPT,
              launchActivity: true
            }
          },
          {
            title: declineActionTitle,
            icon: 'https://ridingo.app/icons/decline-cross.png',
            pressAction: {
              id: NOTIFICATION_ACTIONS.DECLINE,
              launchActivity: false
            }
          }
        ],
        pressAction: {
          id: 'default',
          launchActivity: true
        }
      }
    });

    console.info(`[NotificationEngine] Displayed Notifee custom notification (${isDark ? 'Dark Mode' : 'Light Mode'}, Fare: ₹${fare})`);
    return true;
  } catch (notifeeErr) {
    // 2. Fallback to Expo Notifications
    try {
      const Notifications = await import('expo-notifications');
      if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
        await Notifications.scheduleNotificationAsync({
          identifier: String(tripId),
          content: {
            title: `🚗 New Trip Request: ₹${fare}`,
            subtitle: `${pickup} ➔ ${drop}`,
            body: `₹${fare} Total (₹${advance} Advance)\n📍 Pickup: ${pickup}\n🏁 Drop: ${drop}\nRoute: ${distance} · ETA: ${duration}`,
            categoryIdentifier: NOTIFICATION_CATEGORIES.TRIP_DISPATCH,
            data: {
              tripId: String(tripId),
              fare: String(fare),
              advance: String(advance),
              pickup,
              drop,
              type: 'TRIP_REQUEST'
            },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX
          },
          trigger: null // immediate delivery
        });
        console.info(`[NotificationEngine] Displayed Expo custom notification (Fare: ₹${fare})`);
        return true;
      }
    } catch (_) {}

    // 3. Browser / Web fallback
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🚗 New Trip Request: ₹${fare}`, {
          body: `📍 ${pickup} ➔ 🏁 ${drop}\nTotal: ₹${fare} (₹${advance} Advance)`,
          icon: '/app_icon.png',
          tag: String(tripId),
          data: { tripId, fare, pickup, drop }
        });
        return true;
      } catch (_) {}
    }
  }

  return false;
}

/**
 * 3. Android & iOS Custom Background & Foreground Action Receiver
 * Listens for driver interactions with Green Accept and Red Decline buttons in background and foreground.
 * Automatically updates Supabase even if the app UI is backgrounded or killed!
 * 
 * @param {Object} handlers
 * @param {Function} handlers.onAccept - Called when Accept button is pressed
 * @param {Function} handlers.onDecline - Called when Decline button is pressed
 */
export async function registerNotifeeActionReceiver(handlers = {}) {
  // Direct Supabase background update helper
  const handleBackgroundTripAccept = async (tripId, data) => {
    try {
      if (supabase && tripId) {
        await supabase
          .from('trips')
          .update({
            status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', tripId);
        console.info(`[BackgroundHandler] Trip ${tripId} accepted in Supabase`);
      }
    } catch (e) {
      console.warn('[BackgroundHandler] Accept error:', e);
    }
  };

  const handleBackgroundTripDecline = async (tripId, data) => {
    try {
      if (supabase && tripId) {
        await supabase
          .from('trips')
          .update({
            status: 'declined',
            updated_at: new Date().toISOString()
          })
          .eq('id', tripId);
        console.info(`[BackgroundHandler] Trip ${tripId} declined in Supabase`);
      }
    } catch (e) {
      console.warn('[BackgroundHandler] Decline error:', e);
    }
  };

  // 1. Notifee Receiver
  try {
    const notifee = (await import('@notifee/react-native')).default;
    const { EventType } = await import('@notifee/react-native');

    // Background Event Receiver (App backgrounded or closed)
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      const tripId = notification?.data?.tripId || notification?.id;

      if (type === EventType.ACTION_PRESS) {
        if (pressAction.id === NOTIFICATION_ACTIONS.ACCEPT) {
          console.info(`✅ [Notifee Background] Driver ACCEPTED trip: ${tripId}`);
          if (tripId) await notifee.cancelNotification(notification.id);
          await handleBackgroundTripAccept(tripId, notification?.data);
          if (handlers.onAccept) await handlers.onAccept(notification.data);
        } else if (pressAction.id === NOTIFICATION_ACTIONS.DECLINE) {
          console.info(`❌ [Notifee Background] Driver DECLINED trip: ${tripId}`);
          if (tripId) await notifee.cancelNotification(notification.id);
          await handleBackgroundTripDecline(tripId, notification?.data);
          if (handlers.onDecline) await handlers.onDecline(notification.data);
        }
      }
    });

    // Foreground Event Receiver (App currently open)
    notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      const tripId = notification?.data?.tripId || notification?.id;

      if (type === EventType.ACTION_PRESS) {
        if (pressAction.id === NOTIFICATION_ACTIONS.ACCEPT) {
          console.info(`✅ [Notifee Foreground] Driver ACCEPTED trip: ${tripId}`);
          if (tripId) await notifee.cancelNotification(notification.id);
          await handleBackgroundTripAccept(tripId, notification?.data);
          if (handlers.onAccept) handlers.onAccept(notification.data);
        } else if (pressAction.id === NOTIFICATION_ACTIONS.DECLINE) {
          console.info(`❌ [Notifee Foreground] Driver DECLINED trip: ${tripId}`);
          if (tripId) await notifee.cancelNotification(notification.id);
          await handleBackgroundTripDecline(tripId, notification?.data);
          if (handlers.onDecline) handlers.onDecline(notification.data);
        }
      }
    });

    console.info('[NotificationEngine] Notifee Action Receiver registered');
  } catch (_) {}

  // 2. Expo Notifications Response Listener
  try {
    const Notifications = await import('expo-notifications');
    if (Notifications && typeof Notifications.addNotificationResponseReceivedListener === 'function') {
      Notifications.addNotificationResponseReceivedListener(async (response) => {
        const actionId = response?.actionIdentifier;
        const tripData = response?.notification?.request?.content?.data;
        const tripId = tripData?.tripId || response?.notification?.request?.identifier;

        if (actionId === NOTIFICATION_ACTIONS.ACCEPT) {
          console.info(`✅ [Expo Response] Driver ACCEPTED trip: ${tripId}`);
          await handleBackgroundTripAccept(tripId, tripData);
          if (handlers.onAccept) handlers.onAccept(tripData);
        } else if (actionId === NOTIFICATION_ACTIONS.DECLINE) {
          console.info(`❌ [Expo Response] Driver DECLINED trip: ${tripId}`);
          await handleBackgroundTripDecline(tripId, tripData);
          if (handlers.onDecline) handlers.onDecline(tripData);
        }
      });
      console.info('[NotificationEngine] Expo Response Listener registered');
    }
  } catch (_) {}
}

/**
 * 4. Android Firebase setBackgroundMessageHandler
 * Executed in a standalone Headless JS context when remote FCM message arrives in background
 */
export function registerFirebaseBackgroundHandler(messagingInstance) {
  if (!messagingInstance) return;

  try {
    messagingInstance().setBackgroundMessageHandler(async (remoteMessage) => {
      console.info('🔔 [FCM Background Task] Remote Trip Request received:', remoteMessage);

      const data = remoteMessage?.data || {};

      if (data.type === 'TRIP_REQUEST' || data.type === 'TRIP_REQUESTED' || remoteMessage.notification?.title?.includes('Trip')) {
        await displayCustomTripNotification({
          tripId: data.tripId || data.id,
          fare: data.fare || data.driverPayout || 600,
          advance: data.advance || Math.round(Number(data.fare || 600) * 0.3),
          pickup: data.pickup || data.from || 'Customer Pickup',
          drop: data.drop || data.drop_loc || data.destination || 'Destination',
          distance: data.distance || data.distanceText || '12.4 km',
          duration: data.duration || data.durationText || '28 mins',
          customerName: data.customerName || data.name || 'Customer'
        });
      }

      return Promise.resolve();
    });

    console.info('[NotificationEngine] Firebase setBackgroundMessageHandler registered');
  } catch (err) {
    console.warn('[NotificationEngine] Firebase background handler registration error:', err);
  }
}

/**
 * 5. Universal Root Background Registration
 * Must be called in index.js at the top-level entry point before registerRootComponent
 */
export function registerUniversalBackgroundHandler() {
  try {
    // 1. Notifee headless background handler
    registerNotifeeActionReceiver();
  } catch (_) {}

  try {
    // 2. React Native Firebase Messaging handler if available
    import('@react-native-firebase/messaging').then((messagingModule) => {
      const messaging = messagingModule?.default;
      if (messaging) {
        registerFirebaseBackgroundHandler(messaging);
      }
    }).catch(() => {});
  } catch (_) {}
}

/**
 * 6. iOS APNs Payload with 'content-available: 1' and 'TRIP_DISPATCH_CATEGORY'
 */
export function getBackendAPNsPayload({
  token,
  tripId,
  fare,
  pickup,
  drop,
  distance,
  duration
}) {
  return {
    token,
    notification: {
      title: `New Trip Request: ₹${fare}`,
      body: `Pickup: ${pickup} ➔ ${drop}`
    },
    data: {
      tripId: String(tripId),
      fare: String(fare),
      pickup: String(pickup),
      drop: String(drop),
      distance: String(distance || '12.4 km'),
      duration: String(duration || '28 mins'),
      type: 'TRIP_REQUEST'
    },
    apns: {
      headers: {
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-topic': 'app.ridingo.driver'
      },
      payload: {
        aps: {
          alert: {
            title: `New Trip Request: ₹${fare}`,
            subtitle: `${pickup} ➔ ${drop}`,
            body: `Total: ₹${fare} · ${distance} · ${duration}`
          },
          category: NOTIFICATION_CATEGORIES.TRIP_DISPATCH,
          sound: 'default',
          badge: 1,
          'content-available': 1, // Wakes driver app in background
          'mutable-content': 1
        }
      }
    },
    android: {
      priority: 'high',
      notification: {
        channelId: NOTIFICATION_CHANNELS.TRIP_DISPATCH,
        priority: 'max',
        defaultSound: true,
        defaultVibrateTimings: true
      }
    }
  };
}
