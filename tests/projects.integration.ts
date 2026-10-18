import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/firebase';
import {runWorkshop} from '../src/server/workshop';
import {runCommand} from '../src/server/workspace';
import {previewWorkspace} from '../src/lib/preview';

// Exercises the project lobby, step rail, step tags and exhibition commands against real Firestore in an isolated cohort.
async function main(){
 const cohortId='test-projects-'+randomUUID(),c=db().collection('cohorts').doc(cohortId),sample=previewWorkspace();
 const cmd=(uid:string,command:unknown,requestId=randomUUID())=>runWorkshop(cohortId,uid,requestId,command) as Promise<{id:string;denied?:boolean;message?:string}>;
 const data=async(path:string)=>(await c.collection(path.split('/')[0]).doc(path.split('/').slice(1).join('/')).get()).data();
 try{
  await c.set({name:'Isolated project test',week:1,testFixture:true});
  await c.collection('activities').doc('discovery').set({...sample.activity,state:'closed'});
  for(const m of sample.members)for(const table of ['members','profiles'])await c.collection(table).doc(m.id).set(m);
  for(const i of sample.ideas)await c.collection('ideas').doc(i.id).set(i);
  for(const p of sample.projects)for(const table of ['projects','projectDirectory'])await c.collection(table).doc(p.id).set(p);

  // Lobby: password project, failed attempts committed, secrets never in the directory.
  const lobby=await cmd('min',{type:'openProject',name:'통합 검증 프로젝트',intro:'처음 온 사람',capacity:4,joinPolicy:'password',password:'abcd1234'});
  const dir=await data('projectDirectory/'+lobby.id),secret=await data('projectSecrets/'+lobby.id);
  assert.equal(dir?.leaderId,'min');assert.equal(dir?.joinPolicy,'password');
  assert.doesNotMatch(JSON.stringify(dir),/hash|salt|abcd1234/);
  assert.match(secret?.hash,/^[a-f0-9]{64}$/);assert.notEqual(secret?.hash,'abcd1234');
  const wrong=await cmd('jun',{type:'enterProject',projectId:lobby.id,password:'nope'});
  assert.equal(wrong.denied,true);
  assert.equal((await c.collection('projectSecrets').doc(lobby.id).collection('attempts').doc('jun').get()).data()?.count,1,'failed attempt must be committed');
  await cmd('jun',{type:'enterProject',projectId:lobby.id,password:'abcd1234'});
  const jun=await data('members/jun');
  assert.deepEqual([...jun?.projectIds].sort(),[lobby.id,'p-onboarding'].sort());assert.equal(jun?.projectId,lobby.id);
  assert.equal((await c.collection('projectSecrets').doc(lobby.id).collection('attempts').doc('jun').get()).exists,false);
  const invite=(await data('workshop/project-'+lobby.id))?.data.inviteCode;
  await cmd('ha',{type:'enterProject',projectId:lobby.id,invite});
  assert.ok((await data('projects/'+lobby.id))?.memberIds.includes('ha'));

  // Capacity holds under concurrent joins.
  const small=await cmd('seo',{type:'openProject',name:'둘이서',intro:'',capacity:2,joinPolicy:'open'});
  const joins=await Promise.allSettled([cmd('min',{type:'enterProject',projectId:small.id}),cmd('ha',{type:'enterProject',projectId:small.id})]);
  assert.equal(joins.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await data('projects/'+small.id))?.memberIds.length,2);

  // Steps: a team card while the cohort activity is closed, then the leader confirms it.
  await cmd('seo',{type:'enterProject',projectId:'p-onboarding'});
  const card=await runCommand(cohortId,'seo',randomUUID(),{type:'createIdea',title:'팀 카드',body:'첫 주에 물어볼 사람을 몰라요',kind:'thought',scope:'project'}) as {id:string};
  assert.equal((await data('ideas/'+card.id))?.projectId,'p-onboarding');
  const full=structuredClone(sample.ideas.find(i=>i.refinement?.draft)!.refinement!);full.ready=false;
  await runCommand(cohortId,'seo',randomUUID(),{type:'refineIdea',id:card.id,revision:1,phase:'definition',input:full,reason:'첫 초안',scope:'project'});
  await assert.rejects(cmd('jun',{type:'confirmProblem',projectId:'p-onboarding',ideaId:card.id,revision:2,reason:'합의'}),/접근|찾을 수 없/,'confirming needs the project to be active');
  await cmd('jun',{type:'enterProject',projectId:'p-onboarding'});
  await assert.rejects(cmd('seo',{type:'confirmProblem',projectId:'p-onboarding',ideaId:card.id,revision:2,reason:'합의'}),/팀장/);
  await cmd('jun',{type:'confirmProblem',projectId:'p-onboarding',ideaId:card.id,revision:2,reason:'팀 모두 겪음'});
  const confirmed=await data('projectDirectory/p-onboarding');
  assert.equal(confirmed?.confirmedProblem.ideaId,card.id);assert.equal(confirmed?.sourceIdeaId,'i2');

  // Step tags on chat and decisions.
  await runCommand(cohortId,'seo',randomUUID(),{type:'sendMessage',channel:'p-onboarding',body:'문장 같이 봐요',step:'definition'});
  const msg=(await c.collection('channels').doc('p-onboarding').collection('messages').get()).docs.map(d=>d.data()).find(m=>m.body==='문장 같이 봐요');
  assert.equal(msg?.step,'definition');
  const decision=await cmd('jun',{type:'decision',projectId:'p-onboarding',title:'첫 주 대상',body:'범위',reason:'4주',sourceMessageId:null,step:'confirm'});
  assert.equal((await data('workshop/'+decision.id))?.data.step,'confirm');

  // Exhibition snapshot uses real Firestore queries for counts and history.
  const show={type:'showcase',projectId:'p-onboarding',problem:'문제',solution:'해결',demoUrl:'https://example.com/demo',slidesUrl:'',retrospective:'회고',constraints:'',milestones:['변화'],state:'published'};
  await cmd('jun',{...show,includeOrigin:true,includeJourney:true});
  const story=(await data('workshop/showcase-p-onboarding'))?.data.story;
  assert.equal(story.origin.title,'팀 카드');assert.equal(story.problem.ownerId,'seo');
  assert.ok(story.journey.cards>=1);assert.equal(story.journey.decisions,1);assert.equal(story.journey.members,2);
  await cmd('jun',show);
  const plain=(await data('workshop/showcase-p-onboarding'))?.data.story;
  assert.equal(plain.origin,undefined);assert.equal(plain.journey,undefined);

  // Correcting the source of a confirmed card hides it from the project and exhibition (nested-field query).
  await cmd('seo',{type:'source',id:'src-1',revision:0,title:'메모',text:'처음 온 사람은 길을 찾기 어렵다.',sourceType:'notes',scope:'owner',projectId:null,consent:false});
  await cmd('seo',{type:'proposal',sourceId:'src-1',sourceRevision:1,proposalType:'new_idea',title:'안내',body:'길 안내',evidence:'길을 찾기 어렵다'});
  const proposal=(await c.collection('workshop').where('kind','==','proposal').get()).docs[0];
  await cmd('seo',{type:'resolveProposal',proposalId:proposal.id,accept:true,title:'안내',body:'길 안내'});
  const derived=(await c.collection('ideas').where('sourceId','==','src-1').get()).docs[0];
  await derived.ref.set({scope:'project',projectId:'p-onboarding',refinement:full},{merge:true});
  await cmd('jun',{type:'confirmProblem',projectId:'p-onboarding',ideaId:derived.id,revision:derived.data().revision,reason:'다시 확정'});
  await cmd('jun',{...show,includeOrigin:true});
  await cmd('seo',{type:'redactSource',sourceId:'src-1',reason:'원문 정정'});
  assert.equal((await data('projectDirectory/p-onboarding'))?.confirmedProblem.statement,'원본 정정으로 숨긴 문제');
  const hidden=(await data('workshop/showcase-p-onboarding'))?.data.story;
  assert.equal(hidden.origin,undefined);assert.equal(hidden.problem.statement,'원본 정정으로 숨긴 문제');
  console.log('PASS: lobby password/invite/attempt commit, hidden secrets, multi-project membership, concurrent capacity, team cards without cohort activity, leader confirmation, step tags, exhibition snapshot and correction hiding');
 }finally{if(!cohortId.startsWith('test-projects-'))throw new Error('Invalid test scope');await db().recursiveDelete(c);console.log('Isolated test cohort removed.');}
}
main().catch(e=>{console.error(e);process.exit(1);});
