'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut,type User} from 'firebase/auth';
import {ArrowUpRight,ArrowRight,ArrowLeft,LayoutDashboard,Lightbulb,Users,MessageCircle,Clock3,Plus,Send,ChevronDown,Check,Lock,Globe2,Leaf,LogOut,X,Menu,RefreshCw,LoaderCircle,Pencil,Archive,GitBranch,Play,Pause,Search,Sparkles,CheckCircle2} from 'lucide-react';
import {clientAuth,firebaseConfigured} from '@/lib/firebase-client';
import {WorkshopHub} from './workshop/hub';
import {ArenaProfile} from './arena-profile';
import {useWorkshop} from './workshop/use-workshop';
import {CharacterPicker} from './character-picker';
import {characterFor} from '@/lib/characters';
import {previewWorkspace,previewCommand} from '@/lib/preview';
import type {Workspace,Command,Idea,Member,Scope} from '@/lib/types';

type View='dashboard'|'ideas'|'projects'|'history'|'workshop';
type Space='me'|'cohort'|'project';
const cohortId=process.env.NEXT_PUBLIC_COHORT_ID||'vibe-2026-01';
const kindLabel={thought:'생각 나누기',question:'함께 고민해요',progress:'진행 공유'};
const stateLabel={candidate:'투표 후보 · 내용 고정',shared:'함께 다듬는 중',selected:'프로젝트로 연결',closed_unselected:'종료 보관'};
function time(value:string){return new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value));}
function Avatar({member,large=false}:{member?:Member;large?:boolean}){
 const character=characterFor(member);
 return <span className={'avatar '+(large?'avatar-large':'')} aria-label={(member?.name||'참가자')+'의 일러스트 아바타'}><img src={large?character.image:character.thumbnail} alt="" loading="lazy"/></span>;
}
function Brand(){return <div className="brand"><span className="brand-mark"><Leaf size={20}/></span>vibe<span className="brand-dot">.</span></div>;}
function Login({loading,error,onLogin}:{loading:boolean;error:string;onLogin:()=>void}){
 return <main className="login-page"><div className="login-story"><img className="login-character" src={characterFor({id:'min'}).image} alt="보라색 재킷을 입은 메이커 캐릭터"/><Brand/><span className="eyebrow">4 WEEKS. ONE NEW POSSIBILITY.</span><h1>당신의 작은 생각이<br/>누군가의 변화를<br/><em>만들 때까지.</em></h1><p>함께 발견하고, 만들고, 연결하는<br/>우리의 바이브코딩 여정.</p><div className="login-orbit"><span>생각</span><i/><span>연결</span><i/><span>실현</span></div><small>바이브코딩 워크숍 · VibeCoding2</small></div><div className="login-card"><span className="pill">함께 시작해요</span><h2>반가워요, 메이커!</h2><p>등록한 Google 계정으로<br/>우리의 작업 공간에 들어오세요.</p><button className="google-button" onClick={onLogin} disabled={loading||!firebaseConfigured}>{loading?<LoaderCircle className="spin" size={20}/>:<b className="google-g">G</b>}Google로 시작하기<ArrowRight size={17}/></button>{error&&<div role="alert" className="form-error">{error}</div>}<p className="login-note">기수에 초대된 계정만 참여할 수 있어요.<br/>접속이 어렵다면 운영자에게 알려주세요.</p><a href="/preview" className="preview-link">샘플 화면 둘러보기 <ArrowUpRight size={16}/></a><span className="login-foot">아이디어가 자라나는 곳, vibe.</span></div></main>;
}
export function WorkspaceApp({preview=false}:{preview?:boolean}){
 const [data,setData]=useState<Workspace|null>(preview?previewWorkspace():null);
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(!preview),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [characterOpen,setCharacterOpen]=useState(false);
 const [memberFilter,setMemberFilter]=useState<string|null>(null);
 const [workshopTab,setWorkshopTab]=useState<{id:string;revision:number}|undefined>();
 const [space,setSpace]=useState<Space>('me'),[view,setView]=useState<View>('dashboard'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const [chatOpen,setChatOpen]=useState(true),[mobileNav,setMobileNav]=useState(false),[channel,setChannel]=useState('cohort'),[chatText,setChatText]=useState('');
 const [composer,setComposer]=useState(false),[editing,setEditing]=useState<Idea|null>(null),[selected,setSelected]=useState<string|null>(null),[action,setAction]=useState<{idea:Idea;type:'select'|'close'}|null>(null);
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[reason,setReason]=useState(''),[scope,setScope]=useState<Scope>('cohort'),[kind,setKind]=useState<Idea['kind']>('thought'),[comment,setComment]=useState('');
 const modalRef=useRef<HTMLDialogElement>(null),detailRef=useRef<HTMLDialogElement>(null),actionRef=useRef<HTMLDialogElement>(null);
 const [pageCursors,setPageCursors]=useState<Record<string,string|null>>({});
 const extraPages=useRef<{kind:'ideas'|'messages'|'comments'|'history';target?:string;cursor?:string}[]>([]);
 const pending=useRef<{key:string;id:string}|null>(null);
 useEffect(()=>{if(window.innerWidth<1280)setChatOpen(false);if(new URLSearchParams(location.search).get('view')==='workshop')setView('workshop');},[]);
 const load=useCallback(async(current:User)=>{
  const response=await fetch('/api/workspace?cohortId='+encodeURIComponent(cohortId),{headers:{Authorization:'Bearer '+await current.getIdToken()},cache:'no-store'});
  const value=await response.json();if(!response.ok){if(response.status===401||response.status===403){setData(null);extraPages.current=[];}throw new Error(value.error||'불러오지 못했습니다.');}
  const token=await current.getIdToken();
  const pages=await Promise.all(extraPages.current.map(async page=>{
   const params=new URLSearchParams({cohortId,kind:page.kind,...(page.target?{target:page.target}:{}),...(page.cursor?{cursor:page.cursor}:{})});
   const r=await fetch('/api/page?'+params,{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)return null;return {kind:page.kind,...await r.json()};
  }));
  for(const page of pages){if(!page)continue;const key=page.kind==='history'?'events':page.kind;const merged=new Map(value[key].map((item:any)=>[item.id,item]));for(const item of page.items)merged.set(item.id,item);value[key]=[...merged.values()].sort((a:any,b:any)=>key==='messages'||key==='comments'?a.createdAt.localeCompare(b.createdAt):(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt));}
  setData(value);
 },[]);
 useEffect(()=>{
  if(preview)return;
  if(!firebaseConfigured){setLoading(false);setError('Firebase 웹 설정이 필요합니다.');return;}
  return onAuthStateChanged(clientAuth(),async current=>{
   setUser(current);setError('');
   if(!current){setData(null);extraPages.current=[];setPageCursors({});setLoading(false);return;}
   setLoading(true);
   try{
    const result=await fetch('/api/enroll',{method:'POST',headers:{Authorization:'Bearer '+await current.getIdToken()}});
    const value=await result.json();if(!result.ok)throw new Error(value.error);
    await load(current);
   }catch(e){setError(e instanceof Error?e.message:'연결을 확인해주세요.');}
   finally{setLoading(false);}
  });
 },[preview,load]);
 useEffect(()=>{if(!user||preview)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')load(user).catch(()=>{});},20000);return()=>clearInterval(timer);},[user,preview,load]);
 useEffect(()=>{if(composer&&!modalRef.current?.open)modalRef.current?.showModal();else if(!composer)modalRef.current?.close();},[composer]);
 useEffect(()=>{if(selected&&!detailRef.current?.open)detailRef.current?.showModal();else if(!selected)detailRef.current?.close();},[selected]);
 useEffect(()=>{if(action&&!actionRef.current?.open)actionRef.current?.showModal();else if(!action)actionRef.current?.close();},[action]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
 async function login(){setLoading(true);setError('');try{await signInWithPopup(clientAuth(),new GoogleAuthProvider());}catch{setError('로그인을 완료하지 못했습니다. Google 로그인 설정과 허용 도메인을 확인해주세요.');setLoading(false);}}
 async function run(command:Command):Promise<boolean>{
  setBusy(true);setError('');
  try{
   if(preview){if(data)setData(previewCommand(data,command));}
   else{
    if(!user)throw new Error('로그인이 필요합니다.');
    const key=JSON.stringify(command);if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
    const response=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({cohortId,requestId:pending.current.id,command})});
    const value=await response.json();if(!response.ok)throw new Error(value.error||'저장하지 못했습니다.');
    pending.current=null;await load(user);
   }
   setNotice(preview?'샘플에 반영했어요. 새로고침하면 초기화됩니다.':'저장했어요.');return true;
  }catch(e){setError(e instanceof Error?e.message:'다시 시도해주세요.');return false;}finally{setBusy(false);}
 }
 const workshop=useWorkshop({data,setData,user,preview,cohortId,reload:load,setError,setNotice});
 async function loadOlder(kind:'ideas'|'messages'|'comments'|'history',target?:string){
  if(preview){setNotice('미리보기에는 모든 샘플 기록이 표시됩니다.');return;}
  if(!user||!data)return;const key=kind+':'+(target||'');
  setBusy(true);setError('');
  try{const cursor=pageCursors[key];const u=new URL('/api/page',location.origin);u.searchParams.set('cohortId',cohortId);u.searchParams.set('kind',kind);if(target)u.searchParams.set('target',target);if(cursor)u.searchParams.set('cursor',cursor);
   const response=await fetch(u,{headers:{Authorization:'Bearer '+await user.getIdToken()},cache:'no-store'}),value=await response.json();if(!response.ok)throw new Error(value.error);
   const page={kind,...(target?{target}:{}),...(cursor?{cursor}:{})};if(!extraPages.current.some(p=>JSON.stringify(p)===JSON.stringify(page)))extraPages.current.push(page);
   const property=kind==='history'?'events':kind;
   setData(previous=>{if(!previous)return previous;const merged=new Map(previous[property].map((x:any)=>[x.id,x]));for(const item of value.items)merged.set(item.id,item);return {...previous,[property]:[...merged.values()].sort((a:any,b:any)=>kind==='messages'||kind==='comments'?a.createdAt.localeCompare(b.createdAt):(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))};});
   setPageCursors(c=>({...c,[key]:value.nextCursor}));setNotice(value.nextCursor?'이전 기록을 불러왔어요.':'마지막 기록까지 불러왔어요.');
  }catch(e){setError(e instanceof Error?e.message:'이전 기록을 불러오지 못했습니다.');}finally{setBusy(false);}
 }
 function openComposer(idea?:Idea){setEditing(idea||null);setTitle(idea?.title||'');setBody(idea?.body||'');setReason('');setKind(idea?.kind||'thought');setScope(idea?.scope||(space==='project'?'project':space==='me'?'owner':'cohort'));setComposer(true);}
 async function submitIdea(e:FormEvent){e.preventDefault();const command:Command=editing?{type:'editIdea',id:editing.id,revision:editing.revision,title,body,reason}:{type:'createIdea',title,body,kind,scope};if(await run(command))setComposer(false);}
 function navigate(next:View){extraPages.current=[];setPageCursors({});setView(next);setMobileNav(false);setQuery('');setMemberFilter(null);}
 if(!data)return <Login loading={loading} error={error} onLogin={login}/>;
 const me=data.me, project=data.projects.find(p=>p.id===me.projectId);
 const findMember=(uid:string)=>data.members.find(m=>m.id===uid);
 const focused=data.ideas.find(i=>i.id===selected);
 const filtered=data.ideas.filter(i=>(space!=='me'||view!=='dashboard'||i.ownerId===me.id)&&(space!=='project'||(!!project&&(i.projectId===project.id||i.id===project.sourceIdeaId))))
 .filter(i=>!memberFilter||i.ownerId===memberFilter)
 .filter(i=>filter==='all'?i.state!=='closed_unselected':filter==='closed'?i.state==='closed_unselected':i.kind===filter)
 .filter(i=>!query||(i.title+' '+i.body).toLowerCase().includes(query.toLowerCase()));
 const messages=data.messages.filter(m=>m.channel===channel&&(channel==='cohort'||channel===me.projectId));
 const teamMembers=space==='project'?data.members.filter(m=>m.projectId===me.projectId):data.members;
 async function send(e:FormEvent){e.preventDefault();if(!chatText.trim())return;if(await run({type:'sendMessage',channel,body:chatText.trim()}))setChatText('');}
 return <div className={'app-shell arena-shell '+(chatOpen?'with-chat':'')}>
 {preview&&<div className="preview-banner"><span><Sparkles size={14}/>샘플 미리보기 · 가상 참가자 · 변경 내용은 새로고침하면 초기화됩니다</span><select className="wk-preview-user" aria-label="미리보기 참가자" value={data.me.id} onChange={e=>setData({...data,me:data.members.find(m=>m.id===e.target.value)!})}>{data.members.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}</select><a href="/">실제 계정으로 시작하기 <ArrowRight size={13}/></a></div>}
 <aside className={'sidebar '+(mobileNav?'mobile-open':'')}>
 <Brand/><div className="cohort-select"><div className="cohort-logo">V<span>1</span></div><div><strong>{data.cohort.name}</strong><small>4주간의 새로운 시작</small></div><ChevronDown size={15}/></div>
 <span className="nav-label">WORKSPACE</span>
 <nav>
 {([['dashboard',LayoutDashboard,'대시보드'],['ideas',Lightbulb,'아이디어 보드'],['projects',Users,'프로젝트'],['history',Clock3,'성장 이력'],['workshop',Sparkles,'워크숍 진행']] as const).map(([id,Icon,label])=><button key={id} className={view===id?'nav-item active':'nav-item'} aria-label={label} title={label} onClick={()=>navigate(id)}><Icon size={19}/><span className='nav-text'>{label}</span>{id==='ideas'&&<span className="nav-count">{data.ideas.length}</span>}</button>)}
 <button className="nav-item" aria-label="대화 공간" title="대화 공간" onClick={()=>setChatOpen(v=>!v)}><MessageCircle size={19}/><span className="nav-text">대화 공간</span><span className="chat-dot"/></button>
 </nav>
 <div className="sidebar-journey"><span>OUR JOURNEY</span><p>작은 생각이<br/>세상을 바꾸는 여정.</p><div className="journey-dots">{[1,2,3,4].map(w=><i key={w} className={w<=data.cohort.week?'done':''}/>)}</div><small>WEEK {data.cohort.week} OF 4</small></div>
 <div className="sidebar-bottom"><button className="avatar-edit" aria-label="내 캐릭터 변경" onClick={()=>{setError('');setCharacterOpen(true);}}><Avatar member={me}/></button><div><strong>{me.name}</strong><small>{me.role==='admin'?'기수 관리자':'메이커'}</small></div><button className="icon-button" aria-label="로그아웃" onClick={()=>preview?location.assign('/'):signOut(clientAuth())}><LogOut size={17}/></button></div>
 </aside>
 <div className="main-shell">
 <header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setMobileNav(v=>!v)} aria-label="메뉴 열기"><Menu size={22}/></button><div className="space-tabs">{([['me','내 공간'],['project','프로젝트 공간'],['cohort','전체 공간']] as const).map(([id,label])=><button key={id} className={space===id?'selected':''} onClick={()=>{setSpace(id);setFilter('all');setMemberFilter(null);}}>{label}</button>)}</div><div className="top-actions"><span className="cohort-status"><i/>WEEK {data.cohort.week} · 함께 만드는 중</span><button className="icon-button" onClick={()=>user?load(user).catch(e=>setError(e.message)):setNotice('미리보기는 현재 샘플 상태를 보여줍니다.')} aria-label="새로고침"><RefreshCw size={17}/></button><button className="icon-button" onClick={()=>setChatOpen(v=>!v)} aria-label="채팅 열기 또는 닫기"><MessageCircle size={19}/></button></div></header>
 <main className="main-content">
 {error&&<div className="error-banner" role="alert">{error}<button aria-label="오류 닫기" onClick={()=>setError('')}><X size={16}/></button></div>}
 <div className="page-heading"><div><span className="eyebrow">{view==='workshop'?'YOUR WORKSHOP / IN PLAY':view==='dashboard'?'MAKE SOMETHING MEANINGFUL':view==='ideas'?'IDEAS GROW TOGETHER':view==='projects'?'BETTER, TOGETHER':'EVERY STEP MATTERS'}</span><h1>{view==='workshop'?'워크숍 플레이북':view==='dashboard'?(space==='me'?me.name.split(' ')[0]+'님의 작업 공간':space==='project'?'우리의 프로젝트':'함께 만드는 가능성'):view==='ideas'?'아이디어 보드':view==='projects'?'프로젝트 둘러보기':'생각이 자라온 기록'}</h1><p>{view==='workshop'?'현장 활동부터 팀 구성, 개발과 발표까지 한 공간에서 진행하세요.':view==='dashboard'?'오늘의 작은 생각을, 다음 가능성으로 연결해보세요.':view==='ideas'?'서로의 시선이 더해지면, 작은 생각도 달라집니다.':view==='projects'?'서로 다른 생각이 모여 하나의 변화를 만듭니다.':'첫 생각부터 지금까지, 우리의 변화가 남아 있어요.'}</p></div><button className="primary-button" onClick={()=>openComposer()}><Plus size={17}/>생각 남기기</button></div>
 <ArenaProfile workspace={data} records={workshop.records} space={space} compact={view!=='dashboard'} onCharacter={()=>{setError('');setCharacterOpen(true);}} onIdeas={()=>navigate('ideas')} onStage={tab=>{setWorkshopTab({id:tab,revision:Date.now()});navigate('workshop');}}/>
 {view==='workshop'&&<WorkshopHub workspace={data} {...workshop} preview={preview} requestedTab={workshopTab}/>}
 {view==='dashboard'&&<>

 <div className="arena-workspace-bar"><span><i/>WEEK {String(data.cohort.week).padStart(2,'0')} · {data.activity.state==='open'?'활동 진행 중':'다음 활동 준비'}</span><button onClick={()=>navigate('workshop')}>워크숍 이어서 진행하기 <ArrowUpRight size={16}/></button></div>
 <section className="activity-card"><div className="activity-icon"><Lightbulb size={24}/></div><div><span className="mini-label">{data.activity.state==='open'?'지금 함께하는 활동':'마감된 활동'}</span><h3>{data.activity.title}</h3><p>{data.activity.question}</p></div><div className="activity-actions"><button className="text-button" onClick={()=>{setScope('cohort');setEditing(null);setTitle('');setBody('');setComposer(true);}} disabled={data.activity.state==='closed'}>생각 나누기 <ArrowRight size={16}/></button>{(me.role==='admin'||me.role==='facilitator')&&<button className="quiet-button" disabled={busy} onClick={()=>run({type:'setActivity',state:data.activity.state==='open'?'closed':'open'})}>{data.activity.state==='open'?<Pause size={12}/>:<Play size={12}/>}활동 {data.activity.state==='open'?'마감':'열기'}</button>}</div></section>

 <section className="people-section"><div className="section-title"><div><span className="eyebrow">THE LINEUP</span><h2>{space==='project'?'우리 팀 메이커':'함께하는 메이커'}</h2></div><span>{space==='project'&&!project?0:teamMembers.length}명 · 함께 만드는 중</span></div>{space==='project'&&!project?<div className="empty-card">아직 참여한 프로젝트가 없어요. 아이디어를 나누며 함께할 문제를 찾아보세요.</div>:<div className="people-grid">{teamMembers.map((m,i)=><button className={'person-card tone-'+['violet','coral','mint','blue'][i%4]} key={m.id} onClick={()=>{setSpace('cohort');navigate('ideas');setMemberFilter(m.id);setFilter('all');}} aria-label={m.name+'의 생각 보기'}><span className="person-number">{String(i+1).padStart(2,'0')}</span><span className="person-role">{m.role==='admin'||m.role==='facilitator'?'FACILITATOR':data.projects.some(p=>p.leaderId===m.id)?'TEAM LEADER':'MAKER'}</span><Avatar member={m} large/><div className="person-info"><strong>{m.name}<ArrowUpRight size={17}/></strong><small>{data.projects.find(p=>p.id===m.projectId)?.name||'가능성을 발견하는 중'}</small><span className="person-stat"><Lightbulb size={12}/>{data.ideas.filter(i=>i.ownerId===m.id).length}개의 생각<span>VIEW IDEAS</span></span></div></button>)}</div>}<p className="portrait-note">캐릭터는 참가자를 표현하는 AI 일러스트입니다.</p></section>

 </>}
 {(view==='dashboard'||view==='ideas')&&<>
 <div className="section-title feed-heading"><h2>{view==='ideas'?'모든 아이디어':space==='me'?'나의 생각과 이야기':'우리의 생각과 이야기'}</h2><label className="search-field"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="생각 검색" aria-label="아이디어 검색"/></label></div>
 {memberFilter&&<div className="member-filter"><span>{findMember(memberFilter)?.name}님의 생각</span><button onClick={()=>setMemberFilter(null)}>전체 보기 <X size={13}/></button></div>}
 <div className="feed-tabs">{[['all','전체'],['thought','생각'],['question','질문'],['progress','진행 공유'],['closed','종료 보관']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>
 <button className="composer-prompt" onClick={()=>openComposer()}><Avatar member={me}/><span>오늘, 어떤 생각이 떠올랐나요?</span><span className="composer-plus"><Plus size={19}/></span></button>
 <div className={view==='ideas'?'idea-grid':'feed-list'}>
 {filtered.length===0&&<div className="empty-card"><Lightbulb size={30}/><h3>첫 번째 생각을 기다리고 있어요.</h3><p>작은 불편, 궁금한 점, 오늘의 발견을 나눠주세요.</p><button className="text-button" onClick={()=>openComposer()}>생각 남기기 <Plus size={16}/></button></div>}
 {filtered.map(idea=><article className={'feed-card '+(idea.state==='closed_unselected'?'archived':'')} key={idea.id}><div className="feed-author"><Avatar member={findMember(idea.ownerId)}/><div><strong>{findMember(idea.ownerId)?.name||'참가자'}</strong><small>{time(idea.createdAt)} · {idea.scope==='owner'?'나만 보기':idea.scope==='project'?'팀 공유':'전체 공유'}</small></div><span className={'kind-tag '+idea.kind}>{kindLabel[idea.kind]}</span></div><button className="feed-content" onClick={()=>{setSelected(idea.id);setComment('');}}><h3>{idea.title}</h3><p>{idea.body}</p></button><div className="feed-footer"><button onClick={()=>{setSelected(idea.id);setComment('');}}><MessageCircle size={16}/>의견 {data.comments.filter(c=>c.ideaId===idea.id).length}</button><span className={'state-tag '+idea.state}>{idea.state==='selected'?<GitBranch size={13}/>:idea.state==='closed_unselected'?<Archive size={13}/>:<span className="tiny-dot"/>}{stateLabel[idea.state]}</span><span className="version-tag">v{idea.version}</span></div></article>)}</div><button className='secondary-button' disabled={busy||pageCursors['ideas:']===null} onClick={()=>loadOlder('ideas')}>아이디어 더 불러오기</button></>}
 {view==='projects'&&<div className="project-grid">{data.projects.length===0?<div className="empty-card"><Users size={32}/><h3>아직은 아이디어를 모으는 중이에요.</h3><p>선정된 아이디어는 프로젝트로 연결됩니다.</p></div>:data.projects.map(p=><article key={p.id} className="project-card"><div className="project-visual"><div className="project-word" aria-hidden="true">BUILD<br/>TOGETHER.</div><img src={characterFor(findMember(p.leaderId)).image} alt="프로젝트 메이커 일러스트" loading="lazy"/><span>{p.stage}</span></div><h2>{p.name}</h2><p>{p.problem}</p><div className="project-members">{p.memberIds.map(id=><Avatar key={id} member={findMember(id)}/>)}<small>{p.memberIds.length}명의 메이커</small></div><button className="text-button" onClick={()=>setSelected(p.sourceIdeaId)}>출발 아이디어 보기 <ArrowUpRight size={16}/></button></article>)}</div>}
 {view==='history'&&<section className="timeline">{workshop.records.filter(r=>r.kind==='event').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=><article key={r.id}><span className="timeline-dot"><GitBranch size={16}/></span><div className="timeline-body"><small>{time(r.createdAt)} · {r.scope==='project'?'팀 기록':r.scope==='owner'?'개인 기록':'전체 기록'}</small><h3>{r.data.title}</h3><p>{r.data.reason}</p></div></article>)}{data.events.length===0?<div className="empty-card">생각을 남기면 변화의 기록이 시작됩니다.</div>:data.events.map(event=><article key={event.id}><span className="timeline-dot"><GitBranch size={16}/></span><div className="timeline-body"><small>{time(event.createdAt)} · {findMember(event.actorId)?.name||'참가자'}</small><h3>{event.title}</h3><p>{event.reason}</p><div className="snapshot"><span>그 순간의 생각 · r{event.revision}</span><strong>{event.snapshot.title}</strong><p>{event.snapshot.body}</p></div><button className="text-button" onClick={()=>setSelected(event.ideaId)}>현재 아이디어 <ArrowUpRight size={14}/></button></div></article>)}</section>}
 <footer className="page-footer"><span>작은 생각, 함께 만드는 변화.</span><span>vibe. workshop</span></footer>
 </main></div>
 {chatOpen&&<aside className="chat-panel"><div className="chat-heading"><div><span className="mini-label">STAY CONNECTED</span><h2>우리의 대화</h2></div><button className="icon-button" aria-label="채팅 닫기" onClick={()=>setChatOpen(false)}><X size={18}/></button></div><div className="channel-tabs"><button className={channel==='cohort'?'active':''} onClick={()=>setChannel('cohort')}>전체 대화</button><button className={channel!=='cohort'?'active':''} disabled={!me.projectId} onClick={()=>me.projectId&&setChannel(me.projectId)}>팀 대화</button></div><div className="chat-intro"><div className="chat-lineup">{data.members.slice(0,4).map(m=><Avatar member={m} key={m.id}/>)}</div><strong>{channel==='cohort'?'여기는 모두의 대화방':'우리 팀 대화방'}</strong><p>가볍게 인사하고, 궁금한 것을 물어보세요.</p></div><div className="chat-messages"><button className='quiet-button' disabled={busy||pageCursors['messages:'+channel]===null} onClick={()=>loadOlder('messages',channel)}>이전 대화 불러오기</button>{messages.length===0&&<p className="chat-empty">첫 인사를 남겨보세요 👋</p>}{messages.map(m=><div key={m.id} className={'message '+(m.authorId===me.id?'mine':'')}><Avatar member={findMember(m.authorId)}/><div><span>{findMember(m.authorId)?.name||'참가자'}<small>{new Date(m.createdAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'})}</small></span><p>{m.body}</p></div></div>)}</div><form onSubmit={send} className="chat-compose"><label className="sr-only" htmlFor="chat-input">메시지</label><textarea id="chat-input" value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="이야기를 이어가세요..." maxLength={2000} rows={3}/><div><small>서로의 생각을 존중해주세요.</small><button type="submit" className="send-button" disabled={busy||!chatText.trim()} aria-label="메시지 보내기"><Send size={16}/></button></div></form></aside>}
 <CharacterPicker open={characterOpen} current={characterFor(me).id} busy={busy} error={error} onClose={()=>setCharacterOpen(false)} onSave={id=>run({type:'setAvatar',avatarId:id})}/>
 <dialog ref={modalRef} onCancel={()=>setComposer(false)} className="modal"><form onSubmit={submitIdea}><div className="modal-heading"><div><span className="mini-label">A SMALL IDEA, A NEW POSSIBILITY</span><h2>{editing?'생각을 더 구체적으로':'당신의 생각을 들려주세요'}</h2></div><button type="button" className="icon-button" onClick={()=>setComposer(false)} aria-label="닫기"><X size={20}/></button></div>{error&&<p className="form-error" role="alert">{error}</p>}<label>어떤 이야기인가요?<select value={kind} onChange={e=>setKind(e.target.value as Idea['kind'])} disabled={!!editing}><option value="thought">생각 나누기</option><option value="question">함께 고민해요</option><option value="progress">진행 공유</option></select></label><label>한 문장으로 표현하면<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} required maxLength={120} placeholder="어떤 문제를 해결하고 싶나요?"/></label><label>조금 더 들려주세요<textarea value={body} onChange={e=>setBody(e.target.value)} required maxLength={5000} rows={6} placeholder="어떤 상황에서 불편했나요? 누구에게 도움이 될까요?"/></label>{editing?<label>무엇 때문에 생각이 바뀌었나요?<input value={reason} onChange={e=>setReason(e.target.value)} required maxLength={120} placeholder="변경 이유를 기록해요"/></label>:<label>누구와 나눌까요?<select value={scope} onChange={e=>setScope(e.target.value as Scope)}><option value="owner">나만 보기 · 개인 초안</option><option value="cohort">기수 전체</option><option value="project" disabled={!me.projectId}>우리 팀</option></select></label>}<div className="modal-footer"><span><Lock size={13}/>{editing?'이전 내용은 이력에 보존됩니다.':'선택한 범위의 사람에게만 보여요.'}</span><button className="primary-button" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<ArrowUpRight size={16}/>} {editing?'변경 기록하기':'생각 남기기'}</button></div></form></dialog>
 <dialog ref={detailRef} onCancel={()=>setSelected(null)} className="modal detail-modal">{focused&&<><div className="modal-heading"><span className={'kind-tag '+focused.kind}>{kindLabel[focused.kind]}</span><button className="icon-button" onClick={()=>setSelected(null)} aria-label="닫기"><X size={20}/></button></div><h2>{focused.title}</h2><div className="detail-author"><Avatar member={findMember(focused.ownerId)}/><span>{findMember(focused.ownerId)?.name} · v{focused.version}</span></div><p className="detail-body">{focused.body}</p>{focused.sourceMessageId&&<p className='wk-callout'>대화에서 연결된 생각 · {data.messages.find(m=>m.id===focused.sourceMessageId)?.body||'이전 대화에서 원문을 확인하세요.'}</p>}<details className="wk-version"><summary>이 생각의 전체 변화 이력</summary>{data.events.filter(e=>e.ideaId===focused.id).map(e=><article key={e.id}><small>{time(e.createdAt)} · r{e.revision}</small><h4>{e.title}</h4><p>{e.reason}</p><pre className="wk-transcript">{e.snapshot.title+'\n'+e.snapshot.body}</pre></article>)}<button className="quiet-button" disabled={busy||pageCursors['history:'+focused.id]===null} onClick={()=>loadOlder('history',focused.id)}>이전 이력 불러오기</button></details>{error&&<p className="form-error" role="alert">{error}</p>}<div className="detail-actions">{focused.ownerId===me.id&&focused.state==='shared'&&<button className="secondary-button" onClick={()=>{setSelected(null);openComposer(focused);}}><Pencil size={14}/>생각 다듬기</button>}{me.role==='admin'&&focused.state==='shared'&&focused.scope==='cohort'&&<><button className="secondary-button" onClick={()=>{setAction({idea:focused,type:'select'});setTitle(focused.title);setReason('');setSelected(null);}}><GitBranch size={14}/>프로젝트로 선정</button><button className="quiet-button" onClick={()=>{setAction({idea:focused,type:'close'});setReason('');setSelected(null);}}><Archive size={14}/>종료 보관</button></>}</div><div className="detail-comments"><h3>함께 나누는 의견</h3><button className='quiet-button' disabled={busy||pageCursors['comments:'+focused.id]===null} onClick={()=>loadOlder('comments',focused.id)}>이전 의견 불러오기</button>{data.comments.filter(c=>c.ideaId===focused.id).map(c=><div className="comment" key={c.id}><Avatar member={findMember(c.authorId)}/><div><strong>{findMember(c.authorId)?.name}</strong><p>{c.body}</p><small>{time(c.createdAt)}</small></div></div>)}{focused.state!=='closed_unselected'&&<form onSubmit={async e=>{e.preventDefault();if(await run({type:'comment',ideaId:focused.id,body:comment.trim()}))setComment('');}}><label className="sr-only" htmlFor="comment">의견 남기기</label><textarea id="comment" value={comment} onChange={e=>setComment(e.target.value)} placeholder="질문이나 새로운 시선을 더해주세요." maxLength={5000} rows={3} required/><button className="primary-button" disabled={busy||!comment.trim()}>의견 남기기 <Send size={14}/></button></form>}</div></>}</dialog>
 <dialog ref={actionRef} onCancel={()=>setAction(null)} className="modal"><form onSubmit={async e=>{e.preventDefault();if(!action)return;const c:Command=action.type==='select'?{type:'selectIdea',ideaId:action.idea.id,revision:action.idea.revision,projectName:title,reason}:{type:'closeIdea',ideaId:action.idea.id,revision:action.idea.revision,reason};if(await run(c))setAction(null);}}><div className="modal-heading"><h2>{action?.type==='select'?'프로젝트의 시작':'아이디어 종료 보관'}</h2><button type="button" className="icon-button" aria-label="닫기" onClick={()=>setAction(null)}><X size={20}/></button></div><p className="modal-description">{action?.type==='select'?'제안자를 리더로 프로젝트를 만들고, 출발 아이디어를 연결합니다.':'원본과 그동안의 대화는 보존됩니다. 종료 후에는 읽기 전용으로 보여요.'}</p>{error&&<p role="alert" className="form-error">{error}</p>}{action?.type==='select'&&<label>프로젝트 이름<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></label>}<label>이유를 기록해주세요<input required value={reason} onChange={e=>setReason(e.target.value)} maxLength={120}/></label><div className="modal-footer"><span>변경 시점과 결정이 이력에 남습니다.</span><button className="primary-button" disabled={busy}>확정하기 <Check size={16}/></button></div></form></dialog>
 {notice&&<div className="toast" role="status"><CheckCircle2 size={17}/>{notice}</div>}
 </div>;
}
