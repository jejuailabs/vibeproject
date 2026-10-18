import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace,previewCommand} from '../src/lib/preview';
import {previewWorkshop} from '../src/lib/workshop/memory';
import {projectTimeline} from '../src/lib/steps';
import type {PreviewState,RecordOf} from '../src/lib/workshop/model';

const as=(s:PreviewState,uid:string):PreviewState=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
const timeline=(s:PreviewState)=>projectTimeline({project:s.workspace.projects.find(p=>p.id==='p-onboarding')!,ideas:s.workspace.ideas.filter(i=>i.projectId==='p-onboarding'),events:s.workspace.events,comments:s.workspace.comments,messages:s.workspace.messages,records:s.records});

test('team chat, decisions, meetings and tasks keep the step they were made in',async()=>{
 let workspace=previewWorkspace();workspace={...workspace,me:workspace.members.find(m=>m.id==='jun')!};
 workspace=previewCommand(workspace,{type:'sendMessage',channel:'p-onboarding',body:'질문 답을 나눠봐요',step:'questions'});
 workspace=previewCommand(workspace,{type:'sendMessage',channel:'cohort',body:'전체 인사',step:'questions'});
 const team=workspace.messages.find(m=>m.body==='질문 답을 나눠봐요')!;
 assert.equal(team.step,'questions');
 assert.equal(workspace.messages.find(m=>m.body==='전체 인사')!.step,undefined);
 let s:PreviewState={workspace,records:[]};
 s=await previewWorkshop(as(s,'jun'),{type:'decision',projectId:'p-onboarding',title:'첫 주 대상만 다룬다',body:'범위 축소',reason:'4주 안에 가능',sourceMessageId:null,step:'confirm'});
 s=await previewWorkshop(as(s,'jun'),{type:'source',id:'meeting-1',revision:0,title:'2차 회의',text:'회의 메모',sourceType:'notes',scope:'project',projectId:'p-onboarding',consent:true,step:'plan'});
 s=await previewWorkshop(as(s,'jun'),{type:'messageToRecord',channel:'p-onboarding',messageId:team.id,target:'task',title:'답변 정리',body:'질문별 정리'});
 const of=<K extends 'decision'|'source'|'task'>(k:K)=>s.records.find(r=>r.kind===k) as RecordOf<K>;
 assert.equal(of('decision').data.step,'confirm');
 assert.equal(of('source').data.step,'plan');
 assert.equal(of('task').data.step,'questions','a task made from chat inherits the chat step');
 s=await previewWorkshop(as(s,'jun'),{type:'task',projectId:'p-onboarding',id:of('task').id,revision:of('task').revision,title:'답변 정리',body:'질문별 정리',status:'done',assigneeId:'jun',sourceMessageId:team.id});
 assert.equal(of('task').data.step,'questions','editing a task without a step keeps its step');

 const entries=timeline(s);
 const group=(title:string)=>entries.find(e=>e.title.includes(title))?.group;
 assert.equal(group('첫 주 대상만 다룬다'),'confirm');
 assert.equal(group('회의·자료 메모'),'plan');
 assert.equal(group('답변 정리'),'questions');
 assert.equal(entries.find(e=>e.detail==='질문 답을 나눠봐요')?.group,'questions');
 assert.ok(!entries.some(e=>e.detail==='전체 인사'),'cohort chat stays out of the project history');
 assert.ok(entries.every((e,i)=>i===0||entries[i-1].at>=e.at),'newest first');
});

test('card saves are grouped by what changed and untagged records fall back sensibly',()=>{
 const workspace=previewWorkspace(),base=workspace.ideas.find(i=>i.refinement?.draft)!;
 const card={...structuredClone(base),id:'tc',ownerId:'seo',scope:'project' as const,projectId:'p-onboarding'};
 const snap=(refinement?:typeof base.refinement)=>({title:card.title,body:card.body,scope:card.scope,state:card.state,refinement});
 const answersOnly=structuredClone(base.refinement!);answersOnly.draft=0;
 const events=[
  {id:'e1',ideaId:'tc',title:'첫 생각 공유',reason:'최초 작성',actorId:'seo',createdAt:'2026-10-01T00:00:00.000Z',revision:1,snapshot:snap()},
  {id:'e2',ideaId:'tc',title:'생각을 구체화했어요',reason:'질문 답',actorId:'seo',createdAt:'2026-10-02T00:00:00.000Z',revision:2,snapshot:snap(answersOnly)},
  {id:'e3',ideaId:'tc',title:'생각을 구체화했어요',reason:'초안',actorId:'seo',createdAt:'2026-10-03T00:00:00.000Z',revision:3,snapshot:snap(base.refinement)},
  {id:'e4',ideaId:'tc',title:'프로젝트 문제로 확정',reason:'팀 합의',actorId:'jun',createdAt:'2026-10-04T00:00:00.000Z',revision:3,snapshot:snap(base.refinement)},
 ];
 const comments=[{id:'c1',ideaId:'tc',authorId:'jun',body:'누가 겪나요?',createdAt:'2026-10-02T12:00:00.000Z'}];
 const messages=[{id:'m-old',authorId:'jun',body:'예전 대화',channel:'p-onboarding',createdAt:'2026-09-30T00:00:00.000Z'}];
 const entries=projectTimeline({project:workspace.projects[0],ideas:[card],events,comments,messages,records:[]});
 const g=(id:string)=>entries.find(e=>e.id===id)?.group;
 assert.deepEqual([g('h-e1'),g('h-e2'),g('h-e3'),g('h-e4')],['thought','questions','definition','confirm']);
 assert.equal(g('c-c1'),'questions','a comment without context follows the card step at that time');
 assert.equal(g('m-m-old'),'none');
});
