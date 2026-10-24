import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace} from '../src/lib/preview';
import {previewWorkshop} from '../src/lib/workshop/memory';
import type {PreviewState, RecordOf} from '../src/lib/workshop/model';

type State=PreviewState&{result?:unknown};
const as=(s:State,uid:string):State=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
const votes=(s:State)=>s.records.filter((r):r is RecordOf<'teamVote'>=>r.kind==='teamVote').sort((a,b)=>b.data.round-a.data.round);
const vote=(s:State)=>votes(s)[0];
const run=(s:State,uid:string,command:{type:string;[key:string]:unknown})=>previewWorkshop(as(s,uid),{
 ...command,
 ...(command.type.endsWith('TeamVote')&&command.type!=='openTeamVote'&&!command.voteId&&vote(s)?{voteId:vote(s).id}:{}),
});

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

test('the leader picks which finished cards go on the vote',async()=>{
 const w=previewWorkspace();
 for(const [id,owner] of [['c1','seo'],['c2','jun'],['c3','seo']] as const){const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:owner,projectId:'p-onboarding',scope:'project'});w.ideas.push(c);}
 let s:State={workspace:w,records:[]};
 await assert.rejects(run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['c1','i3']}),/완성된 문제 카드만/);
 await assert.rejects(run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['c1','c1']}),/중복/);
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['c1','c3'],maxVotes:5});
 assert.deepEqual(vote(s)!.data.candidateIds,['c1','c3']);assert.equal(vote(s)!.data.maxVotes,2);
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'c2'}),/후보/);
 // A card left out stays a finished card.
 assert.equal(s.workspace.ideas.find(i=>i.id==='c2')!.refinement?.ready,true);
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

test('the leader deletes a vote; its old ballots never count in the next one',async()=>{
 const w=previewWorkspace();
 const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id:'d1',ownerId:'seo',projectId:'p-onboarding',scope:'project'});w.ideas.push(c);
 let s:State={workspace:w,records:[]};
 await assert.rejects(run(s,'jun',{type:'deleteTeamVote',projectId:'p-onboarding'}),/지울 투표/);
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'d1'});
 await assert.rejects(run(s,'seo',{type:'deleteTeamVote',projectId:'p-onboarding'}),/팀장/);
 s=await run(s,'jun',{type:'deleteTeamVote',projectId:'p-onboarding'});
 assert.equal(vote(s)!.data.state,'deleted');assert.deepEqual(vote(s)!.data.candidateIds,[]);
 await assert.rejects(run(s,'jun',{type:'deleteTeamVote',projectId:'p-onboarding'}),/지울 투표/);
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 assert.equal(vote(s)!.data.round,2);
 // seo's ballot was for round 1, so voting again adds a vote instead of taking one back.
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'d1'});
 assert.equal(vote(s)!.data.counts.d1,1);assert.equal(vote(s)!.data.voters,1);
});

