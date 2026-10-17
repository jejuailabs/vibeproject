"use client";
import {useState} from 'react';
import type {Idea,Command,Scope} from '@/lib/types';
import {questionFields,definitionFields,emptyRefinement,answered,refinementLabel,refinementText,statement,solutionHints,type Refinement} from '@/lib/refinement';
export function RefinementSummary({value}:{value?:Refinement}){
 if(!value)return null;
 return <details className="refinement-summary"><summary>질문 답변·문제정의 {value.draft?`초안 ${value.draft}`:''}{value.ready?' · 선정 준비':''}</summary><pre>{refinementText(value)}</pre></details>;
}
export function IdeaRefinement({idea,editable,hasProject,busy,error,run,activePanel,onPanelChange}:{idea:Idea;editable:boolean;hasProject:boolean;busy:boolean;error?:string;run:(c:Command)=>Promise<boolean>;activePanel?:'questions'|'definition';onPanelChange?:(panel:'questions'|'definition')=>void}){
 const [value,setValue]=useState<Refinement>(()=>structuredClone(idea.refinement||emptyRefinement()));
 const [base,setBase]=useState(idea.revision),[scope,setScope]=useState<Scope>(idea.scope);
 const [localPanel,setLocalPanel]=useState<'questions'|'definition'>(answered(idea.refinement)===5?'definition':'questions');
 const panel=activePanel||localPanel;
 function setPanel(next:'questions'|'definition'){setLocalPanel(next);onPanelChange?.(next);}
 const [reason,setReason]=useState(''),[saved,setSaved]=useState('');
 const conflict=base!==idea.revision, complete=answered(value)===5;
 const definitionComplete=definitionFields.every(([k])=>value.definition[k].trim())&&value.definition.solutionReviewed;
 const hint=solutionHints(value);
 function reload(){setValue(structuredClone(idea.refinement||emptyRefinement()));setBase(idea.revision);setScope(idea.scope);setReason('');setSaved('최신 저장본을 불러왔어요.');}
 async function save(phase:'questions'|'definition',ready=false,next=false){
  const input={answers:value.answers,definition:value.definition,ready};
  const why=reason.trim()||(idea.refinement?'':'첫 경험 구체화');
  if(!why)return;
  if(await run({type:'refineIdea',id:idea.id,revision:base,phase,input,reason:why,scope})){
   setBase(base+1);setReason('');
   setValue(v=>phase==='questions'?{...v,ready:false,definition:{...v.definition,solutionReviewed:false}}:{...v,ready,draft:v.draft+1});
   setSaved(ready?'선정 준비를 완료했어요. 전체 공유한 카드는 투표 후보로 사용할 수 있습니다.':phase==='questions'?'질문 답변을 저장했어요.':'새 초안을 저장했어요. 이전 초안은 변화 이력에 남아 있어요.');
   if(next)setPanel('definition');
  }
 }
 if(!editable)return <section className="refinement-read"><span className="refinement-badge">{refinementLabel(idea)}</span>{idea.refinement?.draft?<blockquote>{statement(idea.refinement)}</blockquote>:<p>작성자가 질문에 답하면서 문제를 구체화하고 있어요. 아래 의견으로 경험과 질문을 보태주세요.</p>}<RefinementSummary value={idea.refinement}/></section>;
 return <section className="refinement-editor" aria-label="생각 구체화와 문제정의">
  <header><span className="refinement-badge">{refinementLabel(idea)}</span><h3>이 생각을 문제로 다듬어볼까요?</h3><p>경험을 구체화하고, 해결 방법을 정하기 전에 문제를 한 문장으로 남겨요.</p></header>
  <nav aria-label="생각 다듬기 단계" hidden={!!activePanel}><button type="button" aria-pressed={panel==='questions'} onClick={()=>setPanel('questions')}>1. 경험 구체화 · {answered(value)}/5</button><button type="button" aria-pressed={panel==='definition'} disabled={answered(idea.refinement)!==5} onClick={()=>setPanel('definition')}>2. 문제정의카드</button></nav>
  {conflict&&<div role="alert" className="refinement-conflict">다른 변경이 먼저 저장됐어요. 입력은 유지했습니다. 최신 내용을 확인한 뒤 다시 작성해주세요.<button type="button" onClick={reload}>최신 저장본 불러오기</button></div>}
  <form onSubmit={e=>{e.preventDefault();void save(panel);}}>
   <fieldset disabled={busy||conflict}>
   {panel==='questions'?<><h4>막연한 생각 다음에, 실제 경험을 적어요.</h4><p>아는 만큼 저장하고 이어 써도 됩니다. 모르면 ‘확인 필요’라고 적어요.</p>{questionFields.map(([key,label,hint])=><label key={key}>{label}<textarea aria-label={label} rows={2} maxLength={700} value={value.answers[key]} placeholder={hint} onChange={e=>{setValue({...value,answers:{...value.answers,[key]:e.target.value},ready:false,definition:{...value.definition,solutionReviewed:false}});setSaved('');}}/><small>{hint}</small></label>)}</>:<>
    <h4>문제정의카드 · 다음 저장은 초안 {value.draft+1}</h4><p>앱 이름이나 만들 기능 대신, 사람이 겪는 상황과 어려움을 적어주세요. 해결 방법은 다음 단계에서 정합니다.</p>
    <div className="refinement-example">예: 처음 참석한 사람은 모임 시작 전 서로의 관심사를 알기 어려워 대화를 시작할 상대를 찾지 못한다.</div>
    {definitionFields.map(([key,label,hint],index)=><div key={key}>{index===2&&<h4>문제정의 문장 · 누가 / 어떤 상황에서 / 무엇 때문에 / 어떤 어려움</h4>}{index===6&&<><blockquote aria-label="문제정의 문장 미리보기">{statement(value)}</blockquote><h4>통제범위 체크</h4></>}<label>{label}<textarea aria-label={label} rows={2} maxLength={700} value={value.definition[key]} placeholder={hint} onChange={e=>{setValue({...value,definition:{...value.definition,[key]:e.target.value,solutionReviewed:false},ready:false});setSaved('');}}/></label></div>)}
    {hint&&<p className="refinement-hint" role="status">앱·기능을 미리 정한 표현이 있는지 살펴보세요. 해결 방법은 아직 열어두고, 사람이 겪는 어려움으로 표현해주세요. 초안은 저장할 수 있습니다.</p>}
    <label className="refinement-check"><input type="checkbox" checked={value.definition.solutionReviewed} onChange={e=>setValue({...value,definition:{...value.definition,solutionReviewed:e.target.checked}})}/>문장에 앱 이름이나 만들 기능을 넣어 해결책을 미리 정하지 않았는지 확인했습니다.</label>
   </>}
   <label>공개 범위<select aria-label="공개 범위" value={scope} onChange={e=>setScope(e.target.value as Scope)}><option value="owner">나만 보기</option><option value="cohort">기수 전체 · 선정에 참여</option><option value="project" disabled={!hasProject}>우리 팀</option></select><small>공개 범위를 바꾸면 이전 질문 답변·초안·댓글도 같은 범위에 공개됩니다.</small></label>
   <label>무엇 때문에 바꿨나요?<input maxLength={120} value={reason} required={!!idea.refinement} placeholder={idea.refinement?'동료 의견, 새로 확인한 경험, 범위를 좁힌 이유 등':'첫 저장은 비워도 됩니다.'} onChange={e=>setReason(e.target.value)}/></label>
   <div className="refinement-buttons"><button className="secondary-button" type="submit" disabled={busy||conflict||!!idea.refinement&&!reason.trim()}>{panel==='questions'?'답변 임시 저장':'초안 저장'}</button>{panel==='questions'?<button className="primary-button" type="button" disabled={!complete||busy||conflict||!!idea.refinement&&!reason.trim()} onClick={()=>save('questions',false,true)}>저장하고 문제정의로</button>:<button className="primary-button" type="button" disabled={!complete||!definitionComplete||busy||conflict||!!idea.refinement&&!reason.trim()} onClick={()=>save('definition',true)}>선정 준비 완료</button>}</div>
   {panel==='definition'&&scope!=='cohort'&&<p className="refinement-hint">투표에 참여하려면 공개 범위를 ‘기수 전체’로 바꿔주세요.</p>}
   </fieldset>
  </form>
  {error&&<p role="alert" className="refinement-conflict">{error}</p>}
  {saved&&<p className="refinement-saved" role="status">{saved}</p>}
  <RefinementSummary value={idea.refinement}/>
 </section>;
}
