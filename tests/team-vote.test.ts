import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace} from '../src/lib/preview';
import {previewWorkshop} from '../src/lib/workshop/memory';
import type {PreviewState, RecordOf, WorkshopRecord} from '../src/lib/workshop/model';

type State=PreviewState&{result?:unknown};
const as=(s:State,uid:string):State=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
const votes=(s:State)=>s.records.filter((r):r is RecordOf<'teamVote'>=>r.kind==='teamVote').sort((a,b)=>b.data.round-a.data.round);
const vote=(s:State)=>votes(s)[0];
const run=(s:State,uid:string,command:{type:string;[key:string]:unknown})=>previewWorkshop(as(s,uid),{
 ...command,
 ...(command.type.endsWith('TeamVote')&&command.type!=='openTeamVote'&&!command.voteId&&vote(s)?{voteId:vote(s).id}:{}),
});
function responseRecord<K extends 'teamVote'|'pathVote'|'joinBoard'>(s:State,kind:K,id:string):RecordOf<K>{
 const result=s.result as {id:string;records:WorkshopRecord[]};
 const saved=s.records.find(r=>r.kind===kind&&r.id===id) as RecordOf<K>;
 assert.ok(saved);
 assert.deepEqual(result.records,[saved]);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
 return saved;
}

function editableVoteState():State {
 const workspace=previewWorkspace();
 for(const id of ['edit-a','edit-b','edit-c']) workspace.ideas.push({...structuredClone(workspace.ideas.find(i=>i.id==='i1')!),id,ownerId:'jun',projectId:'p-onboarding',scope:'project'});
 return {workspace,records:[]};
}
function editVote(s:State,patch:Record<string,unknown>={}) {
 return {type:'editTeamVote',projectId:'p-onboarding',voteId:vote(s).id,settingsRevision:vote(s).data.settingsRevision||0,title:'수정한 투표',...patch};
}

test('editing vote settings preserves concurrent ballots, exact deadlines, and other rooms',async()=>{
 let s=await run(editableVoteState(),'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['edit-c']});
 const other=structuredClone(vote(s));
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['edit-a','edit-b'],minutes:4320});
 const captured=editVote(s,{candidateIds:['edit-a','edit-b','edit-c'],maxVotes:2});
 const deadline=vote(s).data.endsAt;
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'edit-a'});
 // A ballot arriving after the editor opened must survive, without a settings conflict.
 s=await run(s,'jun',captured);
 const updated=responseRecord(s,'teamVote',vote(s).id);
 assert.equal(updated.data.title,'수정한 투표');assert.equal(updated.data.maxVotes,2);
 assert.equal(updated.data.endsAt,deadline);assert.equal(updated.data.counts['edit-a'],1);assert.equal(updated.data.voters,1);
 assert.deepEqual(s.records.find(r=>r.id===other.id),other);
 await assert.rejects(run(s,'jun',captured),/설정이 먼저 변경/);
 s=await run(s,'jun',editVote(s,{minutes:720}));
 assert.equal(Date.parse(vote(s).data.endsAt!)-Date.parse(vote(s).updatedAt),720*60000);
 s=await run(s,'jun',editVote(s,{minutes:0,title:''}));
 assert.equal(vote(s).data.endsAt,null);assert.equal(vote(s).data.title,'');
});

