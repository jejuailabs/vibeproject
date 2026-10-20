import { getApps, initializeApp } from 'firebase/app';
import { browserPopupRedirectResolver, browserSessionPersistence, getAuth, initializeAuth, type Auth } from 'firebase/auth';
export const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
let auth: Auth | null = null;
// A refresh keeps the tab's login; arriving at the site any other way (typed address, link, reopened tab) starts signed out.
function forgetStoredLogins() {
 try {
  const reload = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';
  const stores = reload ? [localStorage] : [localStorage, sessionStorage];
  for (const store of stores) for (const key of Object.keys(store)) if (key.startsWith('firebase:authUser:')) store.removeItem(key);
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
