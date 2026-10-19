import { getApps, initializeApp } from 'firebase/app';
import { browserPopupRedirectResolver, browserSessionPersistence, getAuth, initializeAuth, type Auth } from 'firebase/auth';
export const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
let auth: Auth | null = null;
export function clientAuth() {
 if (!firebaseConfigured) throw new Error('Firebase 웹 설정이 필요합니다.');
 if (auth) return auth;
 const existing = getApps()[0];
 const app = existing ?? initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
 });
 // Sign-in lasts only for this browser tab session; a stored login from an earlier visit never signs anyone in automatically.
 auth = existing ? getAuth(app) : initializeAuth(app, { persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver });
 return auth;
}
