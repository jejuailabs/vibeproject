import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace} from '../src/lib/preview';
import {previewWorkshop} from '../src/lib/workshop/memory';
import type {PreviewState, RecordOf} from '../src/lib/workshop/model';

type State=PreviewState&{result?:unknown};
const as=(s:State,uid:string):State=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
const run=(s:State,uid:string,command:unknown)=>previewWorkshop(as(s,uid),command);
const vote=(s:State)=>s.records.find((r):r is RecordOf<'teamVote'>=>r.kind==='teamVote');

test('the leader opens a vote on problem cards, members vote once each and may change it, then the leader closes it',async()=>{
 const w=previewWorkspace();
 // jun leads p-onboarding; give the team a refined card from seo.
 const card=structuredClone(w.ideas.find(i=>i.id==='i1')!);
 Object.assign(card,{id:'t1',ownerId:'seo',projectId:'p-onboarding',scope:'project'});
 w.ideas.push(card);
 let s:State={workspace:w,records:[]};
 await assert.rejects(run(s,'seo',{type:'openTeamVote',projectId:'p-onboarding'}),/팀장/);
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 assert.equal(vote(s)!.data.state,'open');assert.deepEqual(vote(s)!.data.candidateIds,['t1']);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'t1'});
 s=await run(s,'jun',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'t1'});
 assert.equal(vote(s)!.data.counts.t1,2);assert.equal(vote(s)!.data.voters,2);
 // Pressing a chosen card again takes the vote back.
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'t1'});
 assert.equal(vote(s)!.data.counts.t1,1);assert.equal(vote(s)!.data.voters,1);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'t1'});
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'i3'}),/후보/);
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding'});
 assert.equal(vote(s)!.data.state,'closed');
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'t1'}),/열려 있는 투표/);
 // Confirming the winning card writes it as the product planning document.
 s=await run(s,'jun',{type:'confirmProblem',projectId:'p-onboarding',ideaId:'t1',revision:card.revision,reason:'투표 1위'});
 const doc=s.records.find((r):r is RecordOf<'document'>=>r.kind==='document'&&r.id==='doc-p-onboarding-product')!;
 assert.match(doc.data.markdown,/# 문제와 사용자/);assert.match(doc.data.markdown,/모임에 처음 참석하는 사람/);
 // Ballots stay private to their owner.
 assert.equal(as(s,'jun').records.filter(r=>r.kind==='teamBallot').length>=1,true);
});

test('the leader sets how many cards each member may vote for',async()=>{
 const w=previewWorkspace();
 for(const [id,owner] of [['a1','seo'],['a2','jun'],['a3','seo']] as const){const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:owner,projectId:'p-onboarding',scope:'project'});w.ideas.push(c);}
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',maxVotes:2});
 assert.equal(vote(s)!.data.maxVotes,2);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'a1'});
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'a2'});
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'a3'}),/2개까지/);
 assert.deepEqual([vote(s)!.data.counts.a1,vote(s)!.data.counts.a2,vote(s)!.data.voters],[1,1,1]);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'a1'});
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'a3'});
 assert.deepEqual([vote(s)!.data.counts.a1,vote(s)!.data.counts.a2,vote(s)!.data.counts.a3],[0,1,1]);
 // More votes than cards are capped to the number of cards.
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding'});
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',maxVotes:9});
 assert.equal(vote(s)!.data.maxVotes,3);
});

test('the leader adds cards finished after the vote opened, and can cancel the vote to start over',async()=>{
 const w=previewWorkspace();
 const make=(id:string,owner:string)=>{const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:owner,projectId:'p-onboarding',scope:'project'});return c;};
 w.ideas.push(make('b1','seo'));
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'b1'});
 await assert.rejects(run(s,'jun',{type:'refreshTeamVote',projectId:'p-onboarding'}),/새로 추가할/);
 // A card finished after opening joins the vote; the vote already cast stays.
 s.workspace.ideas.push(make('b2','jun'));
 await assert.rejects(run(s,'seo',{type:'refreshTeamVote',projectId:'p-onboarding'}),/팀장/);
 s=await run(s,'jun',{type:'refreshTeamVote',projectId:'p-onboarding'});
 assert.deepEqual(vote(s)!.data.candidateIds,['b1','b2']);assert.equal(vote(s)!.data.counts.b1,1);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'b2'});
 // Cancelling throws the votes away; the next vote is a new round.
 await assert.rejects(run(s,'seo',{type:'cancelTeamVote',projectId:'p-onboarding'}),/팀장/);
 s=await run(s,'jun',{type:'cancelTeamVote',projectId:'p-onboarding'});
 assert.equal(vote(s)!.data.state,'cancelled');assert.equal(vote(s)!.data.voters,0);
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'b1'}),/열려 있는 투표/);
 const round=vote(s)!.data.round;
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 assert.equal(vote(s)!.data.round,round+1);assert.equal(vote(s)!.data.voters,0);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'b1'});
 assert.equal(vote(s)!.data.counts.b1,1);assert.equal(vote(s)!.data.voters,1);
});
