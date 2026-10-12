import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {db} from '../src/server/firebase';
import {enroll} from '../src/server/workspace';
async function main(){
 const cohortId='test-enrollment-'+randomUUID(), c=db().collection('cohorts').doc(cohortId);
 const identity=(uid:string)=>({uid,email:uid+'@example.com',name:'Test participant',avatar:''});
 try {
  await c.set({testFixture:true,status:'running',name:'Enrollment integration'});
  const newcomer=identity('new');
  await Promise.all([enroll(cohortId,newcomer),enroll(cohortId,newcomer)]);
  assert.equal((await c.collection('members').get()).size,1);
  assert.equal((await c.collection('profiles').get()).size,1);
  assert.equal((await c.collection('members').doc('new').get()).data()?.role,'participant');
  assert.equal((await c.collection('invites').get()).size,0);
  await c.collection('members').doc('new').update({role:'facilitator',avatar:'maker-test'});
  await enroll(cohortId,newcomer);
  assert.equal((await c.collection('members').doc('new').get()).data()?.role,'facilitator');
  assert.equal((await c.collection('members').doc('new').get()).data()?.avatar,'maker-test');
  await c.collection('members').doc('new').update({active:false});
  await assert.rejects(enroll(cohortId,newcomer),/중지/);
  const admin=identity('initial-admin'),key=createHash('sha256').update(admin.email).digest('hex');
  await c.collection('invites').doc(key).set({email:admin.email,role:'admin',status:'pending',expiresAt:'2099-01-01T00:00:00.000Z'});
  await enroll(cohortId,admin);
  assert.equal((await c.collection('members').doc(admin.uid).get()).data()?.role,'admin');
  assert.equal((await c.collection('invites').doc(key).get()).data()?.status,'accepted');
  await c.collection('workshop').doc('settings').set({data:{state:'completed'}});
  await assert.rejects(enroll(cohortId,identity('late')),/종료/);
  await enroll(cohortId,admin);
  assert.equal((await c.collection('members').doc('late').get()).exists,false);
  console.log('PASS: automatic enrollment, concurrent replay, preserved roles/avatar, suspended account, initial administrator, completed cohort');
 } finally {
  // Only the uniquely named fixture created above is removed.
  await db().recursiveDelete(c);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
