import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace,previewCommand} from '../src/lib/preview';
import {previewWorkshop} from '../src/lib/workshop/memory';
import {statement} from '../src/lib/refinement';
import type {PreviewState} from '../src/lib/workshop/model';
import type {Idea} from '../src/lib/types';

const as=(s:PreviewState,uid:string):PreviewState=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
function teamState(){
 const workspace=previewWorkspace(),base=workspace.ideas.find(i=>i.refinement?.draft)!;
 const card:Idea={...structuredClone(base),id:'team-card',ownerId:'seo',scope:'project',projectId:'p-onboarding'};
 const blank:Idea={...structuredClone(base),id:'team-blank',ownerId:'seo',scope:'project',projectId:'p-onboarding',refinement:undefined};
 workspace.ideas.push(card,blank);
 return {s:{workspace,records:[]} as PreviewState,card};
}

test('only the leader confirms a drafted team card; the snapshot keeps the original source card',async()=>{
 const {s,card}=teamState();
 const confirm={type:'confirmProblem',projectId:'p-onboarding',ideaId:card.id,revision:card.revision,reason:'팀 모두 겪은 일'};
 await assert.rejects(previewWorkshop(as(s,'seo'),confirm),/팀장/);
 await assert.rejects(previewWorkshop(as(s,'jun'),{...confirm,revision:card.revision-1}),/최신 내용/);
 await assert.rejects(previewWorkshop(as(s,'jun'),{...confirm,ideaId:'team-blank'}),/초안/);
 const next=await previewWorkshop(as(s,'jun'),confirm);
 const p=next.workspace.projects.find(x=>x.id==='p-onboarding')!;
 assert.equal(p.problem,statement(card.refinement!));
 assert.equal(p.sourceIdeaId,'i2');
 assert.deepEqual({ideaId:p.confirmedProblem?.ideaId,ownerId:p.confirmedProblem?.ownerId,draft:p.confirmedProblem?.draft,by:p.confirmedProblem?.confirmedBy},{ideaId:card.id,ownerId:'seo',draft:card.refinement!.draft,by:'jun'});
 assert.ok(next.workspace.events.some(e=>e.ideaId===card.id&&e.title==='프로젝트 문제로 확정'));
 assert.ok(next.records.some(r=>r.kind==='notification'&&r.ownerId==='seo'));
});

test('cards from another project cannot be confirmed',async()=>{
 const {s}=teamState(),other=s.workspace.ideas.find(i=>i.scope==='cohort'&&i.refinement?.draft&&i.id!=='i2')!;
 await assert.rejects(previewWorkshop(as(s,'jun'),{type:'confirmProblem',projectId:'p-onboarding',ideaId:other.id,revision:other.revision,reason:'x'}),/이 프로젝트/);
});

test('team cards do not depend on the cohort activity being open',()=>{
 const workspace=previewWorkspace();workspace.activity.state='closed';
 const jun={...workspace,me:workspace.members.find(m=>m.id==='jun')!};
 const next=previewCommand(jun,{type:'createIdea',title:'팀 생각',body:'팀 안에서만',kind:'thought',scope:'project'});
 assert.equal(next.ideas[0].projectId,'p-onboarding');
 assert.throws(()=>previewCommand(jun,{type:'createIdea',title:'전체 생각',body:'전체 공유',kind:'thought',scope:'cohort'}),/마감/);
});