test('removing a vote candidate cancels only its selections, keeps privacy, and permits voting again',async()=>{
 let s=await run(editableVoteState(),'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['edit-a','edit-b','edit-c'],maxVotes:2});
 for(const [uid,ideaId] of [['jun','edit-a'],['jun','edit-b'],['seo','edit-a']] as const)
  s=await run(s,uid,{type:'castTeamVote',projectId:'p-onboarding',ideaId});
 s=await run(s,'jun',editVote(s,{candidateIds:['edit-b','edit-c'],maxVotes:1}));
 assert.deepEqual(vote(s).data.counts,{'edit-b':1});assert.equal(vote(s).data.voters,1);
 const ballots=s.records.filter((r):r is RecordOf<'teamBallot'>=>r.kind==='teamBallot');
 assert.deepEqual(ballots.find(b=>b.ownerId==='jun')!.data.ideaIds,['edit-b']);
 assert.deepEqual(ballots.find(b=>b.ownerId==='seo')!.data.ideaIds,[]);
 const response=s.result as {records:WorkshopRecord[]};
 assert.equal(response.records.length,2);assert.equal(response.records[1].ownerId,'jun');
 assert.equal(response.records.some(r=>r.kind==='teamBallot'&&r.ownerId==='seo'),false);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'edit-c'});
 assert.deepEqual(vote(s).data.counts,{'edit-b':1,'edit-c':1});assert.equal(vote(s).data.voters,2);
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'edit-a'}),/후보/);
});

test('editing refuses unauthorized, foreign, duplicate, unfinished and conflicting settings without losing votes',async()=>{
 let s=await run(editableVoteState(),'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['edit-a','edit-b'],maxVotes:2});
 for(const ideaId of ['edit-a','edit-b']) s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId});
 const before=structuredClone(s);
 await assert.rejects(run(s,'seo',editVote(s)),/팀장/);
 await assert.rejects(run(s,'jun',editVote(s,{maxVotes:1})),/새 한도보다 많이/);
 await assert.rejects(run(s,'jun',editVote(s,{candidateIds:['edit-a','edit-a']})),/중복/);
 await assert.rejects(run(s,'jun',editVote(s,{candidateIds:['edit-a','i3']})),/완성된 문제 카드만/);
 await assert.rejects(run(s,'min',editVote(s,{projectId:'p-space'})),/이 프로젝트의 투표방/);
 for(const patch of [{candidateIds:[]},{minutes:4321},{minutes:-1},{maxVotes:0}]) await assert.rejects(run(s,'jun',editVote(s,patch)));
 assert.deepEqual(s,before);
 const captured=editVote(s);
 s=await run(s,'jun',{type:'refreshTeamVote',projectId:'p-onboarding',ideaIds:['edit-c']});
 await assert.rejects(run(s,'jun',captured),/설정이 먼저 변경/);
 s=await run(s,'min',editVote(s,{title:'관리자가 수정한 투표'}));
 assert.equal(vote(s).data.title,'관리자가 수정한 투표');
});

test('closed and cancelled votes allow title edits while their results and downstream choices remain intact',async()=>{
 let s=await run(editableVoteState(),'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['edit-a']});
 s=await run(s,'jun',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'edit-a'});
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding'});
 s=await run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId:vote(s).id});
 const before=structuredClone(vote(s).data),path=structuredClone(s.records.find(r=>r.kind==='pathVote'));
 s=await run(s,'jun',editVote(s));
 assert.deepEqual(vote(s).data,{...before,title:'수정한 투표',settingsRevision:1});
 assert.deepEqual(s.records.find(r=>r.kind==='pathVote'),path);
 await assert.rejects(run(s,'jun',editVote(s,{candidateIds:['edit-a','edit-b']})),/이름만 수정/);
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['edit-b']});
 s=await run(s,'jun',{type:'cancelTeamVote',projectId:'p-onboarding'});
 s=await run(s,'jun',editVote(s));assert.equal(vote(s).data.state,'cancelled');
 await assert.rejects(run(s,'jun',editVote(s,{minutes:10})),/이름만 수정/);
 s=await run(s,'jun',{type:'deleteTeamVote',projectId:'p-onboarding'});
 await assert.rejects(run(s,'jun',editVote(s)),/수정할 투표가 없습니다/);
});

