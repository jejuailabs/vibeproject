import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace} from '../src/lib/preview';
import {previewWorkshop,rememberPreviewPhoto} from '../src/lib/workshop/memory';
import {characterFor} from '../src/lib/characters';
import type {PreviewState} from '../src/lib/workshop/model';

type State=PreviewState&{result?:unknown};
const as=(s:State,uid:string):State=>({...s,workspace:{...s.workspace,me:s.workspace.members.find(m=>m.id===uid)!}});
const run=(s:State,uid:string,command:unknown)=>previewWorkshop(as(s,uid),command);
const start=():State=>({workspace:previewWorkspace(),records:[]});

test('a member changes nickname and character, and every member list shows it',async()=>{
 const s=await run(start(),'jun',{type:'updateProfile',name:'  준호   메이커 ',avatar:'maker-graphite'});
 const jun=s.workspace.members.find(m=>m.id==='jun')!;
 assert.equal(jun.name,'준호 메이커');assert.equal(jun.avatar,'maker-graphite');
 assert.equal(characterFor(jun).id,'maker-graphite');
 // Leaving the image out keeps it.
 const again=await run(s,'jun',{type:'updateProfile',name:'준호'});
 assert.equal(again.workspace.members.find(m=>m.id==='jun')!.avatar,'maker-graphite');
});

test('nicknames are 1-20 characters and unique in the cohort, ignoring case',async()=>{
 await assert.rejects(run(start(),'jun',{type:'updateProfile',name:'   '}));
 await assert.rejects(run(start(),'jun',{type:'updateProfile',name:'가'.repeat(21)}));
 await assert.rejects(run(start(),'jun',{type:'updateProfile',name:'<b>'}));
 await assert.rejects(run(start(),'jun',{type:'updateProfile',name:'김민지'}),/이미 다른 사람이/);
 let s=await run(start(),'jun',{type:'updateProfile',name:'Maker'});
 await assert.rejects(run(s,'seo',{type:'updateProfile',name:'maker'}),/이미 다른 사람이/);
 // Keeping your own name is fine.
 s=await run(s,'jun',{type:'updateProfile',name:'Maker',avatar:'maker-mint'});
 assert.equal(s.workspace.members.find(m=>m.id==='jun')!.avatar,'maker-mint');
});

test('only the uploader can use an uploaded photo, which then becomes the avatar image',async()=>{
 const s=start(),url='blob:http://127.0.0.1/photo-1';
 const photo=rememberPreviewPhoto(s.workspace.cohort.id,'jun',url);
 await assert.rejects(run(s,'seo',{type:'updateProfile',name:'박서연',avatar:photo}),/찾을 수 없어요/);
 await assert.rejects(run(s,'jun',{type:'updateProfile',name:'이준호',avatar:'photo-00000000-0000-0000-0000-000000000000'}),/찾을 수 없어요/);
 await assert.rejects(run(s,'jun',{type:'updateProfile',name:'이준호',avatar:'https://evil.example/x.png'}));
 const next=await run(s,'jun',{type:'updateProfile',name:'이준호',avatar:photo});
 const jun=next.workspace.members.find(m=>m.id==='jun')!;
 assert.equal(jun.avatar,url);assert.equal(characterFor(jun).image,url);assert.equal(characterFor(jun).thumbnail,url);
});
