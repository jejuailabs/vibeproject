import {z} from 'zod';
import {questionFields,definitionFields} from './refinement';
// Step-by-step AI coach: asks one field at a time, turns a spoken-style answer into text for that field.
// The coach never saves anything; the writer applies a suggestion to the form and saves it themselves.
export type CoachPhase='thought'|'questions'|'definition';
export type CoachField={key:string;label:string;hint:string;max:number};
export type CoachTurn={role:'coach'|'me';text:string};
export type CoachReply={reply:string;suggestion:string;needsMore:boolean;engine:'ai'|'basic'};
export type CoachAsk=(input:CoachInput)=>Promise<CoachReply>;
export type CoachInput={phase:CoachPhase;field:string;action?:'open'|'answer';answer?:string;values:Record<string,string>;context:{title:string;body:string};history:CoachTurn[]};
const opening:Record<string,string>={
 title:'최근에 "아, 불편하다" 싶었던 일이 있었나요? 한 문장으로 말해주세요.',
 body:'그 일은 언제, 어디서 있었나요?',
 who:'이 일을 겪는 사람은 누구인가요? 나 자신이라면 "나"라고 해도 돼요.',
 whenWhere:'그 일은 주로 언제 생기나요? 그때 무엇을 하려고 했나요?',
 workaround:'지금은 그럴 때 어떻게 넘기고 있나요?',
 why:'그 일 때문에 무엇이 가장 힘들거나 아쉬운가요?',
 change:'이게 풀리면 그 사람은 어떻게 달라질까요?',
 focus:'4주 동안 어디까지 해볼까요? 작게 정할수록 좋아요.',
};
// What each field must contain before the coach moves on; the AI asks for the missing pieces one at a time.
export const fieldNeeds:Record<string,string[]>={
 title:['불편했던 일을 한 문장으로'],
 body:['언제, 어디서 있었던 일인지','누구와 있었거나 누구 때문이었는지','무엇이 구체적으로 불편했는지'],
 who:['이 일을 겪는 사람이 누구인지 (다른 사람을 말하지 않았으면 글쓴이 자신이고, 함께 겪은 사람이 있으면 같이 적는다. 예: "나와 친구")'],
 whenWhere:['그 일이 생기는 때나 상황','그때 무엇을 하려다 막혔는지'],
 workaround:['지금 어떻게 넘기고 있는지','얼마나 자주 그런지'],
 why:['그 일 때문에 무엇이 힘들거나 아쉬운지'],
 change:['풀리면 사람이 어떻게 달라지는지 (앱·기능이 아닌 사람의 변화)'],
 focus:['4주 동안 해볼 작은 범위'],
};
export function coachFields(phase:CoachPhase):CoachField[]{
 if(phase==='thought')return [{key:'title',label:'무슨 일이었나요?',hint:'한 문장',max:120},{key:'body',label:'언제, 누구에게, 무엇이 불편했나요?',hint:'겪은 일',max:5000}];
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
 cohortId:id,phase:z.enum(['thought','questions','definition']),field:z.string().max(30),action:z.enum(['open','answer']).default('answer'),answer:z.string().trim().max(2000).default(''),
 values:z.record(z.string().max(30),z.string().max(5000)),context:z.object({title:z.string().max(120),body:z.string().max(5000)}).strict(),
 history:z.array(z.object({role:z.enum(['coach','me']),text:z.string().max(2000)}).strict()).max(16),
}).strict().refine(r=>coachFields(r.phase).some(f=>f.key===r.field),{message:'field'}).refine(r=>r.action==='open'||r.answer.length>0,{message:'answer'});
export const coachOutput=z.object({reply:z.string().min(1).max(600),suggestion:z.string().max(5000),needsMore:z.boolean()}).strict();
// Used when no AI key is configured (and in preview): keeps the question flow, uses the writer's words as-is.
export function basicCoach(input:Pick<CoachInput,'phase'|'field'|'answer'|'values'|'action'>):CoachReply{
 const f=coachFields(input.phase).find(f=>f.key===input.field)!;
 if(input.action==='open')return {reply:coachQuestion(input.phase,f.key),suggestion:'',needsMore:true,engine:'basic'};
 const answer=(input.answer||'').trim().slice(0,f.max);
 if(answer.length<4)return {reply:'조금만 더 자세히 말해줄래요? '+(f.hint||''),suggestion:'',needsMore:true,engine:'basic'};
 return {reply:'좋아요, 칸에 넣었어요.',suggestion:answer,needsMore:false,engine:'basic'};
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

// One-shot draft: a long rough text and/or files become steps 1–3 and the problem card at once.
// Whatever the material does not cover comes back as easy follow-up questions; answering them redrafts.
export const draftKeys=['title','body','who','whenWhere','workaround','why','change','focus','sWho','situation','cause','difficulty'] as const;
export type DraftKey=(typeof draftKeys)[number];
export type DraftFields=Record<DraftKey,string>;
export type DraftFile={name:string;type:string;data:string};
export type DraftInput={text:string;files:DraftFile[];current?:DraftFields;answers?:{field:DraftKey;question:string;answer:string}[]};
export type DraftReply={fields:DraftFields;missing:{field:DraftKey;question:string}[];engine:'ai'|'basic'};
export type DraftAsk=(input:DraftInput)=>Promise<DraftReply>;
export const draftFileTypes=['application/pdf','image/png','image/jpeg','image/webp'];
export const DRAFT_FILE_BYTES=3_000_000;
const fieldsShape=Object.fromEntries(draftKeys.map(k=>[k,z.string().max(k==='body'?3000:700)])) as Record<DraftKey,z.ZodString>;
export const draftRequest=z.object({
 cohortId:id,kind:z.literal('draft'),text:z.string().max(20000),
 files:z.array(z.object({name:z.string().max(200),type:z.enum(draftFileTypes as [string,...string[]]),data:z.string().max(4_200_000)}).strict()).max(3),
 current:z.object(fieldsShape).strict().optional(),
 answers:z.array(z.object({field:z.enum(draftKeys),question:z.string().max(500),answer:z.string().max(2000)}).strict()).max(12).optional(),
}).strict().refine(r=>r.text.trim().length>0||r.files.length>0||!!r.answers?.length,{message:'empty'});
export const draftOutput=z.object({...fieldsShape,missing:z.array(z.object({field:z.enum(draftKeys),question:z.string().max(300)}).strict()).max(6)}).strict();
export const emptyDraft=():DraftFields=>Object.fromEntries(draftKeys.map(k=>[k,'']))as DraftFields;
// Without AI the text becomes the first thought, and every other part is asked for.
export function basicDraft(i:Pick<DraftInput,'text'|'current'|'answers'>):DraftReply{
 const f={...emptyDraft(),...i.current};
 for(const a of i.answers||[])if(a.answer.trim())f[a.field]=a.answer.trim();
 if(!f.body&&i.text.trim()){f.body=i.text.trim().slice(0,3000);f.title=clip(i.text,60);}
 const ask:{field:DraftKey;question:string}[]=([['who','이 일을 겪는 사람은 누구인가요?'],['whenWhere','그 일은 언제, 무엇을 하려다 막히나요?'],['workaround','지금은 어떻게 넘기고 있나요?'],['why','그래서 무엇이 힘들거나 아쉬운가요?'],['change','이게 풀리면 무엇이 달라질까요?'],['focus','4주 동안 어디까지 해볼까요?']] as const).filter(([k])=>!f[k]).map(([field,question])=>({field,question}));
 return {fields:f,missing:ask.slice(0,4),engine:'basic'};
}