test('legacy single-choice ballots are cleaned when their candidate is removed',async()=>{
 const s=editableVoteState(),now=new Date().toISOString();
 s.records.push({id:'teamvote-p-onboarding',kind:'teamVote',scope:'project',projectId:'p-onboarding',ownerId:'jun',revision:1,createdAt:now,updatedAt:now,
  data:{round:1,state:'open',candidateIds:['edit-a','edit-b'],counts:{'edit-a':1},voters:1,openedAt:now,closedAt:null}},
 {id:'teamballot-p-onboarding-seo',kind:'teamBallot',scope:'project',projectId:'p-onboarding',ownerId:'seo',revision:1,createdAt:now,updatedAt:now,data:{round:1,ideaId:'edit-a'}});
 const changed=await run(s,'jun',editVote(s,{candidateIds:['edit-b']}));
 assert.deepEqual(vote(changed).data.counts,{});assert.equal(vote(changed).data.voters,0);
 assert.deepEqual((changed.records.find(r=>r.kind==='teamBallot') as RecordOf<'teamBallot'>).data,{round:1,voteId:'teamvote-p-onboarding',ideaIds:[]});
 assert.equal((changed.result as {records:WorkshopRecord[]}).records.length,1);
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

test('a timed vote refuses late ballots, then any member may close it and non-voters abstain',async()=>{
 const w=previewWorkspace();
 const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id:'d1',ownerId:'seo',projectId:'p-onboarding',scope:'project'});w.ideas.push(c);
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',minutes:10});
 const ends=Date.parse(vote(s)!.data.endsAt!)-Date.parse(vote(s)!.data.openedAt);
 assert.equal(ends,10*60000);
 s=await run(s,'jun',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'d1'});
 // Before the deadline only the leader may close it.
 await assert.rejects(run(s,'seo',{type:'closeTeamVote',projectId:'p-onboarding'}),/팀장/);
 vote(s)!.data.endsAt=new Date(Date.now()-1000).toISOString();
 await assert.rejects(run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',ideaId:'d1'}),/시간이 끝났/);
 s=await run(s,'seo',{type:'closeTeamVote',projectId:'p-onboarding'});
 const members=s.workspace.projects.find(p=>p.id==='p-onboarding')!.memberIds.length;
 assert.equal(vote(s)!.data.state,'closed');assert.equal(vote(s)!.data.endedBy,'time');assert.equal(vote(s)!.data.abstained,members-1);
});

test('6 to 72 hour deadlines persist for main votes, path votes and participation boards',async()=>{
 for(const hours of [6,12,24,48,72]){
  const w=previewWorkspace();
  const card={...structuredClone(w.ideas.find(i=>i.id==='i1')!),id:'long-vote-card',ownerId:'seo',projectId:'p-onboarding',scope:'project' as const};w.ideas.push(card);
  let s:State={workspace:w,records:[]};
  const minutes=hours*60;
  await assert.rejects(run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',minutes:4321}));
  s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',minutes});
  const main=vote(s)!;
  assert.equal(Date.parse(main.data.endsAt!)-Date.parse(main.data.openedAt),hours*3600000);
  s=await run(s,'jun',{type:'castTeamVote',projectId:'p-onboarding',voteId:main.id,ideaId:card.id});
  s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding',voteId:main.id});
  s=await run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId:main.id,minutes});
  const path=s.records.find((r):r is RecordOf<'pathVote'>=>r.kind==='pathVote')!;
  assert.equal(Date.parse(path.data.endsAt!)-Date.parse(path.data.openedAt),hours*3600000);
  s=await run(s,'jun',{type:'closePathVote',projectId:'p-onboarding',pathId:path.id});
  s=await run(s,'jun',{type:'openJoinBoard',projectId:'p-onboarding',pathId:path.id,capacity:5,minutes});
  const board=s.records.find((r):r is RecordOf<'joinBoard'>=>r.kind==='joinBoard')!;
  assert.equal(Date.parse(board.data.endsAt!)-Date.parse(board.data.openedAt),hours*3600000);
 }
});

