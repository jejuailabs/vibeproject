import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace,previewCommand} from '../src/lib/preview';
import {emptyRefinement,nextRefinement,solutionHints,statement} from '../src/lib/refinement';
import {previewWorkshop} from '../src/lib/workshop/memory';
import type {Command,Idea} from '../src/lib/types';
const fresh=()=>{const s=previewWorkspace();delete s.ideas[0].refinement;return s;};
const save=(i:Idea,input=emptyRefinement(),phase:'questions'|'definition'='questions'):Command=>({type:'refineIdea',id:i.id,revision:i.revision,phase,input,reason:'경험을 확인함',scope:i.scope});
test('partial answers persist; definition revisions preserve snapshots and invalidate readiness on changes',()=>{
 let s=fresh(),i=s.ideas[0],input=emptyRefinement();input.answers.who='첫 참가자';
 s=previewCommand(s,save(i,input));i=s.ideas[0];assert.equal(i.refinement?.answers.who,'첫 참가자');
 assert.throws(()=>nextRefinement(i,'definition',input,'초안'),/다섯 질문/);
 input=structuredClone(previewWorkspace().ideas[0].refinement!);input.ready=false;
 s=previewCommand(s,save(i,input,'definition'));i=s.ideas[0];assert.equal(i.refinement?.draft,1);
 const previous=structuredClone(s.events[0]);input.definition.focus='시작 전 5분';input.ready=true;
 s=previewCommand(s,save(i,input,'definition'));i=s.ideas[0];assert.equal(i.refinement?.draft,2);assert.equal(i.refinement?.ready,true);
 assert.deepEqual(s.events.find(e=>e.id===previous.id),previous);
 s=previewCommand(s,save(i,input));assert.equal(s.ideas[0].refinement?.ready,false);assert.equal(s.ideas[0].refinement?.draft,2);
});
test('only author edits, stale revisions and frozen candidates reject updates',()=>{
 const s=fresh(),cmd=save(s.ideas[0]);
 assert.throws(()=>previewCommand({...s,me:s.members[2]},cmd),/작성자/);
 const next=previewCommand(s,cmd);assert.throws(()=>previewCommand(next,cmd),/다른 변경/);
 s.ideas[0].state='candidate';assert.throws(()=>previewCommand(s,cmd),/원본/);
});
test('completion requires all fields and review; keyword hints do not prevent drafts',()=>{
 const i=fresh().ideas[0],input=structuredClone(previewWorkspace().ideas[0].refinement!);
 input.definition.who='앱을 만드는 사람';input.definition.solutionReviewed=false;
 assert.equal(solutionHints(input),true);assert.throws(()=>nextRefinement(i,'definition',input,'검토'),/확인/);
 input.ready=false;assert.equal(nextRefinement(i,'definition',input,'임시 저장').draft,1);
 input.ready=true;input.definition.solutionReviewed=true;input.definition.control='';assert.throws(()=>nextRefinement(i,'definition',input,'확정'),/통제범위/);
});
test('vote rejects unfinished cards and freezes full problem definition; project starts with its statement',async()=>{
 let workspace=fresh();
 const vote={type:'openVote',title:'문제 선정',candidateIds:['i1'],budget:1,allowSelfVote:true,closesAt:'2099-01-01T00:00:00Z'};
 await assert.rejects(previewWorkshop({workspace,records:[]},vote),/선정 준비/);
 workspace=previewCommand(workspace,save(workspace.ideas[0],previewWorkspace().ideas[0].refinement!,'definition'));
 let s=await previewWorkshop({workspace,records:[]},vote);const round=s.records.find(r=>r.kind==='round')!;
 assert.deepEqual(round.data.candidates[0].refinement,workspace.ideas[0].refinement);
 s=await previewWorkshop(s,{type:'closeVote',roundId:round.id,reason:'마감'});
 s=await previewWorkshop(s,{type:'selectVote',roundId:round.id,selected:[{ideaId:'i1',name:'새 모임',mode:'team',capacity:5}],reason:'확인된 문제'});
 assert.equal(s.workspace.projects.find(p=>p.sourceIdeaId==='i1')?.problem,statement(workspace.ideas[0].refinement!));
});

test('product document preserves source provenance for later redaction',async()=>{
 let s=await previewWorkshop({workspace:previewWorkspace(),records:[]},{type:'source',sourceType:'notes',id:'origin',revision:0,title:'모임 경험',text:'처음 참석한 사람은 혼자 기다렸다.',scope:'cohort',projectId:null,consent:true});
 const source=s.workspace.ideas.find(i=>i.id==='i2')!;source.sourceId='origin';source.refinement=structuredClone(s.workspace.ideas[0].refinement!);
 s.workspace.me=s.workspace.members.find(m=>m.id==='jun')!;
 s=await previewWorkshop(s,{type:'document',projectId:'p-onboarding',key:'product',revision:0,markdown:'처음 참석한 사람은 혼자 기다렸다.',reason:'선정 문제에서 시작'});
 const doc=s.records.find(r=>r.kind==='document')!;assert.equal(doc.data.sourceId,'origin');
 s.workspace.me=s.workspace.members.find(m=>m.id==='min')!;
 s=await previewWorkshop(s,{type:'redactSource',sourceId:'origin',reason:'원문 작성자 정정'});
 assert.equal(s.records.find(r=>r.kind==='document')?.data.redacted,true);
 s.workspace.me=s.workspace.members.find(m=>m.id==='jun')!;
 const latest=s.records.find(r=>r.kind==='document')!;
 await assert.rejects(previewWorkshop(s,{type:'document',projectId:'p-onboarding',key:'product',revision:latest.revision,markdown:'이전 내용을 복원',reason:'저장'}),/정정/);
});
