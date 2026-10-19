import {z} from 'zod';
import {questionFields,definitionFields} from './refinement';
// Step-by-step AI coach: asks one field at a time, turns a spoken-style answer into text for that field.
// The coach never saves anything; the writer applies a suggestion to the form and saves it themselves.
export type CoachPhase='thought'|'questions'|'definition';
export type CoachField={key:string;label:string;hint:string;max:number};
export type CoachTurn={role:'coach'|'me';text:string};
export type CoachReply={reply:string;suggestion:string;needsMore:boolean;engine:'ai'|'basic'};
export type CoachAsk=(input:CoachInput)=>Promise<CoachReply>;
export type CoachInput={phase:CoachPhase;field:string;answer:string;values:Record<string,string>;context:{title:string;body:string};history:CoachTurn[]};
const opening:Record<string,string>={
 title:'최근에 "아, 불편하다" 싶었던 순간이 있었나요? 한 줄로 편하게 말해주세요.',
 body:'그 일은 언제, 어디서, 누구와 있을 때 일어났나요? 그때 무엇이 불편했는지 떠오르는 대로 말해주세요.',
 who:'이 불편을 실제로 겪는 사람은 누구인가요? 나 자신이라면 어떤 상황의 나인지 말해주세요.',
 whenWhere:'그 일은 주로 언제, 어디서 일어나나요?',
 blocked:'그 순간 무엇을 하려고 했고, 어디서 막혔나요?',
 workaround:'지금은 그 상황을 어떻게 넘기고 있나요? 포기하는 것도 답이 될 수 있어요.',
 frequency:'이런 일이 얼마나 자주 있나요? 정확히 모르면 짐작이나 "확인 필요"도 괜찮아요.',
 why:'그 상황 때문에 무엇을 잃거나 힘들어지나요?',
 change:'이 문제가 풀리면 그 사람의 하루나 행동이 어떻게 달라질까요? 만들 기능 말고 사람의 변화로 말해주세요.',
 situation:'문제정의 문장에 들어갈 "어떤 상황에서"를 정해볼게요. 그 어려움이 생기는 순간을 짧게 말해주세요.',
 cause:'그 어려움은 무엇 때문에 생기나요? 원인이라고 생각하는 것을 말해주세요.',
 difficulty:'결국 그 사람이 겪는 어려움을 한마디로 하면 무엇인가요?',
 control:'이 중에서 우리가 직접 바꿔볼 수 있는 부분은 무엇인가요?',
 outside:'다른 사람이나 기관의 협조가 필요하거나 우리가 바꾸기 어려운 부분은 무엇인가요? 없으면 없다고 말해주세요.',
 focus:'4주 동안 이 중 어디까지를 작게 확인해볼까요?',
};
export function coachFields(phase:CoachPhase):CoachField[]{
 if(phase==='thought')return [{key:'title',label:'무슨 일이었나요?',hint:'한 줄 제목',max:120},{key:'body',label:'언제, 누구에게, 무엇이 불편했나요?',hint:'겪은 일',max:5000}];
 const src=phase==='questions'?questionFields:definitionFields;
 return src.map(([key,label,hint])=>({key,label,hint,max:700}));
}
export function coachQuestion(phase:CoachPhase,field:string){
 if(phase==='definition'&&field==='who')return '문제정의 문장의 "누가"를 정해볼게요. 이 어려움을 겪는 사람을 구체적으로 말해주세요.';
 return opening[field]||coachFields(phase).find(f=>f.key===field)?.label||'';
}
export function nextOpenField(phase:CoachPhase,values:Record<string,string>,after?:string){
 const fs=coachFields(phase),start=after?fs.findIndex(f=>f.key===after)+1:0;
 return [...fs.slice(start),...fs.slice(0,start)].find(f=>f.key!==after&&!values[f.key]?.trim())?.key||null;
}
const id=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const coachRequest=z.object({
 cohortId:id,phase:z.enum(['thought','questions','definition']),field:z.string().max(30),answer:z.string().trim().min(1).max(2000),
 values:z.record(z.string().max(30),z.string().max(5000)),context:z.object({title:z.string().max(120),body:z.string().max(5000)}).strict(),
 history:z.array(z.object({role:z.enum(['coach','me']),text:z.string().max(2000)}).strict()).max(12),
}).strict().refine(r=>coachFields(r.phase).some(f=>f.key===r.field),{message:'field'});
export const coachOutput=z.object({reply:z.string().min(1).max(600),suggestion:z.string().max(5000),needsMore:z.boolean()}).strict();
// Used when no AI key is configured (and in preview): keeps the question flow, uses the writer's words as-is.
export function basicCoach(input:Pick<CoachInput,'phase'|'field'|'answer'|'values'>):CoachReply{
 const f=coachFields(input.phase).find(f=>f.key===input.field)!,answer=input.answer.trim().slice(0,f.max);
 if(answer.length<4)return {reply:'조금만 더 구체적으로 말해줄래요? '+(f.hint||''),suggestion:'',needsMore:true,engine:'basic'};
 const next=nextOpenField(input.phase,{...input.values,[f.key]:answer},f.key);
 return {reply:'좋아요. 아래 내용을 "'+f.label+'" 칸에 넣을 수 있어요.'+(next?' 넣고 나면 다음 질문으로 넘어갈게요.':' 넣고 나면 모든 칸이 채워져요. 확인하고 저장해주세요.'),suggestion:answer,needsMore:false,engine:'basic'};
}