test('simultaneous vote rooms keep separate ballots, limits, candidates and results',async()=>{
 const w=previewWorkspace();
 const make=(id:string)=>{const card=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(card,{id,ownerId:'seo',projectId:'p-onboarding',scope:'project'});return card;};
 w.ideas.push(make('r1'),make('r2'),make('r3'));
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',maxVotes:1});
 const first=vote(s).id;
 const room=(id:string)=>votes(s).find(v=>v.id===id)!;
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:first,ideaId:'r1'});
 const original=structuredClone(room(first));
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',maxVotes:2});
 const second=vote(s).id;
 assert.notEqual(first,second);assert.equal(votes(s).length,2);
 assert.deepEqual(room(first),original);
 assert.deepEqual(votes(s).map(v=>v.data.round),[2,1]);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:second,ideaId:'r1'});
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:second,ideaId:'r2'});
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:second,ideaId:'r3'}),/2개까지/);
 // Changing a single-vote choice in the first room cannot change the second room.
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:first,ideaId:'r2'});
 assert.deepEqual([room(first).data.counts.r1,room(first).data.counts.r2],[0,1]);
 assert.deepEqual([room(second).data.counts.r1,room(second).data.counts.r2],[1,1]);
 assert.equal(room(first).data.voters,1);assert.equal(room(second).data.voters,1);
 assert.equal(s.records.filter(r=>r.kind==='teamBallot'&&r.ownerId==='seo').length,2);
 // A new card only joins the selected room.
 s.workspace.ideas.push(make('r4'));
 s=await run(s,'jun',{type:'refreshTeamVote',projectId:'p-onboarding',voteId:first});
 assert.equal(room(first).data.candidateIds.includes('r4'),true);
 assert.equal(room(second).data.candidateIds.includes('r4'),false);
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:second,ideaId:'r4'}),/후보/);
 // Closing, cancelling or deleting one room never closes or resets its neighbours.
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding',voteId:first});
 assert.equal(room(second).data.state,'open');
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:first,ideaId:'r1'}),/열려 있는 투표/);
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 const third=vote(s).id;
 s=await run(s,'jun',{type:'cancelTeamVote',projectId:'p-onboarding',voteId:second});
 assert.equal(room(first).data.state,'closed');assert.equal(room(third).data.state,'open');
 assert.equal(room(first).data.counts.r2,1);
 s=await run(s,'jun',{type:'deleteTeamVote',projectId:'p-onboarding',voteId:second});
 assert.equal(room(first).data.counts.r2,1);assert.equal(room(third).data.state,'open');
 // An old client must select a room rather than accidentally changing another room.
 await assert.rejects(previewWorkshop(as(s,'jun'),{type:'closeTeamVote',projectId:'p-onboarding'}),/투표방을 다시 선택/);
});

test('legacy votes and their ballots survive opening another room',async()=>{
 const w=previewWorkspace();
 const card=structuredClone(w.ideas.find(i=>i.id==='i1')!);
 Object.assign(card,{id:'legacy-card',ownerId:'seo',projectId:'p-onboarding',scope:'project'});w.ideas.push(card);
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 const legacy=vote(s);legacy.id='teamvote-p-onboarding';legacy.data.round=7;
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:legacy.id,ideaId:card.id});
 const ballot=s.records.find((r):r is RecordOf<'teamBallot'>=>r.kind==='teamBallot')!;
 delete ballot.data.voteId;delete ballot.data.ideaIds;ballot.data.ideaId=card.id;
 const original=structuredClone(vote(s));
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 const next=vote(s);assert.equal(next.data.round,8);
 assert.deepEqual(votes(s).find(v=>v.id===legacy.id),original);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:legacy.id,ideaId:card.id});
 assert.equal(votes(s).find(v=>v.id===legacy.id)!.data.voters,0);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId:next.id,ideaId:card.id});
 assert.equal(vote(s).data.counts[card.id],1);
});

test('a room ID cannot be used through another project or by a member to manage votes',async()=>{
 const w=previewWorkspace();
 const card=structuredClone(w.ideas.find(i=>i.id==='i1')!);
 Object.assign(card,{id:'guard-card',projectId:'p-onboarding',scope:'project'});w.ideas.push(card);
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 const voteId=vote(s).id;
 const foreign=structuredClone(vote(s));foreign.id='foreign-vote';foreign.projectId='another-project';s.records.push(foreign);
 for(const type of ['castTeamVote','refreshTeamVote','closeTeamVote','cancelTeamVote','deleteTeamVote']){
  await assert.rejects(run(s,'jun',{type,projectId:'p-onboarding',voteId:foreign.id,...(type==='castTeamVote'?{ideaId:card.id}:{})}),/이 프로젝트의 투표방/);
  if(type!=='castTeamVote')await assert.rejects(run(s,'seo',{type,projectId:'p-onboarding',voteId}),/팀장/);
 }
});
