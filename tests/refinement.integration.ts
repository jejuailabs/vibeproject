import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/firebase';
import {runCommand,getWorkspace} from '../src/server/workspace';
import {previewWorkspace} from '../src/lib/preview';
import {emptyRefinement} from '../src/lib/refinement';
async function main(){
 const cohortId='test-refinement-'+randomUUID(),c=db().collection('cohorts').doc(cohortId),sample=previewWorkspace();
 try{
  await c.set({name:'Isolated refinement test',week:1,testFixture:true});
  await c.collection('activities').doc('discovery').set(sample.activity);
  for(const member of sample.members.slice(0,3))for(const table of ['members','profiles'])await c.collection(table).doc(member.id).set(member);
  const created=await runCommand(cohortId,'min',randomUUID(),{type:'createIdea',title:'통합 검증 생각',body:'처음 참석한 모임에서 혼자 기다림',kind:'thought',scope:'owner'});
  const id=created.id,input=emptyRefinement();input.answers.who='처음 참석한 사람';
  const partial={type:'refineIdea' as const,id,revision:1,phase:'questions' as const,input,reason:'경험 저장',scope:'owner' as const},requestId=randomUUID();
  await runCommand(cohortId,'min',requestId,partial);await runCommand(cohortId,'min',requestId,partial);
  assert.equal((await c.collection('ideas').doc(id).get()).data()?.revision,2);
  assert.equal((await getWorkspace(cohortId,'seo')).ideas.some(i=>i.id===id),false);
  await assert.rejects(runCommand(cohortId,'seo',randomUUID(),{...partial,revision:2}),/접근/);
  const ready=structuredClone(sample.ideas[0].refinement!);
  await runCommand(cohortId,'min',randomUUID(),{...partial,revision:2,phase:'definition',input:ready,scope:'cohort',reason:'문제정의 초안'});
  ready.definition.focus='모임 시작 전 5분';
  await runCommand(cohortId,'min',randomUUID(),{...partial,revision:3,phase:'definition',input:ready,scope:'cohort',reason:'동료 의견으로 수정'});
  await assert.rejects(runCommand(cohortId,'min',randomUUID(),partial),/다른 변경/);
  const loaded=await getWorkspace(cohortId,'min'),idea=loaded.ideas.find(i=>i.id===id)!;
  assert.equal(idea.refinement?.draft,2);assert.equal(idea.refinement?.ready,true);
  assert.equal(loaded.events.filter(e=>e.ideaId===id).length,4);
  assert.equal(loaded.events.find(e=>e.ideaId===id&&e.revision===3)?.snapshot.refinement?.definition.focus,'한 모임의 시작 전 10분');
  assert.equal((await getWorkspace(cohortId,'seo')).ideas.find(i=>i.id===id)?.refinement?.draft,2);
  await assert.rejects(runCommand(cohortId,'seo',randomUUID(),{...partial,revision:4,scope:'cohort'}),/작성자/);
  await runCommand(cohortId,'seo',randomUUID(),{type:'comment',ideaId:id,body:'초안 1의 범위를 더 좁히면 어떨까요?',context:{stage:'definition',revision:3}});
  await assert.rejects(runCommand(cohortId,'seo',randomUUID(),{type:'comment',ideaId:id,body:'test',context:{stage:'definition',revision:2}}),/단계/);
  await assert.rejects(runCommand(cohortId,'seo',randomUUID(),{type:'comment',ideaId:id,body:'test',context:{stage:'definition',revision:999}}),/버전/);
  const feedback=(await getWorkspace(cohortId,'min')).comments.find(c=>c.ideaId===id);
  assert.deepEqual(feedback?.context,{stage:'definition',revision:3});
  await c.collection('workshop').doc('settings').set({data:{state:'completed'}});
  await assert.rejects(runCommand(cohortId,'min',randomUUID(),{...partial,revision:4}),/읽기 전용/);
  console.log('PASS: Firestore save/read, partial answers, two drafts, snapshots, idempotency, privacy, version-specific feedback, author/revision and completion guards');
 }finally{if(!cohortId.startsWith('test-refinement-'))throw new Error('Invalid test scope');await db().recursiveDelete(c);console.log('Isolated test cohort removed.');}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