test('closing a vote marks the 1st to 5th cards with votes, ties sharing a rank',async()=>{
 const w=previewWorkspace();
 const ids=['e1','e2','e3','e4','e5','e6','e7'];
 for(const id of ids){const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:'seo',projectId:'p-onboarding',scope:'project'});w.ideas.push(c);}
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 vote(s)!.data.counts={e1:5,e2:3,e3:3,e4:2,e5:1,e6:1,e7:0};
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding'});
 assert.deepEqual(vote(s)!.data.top,[
  {ideaId:'e1',votes:5,rank:1},{ideaId:'e2',votes:3,rank:2},{ideaId:'e3',votes:3,rank:2},
  {ideaId:'e4',votes:2,rank:4},{ideaId:'e5',votes:1,rank:5},{ideaId:'e6',votes:1,rank:5},
 ]);
});

test('after a main vote members choose team or solo under a nickname, and everyone sees the result',async()=>{
 const w=previewWorkspace();
 for(const [id,owner] of [['f1','seo'],['f2','jun']] as const){const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:owner,projectId:'p-onboarding',scope:'project'});w.ideas.push(c);}
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 const main=vote(s)!.id;
 await assert.rejects(run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId:main}),/마감된 투표/);
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding'});
 await assert.rejects(run(s,'seo',{type:'openPathVote',projectId:'p-onboarding',voteId:main}),/팀장/);
 s=await run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId:main,minutes:5});
 await assert.rejects(run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId:main}),/이미 열었/);
 const pv=()=>s.records.find((r):r is RecordOf<'pathVote'>=>r.kind==='pathVote')!;
 const pathId=pv().id;
 // Going solo needs one of my own finished cards.
 await assert.rejects(run(s,'seo',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:'서오',choice:'solo'}),/내 완성된 문제 카드/);
 await assert.rejects(run(s,'seo',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:'서오',choice:'solo',ideaId:'f2'}),/내 완성된 문제 카드/);
 s=await run(s,'seo',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:'서오',choice:'solo',ideaId:'f1'});
 s=await run(s,'jun',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:' 준 ',choice:'solo',ideaId:'f2'});
 // A member may change their mind while it is open.
 s=await run(s,'jun',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:'준',choice:'team'});
 assert.deepEqual(pv().data.picks,{seo:{nickname:'서오',choice:'solo',ideaId:'f1'},jun:{nickname:'준',choice:'team'}});
 await assert.rejects(run(s,'seo',{type:'closePathVote',projectId:'p-onboarding',pathId}),/팀장/);
 pv().data.endsAt=new Date(Date.now()-1000).toISOString();
 await assert.rejects(run(s,'seo',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:'서오',choice:'team'}),/시간이 끝났/);
 s=await run(s,'seo',{type:'closePathVote',projectId:'p-onboarding',pathId});
 const members=s.workspace.projects.find(p=>p.id==='p-onboarding')!.memberIds.length;
 assert.equal(pv().data.state,'closed');assert.equal(pv().data.endedBy,'time');assert.equal(pv().data.abstained,members-2);
});

test('the leader adds only the new cards they check to an open vote',async()=>{
 const w=previewWorkspace();
 const make=(id:string)=>{const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:'seo',projectId:'p-onboarding',scope:'project'});return c;};
 w.ideas.push(make('g1'));
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 s.workspace.ideas.push(make('g2'),make('g3'));
 await assert.rejects(run(s,'jun',{type:'refreshTeamVote',projectId:'p-onboarding',ideaIds:['g1']}),/후보가 아닌/);
 s=await run(s,'jun',{type:'refreshTeamVote',projectId:'p-onboarding',ideaIds:['g3']});
 assert.deepEqual(vote(s)!.data.candidateIds,['g1','g3']);
});

