import {z} from 'zod';
import {DomainError} from './policy';
import {answered} from './refinement';
import type {Idea,HistoryEvent,FeedbackContext,Comment} from './types';
export const feedbackContextSchema=z.object({stage:z.enum(['thought','questions','definition','ready']),revision:z.number().int().positive()});
export const exhibitionStages=[
 {id:'thought',name:'처음 생각',hint:'작은 경험과 막연한 생각'},
 {id:'questions',name:'경험 구체화',hint:'질문 세 개로 상황을 더 자세히'},
 {id:'definition',name:'문제정의 초안',hint:'초안 1·2와 바뀐 이유'},
 {id:'ready',name:'선정 준비',hint:'함께 풀 문제로 정리한 최신 카드'},
] as const;
export type Exhibit={idea:Idea;context:FeedbackContext;snapshot:HistoryEvent['snapshot'];reason:string;date:string};
export function feedbackLabel(context?:FeedbackContext){return context?`${exhibitionStages.find(s=>s.id===context.stage)?.name} · r${context.revision}`:'아이디어 전체';}
export function validateFeedbackContext(context:FeedbackContext,snapshot?:HistoryEvent['snapshot']){
 if(!snapshot)throw new DomainError('NOT_FOUND','피드백을 남길 버전을 찾을 수 없습니다.',404);
 const r=snapshot.refinement;
 if(context.stage==='questions'&&!answered(r)||context.stage==='definition'&&!r?.draft||context.stage==='ready'&&!r?.ready)throw new DomainError('INVALID_STAGE','해당 버전에 아직 작성되지 않은 단계입니다.',409);
}
// Each card points to the earliest saved snapshot of that content, so comments stay
// anchored when later events copy the same content (selection, scope changes, etc.).
export function buildExhibition(ideas:Idea[],events:HistoryEvent[],comments:Comment[]=[]):Exhibit[]{
 const result:Exhibit[]=[];
 for(const idea of ideas){
  const versions=events.filter(e=>e.ideaId===idea.id).sort((a,b)=>a.revision-b.revision);
  if(!versions.some(e=>e.revision===idea.revision))versions.push({id:'current-'+idea.id,ideaId:idea.id,title:'현재',reason:'현재 저장한 내용',actorId:idea.ownerId,createdAt:idea.updatedAt,revision:idea.revision,snapshot:idea});
  const seen=new Set<string>();
  for(const v of versions){
   const r=v.snapshot.refinement;
   const add=(stage:FeedbackContext['stage'],key:string)=>{if(seen.has(key)&&!comments.some(c=>c.ideaId===idea.id&&c.context?.stage===stage&&c.context.revision===v.revision))return;seen.add(key);result.push({idea,context:{stage,revision:v.revision},snapshot:v.snapshot,reason:v.reason,date:v.createdAt});};
   add('thought','t:'+JSON.stringify([v.snapshot.title,v.snapshot.body]));
   if(answered(r))add('questions','q:'+JSON.stringify(r!.answers));
   if(r?.draft)add('definition','d:'+r.draft);
   if(r?.ready&&idea.refinement?.ready&&r.draft===idea.refinement.draft)add('ready','r:'+r.draft);
  }
 }
 return result;
}
