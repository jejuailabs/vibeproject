import { getApps, initializeApp } from 'firebase/app';
import { browserPopupRedirectResolver, getAuth, inMemoryPersistence, initializeAuth, type Auth } from 'firebase/auth';
export const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
let auth: Auth | null = null;
function forgetStoredLogins() {
 try {
  for (const store of [localStorage, sessionStorage]) for (const key of Object.keys(store)) if (key.startsWith('firebase:authUser:')) store.removeItem(key);
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
 // Sign-in lives only in memory: every visit, refresh or reopened tab starts at the login screen.
 // Logins stored by earlier versions (localStorage, sessionStorage, IndexedDB) are wiped so they can never sign anyone in.
 forgetStoredLogins();
 auth = existing ? getAuth(app) : initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
 return auth;
}