test('the join board lists the top 5 and solo cards, caps each project, and closing makes the real projects',async()=>{
 const w=previewWorkspace();
 for(const [id,owner] of [['h1','seo'],['h2','jun'],['h3','seo']] as const){const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:owner,projectId:'p-onboarding',scope:'project',title:'카드 '+id});w.ideas.push(c);}
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 vote(s)!.data.counts={h1:2,h2:1,h3:0};
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding'});
 s=await run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId:vote(s)!.id});
 const pathId=s.records.find(r=>r.kind==='pathVote')!.id;
 // seo goes solo on h3, which got no votes; jun goes with a team.
 s=await run(s,'seo',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:'서오',choice:'solo',ideaId:'h3'});
 s=await run(s,'jun',{type:'pickPath',projectId:'p-onboarding',pathId,nickname:'준',choice:'team'});
 await assert.rejects(run(s,'jun',{type:'openJoinBoard',projectId:'p-onboarding',pathId,capacity:1}),/먼저 마감/);
 s=await run(s,'jun',{type:'closePathVote',projectId:'p-onboarding',pathId});
 await assert.rejects(run(s,'seo',{type:'openJoinBoard',projectId:'p-onboarding',pathId,capacity:1}),/팀장/);
 s=await run(s,'jun',{type:'openJoinBoard',projectId:'p-onboarding',pathId,capacity:1,minutes:10});
 const jb=()=>s.records.find((r):r is RecordOf<'joinBoard'>=>r.kind==='joinBoard')!;
 const boardId=jb().id;
 assert.deepEqual(jb().data.options.map(o=>[o.ideaId,o.rank??null,o.soloNick??null]),[['h1',1,null],['h2',2,null],['h3',null,'서오']]);
 assert.deepEqual(Object.keys(jb().data.picks),['seo']);
 // A solo chooser cannot move; a full project refuses another member.
 await assert.rejects(run(s,'seo',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'h1'}),/개별로 고른/);
 await assert.rejects(run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'h3'}),/정원/);
 s=await run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'h2'});
 s=await run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'h2'});
 assert.equal(jb().data.picks.jun,undefined);
 s=await run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'h1'});
 await assert.rejects(run(s,'seo',{type:'closeJoinBoard',projectId:'p-onboarding',boardId}),/팀장/);
 s=await run(s,'jun',{type:'closeJoinBoard',projectId:'p-onboarding',boardId});
 const made=jb().data.projects!;
 assert.deepEqual(Object.keys(made).sort(),['h1','h3']);
 const p1=s.workspace.projects.find(p=>p.id===made.h1)!, p3=s.workspace.projects.find(p=>p.id===made.h3)!;
 // h1 was written by seo, who did not join it, so its first joiner leads it.
 assert.deepEqual([p1.leaderId,p1.memberIds,p1.sourceIdeaId],['jun',['jun'],'h1']);
 assert.deepEqual([p3.leaderId,p3.memberIds],['seo',['seo']]);
 // Members keep working in the shared room until they open their new project.
 const jun=s.workspace.members.find(m=>m.id==='jun')!;
 assert.equal(jun.projectId,'p-onboarding');assert.ok(jun.projectIds?.includes(made.h1));
 const roomMembers=s.workspace.projects.find(p=>p.id==='p-onboarding')!.memberIds;
 assert.deepEqual(jb().data.unassigned,roomMembers.filter(id=>!['jun','seo'].includes(id)));
});

