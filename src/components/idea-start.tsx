"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,Lock,Plus} from 'lucide-react';
import {IdeaRefinement} from './idea-refinement';
import {answered,questionFields} from '@/lib/refinement';
import type {Command,Workspace} from '@/lib/types';
import type {CoachAsk} from '@/lib/coaching';
import {AICoach} from './ai-coach';
import {CardPreview} from './card-view';
type Stage='thought'|'questions'|'definition';
type Props={workspace:Workspace;busy:boolean;ended:boolean;scope:'me'|'cohort'|'project';startRequest:number;coach?:CoachAsk;aiEnabled?:boolean;onIdea:(id:string)=>void;save:(c:Command,onResult?:(result:{id?:string})=>void)=>Promise<boolean>};
export function IdeaStart(p:Props){
 const [id,setId]=useState(''),[stage,setStage]=useState<Stage>('thought'),[title,setTitle]=useState(''),[body,setBody]=useState(''),[privateNote,setPrivateNote]=useState(false),[saved,setSaved]=useState(false);
 const section=useRef<HTMLElement>(null), me=p.workspace.me;
 const own=p.workspace.ideas.filter(i=>i.ownerId===me.id&&i.state==='shared');
 const idea=own.find(i=>i.id===id);
 function fresh(){setId('');setStage('thought');setSaved(false);}
 useEffect(()=>{if(p.startRequest){fresh();section.current?.scrollIntoView({block:'start',behavior:'smooth'});}},[p.startRequest]);
 function resume(value:string){setId(value);setSaved(false);const item=own.find(i=>i.id===value);setStage(item?(answered(item.refinement)===5?'definition':'questions'):'thought');}
 return <section ref={section} id="idea-start" className="idea-start" aria-label="프로젝트 시작 입력">
  <header className="start-heading"><div><span className="journey-kicker">여기서 시작해요</span><h2>어떤 순간이 불편했나요?</h2><p>생각을 저장하면 다섯 질문으로 이어집니다. 저장한 단계는 아래 보드에 전시됩니다.</p></div>{own.length>0&&<label>작성 중인 생각 이어쓰기<select aria-label="작성 중인 생각 이어쓰기" value={id} disabled={p.busy} onChange={e=>resume(e.target.value)}><option value="">새 생각 작성</option>{own.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>}</header>
  <nav className="start-steps" aria-label="시작 입력 단계">{([['thought','처음 생각','막연해도 괜찮아요'],['questions','경험 구체화','다섯 질문에 답해요'],['definition','문제정의 초안','문장과 범위를 정해요']] as const).map(([key,label,hint],index)=><button type="button" key={key} aria-current={stage===key?'step':undefined} disabled={p.busy||(key!=='thought'&&!idea)||(key==='definition'&&answered(idea?.refinement)!==5)} onClick={()=>setStage(key)}><span>{(key==='thought'&&idea)||(key==='questions'&&answered(idea?.refinement)===5)||(key==='definition'&&idea?.refinement?.ready)?<Check size={18}/>:index+1}</span><strong>{label}<small>{hint}</small></strong></button>)}</nav>
  {saved&&<p role="status" className="start-status">카드를 남겼어요. 이제 아래 다섯 질문에 답해 경험을 구체화하세요.</p>}
  {stage==='thought'&&!idea&&<div className="journey-discovery">
   <form className="journey-write" onSubmit={async e=>{e.preventDefault();await p.save({type:'createIdea',title:title.trim(),body:body.trim(),scope:privateNote?'owner':p.scope==='project'&&me.projectId?'project':'cohort',kind:'thought'},result=>{if(result.id){setId(result.id);setStage('questions');setTitle('');setBody('');setSaved(true);section.current?.scrollIntoView({block:'start',behavior:'smooth'});}});}}>
    <span className="journey-card-label">01 · 처음 생각</span><h3>지금 떠오르는 생각부터 적어주세요.</h3>
    <label htmlFor="journey-title">무슨 일이었나요?<input id="journey-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required placeholder="예: 모임에 처음 가면 누구에게 말을 걸지 모르겠어요" disabled={p.busy||p.ended}/></label>
    <label htmlFor="journey-body">언제, 누구에게, 무엇이 불편했나요?<textarea id="journey-body" value={body} onChange={e=>setBody(e.target.value)} rows={4} maxLength={5000} required placeholder="막연한 아이디어나 직접 겪은 일을 편하게 적으세요. 다음 단계에서 질문으로 구체화합니다." disabled={p.busy||p.ended}/></label>
    <label className="journey-private"><input type="checkbox" checked={privateNote} onChange={e=>setPrivateNote(e.target.checked)} disabled={p.busy||p.ended}/><Lock size={13}/> 아직은 나만 볼게요</label>
    <div className="journey-write-footer"><small>{privateNote?'나만 보는 기록으로 시작해요':'저장한 생각이 공유 보드에 올라갑니다'}</small><button className="primary-button" disabled={p.busy||p.ended||!title.trim()||!body.trim()}><ArrowRight size={16}/>{p.busy?'저장 중…':'카드 올리기'}</button></div><p className="start-next-hint">저장 후 바로 02 · 경험 구체화를 입력합니다.</p>
   </form>
   {p.coach?<div className="write-aside"><AICoach phase="thought" ask={p.coach} aiEnabled={p.aiEnabled} disabled={p.busy||p.ended} values={{title,body}} context={{title,body}} onApply={(k,t)=>k==='title'?setTitle(t.slice(0,120)):setBody(t)}/><CardPreview phase="thought" member={me} title={title} body={body}/></div>:<aside className="start-question-preview"><span className="journey-card-label">02 · 다음에 적을 내용</span><h3>이 생각을 다섯 질문으로 구체화해요.</h3><p>처음 생각을 저장하면 여기서 답변을 이어갑니다.</p><ol>{questionFields.map(([,label])=><li key={label}>{label}</li>)}</ol><span className="start-preview-end">그다음 · 문제정의 문장과 통제범위 <ArrowRight size={14}/></span></aside>}
  </div>}
  {idea&&<>
   <div className="start-source"><div><small>01 · 저장한 처음 생각</small><h4>{idea.title}</h4><p>{idea.body}</p></div><button type="button" className="secondary-button" disabled={p.busy} onClick={()=>p.onIdea(idea.id)}>원문·변화 이력</button></div>
   {stage==='thought'&&<div className="start-continue"><button className="primary-button" onClick={()=>setStage('questions')}>다섯 질문 이어쓰기 <ArrowRight size={16}/></button></div>}
   <div hidden={stage==='thought'} className="start-editor"><IdeaRefinement key={idea.id} idea={idea} editable={!p.ended} hasProject={!!me.projectId} busy={p.busy} run={p.save} activePanel={stage==='definition'?'definition':'questions'} onPanelChange={setStage} coach={p.coach} aiEnabled={p.aiEnabled} owner={me}/></div>
   <div className="start-bottom"><span>저장한 답변과 초안은 아래 단계별 보드에서 함께 볼 수 있어요.</span><button className="secondary-button" disabled={p.busy} onClick={fresh}><Plus size={14}/>새 생각 시작</button><button className="secondary-button" onClick={()=>document.getElementById('idea-exhibition')?.scrollIntoView({block:'start',behavior:'smooth'})}>저장한 내용·피드백 보기</button></div>
  </>}
 </section>;
}