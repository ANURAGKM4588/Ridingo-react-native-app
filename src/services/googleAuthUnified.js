/**
 * googleAuthUnified.js
 * 
 * Production-ready, Universal Google Authentication Service:
 * - Native iOS & Android: Official Google Sign-In via @codetrix-studio/capacitor-google-auth
 * - Web Browsers: Official Google Identity Services (GIS) OAuth 2.0 Account Chooser Popup
 * - Web Fallback: Firebase Auth GoogleAuthProvider signInWithPopup
 * - Zero mock popups, zero hardcoded accounts
 */
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { auth as firebaseAuth } from '../lib/firebase.js';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

export const GOOGLE_CONFIG = {
  webClientId: env.VITE_GOOGLE_SERVER_CLIENT_ID || '496710932146-0dc47l9jkgb584na7uu8ajh6bjtg98vu.apps.googleusercontent.com',
  iosClientId: env.VITE_GOOGLE_IOS_CLIENT_ID || '496710932146-dff905ju49pr9j04ph4ii6u5c9moktge.apps.googleusercontent.com',
  androidClientId: env.VITE_GOOGLE_ANDROID_CLIENT_ID || '496710932146-0dc47l9jkgb584na7uu8ajh6bjtg98vu.apps.googleusercontent.com'
};

let nativeInitialized = false;

export async function initNativeGoogleAuth() {
  if (nativeInitialized) return;
  try {
    const isIos = typeof window !== 'undefined' && (
      window.Capacitor?.getPlatform?.() === 'ios' ||
      /iPad|iPhone|iPod/.test(navigator?.userAgent)
    );

    const activeClientId = isIos ? GOOGLE_CONFIG.iosClientId : GOOGLE_CONFIG.webClientId;

    await GoogleAuth.initialize({
      clientId: activeClientId,
      serverClientId: GOOGLE_CONFIG.webClientId,
      androidClientId: GOOGLE_CONFIG.androidClientId,
      scopes: ['profile', 'email'],
      grantOfflineAccess: true
    });
    nativeInitialized = true;
    console.log('[GoogleAuth] Native initialized with clientId:', activeClientId);
  } catch (err) {
    console.warn('[GoogleAuth] Native initialize warning:', err);
  }
}

// Pre-init native if on Capacitor
if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
  initNativeGoogleAuth();
}

/**
 * 1. Native iOS / Android Google Sign-In
 */
export async function performNativeGoogleSignIn() {
  try {
    await initNativeGoogleAuth();
  } catch (_) {}

  try {
    const user = await GoogleAuth.signIn();
    if (!user) {
      throw new Error('Google sign-in was cancelled or returned empty');
    }

    const fullName = user.name || `${user.givenName || ''} ${user.familyName || ''}`.trim() || 'Google User';
    const fName = user.givenName || fullName.split(' ')[0] || 'User';
    const lName = user.familyName || fullName.split(' ').slice(1).join(' ') || '';

    return {
      success: true,
      email: user.email,
      name: fullName,
      firstName: fName,
      lastName: lName,
      avatar: user.imageUrl || null,
      id: user.id || `goog_${Date.now()}`,
      googleId: user.id || null,
      idToken: user.authentication?.idToken,
      accessToken: user.authentication?.accessToken,
      provider: 'google',
      authMethod: 'google'
    };
  } catch (err) {
    const errMsg = (err?.message || String(err)).toLowerCase();
    if (errMsg.includes('cancel') || errMsg.includes('12501')) {
      const cancelErr = new Error('Google sign-in was cancelled');
      cancelErr.isCancelled = true;
      throw cancelErr;
    }
    throw err;
  }
}

/**
 * 2. Web Google Identity Services (GIS) OAuth 2.0 Token Client
 * Opens Google's official accounts.google.com account selector popup
 */