test('the leader keeps the cards ranked 1st to N as final teams and members join them without a team-or-solo vote',async()=>{
 const w=previewWorkspace();
 for(const [id,owner] of [['f1','seo'],['f2','jun'],['f3','seo'],['f4','jun']] as const){const c=structuredClone(w.ideas.find(i=>i.id==='i1')!);Object.assign(c,{id,ownerId:owner,projectId:'p-onboarding',scope:'project',title:'카드 '+id});w.ideas.push(c);}
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding',candidateIds:['f1','f2','f3','f4']});
 const voteId=vote(s)!.id;
 await assert.rejects(run(s,'jun',{type:'openFinalBoard',projectId:'p-onboarding',voteId,topRank:2,capacity:2}),/마감된 투표/);
 vote(s)!.data.counts={f1:3,f2:2,f3:2,f4:0};
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding'});
 await assert.rejects(run(s,'seo',{type:'openFinalBoard',projectId:'p-onboarding',voteId,topRank:2,capacity:2}),/팀장/);
 s=await run(s,'jun',{type:'openFinalBoard',projectId:'p-onboarding',voteId,topRank:2,capacity:2});
 const jb=()=>s.records.find((r):r is RecordOf<'joinBoard'>=>r.kind==='joinBoard')!;
 const boardId=responseRecord(s,'joinBoard','joinboard-'+voteId).id;
 // Tied cards share 2nd place, so both stay; the card with no votes is left out.
 assert.deepEqual(jb().data.options.map(o=>[o.ideaId,o.rank]),[['f1',1],['f2',2],['f3',2]]);
 assert.deepEqual([jb().data.pathId,jb().data.topRank,jb().data.picks],['',2,{}]);
 await assert.rejects(run(s,'jun',{type:'openFinalBoard',projectId:'p-onboarding',voteId,topRank:1,capacity:2}),/이미 정했/);
 await assert.rejects(run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId}),/최종 팀/);
 s=await run(s,'seo',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'f2'});
 s=await run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'f2'});
 assert.deepEqual(Object.keys(jb().data.picks).sort(),['jun','seo']);
 s=await run(s,'jun',{type:'closeJoinBoard',projectId:'p-onboarding',boardId});
 const made=jb().data.projects!;
 assert.deepEqual(Object.keys(made),['f2']);
 const p2=s.workspace.projects.find(p=>p.id===made.f2)!;
 assert.deepEqual([p2.leaderId,[...p2.memberIds].sort()],['jun',['jun','seo']]);
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

test('casting returns the committed room and only the caller ballot, including cancellation',async()=>{
 const w=previewWorkspace();
 const card=structuredClone(w.ideas.find(i=>i.id==='i1')!);
 Object.assign(card,{id:'response-card',ownerId:'seo',projectId:'p-onboarding',scope:'project'});w.ideas.push(card);
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 const voteId=vote(s).id;
 s=await run(s,'jun',{type:'castTeamVote',projectId:'p-onboarding',voteId,ideaId:card.id});
 const otherBallot=structuredClone(s.records.find(r=>r.kind==='teamBallot'&&r.ownerId==='jun')!);
 const previousRevision=vote(s).revision;
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId,ideaId:card.id});
 const result=s.result as {id:string;records:(RecordOf<'teamVote'>|RecordOf<'teamBallot'>)[]};
 assert.equal(result.id,'p-onboarding');
 assert.equal(result.records.length,2);
 const room=result.records.find((r):r is RecordOf<'teamVote'>=>r.kind==='teamVote')!;
 const ballot=result.records.find((r):r is RecordOf<'teamBallot'>=>r.kind==='teamBallot')!;
 assert.deepEqual(room,vote(s));
 assert.equal(room.revision,previousRevision+1);
 assert.equal(room.data.counts[card.id],2);
 assert.equal(room.data.voters,2);
 assert.equal(ballot.ownerId,'seo');
 assert.equal(ballot.data.voteId,voteId);
 assert.deepEqual(ballot.data.ideaIds,[card.id]);
 assert.deepEqual(ballot,s.records.find(r=>r.id===ballot.id));
 assert.equal(result.records.some(r=>r.id===otherBallot.id),false);
 assert.deepEqual(s.records.find(r=>r.id===otherBallot.id),otherBallot);
 // The patch is JSON-safe, as required by the response and stored idempotency result.
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
 s=await run(s,'seo',{type:'castTeamVote',projectId:'p-onboarding',voteId,ideaId:card.id});
 const cancelled=s.result as typeof result;
 const cancelledRoom=cancelled.records.find((r):r is RecordOf<'teamVote'>=>r.kind==='teamVote')!;
 const cancelledBallot=cancelled.records.find((r):r is RecordOf<'teamBallot'>=>r.kind==='teamBallot')!;
 assert.deepEqual(cancelledRoom,vote(s));
 assert.equal(cancelledRoom.data.counts[card.id],1);
 assert.equal(cancelledRoom.data.voters,1);
 assert.equal(cancelledBallot.revision,ballot.revision+1);
 assert.deepEqual(cancelledBallot.data.ideaIds,[]);
 assert.equal(cancelled.records.some(r=>r.id===otherBallot.id),false);
});

