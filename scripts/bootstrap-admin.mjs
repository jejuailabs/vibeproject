import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if(!email || !email.includes('@') || email.includes(' '))throw new Error('Set BOOTSTRAP_ADMIN_EMAIL explicitly.');
const app=getApps()[0]||initializeApp({credential:applicationDefault(),projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID});
const db=getFirestore(app), cohortId=process.env.NEXT_PUBLIC_COHORT_ID||'vibe-2026-01';
const c=db.collection('cohorts').doc(cohortId), hash=createHash('sha256').update(email).digest('hex');
await db.runTransaction(async tx=>{
 const inviteRef=c.collection('invites').doc(hash);
 const [cohort,invite,activity]=await Promise.all([tx.get(c),tx.get(inviteRef),tx.get(c.collection('activities').doc('discovery'))]);
 if(!cohort.exists)tx.create(c,{name:'바이브코딩 1기',week:1,status:'running',timezone:'Asia/Seoul',createdAt:new Date().toISOString()});
 if(!activity.exists)tx.create(c.collection('activities').doc('discovery'),{title:'작은 불편에서, 새로운 가능성으로',question:'일상에서 바꾸고 싶은 순간이 있나요?',description:'정답은 없어요. 직접 겪은 불편한 순간 하나를 동료들과 나눠보세요.',state:'open',week:1});
 if(!invite.exists)tx.create(inviteRef,{email,role:'admin',status:'pending',expiresAt:new Date(Date.now()+30*86400000).toISOString(),createdAt:new Date().toISOString()});
 else if(invite.data().role!=='admin')throw new Error('Existing invite has a different role; no changes made.');
});
console.log('Initial cohort and explicit administrator invitation are ready.');
