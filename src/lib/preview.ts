import type {Workspace,Command,Idea,HistoryEvent} from './types';
import {assertAdmin,assertEditable,assertCanRead,assertChannel,validateSelection} from './policy';
const date='2026-10-12T01:00:00.000Z';
export function previewWorkspace():Workspace {
 const members=[
 {id:'min',name:'김민지',avatar:'',role:'admin' as const,projectId:null,active:true},
 {id:'jun',name:'이준호',avatar:'',role:'participant' as const,projectId:'p-onboarding',active:true},
 {id:'seo',name:'박서연',avatar:'',role:'participant' as const,projectId:'p-onboarding',active:true},
 {id:'ha',name:'정하늘',avatar:'',role:'participant' as const,projectId:null,active:true},
 ];
 const ideas:Idea[]=[
 {id:'i1',title:'처음 온 사람도 편안한 커뮤니티를 만들고 싶어요',body:'새로운 모임에 가면 어디에 앉아야 할지, 누구에게 말을 걸어야 할지 막막해요. 처음 참여하는 사람과 기존 멤버를 자연스럽게 연결해주면 어떨까요?',kind:'thought',ownerId:'min',scope:'cohort',projectId:null,state:'shared',revision:1,version:1,createdAt:date,updatedAt:date},
 {id:'i2',title:'팀의 지식이 사람과 함께 사라지지 않도록',body:'인수인계를 받을 때 흩어진 문서와 채팅을 찾아다니느라 며칠을 보내곤 해요. 신규 입사자의 첫 일주일을 위한 작은 길잡이를 생각하고 있어요.',kind:'progress',ownerId:'jun',scope:'cohort',projectId:null,state:'selected',revision:2,version:1,createdAt:date,updatedAt:date},
 {id:'i3',title:'우리 동네의 남는 공간, 함께 쓸 수 없을까요?',body:'주말이면 비어 있는 사무실과 연습할 장소가 필요한 동아리. 서로의 필요를 연결할 수 있는 방법이 궁금해요.',kind:'question',ownerId:'ha',scope:'cohort',projectId:null,state:'shared',revision:1,version:1,createdAt:date,updatedAt:date},
 ];
 return {cohort:{id:'preview',name:'바이브코딩 1기',week:1},me:members[0],members,ideas,
 comments:[{id:'c1',ideaId:'i1',authorId:'seo',body:'저도 공감해요! 관심사가 비슷한 사람을 미리 알 수 있다면 좋겠어요.',createdAt:date}],
 projects:[{id:'p-onboarding',name:'첫걸음',problem:'신규 입사자의 첫 일주일을 돕는 온보딩 길잡이',leaderId:'jun',memberIds:['jun','seo'],sourceIdeaId:'i2',stage:'기획 중',createdAt:date}],
 activity:{id:'discovery',title:'작은 불편에서, 새로운 가능성으로',question:'일상에서 바꾸고 싶은 순간이 있나요?',description:'정답은 없어요. 직접 겪은 불편한 순간 하나를 동료들과 나눠보세요.',state:'open',week:1},
 messages:[{id:'m1',authorId:'jun',body:'오늘 나눈 이야기들이 정말 흥미로웠어요 👋',channel:'cohort',createdAt:date},{id:'m2',authorId:'seo',body:'아이디어 보드에 질문을 남겼어요. 같이 이야기해봐요!',channel:'cohort',createdAt:date}],
 events:ideas.map(i=>({id:'e'+i.id,ideaId:i.id,title:'첫 생각 공유',reason:'오프라인 대화에서 출발한 첫 아이디어',actorId:i.ownerId,createdAt:date,revision:1,snapshot:{title:i.title,body:i.body,scope:i.scope,state:'shared'}}))};
}
export function previewCommand(state:Workspace,command:Command):Workspace {
 const next=structuredClone(state), now=new Date().toISOString(), uid=next.me.id;
 const uuid=()=>crypto.randomUUID();
 const record=(idea:Idea,title:string,reason:string)=>next.events.unshift({id:uuid(),ideaId:idea.id,title,reason,actorId:uid,createdAt:now,revision:idea.revision,snapshot:{title:idea.title,body:idea.body,scope:idea.scope,state:idea.state}});
 if(command.type==='createIdea'){
  if(command.scope!=='owner' && next.activity.state==='closed')throw new Error('현재 활동이 마감되었습니다.');
  if(command.scope==='project'&&!next.me.projectId)throw new Error('프로젝트에 먼저 참여해주세요.');
  const idea:Idea={id:uuid(),...command,ownerId:uid,projectId:command.scope==='project'?next.me.projectId:null,state:'shared',revision:1,version:1,createdAt:now,updatedAt:now};
  next.ideas.unshift(idea);record(idea,'첫 생각 공유','최초 작성');
 }else if(command.type==='sendMessage'){assertChannel(next.me,command.channel);next.messages.push({id:uuid(),authorId:uid,body:command.body,channel:command.channel,createdAt:now});
 }else if(command.type==='setActivity'){assertAdmin(next.me);next.activity.state=command.state;
 }else{
  const idea=next.ideas.find(i=>i.id===(command.type==='editIdea'?command.id:command.ideaId));if(!idea)throw new Error('아이디어가 없습니다.');
  assertCanRead(next.me,idea);
  if(command.type==='comment'){if(idea.state==='closed_unselected')throw new Error('종료된 아이디어입니다.');next.comments.push({id:uuid(),ideaId:idea.id,authorId:uid,body:command.body,createdAt:now});}
  else if(command.type==='editIdea'){assertEditable(next.me,idea,command.revision);idea.title=command.title;idea.body=command.body;idea.revision++;idea.version++;idea.updatedAt=now;record(idea,'생각을 구체화했어요',command.reason);}
  else if(command.type==='closeIdea'){assertAdmin(next.me);idea.state='closed_unselected';idea.revision++;record(idea,'아이디어 종료',command.reason);}
  else{
   const owner=next.members.find(m=>m.id===idea.ownerId)!;validateSelection(next.me,idea,command.revision,owner);
   const project={id:uuid(),name:command.projectName,problem:idea.title,leaderId:idea.ownerId,memberIds:[idea.ownerId],sourceIdeaId:idea.id,stage:'기획 중',createdAt:now};
   next.projects.push(project);owner.projectId=project.id;if(owner.id===uid)next.me.projectId=project.id;
   idea.state='selected';idea.revision++;record(idea,'프로젝트로 선정되었어요',command.reason);
  }
 }
 return next;
}
