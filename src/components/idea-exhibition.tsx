"use client";
import {useState} from 'react';
import {ArrowRight,MessageCircle,Search} from 'lucide-react';
import {buildExhibition,exhibitionStages,feedbackLabel,type Exhibit} from '@/lib/exhibition';
import {questionFields,statement,refinementAction,refinementLabel,refinementText} from '@/lib/refinement';
import {characterFor} from '@/lib/characters';
import type {Idea,Workspace,Command,FeedbackContext} from '@/lib/types';
type Props={workspace:Workspace;ideas:Idea[];busy:boolean;ended:boolean;save:(c:Command)=>Promise<boolean>;onIdea:(id:string)=>void;loadMore:(kind:'comments'|'history',id:string)=>Promise<void>};
export function IdeaExhibition(p:Props){
 const [stage,setStage]=useState<'all'|FeedbackContext['stage']>('all'),[flow,setFlow]=useState('all'),[query,setQuery]=useState('');
 const all=buildExhibition(p.ideas,p.workspace.events,p.workspace.comments);
 const matching=new Set(all.filter(x=>(x.snapshot.title+' '+x.snapshot.body+' '+refinementText(x.snapshot.refinement)).toLowerCase().includes(query.toLowerCase())).map(x=>x.idea.id));
 const cards=all.filter(x=>(flow==='all'||x.idea.id===flow)&&matching.has(x.idea.id));
 const lanes=exhibitionStages.filter(s=>stage==='all'||stage===s.id);
 return <section id="idea-exhibition" className="idea-exhibition" aria-label="단계별 생각 전시">
  <div className="exhibition-toolbar"><label className="exhibition-search"><Search size={15}/><input aria-label="전시 내용 검색" placeholder="생각·경험·문제정의 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="exhibition-flow">아이디어 흐름<select aria-label="아이디어 흐름" value={flow} onChange={e=>setFlow(e.target.value)}><option value="all">모든 아이디어 함께 보기</option>{p.ideas.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label></div>
  <nav className="exhibition-tabs" aria-label="전시 단계"><button aria-pressed={stage==='all'} onClick={()=>setStage('all')}>전체 단계</button>{exhibitionStages.map(s=><button key={s.id} aria-pressed={stage===s.id} onClick={()=>setStage(s.id)}>{s.name}<span>{cards.filter(c=>c.context.stage===s.id).length}</span></button>)}</nav>
  <p className="exhibition-help">같은 아이디어가 왼쪽에서 오른쪽으로 다듬어져요. 각 카드의 피드백은 그 단계·버전에 남습니다. {stage==='all'?'옆으로 밀어 다음 단계를 보거나, 위에서 한 단계를 선택하세요.':''}</p>
  <div className={'exhibition-columns '+(stage!=='all'?'single-stage':'')}>
   {lanes.map(s=><section className={'exhibition-lane stage-'+s.id} aria-label={s.name+' 전시'} key={s.id}><header><span>{String(exhibitionStages.indexOf(s)+1).padStart(2,'0')}</span><div><h4>{s.name}</h4><p>{s.hint}</p></div><b>{cards.filter(c=>c.context.stage===s.id).length}</b></header><div className="exhibition-lane-cards">
    {cards.filter(c=>c.context.stage===s.id).map(c=><ExhibitionCard key={c.idea.id+'-'+c.context.stage+'-'+c.context.revision} {...p} card={c} focus={()=>setFlow(c.idea.id)}/>)}
    {!cards.some(c=>c.context.stage===s.id)&&<div className="exhibition-empty">{s.id==='thought'?'위에서 생각을 남기면 여기에 전시됩니다.':s.id==='questions'?'생각 카드에서 다섯 질문에 답하고 저장하면 여기에 전시됩니다.':s.id==='definition'?'문제정의를 저장할 때마다 초안 1·2가 나란히 쌓입니다.':'문제정의에서 선정 준비를 완료하면 여기에 전시됩니다.'}</div>}
   </div></section>)}
  </div>
 </section>;
}
function ExhibitionCard(p:Props&{card:Exhibit;focus:()=>void}){
 const {idea,context,snapshot,reason}=p.card,r=snapshot.refinement,me=p.workspace.me;
 const [expanded,setExpanded]=useState(false),[feedbackOpen,setFeedbackOpen]=useState(false),[text,setText]=useState(''),[message,setMessage]=useState('');
 const comments=p.workspace.comments.filter(c=>c.ideaId===idea.id&&(c.context?c.context.stage===context.stage&&c.context.revision===context.revision:context.stage==='thought'));
 const author=p.workspace.members.find(m=>m.id===idea.ownerId),readonly=p.ended||idea.state==='closed_unselected';
 const fields=context.stage==='questions'&&r?questionFields.map(([k,label])=>[label,r.answers[k]||'아직 작성하지 않았어요.']):r?[
  ['왜 문제인가',r.definition.why],['해결되면 달라지는 점',r.definition.change],['직접 바꿀 수 있는 부분',r.definition.control],['협조가 필요한 부분',r.definition.outside],['이번 4주의 범위',r.definition.focus]
 ]:[];
 return <article className={'journey-note exhibition-card note-'+exhibitionStages.findIndex(s=>s.id===context.stage)+(expanded?' expanded':'')+(readonly?' is-closed':'')} aria-label={snapshot.title+' · '+feedbackLabel(context)}>
  <div className="journey-note-author"><img src={characterFor(author).thumbnail} alt=""/><strong>{author?.name||'참가자'}</strong><small>{idea.scope==='owner'?'나만 보기':idea.scope==='project'?'팀 공유':'전체 공유'}</small></div>
  <div className="exhibit-version"><b>{context.stage==='definition'?`초안 ${r?.draft}`:context.stage==='ready'?`선정 준비 · 초안 ${r?.draft}`:context.stage==='thought'?'생각 카드':'다섯 질문'}</b><span>r{context.revision}</span></div>
  {context.stage==='thought'?<button className="journey-note-content" onClick={()=>p.onIdea(idea.id)}><h4>{snapshot.title}</h4><p>{snapshot.body}</p></button>:<><h4>{snapshot.title}</h4>{r&&context.stage!=='questions'&&<blockquote>{statement(r)}</blockquote>}<dl>{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'아직 작성하지 않았어요.'}</dd></div>)}</dl>{context.stage==='definition'&&<p className="exhibit-reason"><strong>바꾼 이유</strong>{reason}</p>}</>}
  <div className="exhibit-small-actions"><button onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?'내용 접기':'내용 펼치기'}</button><button onClick={p.focus}>이 흐름만 보기</button></div>
  {context.stage==='thought'&&<div className="journey-refinement-state"><span>{refinementLabel(idea)}{idea.refinement?.draft?` · 초안 ${idea.refinement.draft}`:''}</span><button onClick={()=>p.onIdea(idea.id)}>{idea.ownerId===me.id?refinementAction(idea):'경험·문제정의 보기'}<ArrowRight size={13}/></button></div>}
  {context.stage!=='thought'&&idea.ownerId===me.id&&idea.state==='shared'&&<button className="exhibit-history-load" onClick={()=>p.onIdea(idea.id)}>최신 카드 다듬기</button>}
  <footer><button onClick={()=>setFeedbackOpen(!feedbackOpen)} aria-expanded={feedbackOpen}><MessageCircle size={15}/> 피드백 {comments.length}</button><span>{idea.state==='closed_unselected'?'종료 보관':idea.state==='candidate'?'투표 중':idea.state==='selected'?'프로젝트로 연결':'의견을 보태주세요'}</span></footer>
  {feedbackOpen&&<section className="exhibit-feedback" aria-label="이 카드의 피드백"><p>{feedbackLabel(context)}에 대한 의견</p>{comments.map(c=><div className="exhibit-comment" key={c.id}><strong>{p.workspace.members.find(m=>m.id===c.authorId)?.name||'참가자'}</strong>{!c.context&&<small>아이디어 전체에 남긴 의견</small>}<p>{c.body}</p></div>)}{!comments.length&&<p className="feedback-empty">공감한 경험, 더 알고 싶은 점, 다듬을 제안을 남겨주세요.</p>}<button className="feedback-load" disabled={p.busy} onClick={()=>p.loadMore('comments',idea.id)}>이전 피드백 더 불러오기</button>
   {readonly?<p>종료된 기록은 읽기 전용입니다.</p>:<form onSubmit={async e=>{e.preventDefault();setMessage('');if(await p.save({type:'comment',ideaId:idea.id,context,body:text.trim()})){setText('');setMessage('이 카드에 피드백을 남겼어요.');}else setMessage('저장하지 못했어요. 화면 상단의 오류 안내를 확인해주세요.');}}><label>이 내용에 피드백<textarea aria-label="이 내용에 피드백" rows={3} maxLength={5000} required value={text} disabled={p.busy} onChange={e=>setText(e.target.value)} placeholder={context.stage==='questions'?'이 경험에서 더 알고 싶은 상황이 있나요?':context.stage==='definition'?'대상·원인·범위에서 더 명확해질 부분이 있나요?':'공감하는 경험이나 질문을 남겨주세요.'}/></label><button className="primary-button" disabled={p.busy||!text.trim()}>피드백 남기기</button></form>}
   {message&&<p role="status">{message}</p>}
  </section>}
  {context.stage==='thought'&&<button className="exhibit-history-load" disabled={p.busy} onClick={()=>p.loadMore('history',idea.id)}>이 아이디어의 이전 버전 더 보기</button>}
 </article>;
}
