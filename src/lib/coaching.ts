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
 body:'그 일은 언제, 어디서 있었나요? 무엇이 불편했는지 떠오르는 대로 말해주세요.',
 who:'이 일을 겪는 사람은 누구인가요? 나 자신이라면 "나"라고 해도 돼요.',
 whenWhere:'그 일은 언제 생기나요? 그때 무엇을 하려다 막혔나요?',
 workaround:'지금은 그럴 때 어떻게 넘기고 있나요? 그런 일이 얼마나 자주 있나요?',
 why:'그 일 때문에 무엇이 힘들거나 아쉬운가요? 시간, 기분, 놓친 기회 같은 것도 좋아요.',
 change:'이게 풀리면 그 사람은 어떻게 달라질까요? 만들 앱 말고 사람의 변화로 말해주세요.',
 focus:'4주 동안 어디까지 해볼까요? 작게 정할수록 좋아요.',
};
export function coachFields(phase:CoachPhase):CoachField[]{
 if(phase==='thought')return [{key:'title',label:'무슨 일이었나요?',hint:'한 줄 제목',max:120},{key:'body',label:'언제, 누구에게, 무엇이 불편했나요?',hint:'겪은 일',max:5000}];
 const src=phase==='questions'?questionFields:definitionFields;
 return src.map(([key,label,hint])=>({key,label,hint,max:700}));
}
export function coachQuestion(phase:CoachPhase,field:string){
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
 return {reply:'좋아요. 아래 내용을 "'+f.label+'" 칸에 넣을 수 있어요.'+(next?' 넣고 나면 다음 질문으로 넘어갈게요.':' 넣고 나면 모든 칸이 채워져요.'),suggestion:answer,needsMore:false,engine:'basic'};
}

// Problem card: after steps 2 and 3, the six answers become one sentence "[누가]는 [상황]에 [원인] 때문에 [어려움]을 겪는다".
export type CardInput={title:string;body:string;answers:Record<string,string>;definition:Record<string,string>};
export type CardReply={who:string;situation:string;cause:string;difficulty:string;engine:'ai'|'basic'};
export type CardAsk=(input:CardInput)=>Promise<CardReply>;
const short=z.string().max(700);
export const cardRequest=z.object({cohortId:id,kind:z.literal('card'),title:z.string().max(120),body:z.string().max(5000),answers:z.record(z.string().max(30),short),definition:z.record(z.string().max(30),short)}).strict();
export const cardOutput=z.object({who:z.string().min(1).max(200),situation:z.string().min(1).max(300),cause:z.string().min(1).max(300),difficulty:z.string().min(1).max(300)}).strict();
const clip=(v:string|undefined,n=120)=>(v||'').trim().split(/[.,\n]/)[0].replace(/(이에요|예요|에요|해요|어요|아요|요)$/,'').slice(0,n).trim();
// Without AI only the parts that can be copied safely are filled; the writer finishes cause and difficulty.
export function basicCard(i:CardInput):CardReply{
 return {who:clip(i.answers.who),situation:clip(i.answers.whenWhere),cause:'',difficulty:'',engine:'basic'};
}
