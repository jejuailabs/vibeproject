import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace} from '../src/lib/preview';
import {previewWorkshop} from '../src/lib/workshop/memory';
import type {PreviewState,RecordOf} from '../src/lib/workshop/model';

const as=(s:PreviewState,uid:string):PreviewState=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
const showcase=(extra:Record<string,unknown>)=>({type:'showcase',projectId:'p-onboarding',problem:'문제',solution:'해결',demoUrl:'https://example.com/demo',slidesUrl:'',retrospective:'회고',constraints:'',milestones:['변화 하나'],state:'published',...extra});
const story=(s:PreviewState)=>(s.records.find(r=>r.kind==='showcase') as RecordOf<'showcase'>).data.story!;

test('the exhibition keeps team-internal parts out unless the leader includes them',async()=>{
 const base:PreviewState={workspace:previewWorkspace(),records:[]};
 await assert.rejects(previewWorkshop(as(base,'seo'),showcase({})),/팀장/);
 let s=await previewWorkshop(as(base,'jun'),showcase({}));
 assert.equal(story(s).origin,undefined);assert.equal(story(s).journey,undefined);
 assert.equal(story(s).problem.statement,s.workspace.projects.find(p=>p.id==='p-onboarding')!.problem);
 assert.ok(!('includeOrigin' in (s.records.find(r=>r.kind==='showcase') as RecordOf<'showcase'>).data));
 s=await previewWorkshop(as(s,'jun'),{type:'decision',projectId:'p-onboarding',title:'범위',body:'첫 주',reason:'4주',sourceMessageId:null});
 s=await previewWorkshop(as(s,'jun'),showcase({includeOrigin:true,includeJourney:true}));
 const source=s.workspace.ideas.find(i=>i.id==='i2')!;
 assert.equal(story(s).origin?.title,source.title);assert.equal(story(s).origin?.ownerId,source.ownerId);
 assert.equal(story(s).journey?.members,2);assert.equal(story(s).journey?.decisions,1);
});

test('correcting the source of a confirmed card hides it from the project and its exhibition',async()=>{
 let s:PreviewState=as({workspace:previewWorkspace(),records:[]},'jun');
 const run=async(command:unknown)=>{s=as(await previewWorkshop(s,command),'jun');};
 await run({type:'source',id:'s1',revision:0,title:'메모',text:'처음 온 사람은 길을 찾기 어렵다.',sourceType:'notes',scope:'owner',projectId:null,consent:false});
 await run({type:'proposal',sourceId:'s1',sourceRevision:1,proposalType:'new_idea',title:'안내',body:'길 안내',evidence:'길을 찾기 어렵다'});
 await run({type:'resolveProposal',proposalId:s.records.find(r=>r.kind==='proposal')!.id,accept:true,title:'안내',body:'길 안내'});
 const derived=s.workspace.ideas.find(i=>i.sourceId==='s1')!;
 Object.assign(derived,{scope:'project',projectId:'p-onboarding',refinement:structuredClone(previewWorkspace().ideas.find(i=>i.refinement?.draft)!.refinement)});
 await run({type:'confirmProblem',projectId:'p-onboarding',ideaId:derived.id,revision:derived.revision,reason:'팀 합의'});
 await run(showcase({includeOrigin:true}));
 assert.equal(story(s).origin?.title,'안내');
 await run({type:'redactSource',sourceId:'s1',reason:'원문 정정'});
 const p=s.workspace.projects.find(x=>x.id==='p-onboarding')!;
 assert.equal(p.confirmedProblem?.statement,'원본 정정으로 숨긴 문제');
 assert.equal(story(s).origin,undefined);
 assert.equal(story(s).problem.statement,'원본 정정으로 숨긴 문제');
});
