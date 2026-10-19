"use client";
import {IdeaStart} from "./idea-start";
import {IdeaExhibition} from "./idea-exhibition";
import {useState,useEffect} from "react";
import {ArrowRight, Check, ArrowUpRight} from "lucide-react";
import {characterFor} from "@/lib/characters";
import {canReadIdea} from "@/lib/policy";
import {docKeys, docNames, type DocKey} from "@/lib/workshop/model";
import {recordsOf, type Props} from "./workshop/common";
import type {Command} from "@/lib/types";
const steps = [
 {name:"생각 꺼내기", output:"경험을 구체화한 문제정의카드", title:"어떤 순간이 불편했나요?", hint:"잘 정리하지 않아도 괜찮아요. 직접 겪은 일 하나부터 적어보세요."},
 {name:"함께할 문제 고르기", output:"선택한 문제와 내 프로젝트", title:"어떤 문제를 함께 풀고 싶나요?", hint:"카드를 읽고 투표한 뒤, 직접 만들거나 함께할 프로젝트를 선택하세요."},
 {name:"만들고 고치기", output:"기획 문서와 실행 주소", title:"우리의 생각을 어떻게 만들까요?", hint:"기획을 한 장씩 정리하고, 작은 기능부터 만들어 실행 주소를 남기세요."},
 {name:"결과 나누기", output:"시연과 달라진 생각", title:"처음 생각에서 무엇이 달라졌나요?", hint:"만든 것을 보여주고, 바뀐 생각과 다음에 해볼 일을 남겨주세요."},
];
const prompts:Record<DocKey,string>={product:"누구의 어떤 불편을 해결하나요?",features:"이번에 꼭 만들 기능은 무엇인가요?",screens:"사용자는 어디서 시작해 무엇을 하나요?",design:"어떤 화면을 참고하고 어떻게 적용하나요?","data-auth":"무엇을 저장하고 누가 볼 수 있나요?","setup-deploy":"어디에서 개발하고 배포하나요?",acceptance:"어떻게 동작하면 완성인가요?"};
type BoardProps=Props & {saveIdea:(c:Command,onResult?:(result:{id?:string})=>void)=>Promise<boolean>;startRequest:number;onIdea:(id:string)=>void;onNavigate:(tab:string,doc?:DocKey,target?:string)=>void;scope:"me"|"cohort"|"project";loadMore:(kind:"comments"|"history",id:string)=>Promise<void>};
export function JourneyBoard(p:BoardProps){
 const w=p.workspace, me=w.me, team=w.projects.find(x=>x.id===me.projectId);
 const [step,setStep]=useState(!team&&!w.ideas.some(i=>i.ownerId===me.id)?1:Math.min(4,Math.max(1,w.cohort.week))),[mine,setMine]=useState(false);
 const spec=steps[step-1],myIdeas=w.ideas.filter(x=>x.ownerId===me.id&&x.kind==="thought"),docs=recordsOf(p,"document").filter(x=>x.projectId===team?.id&&!x.data.redacted),baselines=recordsOf(p,"baseline").filter(x=>x.projectId===team?.id),releases=recordsOf(p,"release").filter(x=>x.projectId===team?.id),showcase=recordsOf(p,"showcase").find(x=>x.projectId===team?.id);
 const leader=team?.leaderId===me.id;
 const hasDoc=(key:DocKey)=>docs.find(x=>x.data.key===key&&x.data.markdown.trim());
 const status=[myIdeas.some(i=>i.refinement?.ready),!!team,baselines.length>0&&releases.length>0,showcase?.data.state==="published"];
 const ended=recordsOf(p,"settings")[0]?.data.state==="completed";
 const currentActivity=recordsOf(p,"activity").find(x=>x.data.featured&&x.data.state==="open");
 const cards=w.ideas.filter(x=>canReadIdea(me,x)&&(!mine||x.ownerId===me.id)&&(p.scope!=="project"||(!!team&&(x.projectId===team.id||x.id===team.sourceIdeaId)))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 useEffect(()=>{if(p.startRequest)setStep(1);},[p.startRequest]);
 function go(n:number){setStep(n);}
 return <section className="journey-board" aria-label="단계별 활동 보드">
  <nav className="journey-steps" aria-label="프로젝트 진행 단계">{steps.map((s,i)=><button key={s.name} type="button" className={step===i+1?"active":""} aria-current={step===i+1?"step":undefined} onClick={()=>go(i+1)}><span className="journey-step-number">{status[i]?<Check size={17}/>:String(i+1).padStart(2,"0")}</span><span><strong>{s.name}</strong><small>{s.output}</small></span>{w.cohort.week===i+1&&<em>이번 주</em>}</button>)}</nav>
  {step!==1&&<header className="journey-intro"><div><span className="journey-kicker">STEP 0{step} · 이번에 남길 것</span><h2>{spec.title}</h2><p>{spec.hint}</p></div><span className="journey-output">{spec.output}<small>{status[step-1]?"내 기록이 있어요 · 이어서 다듬기":"아래에서 시작하세요"}</small></span></header>}
  {ended&&<p className="journey-closed">종료된 기수입니다. 남긴 카드와 변화 과정을 둘러보세요.</p>}
  {step===1&&<>
   <IdeaStart workspace={w} busy={p.busy} ended={!!ended} scope={p.scope} save={p.saveIdea} onIdea={p.onIdea} startRequest={p.startRequest} coach={p.askCoach} makeCard={p.makeCard} aiEnabled={p.ai?.enabled} />
   {currentActivity&&<button className="journey-activity" onClick={()=>p.onNavigate("activities")}><span>진행자가 연 활동<strong>{currentActivity.data.question}</strong></span>활동에 답변하기 <ArrowRight size={17}/></button>}
   <div className="journey-board-heading"><div><h3>{p.scope==="project"?"우리 팀의 생각 보드":"함께 보는 생각 보드"}</h3><p>생각부터 문제정의까지 단계별로 펼쳐보고, 각 카드에 피드백을 남겨주세요.</p></div><button className="secondary-button" aria-pressed={mine} onClick={()=>setMine(!mine)}>{mine?"모두의 카드 보기":"내 카드만 보기"}</button></div>
   <IdeaExhibition workspace={w} ideas={cards} busy={p.busy} ended={!!ended} save={p.saveIdea} onIdea={p.onIdea} loadMore={p.loadMore}/>
   {!cards.length&&<p className="journey-empty">{p.scope==="project"&&!team?"아직 참여한 프로젝트가 없어요. 전체 공간에서 생각을 나누거나 2단계에서 프로젝트를 선택하세요.":"아직 카드가 없어요. 위 입력칸에서 첫 생각을 남겨주세요."}</p>}
   <div className="journey-next"><span>{myIdeas.length?"경험 질문과 문제 카드를 다듬었다면, 함께 풀 문제를 골라요.":"먼저 내 생각 카드 하나를 남겨보세요."}</span><button onClick={()=>go(2)}>다음 단계 살펴보기 <ArrowRight size={16}/></button></div>
  </>}
  {step===2&&<>
   <div className="journey-action-grid"><ActionCard number="01" title="함께 풀 문제에 투표" hint="후보 카드를 읽고 마음이 가는 문제를 선택하세요." button="후보 보고 투표하기" onClick={()=>p.onNavigate("votes")}/><ActionCard number="02" title={team?"내 프로젝트가 정해졌어요":"개인으로 만들거나 팀에 합류"} hint={team?team.name+" · "+team.memberIds.length+"명과 함께 진행 중":"혼자 진행해도 같은 프로젝트 공간을 사용합니다."} button={team?"팀 구성 확인하기":"프로젝트 선택하기"} onClick={()=>p.onNavigate("votes")}/></div>
   <div className="journey-board-heading"><div><h3>우리가 만들고 있는 프로젝트</h3><p>선택한 문제와 팀 구성을 확인하세요.</p></div></div>
   <div className="journey-action-grid">{w.projects.map(t=><article className="journey-project" key={t.id}><img src={characterFor(w.members.find(m=>m.id===t.leaderId)).image} alt=""/><div><small>{t.id===team?.id?"내 프로젝트":"함께할 프로젝트"} · {t.memberIds.length}명</small><h3>{t.name}</h3><p>{t.problem}</p><button className="secondary-button" onClick={()=>p.onNavigate("votes",undefined,"project-join")}>{t.id===team?.id?"구성원 확인":"참여 방법 보기"}<ArrowRight size={15}/></button></div></article>)}</div>
   {!w.projects.length&&<p className="journey-empty">아직 프로젝트가 없어요. 내 아이디어로 개인 프로젝트를 만들거나, 진행자의 투표·선정을 기다려주세요.</p>}
   <Next step={3} onClick={go} text="프로젝트가 정해졌다면 기획을 한 장씩 정리해요."/>
  </>}
  {step===3&&<>{!team?<MissingTeam onClick={()=>go(2)}/>:<>
   <div className="journey-board-heading"><div><h3>{team.name} · 이번에 만들 것을 정리해요</h3><p>문서를 하나씩 눌러 질문에 답하세요. {docs.filter(x=>x.data.markdown.trim()).length}/7개 작성</p></div><button className="secondary-button" onClick={()=>p.onNavigate("studio",undefined,"personal-readiness")}>개발 환경 확인</button></div>
   <div className="journey-docs">{docKeys.map((key,i)=><button className="journey-doc" key={key} onClick={()=>p.onNavigate("studio",key,"project-docs")}><span>{hasDoc(key)?<Check size={19}/>:String(i+1).padStart(2,"0")}</span><strong>{docNames[key]}</strong><p>{prompts[key]}</p><small>{hasDoc(key)?"작성한 내용 다듬기":"이 질문부터 작성하기"}<ArrowUpRight size={15}/></small></button>)}</div>
   <div className="journey-action-grid"><ActionCard number="다음" title="기획 버전 확정하고 개발 시작" hint={baselines.length?"확정한 기획 "+baselines.length+"개 · 필요하면 수정 후 새 버전을 만드세요.":"7개 문서를 작성한 뒤 팀장이 버전을 확정하고 MD · ZIP을 받습니다."} button={leader?"기획 버전 확정하기":"기획 문서 다듬기"} onClick={()=>p.onNavigate("studio",undefined,leader?"project-baseline":"project-docs")}/><ActionCard number="기록" title="만든 것을 실행 주소로 남기기" hint={releases.length?"배포 기록 "+releases.length+"개 · 피드백을 받아 다음 수정으로 이어가세요.":"실행 주소, 구현한 내용, 아직 안 되는 부분을 함께 기록하세요."} button={leader?"배포 기록 남기기":"배포 기록 확인하기"} onClick={()=>p.onNavigate("studio",undefined,leader?"project-release":"project-releases")}/></div>
   <Next step={4} onClick={go} text="작동하는 결과가 있다면, 변화 과정과 함께 나눠요."/>
  </>}</>}
  {step===4&&<>{!team?<MissingTeam onClick={()=>go(2)}/>:<>
   <div className="journey-action-grid"><ActionCard number="01" title="처음 문제와 지금의 결과" hint={leader?"어떤 문제를 풀었고, 무엇을 만들었나요? 시연 주소도 남겨주세요.":"팀장이 발표 카드를 정리합니다. 팀 대화에 결과와 회고를 남겨 함께 완성하세요."} button={leader?"발표 카드 작성하기":"우리 팀 발표 확인하기"} onClick={()=>p.onNavigate("showcase",undefined,leader?"showcase-editor":"showcase-work")}/><ActionCard number="02" title="생각이 바뀐 순간 3개" hint="동료 의견으로 바뀐 점, 해보니 달랐던 점, 다음에 할 일을 정리하세요." button={leader?"변화 과정·회고 남기기":"팀 대화에 회고 나누기"} onClick={()=>leader?p.onNavigate("showcase",undefined,"showcase-editor"):p.onNavigate("communication")}/></div>
   {showcase&&<article className="journey-result"><small>{showcase.data.state==="published"?"공유한 발표":"작성 중인 발표"}</small><h3>{showcase.data.problem}</h3><p>{showcase.data.solution}</p><ul>{showcase.data.milestones.map((m,i)=><li key={i}>{m}</li>)}</ul></article>}
   <div className="journey-next"><span>동료의 결과를 써보고 질문과 응원을 남겨주세요.</span><button onClick={()=>p.onNavigate("showcase")}>발표·피드백 보드 <ArrowRight size={16}/></button></div>
  </>}</>}
 <div className="journey-tools"><span>활동을 이어갈 때</span><button onClick={()=>p.onNavigate("activities")}>현장 질문에 답하기</button><button onClick={()=>p.onNavigate("sources")}>자료·녹취록 남기기</button><button onClick={()=>p.onNavigate("communication")}>대화·진행 공유하기</button></div>
 </section>;
}
function ActionCard({number,title,hint,button,onClick}:{number:string;title:string;hint:string;button:string;onClick:()=>void}){return <article className="journey-action"><small>{number}</small><h3>{title}</h3><p>{hint}</p><button className="primary-button" onClick={onClick}>{button}<ArrowRight size={16}/></button></article>;}
function Next({step,text,onClick}:{step:number;text:string;onClick:(n:number)=>void}){return <div className="journey-next"><span>{text}</span><button onClick={()=>onClick(step)}>다음 단계 살펴보기 <ArrowRight size={16}/></button></div>;}
function MissingTeam({onClick}:{onClick:()=>void}){return <div className="journey-empty"><h3>먼저 프로젝트를 선택해주세요.</h3><p>개인 프로젝트를 만들거나 팀에 참여하면 내 프로젝트의 기록을 이어갈 수 있어요.</p><button className="primary-button" onClick={onClick}>2단계에서 프로젝트 선택 <ArrowRight size={16}/></button></div>;}
