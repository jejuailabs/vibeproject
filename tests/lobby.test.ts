import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace} from '../src/lib/preview';
import {previewWorkshop} from '../src/lib/workshop/memory';
import {projectIdsOf} from '../src/lib/policy';
import type {PreviewState, RecordOf} from '../src/lib/workshop/model';

type State=PreviewState&{result?:unknown};
const as=(s:State,uid:string):State=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
const run=(s:State,uid:string,command:unknown)=>previewWorkshop(as(s,uid),command);
const config=(s:State,id:string)=>s.records.find((r):r is RecordOf<'project'>=>r.kind==='project'&&r.projectId===id)!;
async function open(joinPolicy:'open'|'password'|'request',password?:string){
 const s=await run({workspace:previewWorkspace(),records:[]},'min',{type:'openProject',name:'동네 모임 길잡이',intro:'처음 온 사람이 어색하지 않게',capacity:4,joinPolicy,...(password?{password}:{})});
 return {s,id:(s.result as {id:string}).id};
}

test('any member opens a project as its leader without exposing join secrets',async()=>{
 const {s,id}=await open('password','abcd1234');
 const p=s.workspace.projects.find(x=>x.id===id)!;
 assert.equal(p.leaderId,'min');assert.deepEqual(p.memberIds,['min']);assert.equal(p.joinPolicy,'password');
 assert.equal(s.workspace.me.projectId,id);assert.deepEqual(projectIdsOf(s.workspace.me),[id]);
 assert.match(config(s,id).data.inviteCode!,/^[a-f0-9]{32}$/);
 assert.doesNotMatch(JSON.stringify(s.workspace)+JSON.stringify(s.records),/abcd1234|"hash"|"salt"/);
 await assert.rejects(run(s,'jun',{type:'openProject',name:'짧은 비번',intro:'',capacity:3,joinPolicy:'password',password:'12'}),/4자 이상/);
});

test('password join keeps other memberships and locks after repeated failures',async()=>{
 let {s,id}=await open('password','abcd1234');
 s=await run(s,'jun',{type:'enterProject',projectId:id,password:'wrong'});
 assert.equal((s.result as {denied:boolean}).denied,true);
 assert.ok(!s.workspace.projects.find(x=>x.id===id)!.memberIds.includes('jun'));
 s=await run(s,'jun',{type:'enterProject',projectId:id,password:'abcd1234'});
 const jun=s.workspace.members.find(m=>m.id==='jun')!;
 assert.deepEqual(projectIdsOf(jun).sort(),[id,'p-onboarding'].sort());assert.equal(jun.projectId,id);
 assert.ok(s.workspace.projects.find(x=>x.id===id)!.memberIds.includes('jun'));
 for(let n=0;n<5;n++)s=await run(s,'ha',{type:'enterProject',projectId:id,password:'nope'});
 await assert.rejects(run(s,'ha',{type:'enterProject',projectId:id,password:'abcd1234'}),/10분 뒤/);
});

test('invite links bypass the password while unknown codes and approval-only projects are refused',async()=>{
 let {s,id}=await open('password','abcd1234');
 await assert.rejects(run(s,'ha',{type:'enterProject',projectId:id,invite:'0'.repeat(32)}),/초대 링크/);
 s=await run(s,'ha',{type:'enterProject',projectId:id,invite:config(s,id).data.inviteCode});
 assert.ok(s.workspace.projects.find(x=>x.id===id)!.memberIds.includes('ha'));
 const approval=await open('request');
 await assert.rejects(run(approval.s,'jun',{type:'enterProject',projectId:approval.id}),/승인/);
 let a=await run(approval.s,'jun',{type:'join',projectId:approval.id,message:''});
 const request=a.records.find(r=>r.kind==='join'&&r.projectId===approval.id)!;
 a=await run(a,'min',{type:'resolveJoin',requestId:request.id,accept:true,reason:'함께해요'});
 assert.deepEqual(projectIdsOf(a.workspace.members.find(m=>m.id==='jun')!).sort(),[approval.id,'p-onboarding'].sort());
});

test('open projects respect capacity; leaving one project keeps the other active',async()=>{
 let {s,id}=await open('open');
 const small=await run(s,'jun',{type:'openProject',name:'둘이서',intro:'',capacity:2,joinPolicy:'open'});
 const smallId=(small.result as {id:string}).id;
 const filled=await run(small,'ha',{type:'enterProject',projectId:smallId});
 await assert.rejects(run(filled,'seo',{type:'enterProject',projectId:smallId}),/정원/);
 s=await run(s,'seo',{type:'enterProject',projectId:id});
 s=await run(s,'seo',{type:'leaveProject',projectId:id,reason:'다른 팀에 집중'});
 const seo=s.workspace.members.find(m=>m.id==='seo')!;
 assert.deepEqual(projectIdsOf(seo),['p-onboarding']);assert.equal(seo.projectId,'p-onboarding');
 await assert.rejects(run(s,'jun',{type:'projectAccess',projectId:id,joinPolicy:'password',password:'abcd1234',resetInvite:false}),/리더/);
 const before=config(s,id).data.inviteCode;
 s=await run(s,'min',{type:'projectAccess',projectId:id,joinPolicy:'open',resetInvite:true});
 assert.notEqual(config(s,id).data.inviteCode,before);
});
