import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspace,previewCommand} from '../src/lib/preview';
import {buildExhibition} from '../src/lib/exhibition';
import {emptyRefinement} from '../src/lib/refinement';
test('exhibition displays questions and definition versions without duplicating copied snapshots',()=>{
 let w=previewWorkspace();const first=w.ideas[0];
 let cards=buildExhibition([first],w.events);
 assert.equal(cards.filter(x=>x.context.stage==='thought').length,1);
 assert.equal(cards.filter(x=>x.context.stage==='questions').length,1);
 assert.equal(cards.find(x=>x.context.stage==='definition')?.snapshot.refinement?.draft,1);
 const input=structuredClone(first.refinement!);input.definition.focus='새 범위';
 w=previewCommand(w,{type:'refineIdea',id:first.id,revision:first.revision,phase:'definition',input,scope:'cohort',reason:'동료의 제안'});
 cards=buildExhibition([w.ideas[0]],w.events);
 assert.equal(cards.filter(x=>x.context.stage==='definition').length,2);
 assert.equal(cards.filter(x=>x.context.stage==='questions').length,1);
 assert.equal(cards.find(x=>x.context.stage==='ready')?.snapshot.refinement?.draft,2);
});
test('feedback remains attached to the older version and general comments keep working',()=>{
 let w=previewWorkspace(),idea=w.ideas[0];
 w=previewCommand({...w,me:w.members[2]},{type:'comment',ideaId:idea.id,body:'범위를 좁혀볼까요?',context:{stage:'definition',revision:2}});
 const input=structuredClone(idea.refinement!);input.definition.focus='시작 전 5분';
 w=previewCommand({...w,me:w.members[0]},{type:'refineIdea',id:idea.id,revision:idea.revision,phase:'definition',input,scope:'cohort',reason:'피드백 반영'});
 assert.equal(w.comments.at(-1)?.context?.revision,2);
 assert.equal(w.events.find(e=>e.ideaId===idea.id&&e.revision===2)?.snapshot.refinement?.draft,1);
 assert.doesNotThrow(()=>previewCommand(w,{type:'comment',ideaId:idea.id,body:'전체 의견'}));
});
test('feedback rejects nonexistent versions, incomplete stages, private cards and closed cards',()=>{
 const w=previewWorkspace(),id=w.ideas[0].id;
 assert.throws(()=>previewCommand(w,{type:'comment',ideaId:id,body:'test',context:{stage:'definition',revision:999}}),/버전/);
 assert.throws(()=>previewCommand(w,{type:'comment',ideaId:id,body:'test',context:{stage:'definition',revision:1}}),/단계/);
 w.ideas[0].scope='owner';assert.throws(()=>previewCommand({...w,me:w.members[2]},{type:'comment',ideaId:id,body:'test',context:{stage:'thought',revision:1}}),/권한/);
 w.ideas[0].state='closed_unselected';assert.throws(()=>previewCommand(w,{type:'comment',ideaId:id,body:'test',context:{stage:'thought',revision:1}}),/종료/);
});
test('loading older snapshots does not discard a previously commented duplicate card',()=>{
 const w=previewWorkspace(),i=w.ideas[0];
 const c={id:'feedback',ideaId:i.id,authorId:'seo',createdAt:'',body:'saved',context:{stage:'thought' as const,revision:2}};
 assert.ok(buildExhibition([i],w.events,[c]).some(x=>x.context.stage==='thought'&&x.context.revision===2));
});
