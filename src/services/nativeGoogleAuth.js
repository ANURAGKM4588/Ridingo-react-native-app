/**
 * nativeGoogleAuth.js
 * 
 * Backward-compatible bridge to googleAuthUnified.js
 * Provides unified Google Authentication across Native (iOS/Android) and Web (Browsers)
 */
export {
  GOOGLE_CONFIG,
  initNativeGoogleAuth,
  initNativeGoogleAuth as initGoogleAuth,
  performNativeGoogleSignIn,
  performGoogleSignIn,
  signOutGoogle,
  signOutGoogle as signOutNativeGoogle
} from './googleAuthUnified.js';
