import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadIdea, assertEditable, assertChannel, validateSelection } from '../src/lib/policy';
import type {Idea,Member} from '../src/lib/types';
const member:Member={id:'a',name:'A',avatar:'',role:'participant',projectId:'p1',active:true};
const idea:Idea={id:'i',title:'idea',body:'body',kind:'thought',ownerId:'a',scope:'owner',projectId:null,state:'shared',revision:2,version:2,createdAt:'',updatedAt:''};
test('private thoughts stay private even for cohort administrators',()=>{
 assert.equal(canReadIdea(member,idea),true);
 assert.equal(canReadIdea({...member,id:'admin',role:'admin'},idea),false);
});
test('team thoughts require the same project',()=>{
 const team={...idea,scope:'project' as const,projectId:'p1'};
 assert.equal(canReadIdea({...member,id:'b'},team),true);
 assert.equal(canReadIdea({...member,id:'c',projectId:'p2'},team),false);
});
test('inactive membership removes read access',()=>assert.equal(canReadIdea({...member,active:false},idea),false));
test('stale edits cannot overwrite a newer revision',()=>assert.throws(()=>assertEditable(member,idea,1),/다른 변경/));
test('selected source ideas are immutable',()=>assert.throws(()=>assertEditable(member,{...idea,state:'selected'},2),/원본/));
test('project channels reject non-members including administrators',()=>assert.throws(()=>assertChannel({...member,role:'admin'},'p2'),/대화방/));
test('only admin can select a shared cohort idea',()=>{
 assert.throws(()=>validateSelection(member,{...idea,scope:'cohort'},2,{...member,projectId:null}),/관리자/);
 assert.doesNotThrow(()=>validateSelection({...member,role:'admin'},{...idea,scope:'cohort'},2,{...member,projectId:null}));
});
test('selection cannot create a second active project for the author',()=>assert.throws(()=>validateSelection({...member,role:'admin'},{...idea,scope:'cohort'},2,member),/이미/));
