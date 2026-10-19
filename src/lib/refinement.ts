import {z} from 'zod';
import {DomainError} from './policy';
import type {Idea} from './types';
// Step 2: three plain questions about what happened. blocked/frequency stay in the schema for older cards.
export const questionFields = [
 ['who','누가 겪는 일인가요?','나 자신이어도 좋아요. 예: 동아리 모임에 처음 온 사람'],
 ['whenWhere','언제, 무엇을 하려다 막히나요?','그 순간을 떠올려 적어요. 예: 모임 시작 전에 말을 걸려다 머뭇거려요'],
 ['workaround','지금은 어떻게 넘기고 있나요? 얼마나 자주 그런가요?','그냥 참거나 포기하는 것도 답이에요. 모르면 "잘 모르겠어요"라고 적어요.'],
] as const;
// Step 3: three questions that turn the experience into a problem; the problem card sentence is drafted from all six answers.
export const definitionFields = [
 ['why','그래서 무엇이 힘들거나 아쉬운가요?','그 일 때문에 잃는 시간, 기분, 기회 등을 적어요.'],
 ['change','이게 풀리면 무엇이 달라질까요?','만들 앱이나 기능 말고, 사람이 어떻게 달라지는지 적어요.'],
 ['focus','4주 동안 어디까지 해볼까요?','작게 정해요. 예: 우리 동아리 첫 모임의 처음 10분'],
] as const;
export const sentenceFields = [
 ['who','누가','예: 동아리 모임에 처음 온 사람'],
 ['situation','어떤 상황에서','예: 모임 시작 전 자유 대화 시간'],
 ['cause','무엇 때문에','예: 서로의 관심사를 알 수 없어서'],
 ['difficulty','어떤 어려움','예: 먼저 말을 걸 상대를 찾지 못하는 어려움'],
] as const;
const text=z.string().trim().max(700);
export const answersSchema=z.object({who:text,whenWhere:text,blocked:text,workaround:text,frequency:text});
export const definitionSchema=z.object({why:text,change:text,who:text,situation:text,cause:text,difficulty:text,control:text,outside:text,focus:text,solutionReviewed:z.boolean()});
export const refinementInputSchema=z.object({answers:answersSchema,definition:definitionSchema,ready:z.boolean()});
export type RefinementInput=z.infer<typeof refinementInputSchema>;
export type Refinement=RefinementInput & {draft:number};
export const emptyRefinement=():Refinement=>({answers:{who:'',whenWhere:'',blocked:'',workaround:'',frequency:''},definition:{why:'',change:'',who:'',situation:'',cause:'',difficulty:'',control:'',outside:'',focus:'',solutionReviewed:false},ready:false,draft:0});
export const answered=(r?:Refinement)=>r?questionFields.filter(([k])=>r.answers[k].trim()).length:0;
function particle(text:string,closed:string,open:string){const code=text.charCodeAt(text.length-1)-0xac00;return text+(code>=0&&code<=11171&&code%28!==0?closed:open);}
export function statement(r:Refinement){const d=r.definition;const who=d.who||'[누가]',situation=d.situation||'[어떤 상황]',rawCause=d.cause.trim().replace(/\s*때문에$/,''),cause=rawCause?(/(서|아서|어서|여서)$/.test(rawCause)?rawCause:rawCause+' 때문에'):'[무엇] 때문에',difficulty=d.difficulty||'[어떤 어려움]';return `${particle(who,'은','는')} ${situation}${/(에서|에)$/.test(situation)?'':'에'} ${cause} ${particle(difficulty,'을','를')} 겪는다.`;}
export function refinementLabel(i:Pick<Idea,'refinement'>){const r=i.refinement;return r?.ready?'선정 준비':r?.draft?'문제정의 중':answered(r)?'구체화 중':'생각 남김';}
export function refinementAction(i:Idea){return i.state!=='shared'?'문제정의·이력 보기':i.refinement?.ready?'문제정의 다시 다듬기':answered(i.refinement)===questionFields.length?'문제정의 작성하기':'이 생각 구체화하기';}
export function assertProblemReady(i:Idea){if(!i.refinement?.ready)throw new DomainError('NOT_READY','경험 질문과 문제 카드를 완성해주세요.',409);}
// A reminder, not an AI judgment or a keyword-based save prohibition.
export function solutionHints(r:RefinementInput){const d=r.definition;return /앱|어플|플랫폼|챗봇|기능|시스템|서비스|매칭|알림|자동화|대시보드|추천|카카오|노션|구글|chatgpt|slack/i.test([d.who,d.situation,d.cause,d.difficulty].join(' '));}
export function nextRefinement(idea:Idea,phase:'questions'|'definition',raw:RefinementInput,reason:string):Refinement {
 const input=refinementInputSchema.parse(raw);
 if(!reason.trim())throw new DomainError('REASON','저장·변경 이유를 남겨주세요.');
 const old=idea.refinement||emptyRefinement();
 if(phase==='questions')return {...old,answers:input.answers,ready:false,definition:{...old.definition,solutionReviewed:false}};
 if(questionFields.some(([k])=>!input.answers[k]))throw new DomainError('QUESTIONS','먼저 경험 질문 세 개에 답해주세요. 모르는 내용은 "잘 모르겠어요"라고 적어도 됩니다.');
 if(input.ready&&[...definitionFields,...sentenceFields].some(([k])=>!input.definition[k]))throw new DomainError('DEFINITION','세 질문에 답하고 문제 카드 문장을 채워주세요.');
 return {...input,draft:old.draft+1};
}
const NL='\n';
export function refinementText(r?:Refinement){if(!r)return '';return [
 '경험 구체화',...questionFields.map(([k,label])=>label+NL+(r.answers[k]||'아직 작성하지 않음')),
 ...(r.draft?['문제 카드 초안 '+r.draft+' · '+(r.ready?'완성':'작성 중'),...definitionFields.map(([k,label])=>label+NL+(r.definition[k]||'아직 작성하지 않음')),'문제 한 문장'+NL+statement(r)]:[]),
].join(NL+NL);}
const or=(v:string|undefined)=>v?.trim()||'확인 필요';
/** The confirmed problem card written as the project's first planning document (docs/product.md). */
export function problemMarkdown(i:Idea){
 const r=i.refinement||emptyRefinement(),d=r.definition,a=r.answers;
 return ['# 문제와 사용자','','> '+statement(r),'',
  '## 누가, 언제, 무엇 때문에','- 누가: '+or(d.who),'- 어떤 상황에서: '+or(d.situation),'- 무엇 때문에: '+or(d.cause),'- 어떤 어려움: '+or(d.difficulty),'',
  '## 왜 문제인가',or(d.why),'',
  '## 해결되면 달라지는 것',or(d.change),'',
  '## 이번 4주 범위',or(d.focus),'',
  '## 출발한 경험','### '+i.title,i.body,'',...questionFields.map(([k,label])=>'- '+label+' '+or(a[k])),'',
  '## 성공 기준','- [ ] '+or(d.change).split(NL)[0]+' — 이 변화가 일어났는지 무엇으로 확인할지 팀이 정해요.','',
  '<!-- 확정 카드 '+i.id+' · r'+i.revision+' · 초안 '+r.draft+' -->',''].join(NL);
}
