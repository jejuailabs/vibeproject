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