test('vote lifecycle actions return only their committed room without changing workspace data',async()=>{
 const w=previewWorkspace();
 const make=(id:string)=>({...structuredClone(w.ideas.find(i=>i.id==='i1')!),id,ownerId:'seo',projectId:'p-onboarding',scope:'project' as const});
 w.ideas.push(make('patch-first'));
 let s:State={workspace:w,records:[]};
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 let main=vote(s).id;
 assert.equal(responseRecord(s,'teamVote',main).data.state,'open');
 assert.ok(s.records.some(r=>r.kind==='notification'&&r.ownerId==='seo'));
 s.workspace.ideas.push(make('patch-second'));
 const workspace=structuredClone(s.workspace);
 s=await run(s,'jun',{type:'refreshTeamVote',projectId:'p-onboarding',voteId:main,ideaIds:['patch-second']});
 assert.deepEqual(responseRecord(s,'teamVote',main).data.candidateIds,['patch-first','patch-second']);
 s=await run(s,'jun',{type:'cancelTeamVote',projectId:'p-onboarding',voteId:main});
 assert.equal(responseRecord(s,'teamVote',main).data.state,'cancelled');
 s=await run(s,'jun',{type:'deleteTeamVote',projectId:'p-onboarding',voteId:main});
 assert.equal(responseRecord(s,'teamVote',main).data.state,'deleted');
 s=await run(s,'jun',{type:'openTeamVote',projectId:'p-onboarding'});
 main=vote(s).id;
 vote(s).data.counts={'patch-first':1};vote(s).data.voters=1;
 s=await run(s,'jun',{type:'closeTeamVote',projectId:'p-onboarding',voteId:main});
 assert.equal(responseRecord(s,'teamVote',main).data.state,'closed');
 s=await run(s,'jun',{type:'openPathVote',projectId:'p-onboarding',voteId:main});
 const pathId='pathvote-'+main;
 assert.equal(responseRecord(s,'pathVote',pathId).data.state,'open');
 s=await run(s,'jun',{type:'closePathVote',projectId:'p-onboarding',pathId});
 assert.equal(responseRecord(s,'pathVote',pathId).data.state,'closed');
 s=await run(s,'jun',{type:'openJoinBoard',projectId:'p-onboarding',pathId,capacity:2});
 const boardId='joinboard-'+pathId;
 assert.equal(responseRecord(s,'joinBoard',boardId).data.state,'open');
 assert.deepEqual(s.workspace,workspace);
 // Closing a join board changes project/member data and must keep the full reload path.
 s=await run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId,ideaId:'patch-first'});
 s=await run(s,'jun',{type:'closeJoinBoard',projectId:'p-onboarding',boardId});
 assert.equal('records' in (s.result as object),false);
 assert.equal(s.workspace.projects.length,workspace.projects.length+1);
});

