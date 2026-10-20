import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function firebaseApp() {
 if (getApps().length) return getApps()[0];
 const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 return initializeApp({ credential: json ? cert(JSON.parse(json)) : applicationDefault(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}
export function db() { return getFirestore(firebaseApp()); }
export async function authenticatedUid(request: Request) {
 const header = request.headers.get('authorization');
 if (!header?.startsWith('Bearer ')) return null;
 try {
  const token = await getAuth(firebaseApp()).verifyIdToken(header.slice(7), true);
  // Google and email/password accounts; invites and roles match by email, so the address must be verified either way.
  return ['google.com', 'password'].includes(token.firebase.sign_in_provider) && token.email_verified && token.email ? { uid: token.uid, email: token.email.toLowerCase(), name: token.name || token.email.split('@')[0], avatar: token.picture || '' } : null;
 } catch { return null; }
}
