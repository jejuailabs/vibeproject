import { getApps, initializeApp } from 'firebase/app';
import { browserPopupRedirectResolver, browserSessionPersistence, getAuth, initializeAuth, type Auth } from 'firebase/auth';
export const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
let auth: Auth | null = null;
// The login lives only in this tab's sessionStorage, so any reload of the tab keeps it and a new or reopened tab starts
// signed out. It is never wiped on load: telling a refresh apart by navigation type failed for refreshes Chrome reports as
// "navigate" (Enter in the address bar, some reload buttons), which sent people back to the login screen.
function forgetStoredLogins() {
 try {
  for (const key of Object.keys(localStorage)) if (key.startsWith('firebase:authUser:')) localStorage.removeItem(key);
  // Logins kept by earlier versions in IndexedDB are wiped so they can never sign anyone in.
  indexedDB.deleteDatabase('firebaseLocalStorageDb');
 } catch {}
}
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
 forgetStoredLogins();
 auth = existing ? getAuth(app) : initializeAuth(app, { persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver });
 return auth;
}