test('path selection patches preserve other members and reject choices after the deadline',async()=>{
 const w=previewWorkspace(),now=new Date().toISOString();
 w.ideas.push({...structuredClone(w.ideas.find(i=>i.id==='i1')!),id:'path-own',ownerId:'jun',projectId:'p-onboarding',scope:'project'});
 const room:RecordOf<'pathVote'>={id:'path-response',kind:'pathVote',scope:'project',projectId:'p-onboarding',ownerId:'jun',revision:1,createdAt:now,updatedAt:now,
  data:{voteId:'vote-response',round:1,state:'open',openedAt:now,closedAt:null,endsAt:null,picks:{seo:{nickname:'서오',choice:'team'}}}};
 let s:State={workspace:w,records:[room]};
 s=await run(s,'jun',{type:'pickPath',projectId:'p-onboarding',pathId:room.id,nickname:'준',choice:'solo',ideaId:'path-own'});
 let updated=responseRecord(s,'pathVote',room.id);
 assert.deepEqual(updated.data.picks,{seo:{nickname:'서오',choice:'team'},jun:{nickname:'준',choice:'solo',ideaId:'path-own'}});
 assert.equal(updated.revision,2);
 s=await run(s,'jun',{type:'pickPath',projectId:'p-onboarding',pathId:room.id,nickname:'준',choice:'team'});
 updated=responseRecord(s,'pathVote',room.id);
 assert.deepEqual(updated.data.picks.jun,{nickname:'준',choice:'team'});
 assert.deepEqual(updated.data.picks.seo,room.data.picks.seo);
 assert.equal(updated.revision,3);
 updated.data.endsAt=new Date(Date.now()-1000).toISOString();
 const before=structuredClone(s);
 await assert.rejects(run(s,'seo',{type:'pickPath',projectId:'p-onboarding',pathId:room.id,nickname:'변경',choice:'team'}),/시간이 끝났/);
 assert.deepEqual(s,before);
});

test('join selection patches enforce the latest capacity and preserve choices when a competing pick fails',async()=>{
 const w=previewWorkspace(),now=new Date().toISOString();
 const board:RecordOf<'joinBoard'>={id:'join-response',kind:'joinBoard',scope:'project',projectId:'p-onboarding',ownerId:'jun',revision:1,createdAt:now,updatedAt:now,
  data:{pathId:'path-response',voteId:'vote-response',round:1,state:'open',openedAt:now,closedAt:null,endsAt:null,capacity:1,
   options:['join-a','join-b'].map(ideaId=>({ideaId,title:ideaId,problem:ideaId,ownerId:'jun'})),picks:{}}};
 let s:State={workspace:w,records:[board]};
 s=await run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId:board.id,ideaId:'join-a'});
 assert.equal(responseRecord(s,'joinBoard',board.id).data.picks.jun.ideaId,'join-a');
 // A second request resolved against the committed board cannot take the last occupied slot.
 const full=structuredClone(s);
 await assert.rejects(run(s,'seo',{type:'pickJoin',projectId:'p-onboarding',boardId:board.id,ideaId:'join-a'}),/정원/);
 assert.deepEqual(s,full);
 s=await run(s,'seo',{type:'pickJoin',projectId:'p-onboarding',boardId:board.id,ideaId:'join-b'});
 let updated=responseRecord(s,'joinBoard',board.id);
 assert.equal(updated.data.picks.jun.ideaId,'join-a');
 assert.equal(updated.data.picks.seo.ideaId,'join-b');
 const bothFull=structuredClone(s);
 await assert.rejects(run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId:board.id,ideaId:'join-b'}),/정원/);
 assert.deepEqual(s,bothFull);
 // Cancellation succeeds even when the selected option is full, freeing it for the next request.
 s=await run(s,'jun',{type:'pickJoin',projectId:'p-onboarding',boardId:board.id,ideaId:'join-a'});
 updated=responseRecord(s,'joinBoard',board.id);
 assert.equal(updated.data.picks.jun,undefined);
 assert.equal(updated.data.picks.seo.ideaId,'join-b');
 s=await run(s,'seo',{type:'pickJoin',projectId:'p-onboarding',boardId:board.id,ideaId:'join-a'});
 updated=responseRecord(s,'joinBoard',board.id);
 assert.deepEqual(Object.keys(updated.data.picks),['seo']);
 assert.equal(updated.data.picks.seo.ideaId,'join-a');
 assert.equal(updated.revision,5);
 assert.deepEqual(s.workspace.projects,w.projects);
 assert.deepEqual(s.workspace.members,w.members);
});
