/**
 * NativeAuthService.js
 * 
 * Production-ready authentication service for React Native combining:
 * 1. Google Sign-In via '@react-native-google-signin/google-signin'
 * 2. Apple Authentication via '@invertase/react-native-apple-authentication'
 * 3. Optional Supabase OAuth Token Exchange
 */

import { Platform } from 'react-native';
import { performGoogleSignIn } from '../../services/googleAuthUnified';

// Optional Supabase client import if configured in project
let supabase = null;
try {
  const sbModule = require('../../lib/supabase');
  supabase = sbModule.supabase;
} catch (e) {
  // Supabase optional
}

// 1. Google Sign-In Module
let GoogleSignin = null;
let statusCodes = {};
try {
  const gModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = gModule.GoogleSignin;
  statusCodes = gModule.statusCodes || {};
} catch (e) {
  console.warn('@react-native-google-signin/google-signin is not linked yet');
}

// 2. Apple Authentication Module
let appleAuth = null;
let AppleButton = null;
try {
  const aModule = require('@invertase/react-native-apple-authentication');
  appleAuth = aModule.appleAuth;
  AppleButton = aModule.AppleButton;
} catch (e) {
  console.warn('@invertase/react-native-apple-authentication is not linked yet');
}

export const GOOGLE_CLIENT_IDS = {
  webClientId: '496710932146-0dc47l9jkgb584na7uu8ajh6bjtg98vu.apps.googleusercontent.com',
  iosClientId: '496710932146-dff905ju49pr9j04ph4ii6u5c9moktge.apps.googleusercontent.com',
  androidClientId: '496710932146-4k4qgcv7h252esqc164r6n8ncdqf9h4t.apps.googleusercontent.com'
};

/**
 * Configure Google Sign-In options
 * Call this in your App.js or root component mount
 */
export function configureGoogleSignIn({
  webClientId = GOOGLE_CLIENT_IDS.webClientId,
  iosClientId = GOOGLE_CLIENT_IDS.iosClientId,
  offlineAccess = true,
  scopes = ['profile', 'email']
} = {}) {
  if (GoogleSignin) {
    try {
      GoogleSignin.configure({
        webClientId,
        iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
        offlineAccess,
        scopes,
        forceCodeForRefreshToken: true
      });
      console.log('[NativeAuth] Google Sign-In initialized successfully');
    } catch (err) {
      console.error('Google Sign-In configuration error:', err);
    }
  }
}

/**
 * Trigger Real Native Google Account Selection Dialog
 * Pops up the official Google Account Selector sheet on device
 */
export async function signInWithGoogle() {
  if (!GoogleSignin) {
    return await performGoogleSignIn();
  }

  try {
    // 1. Check Google Play Services availability on Android
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // 2. Sign out any lingering session to force fresh account selection dialog
    try {
      await GoogleSignin.signOut();
    } catch (_) {}

    // 3. Trigger native account selection modal
    const signInResult = await GoogleSignin.signIn();

    // Support both modern (v11+) and legacy result structures
    const userObj = signInResult.data ? signInResult.data.user : (signInResult.user || signInResult);
    const tokens = signInResult.data ? signInResult.data : await GoogleSignin.getTokens();
    const idToken = tokens.idToken || signInResult.idToken;

    const userPayload = {
      provider: 'google',
      id: userObj.id,
      email: userObj.email,
      name: userObj.name || `${userObj.givenName || ''} ${userObj.familyName || ''}`.trim(),
      givenName: userObj.givenName,
      familyName: userObj.familyName,
      photo: userObj.photo,
      idToken: idToken,
      serverAuthCode: signInResult.serverAuthCode
    };

    // 4. Optionally exchange with Supabase
    if (supabase && idToken) {
      try {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken
        });
        if (!sbError && sbData?.session) {
          userPayload.supabaseSession = sbData.session;
          userPayload.supabaseUser = sbData.user;
        }
      } catch (sbErr) {
        console.warn('Supabase token exchange warning:', sbErr);
      }
    }

    return userPayload;
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      const cancelErr = new Error('Google Sign-In cancelled by user');
      cancelErr.isCancelled = true;
      throw cancelErr;
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google Sign-In already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services not available or outdated on this device');
    }
    throw error;
  }
}

/**
 * Sign out from Google account
 */
export async function signOutGoogle() {
  if (GoogleSignin) {
    try {
      await GoogleSignin.signOut();
      console.log('Google Sign-In signed out successfully');
      return true;
    } catch (err) {
      console.warn('Google Sign-Out error:', err);
      throw err;
    }
  }
  return false;
}

