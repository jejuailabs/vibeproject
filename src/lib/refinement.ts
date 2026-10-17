import {z} from 'zod';
import {DomainError} from './policy';
import type {Idea} from './types';
export const questionFields = [
 ['who','누가 겪나요?','실제로 겪는 사람을 구체적으로 적어요.'],
 ['whenWhere','언제, 어디서 일어나나요?','그 일이 발생한 상황과 장소를 적어요.'],
 ['blocked','그 순간 무엇을 하려다 막히나요?','하려던 행동과 막힌 지점을 적어요.'],
 ['workaround','지금은 어떻게 해결하고 있나요?','임시방편, 도움을 받는 방법, 포기하는 경우도 좋아요. 기존에 쓰는 앱 이름은 여기에 적어도 됩니다.'],
 ['frequency','얼마나 자주 일어나나요?','매번·매주·특정 상황 등 경험을 적어요. 모르면 확인 필요로 남겨요.'],
] as const;
export const definitionFields = [
 ['why','왜 그게 문제인가요?','그 상황 때문에 발생하는 불편·손실·어려움을 적어요.'],
 ['change','해결되면 무엇이 달라지나요?','만들 기능 대신 사람의 행동과 경험에서 달라지는 점을 적어요.'],
 ['who','누가','예: 모임에 처음 참석한 사람'],
 ['situation','어떤 상황에서','예: 모임 시작 전 자유 대화 시간에'],
 ['cause','무엇 때문에','예: 서로의 관심사를 알기 어려워서'],
 ['difficulty','어떤 어려움','예: 대화를 시작할 상대를 찾지 못하는 어려움'],
 ['control','우리가 직접 바꿀 수 있는 부분','영향을 줄 수 있는 상황과 조건을 적어요.'],
 ['outside','협조가 필요하거나 바꾸기 어려운 부분','사람·기관의 협조 등. 없으면 없다고 적어요.'],
 ['focus','이번 4주에서 다룰 범위','작게 확인하고 개선할 부분을 정해요.'],
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
export function statement(r:Refinement){const d=r.definition;const who=d.who||'[누가]',situation=d.situation||'[어떤 상황]',cause=d.cause.replace(/\s*때문에$/,'')||'[무엇]',difficulty=d.difficulty||'[어떤 어려움]';return `${particle(who,'은','는')} ${situation}${/(에서|에)$/.test(situation)?'':'에'} ${cause} 때문에 ${particle(difficulty,'을','를')} 겪는다.`;}
export function refinementLabel(i:Pick<Idea,'refinement'>){const r=i.refinement;return r?.ready?'선정 준비':r?.draft?'문제정의 중':answered(r)?'구체화 중':'생각 남김';}
export function refinementAction(i:Idea){return i.state!=='shared'?'문제정의·이력 보기':i.refinement?.ready?'문제정의 다시 다듬기':answered(i.refinement)===5?'문제정의 작성하기':'이 생각 구체화하기';}
export function assertProblemReady(i:Idea){if(!i.refinement?.ready)throw new DomainError('NOT_READY','다섯 질문과 문제정의카드를 작성하고 선정 준비를 완료해주세요.',409);}
// A reminder, not an AI judgment or a keyword-based save prohibition.
export function solutionHints(r:RefinementInput){const d=r.definition;return /앱|어플|플랫폼|챗봇|기능|시스템|서비스|매칭|알림|자동화|대시보드|추천|카카오|노션|구글|chatgpt|slack/i.test([d.who,d.situation,d.cause,d.difficulty].join(' '));}
export function nextRefinement(idea:Idea,phase:'questions'|'definition',raw:RefinementInput,reason:string):Refinement {
 const input=refinementInputSchema.parse(raw);
 if(!reason.trim())throw new DomainError('REASON','저장·변경 이유를 남겨주세요.');
 const old=idea.refinement||emptyRefinement();
 if(phase==='questions')return {...old,answers:input.answers,ready:false,definition:{...old.definition,solutionReviewed:false}};
 if(questionFields.some(([k])=>!input.answers[k]))throw new DomainError('QUESTIONS','먼저 다섯 질문에 답해주세요. 모르는 내용은 확인 필요로 남겨도 됩니다.');
 if(input.ready&&(definitionFields.some(([k])=>!input.definition[k])||!input.definition.solutionReviewed))throw new DomainError('DEFINITION','문제정의와 통제범위를 채우고 해결책을 미리 정하지 않았는지 확인해주세요.');
 return {...input,draft:old.draft+1};
}
export function refinementText(r?:Refinement){if(!r)return '';return [
 '경험 구체화',...questionFields.map(([k,label])=>label+'\n'+(r.answers[k]||'아직 작성하지 않음')),
 ...(r.draft?['문제정의 초안 '+r.draft+' · '+(r.ready?'선정 준비':'작성 중'),...definitionFields.map(([k,label])=>label+'\n'+(r.definition[k]||'아직 작성하지 않음')),'문제정의 문장\n'+statement(r)]:[]),
].join('\n\n');}
export function problemMarkdown(i:Idea){return '# 문제와 사용자\n\n## 출발한 생각\n'+i.title+'\n\n'+i.body+'\n\n## 문제정의 근거 · '+i.id+' · r'+i.revision+'\n'+refinementText(i.refinement)+'\n\n## 성공 기준\n어떤 변화로 해결 여부를 확인할까요?\n';}
