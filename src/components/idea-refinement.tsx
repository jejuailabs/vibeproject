"use client";
import {useState} from 'react';
import {LoaderCircle,Sparkles} from 'lucide-react';
import type {Idea,Command,Scope,Member} from '@/lib/types';
import type {CardAsk,CoachAsk} from '@/lib/coaching';
import {AICoach} from './ai-coach';
import {CardPreview,ProblemCard,RefinementView} from './card-view';
import {questionFields,definitionFields,sentenceFields,emptyRefinement,answered,refinementLabel,statement,solutionHints,type Refinement} from '@/lib/refinement';
export function RefinementSummary({value}:{value?:Refinement}){
 if(!value)return null;
 return <details className="refinement-summary"><summary>마지막으로 저장한 내용 {value.draft?`· 초안 ${value.draft}`:''}{value.ready?' · 완성':''}</summary><RefinementView value={value}/></details>;
}
type Panel='questions'|'definition';
export function IdeaRefinement({idea,editable,hasProject,busy,error,run,activePanel,onPanelChange,teamOnly,coach,makeCard,aiEnabled,owner}:{idea:Idea;editable:boolean;hasProject:boolean;busy:boolean;error?:string;run:(c:Command)=>Promise<boolean>;activePanel?:Panel;onPanelChange?:(panel:Panel)=>void;teamOnly?:boolean;coach?:CoachAsk;makeCard?:CardAsk;aiEnabled?:boolean;owner?:Member}){
 const [value,setValue]=useState<Refinement>(()=>structuredClone(idea.refinement||emptyRefinement()));
 const [base,setBase]=useState(idea.revision),[scope,setScope]=useState<Scope>(idea.scope);
 const [localPanel,setLocalPanel]=useState<Panel>(answered(idea.refinement)===questionFields.length?'definition':'questions');
 const panel=activePanel||localPanel;
 function setPanel(next:Panel){setLocalPanel(next);onPanelChange?.(next);}
 const [saved,setSaved]=useState(''),[making,setMaking]=useState(false),[cardNote,setCardNote]=useState('');
 const conflict=base!==idea.revision, complete=answered(value)===questionFields.length;
 const asked=definitionFields.every(([k])=>value.definition[k].trim());
 const sentence=sentenceFields.every(([k])=>value.definition[k].trim());
 const hint=solutionHints(value);
 function reload(){setValue(structuredClone(idea.refinement||emptyRefinement()));setBase(idea.revision);setScope(idea.scope);setSaved('최신 저장본을 불러왔어요.');}
 const setAnswer=(k:string,t:string)=>{setSaved('');setValue(v=>({...v,answers:{...v.answers,[k]:t},ready:false}));};
 const setDef=(k:string,t:string)=>{setSaved('');setValue(v=>({...v,definition:{...v.definition,[k]:t},ready:false}));};
 async function save(phase:Panel,ready=false,next=false){
  // A change reason is kept in the history; members are not asked to type one.
  const reason=idea.refinement?(phase==='questions'?'경험 답변 수정':ready?'문제 카드 완성':'문제 카드 임시 저장'):'첫 경험 구체화';
  const input={answers:value.answers,definition:{...value.definition,solutionReviewed:ready||value.definition.solutionReviewed},ready};
  if(await run({type:'refineIdea',id:idea.id,revision:base,phase,input,reason,scope})){
   setBase(base+1);
   setValue(v=>phase==='questions'?{...v,ready:false}:{...v,ready,draft:v.draft+1});
   setSaved(ready?'문제 카드를 완성했어요. "최종 아이디어·투표" 보드에 올라갑니다.':phase==='questions'?'답변을 저장했어요.':'임시 저장했어요.');
   if(next)setPanel('definition');
  }
 }
 async function draftCard(){
  if(!makeCard)return;
  setMaking(true);setCardNote('');
  try{
   const r=await makeCard({title:idea.title,body:idea.body,answers:{...value.answers},definition:Object.fromEntries(definitionFields.map(([k])=>[k,value.definition[k]]))});
   setValue(v=>({...v,ready:false,definition:{...v.definition,who:r.who,situation:r.situation,cause:r.cause,difficulty:r.difficulty}}));
   setCardNote(r.engine==='ai'?'AI가 답변을 모아 문장을 만들었어요. 어색한 부분은 아래에서 고쳐주세요.':'AI 키가 설정되지 않아 "누가"와 "어떤 상황에서"만 채웠어요. 나머지 두 칸을 짧게 적어주세요.');
  }catch(e){setCardNote(e instanceof Error?e.message:'문제 카드를 만들지 못했어요.');}
  finally{setMaking(false);}
 }
 if(!editable)return <section className="refinement-read"><span className="refinement-badge">{refinementLabel(idea)}</span>{idea.refinement?<RefinementView value={idea.refinement}/>:<p>작성자가 질문에 답하면서 문제를 구체화하고 있어요. 아래 의견으로 경험과 질문을 보태주세요.</p>}</section>;
 const fields=panel==='questions'?questionFields:definitionFields;
 // What the earlier steps said: shown above the form and handed to the coach so it continues from there.
 const NL=String.fromCharCode(10);
 const earlier=questionFields.filter(([k])=>value.answers[k].trim()).map(([k,label])=>label+' '+value.answers[k].trim()).join(NL);
 const coachContext={title:idea.title,body:(panel==='definition'&&earlier?idea.body+NL+NL+'[2단계에서 답한 내용]'+NL+earlier:idea.body).slice(0,5000)};
 return <section className="refinement-editor" aria-label="생각 구체화와 문제정의">
  <header><span className="refinement-badge">{refinementLabel(idea)}</span><h3>이 생각을 문제로 다듬어볼까요?</h3><p>질문 세 개씩만 답하면 AI가 문제 카드로 정리해줘요.</p></header>
  <nav aria-label="생각 다듬기 단계" hidden={!!activePanel}><button type="button" aria-pressed={panel==='questions'} onClick={()=>setPanel('questions')}>1. 경험 · {answered(value)}/{questionFields.length}</button><button type="button" aria-pressed={panel==='definition'} disabled={answered(idea.refinement)!==questionFields.length} onClick={()=>setPanel('definition')}>2. 문제 카드</button></nav>
  {conflict&&<div role="alert" className="refinement-conflict">다른 변경이 먼저 저장됐어요. 입력은 유지했습니다. 최신 내용을 확인한 뒤 다시 작성해주세요.<button type="button" onClick={reload}>최신 저장본 불러오기</button></div>}
  <div className="carry" aria-label="앞 단계에서 쓴 내용">
   <span>1단계 · 내 생각</span><strong>{idea.title}</strong><p>{idea.body}</p>
   {panel==='definition'&&earlier&&<><span>2단계 · 경험</span><dl>{questionFields.map(([k,label])=>value.answers[k].trim()?<div key={k}><dt>{label}</dt><dd>{value.answers[k]}</dd></div>:null)}</dl></>}
  </div>
  <div className={coach?'write-grid':''}>
  <form onSubmit={e=>{e.preventDefault();void save(panel);}}>
   <fieldset disabled={busy||conflict}>
   <h4>{panel==='questions'?'겪은 일을 세 가지만 물어볼게요':'문제를 정리하는 질문 세 가지'}</h4>
   <p>{panel==='questions'?'아는 만큼만 적어도 돼요. 모르면 "잘 모르겠어요"라고 적어요.':'답하고 나면 AI가 여섯 답변을 모아 문제 카드 한 장으로 만들어줘요.'}</p>
   {fields.map(([key,label,hint],n)=><label key={key}><span className="refinement-q">{n+1}</span>{label}<textarea aria-label={label} rows={2} maxLength={700} value={panel==='questions'?value.answers[key as keyof Refinement['answers']]:value.definition[key as keyof Refinement['definition']] as string} placeholder={hint} onChange={e=>panel==='questions'?setAnswer(key,e.target.value):setDef(key,e.target.value)}/></label>)}
   {panel==='definition'&&<div className="problem-card-maker">
    <div className="problem-card-head"><strong>문제 카드</strong><button type="button" className="secondary-button" disabled={!makeCard||!asked||!complete||making} onClick={draftCard}>{making?<LoaderCircle className="spin" size={14}/>:<Sparkles size={14}/>} {sentence?'AI로 다시 만들기':'AI로 문제 카드 만들기'}</button></div>
    {sentence?<ProblemCard value={value} member={owner} mine origin={idea.title}/>:<p className="problem-card-empty">{!asked?'위 세 질문에 먼저 답해주세요.':sentenceFields.some(([k])=>value.definition[k].trim())?'아래 빈칸을 채우면 문제 한 문장이 완성돼요.':'버튼을 누르면 AI가 문제 한 문장을 만들어줘요.'}</p>}
    {cardNote&&<p className="problem-card-note" role="status">{cardNote}</p>}
    {(sentence||sentenceFields.some(([k])=>value.definition[k].trim()))&&<details className="problem-card-edit" open={!sentence}><summary>문장 직접 고치기</summary><div>{sentenceFields.map(([key,label,hint])=><label key={key}>{label}<input aria-label={label} maxLength={300} value={value.definition[key]} placeholder={hint} onChange={e=>setDef(key,e.target.value)}/></label>)}</div></details>}
    {hint&&sentence&&<p className="refinement-hint" role="status">문장에 앱·기능 이름이 들어 있어요. 해결 방법은 나중에 정하고, 사람이 겪는 어려움으로 적어주세요.</p>}
   </div>}
   {!teamOnly&&<label>공개 범위<select aria-label="공개 범위" value={scope} onChange={e=>setScope(e.target.value as Scope)}><option value="owner">나만 보기</option><option value="cohort">기수 전체 · 선정에 참여</option><option value="project" disabled={!hasProject}>우리 팀</option></select></label>}
   <div className="refinement-buttons"><button className="secondary-button" type="submit" disabled={busy||conflict}>{panel==='questions'?'저장':'임시 저장'}</button>{panel==='questions'?<button className="primary-button" type="button" disabled={!complete||busy||conflict} onClick={()=>save('questions',false,true)}>저장하고 다음 단계로</button>:<button className="primary-button" type="button" disabled={!complete||!asked||!sentence||busy||conflict} onClick={()=>save('definition',true)}>문제 카드 완성</button>}</div>
   </fieldset>
  </form>
  {coach&&<div className="write-aside">
   <AICoach key={idea.id+panel} phase={panel} ask={coach} aiEnabled={aiEnabled} disabled={busy||conflict} context={coachContext}
    values={panel==='questions'?Object.fromEntries(questionFields.map(([k])=>[k,value.answers[k]])):Object.fromEntries(definitionFields.map(([k])=>[k,value.definition[k]]))}
    onApply={(k,t)=>panel==='questions'?setAnswer(k,t):setDef(k,t)}/>
   <CardPreview phase={panel} member={owner} title={idea.title} refinement={value}/>
  </div>}
  </div>
  {error&&<p role="alert" className="refinement-conflict">{error}</p>}
  {saved&&<p className="refinement-saved" role="status">{saved}</p>}
  {!teamOnly&&<RefinementSummary value={idea.refinement}/>}
 </section>;
}