function signInWithGoogleIdentityServices(clientId) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      return reject(new Error('Google Identity Services SDK is not loaded.'));
    }

    let settled = false;

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        prompt: 'select_account',
        callback: async (tokenResponse) => {
          if (settled) return;
          if (tokenResponse.error) {
            settled = true;
            if (tokenResponse.error === 'popup_closed_by_user' || tokenResponse.error === 'access_denied') {
              const cancelErr = new Error('Google sign-in was cancelled by user');
              cancelErr.isCancelled = true;
              return reject(cancelErr);
            }
            return reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }

          try {
            // Fetch authentic user profile from Google's OAuth2 userinfo endpoint
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });

            if (!res.ok) {
              throw new Error(`Failed to fetch Google profile (status ${res.status})`);
            }

            const info = await res.json();
            settled = true;

            const fullName = info.name || `${info.given_name || ''} ${info.family_name || ''}`.trim() || 'Google User';
            const firstName = info.given_name || fullName.split(' ')[0] || 'User';
            const lastName = info.family_name || fullName.split(' ').slice(1).join(' ') || '';

            resolve({
              success: true,
              id: info.sub ? `goog_${info.sub}` : `goog_${Date.now()}`,
              googleId: info.sub,
              email: info.email,
              name: fullName,
              firstName,
              lastName,
              avatar: info.picture || null,
              accessToken: tokenResponse.access_token,
              verified: info.email_verified,
              provider: 'google',
              authMethod: 'google'
            });
          } catch (fetchErr) {
            settled = true;
            reject(fetchErr);
          }
        },
        error_callback: (err) => {
          if (settled) return;
          settled = true;
          const msg = err?.message || err?.type || 'Google popup error';
          if (msg.includes('popup_closed') || msg.includes('user_cancel')) {
            const cErr = new Error('Google sign-in was cancelled by user');
            cErr.isCancelled = true;
            return reject(cErr);
          }
          reject(new Error(msg));
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
}

/**
 * 3. Firebase Auth Google Sign-In Popup Fallback
 */
async function signInWithFirebaseGoogle() {
  if (!firebaseAuth) {
    throw new Error('Firebase Auth is not initialized');
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(firebaseAuth, provider);
  const u = result.user;
  const fullName = u.displayName || 'Google User';
  const firstName = fullName.split(' ')[0] || 'User';
  const lastName = fullName.split(' ').slice(1).join(' ') || '';

  return {
    success: true,
    id: u.uid ? `goog_${u.uid}` : `goog_${Date.now()}`,
    googleId: u.uid,
    email: u.email,
    name: fullName,
    firstName,
    lastName,
    avatar: u.photoURL || null,
    accessToken: await u.getIdToken(),
    verified: u.emailVerified,
    provider: 'google',
    authMethod: 'google'
  };
}

/**
 * 4. Master Universal Google Sign-In Function
 * Detects Native vs Web and handles official Google OAuth flow
 */
export async function performGoogleSignIn() {
  const isNative = typeof window !== 'undefined' && Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.Capacitor?.getPlatform?.() === 'ios' ||
    window.Capacitor?.getPlatform?.() === 'android'
  );

  // Native iOS / Android
  if (isNative) {
    return await performNativeGoogleSignIn();
  }

  // Web Browser: Try Official Google Identity Services first
  const clientId = GOOGLE_CONFIG.webClientId;
  
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2 && clientId) {
    try {
      return await signInWithGoogleIdentityServices(clientId);
    } catch (gisErr) {
      if (gisErr?.isCancelled) {
        throw gisErr;
      }
      console.warn('[GoogleAuth] GIS popup failed, attempting Firebase Google Auth:', gisErr.message);
    }
  }

  // Secondary Web Strategy: Firebase Auth Google Popup
  try {
    return await signInWithFirebaseGoogle();
  } catch (fbErr) {
    const msg = (fbErr?.message || String(fbErr)).toLowerCase();
    if (msg.includes('popup-closed') || msg.includes('cancelled') || msg.includes('user-cancelled')) {
      const cErr = new Error('Google sign-in was cancelled');
      cErr.isCancelled = true;
      throw cErr;
    }
    if (msg.includes('popup-blocked')) {
      throw new Error('Browser popup blocked. Please allow popups for localhost to sign in with Google.');
    }
    throw fbErr;
  }
}

/**
 * Sign out Google session (Native & Firebase)
 */
export async function signOutGoogle() {
  try {
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      await GoogleAuth.signOut();
    }
  } catch (_) {}

  try {
    if (firebaseAuth && firebaseAuth.currentUser) {
      await firebaseAuth.signOut();
    }
  } catch (_) {}

  return true;
}