/**
 * Trigger Real Native Apple Authentication Sheet
 * Uses official Apple ID modal on iOS 13+ devices
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only supported on iOS devices.');
  }

  if (!appleAuth) {
    throw new Error('Apple Authentication library is not installed. Run: npm install @invertase/react-native-apple-authentication');
  }

  if (!appleAuth.isSupported) {
    throw new Error('Sign in with Apple is not supported on this version of iOS.');
  }

  try {
    // 1. Perform native Apple ID login request
    const appleAuthResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME]
    });

    // 2. Query credential state to verify valid token
    const credentialState = await appleAuth.getCredentialStateForUser(appleAuthResponse.user);
    if (credentialState !== appleAuth.State.AUTHORIZED) {
      throw new Error('Apple Sign-In authorization failed or was revoked.');
    }

    const { identityToken, authorizationCode, fullName, email, user: appleUserId } = appleAuthResponse;

    let formattedName = 'Apple User';
    if (fullName) {
      const parts = [fullName.givenName, fullName.middleName, fullName.familyName].filter(Boolean);
      if (parts.length > 0) formattedName = parts.join(' ');
    }

    const userPayload = {
      provider: 'apple',
      id: appleUserId,
      email: email || null,
      name: formattedName,
      givenName: fullName?.givenName || null,
      familyName: fullName?.familyName || null,
      identityToken,
      authorizationCode
    };

    // 3. Optionally exchange with Supabase
    if (supabase && identityToken) {
      try {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: identityToken
        });
        if (!sbError && sbData?.session) {
          userPayload.supabaseSession = sbData.session;
          userPayload.supabaseUser = sbData.user;
        }
      } catch (sbErr) {
        console.warn('Supabase Apple token exchange warning:', sbErr);
      }
    }

    return userPayload;
  } catch (error) {
    if (error.code === appleAuth.Error.CANCELED) {
      const cancelErr = new Error('Apple Sign-In cancelled by user');
      cancelErr.isCancelled = true;
      throw cancelErr;
    }
    throw error;
  }
}

/**
 * Register Apple credential revocation listener
 * Apple requires apps to handle credential revocation
 */
export function setupAppleRevocationListener(onRevoked) {
  if (Platform.OS === 'ios' && appleAuth) {
    return appleAuth.onCredentialRevoked(async () => {
      console.warn('Apple credentials revoked for current user');
      if (typeof onRevoked === 'function') {
        onRevoked();
      }
    });
  }
  return () => {};
}

/**
 * ============================================================================
 * PERSISTENT SESSION STORAGE & AUTO-LOGIN RESTORATION (Prevents Guest/Demo Reset)
 * ============================================================================
 */

let AsyncStorage = null;
try {
  const asModule = require('@react-native-async-storage/async-storage');
  AsyncStorage = asModule.default || asModule;
} catch (e) {
  // Fallback to localStorage or in-memory
}

const STORAGE_KEY = 'ridingo_user_session';

/**
 * Persist user profile to local device storage
 */
export async function saveUserSession(userData) {
  if (!userData) return;
  const payload = {
    ...userData,
    isAuthenticated: true,
    isGuest: false,
    isDemo: false,
    lastActive: Date.now()
  };
  const serialized = JSON.stringify(payload);

  if (AsyncStorage) {
    try { await AsyncStorage.setItem(STORAGE_KEY, serialized); } catch (e) {}
  }
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch (e) {}
  }
  return payload;
}

/**
 * Retrieve saved user session from persistent storage
 */
export async function getSavedUserSession() {
  let saved = null;
  if (AsyncStorage) {
    try { saved = await AsyncStorage.getItem(STORAGE_KEY); } catch (e) {}
  }
  if (!saved && typeof localStorage !== 'undefined') {
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  }
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved);
    return parsed.isAuthenticated ? parsed : null;
  } catch (e) {
    return null;
  }
}

/**
 * Clear user session upon explicit sign out
 */
export async function clearUserSession() {
  if (AsyncStorage) {
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }
  if (GoogleSignin) {
    try { await GoogleSignin.signOut(); } catch (e) {}
  }
}

/**
 * Restore persistent Google session silently on app launch
 * Checks both local storage and GoogleSignin.signInSilently()
 */
export async function restoreGoogleSessionSilently() {
  // 1. Check local device storage first for instant UI hydration
  const localSession = await getSavedUserSession();

  // 2. If Google library is linked, verify silently with Google
  if (GoogleSignin) {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        const signInResult = await GoogleSignin.signInSilently();
        const userObj = signInResult.data ? signInResult.data.user : (signInResult.user || signInResult);
        const tokens = signInResult.data ? signInResult.data : await GoogleSignin.getTokens();

        const verifiedUser = {
          provider: 'google',
          id: userObj.id,
          email: userObj.email,
          name: userObj.name || `${userObj.givenName || ''} ${userObj.familyName || ''}`.trim(),
          givenName: userObj.givenName,
          familyName: userObj.familyName,
          photo: userObj.photo,
          idToken: tokens.idToken || signInResult.idToken,
          isAuthenticated: true,
          isGuest: false,
          isDemo: false
        };

        // Cache refreshed profile
        await saveUserSession(verifiedUser);
        return verifiedUser;
      }
    } catch (silentErr) {
      console.log('Silent Google sign-in check:', silentErr.message);
    }
  }

  // Return locally cached session if still authenticated
  return localSession;
}

export { GoogleSignin, statusCodes, appleAuth, AppleButton };
