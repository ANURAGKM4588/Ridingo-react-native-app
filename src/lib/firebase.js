/**
 * Firebase Configuration for Phone Auth SMS OTP
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSy_DEV_CLIENT_KEY_FALLBACK',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'ridingo-prod.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'ridingo-prod',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'ridingo-prod.appspot.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456'
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
