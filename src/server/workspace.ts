import {feedbackContextSchema,validateFeedbackContext} from '@/lib/exhibition';
import {refinementInputSchema,nextRefinement,statement} from '@/lib/refinement';
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { db } from './firebase';
import { DomainError, assertAdmin, assertCanRead, assertChannel, assertDeletable, assertEditable, assertRevision, canReadIdea, projectIdsOf, validateSelection } from '@/lib/policy';
import type { Activity, Command, Comment, HistoryEvent, Idea, Member, Message, Project, Workspace } from '@/lib/types';
import { z } from 'zod';
import {characterIds} from '@/lib/characters';
import {stepKey} from '@/lib/steps';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const short = z.string().trim().min(1).max(120);
const body = z.string().trim().min(1).max(5000);
const commandSchema = z.discriminatedUnion('type', [
 z.object({ type: z.literal('createIdea'), title: short, body, kind: z.enum(['thought','question','progress']), scope: z.enum(['owner','project','cohort']), authorName: z.string().trim().max(40).optional() }),
 z.object({type:z.literal('refineIdea'),id,revision:z.number().int().nonnegative(),phase:z.enum(['questions','definition']),input:refinementInputSchema,reason:short,scope:z.enum(['owner','project','cohort'])}),
 z.object({ type: z.literal('editIdea'), id, revision: z.number().int().nonnegative(), title: short, body, reason: short }),
 z.object({ type: z.literal('deleteIdea'), id, revision: z.number().int().nonnegative() }),
 z.object({ type: z.literal('comment'), ideaId: id, body, context:feedbackContextSchema.optional() }),
 z.object({ type: z.literal('sendMessage'), channel: id, body: body.max(2000), step: stepKey.optional() }),
 z.object({ type: z.literal('selectIdea'), ideaId: id, revision: z.number().int().nonnegative(), projectName: short, reason: short }),
 z.object({ type: z.literal('closeIdea'), ideaId: id, revision: z.number().int().nonnegative(), reason: short }),
 z.object({ type: z.literal('setAvatar'), avatarId: z.enum(characterIds) }).strict(),
 z.object({ type: z.literal('setActivity'), state: z.enum(['open','closed']) }),
]);
export const envelopeSchema = z.object({ cohortId: id, requestId: z.string().uuid(), command: commandSchema });
export function cohortRef(cohortId: string) { return db().collection('cohorts').doc(id.parse(cohortId)); }

async function getMember(c: ReturnType<typeof cohortRef>, uid: string) {
 const snapshot = await c.collection('members').doc(uid).get();
 if (!snapshot.exists || snapshot.data()?.active !== true) throw new DomainError('NOT_ENROLLED', '참가자 등록이 필요합니다. Google 계정으로 다시 로그인해주세요.', 403);
 return { ...snapshot.data(), id: uid } as Member;
}

export async function enroll(cohortId: string, identity: {uid:string;email:string;name:string;avatar:string}) {
 const c = cohortRef(cohortId), email=identity.email.toLowerCase().trim();
 const key = createHash('sha256').update(email).digest('hex');
 await db().runTransaction(async tx => {
  const ref = c.collection('members').doc(identity.uid);
  // Preserve previously assigned roles, including the initial administrator.
  const grantRef = c.collection('invites').doc(key);
  const [member, grant, cohort, settings] = await Promise.all([
   tx.get(ref), tx.get(grantRef), tx.get(c), tx.get(c.collection('workshop').doc('settings'))
  ]);
  if (!cohort.exists) throw new DomainError('NOT_READY', '기수 설정이 아직 완료되지 않았습니다.', 503);
  if (member.exists) {
   if (!member.data()?.active) throw new DomainError('FORBIDDEN', '참여 권한이 중지되었습니다.', 403);
   return;
  }
  if(cohort.data()?.status==='completed' || settings.data()?.data?.state==='completed')
   throw new DomainError('CLOSED','종료된 기수에는 새로 참여할 수 없습니다.',403);
  const value=grant.data(), now=new Date().toISOString();
  const assigned=value?.email===email && value.status==='pending' && value.expiresAt>now;
  const role=assigned && ['participant','facilitator','admin'].includes(value.role) ? value.role : 'participant';
  const memberData: Member = { id: identity.uid, name: identity.name, avatar: '', role, projectId: null, active: true };
  tx.create(ref, memberData);
  tx.create(c.collection('profiles').doc(identity.uid), memberData);
  if(assigned)tx.update(grantRef, {status:'accepted',acceptedBy:identity.uid,acceptedAt:now});
 });
}

export async function getWorkspace(cohortId: string, uid: string): Promise<Workspace> {
 const c = cohortRef(cohortId), me = await getMember(c,uid);
 const queries = [c.collection('ideas').where('scope','==','cohort').limit(100).get(), c.collection('ideas').where('ownerId','==',uid).limit(100).get()];
 if (me.projectId) queries.push(c.collection('ideas').where('projectId','==',me.projectId).where('scope','==','project').limit(100).get());
 const [cohort, profiles, directory, activity, ...ideaSets] = await Promise.all([
  c.get(), c.collection('profiles').limit(200).get(), c.collection('projectDirectory').limit(100).get(),
  c.collection('activities').doc('discovery').get(), ...queries
 ]);
 const map = new Map<string,Idea>();
 for (const set of ideaSets) for (const d of set.docs) { const idea = {...d.data(),id:d.id} as Idea; if (canReadIdea(me,idea)) map.set(d.id,idea); }
 const ideas = [...map.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100);
 const comments: Comment[] = [], events: HistoryEvent[] = [];
 await Promise.all(ideas.slice(0,30).map(async idea => {
  const [cs,vs] = await Promise.all([c.collection('ideas').doc(idea.id).collection('comments').orderBy('createdAt','desc').limit(50).get(),
   c.collection('ideas').doc(idea.id).collection('history').orderBy('createdAt','desc').limit(20).get()]);
  for (const d of cs.docs) comments.push({...d.data(),id:d.id} as Comment);
  for (const d of vs.docs) events.push({...d.data(),id:d.id} as HistoryEvent);
 }));
 const messages: Message[] = [];
 await Promise.all(['cohort', ...(me.projectId ? [me.projectId] : [])].map(async channel => {
  const ms = await c.collection('channels').doc(channel).collection('messages').orderBy('createdAt','desc').limit(50).get();
  for(const d of ms.docs) messages.push({...d.data(),id:d.id} as Message);
 }));
 return {
  cohort:{ id:cohortId, name:cohort.data()?.name || '바이브코딩 워크숍', week:cohort.data()?.week || 1 },
  me, members:profiles.docs.filter(d=>d.data().active||me.role==='admin').map(d=>({...d.data(),id:d.id} as Member)), ideas,
  comments:comments.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),
  projects:directory.docs.map(d=>({...d.data(),id:d.id} as Project)),
  activity:activity.exists ? {...activity.data(),id:activity.id} as Activity : {id:'discovery',title:'문제 발견',question:'어떤 불편을 해결하고 싶나요?',description:'일상에서 느낀 작은 불편을 꺼내보세요.',state:'closed',week:1},
  messages:messages.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),
  events:events.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),
 };
}

export async function runCommand(cohortId: string, uid: string, requestId: string, raw: Command) {
 const command = commandSchema.parse(raw);
 const c=cohortRef(cohortId);
 const hash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
 const replayRef=c.collection('idempotency').doc(uid+'_'+requestId);
 return db().runTransaction(async tx => {
  const now=new Date().toISOString();
  const memberRef=c.collection('members').doc(uid);
  const [memberSnap,replay,settings]=await Promise.all([tx.get(memberRef),tx.get(replayRef),tx.get(c.collection('workshop').doc('settings'))]);
  if(!memberSnap.exists || memberSnap.data()?.active!==true) throw new DomainError('FORBIDDEN','기수 참여 권한이 필요합니다.',403);
  const me={...memberSnap.data(),id:uid} as Member;
  if(replay.exists) {
   if(replay.data()?.hash!==hash) throw new DomainError('CONFLICT','요청 식별자가 다른 작업에 사용되었습니다.',409);
   return replay.data()?.result;
  }
  if(settings.data()?.data?.state==='completed')throw new DomainError('CLOSED','종료된 기수는 읽기 전용입니다.',409);
  let result:{id:string}={id:requestId};
  const history=(idea:Idea,title:string,reason:string) => {
   const ref=c.collection('ideas').doc(idea.id).collection('history').doc();
   tx.create(ref,{id:ref.id,ideaId:idea.id,title,reason,actorId:uid,createdAt:now,revision:idea.revision,
    snapshot:{title:idea.title,body:idea.body,scope:idea.scope,state:idea.state,...(idea.refinement?{refinement:idea.refinement}:{})}});
  };
  if(command.type==='setAvatar') {
   tx.update(memberRef,{avatar:command.avatarId,updatedAt:now});
   tx.update(c.collection('profiles').doc(uid),{avatar:command.avatarId,updatedAt:now});
   result={id:uid};
  } else if(command.type==='createIdea') {
   if(command.scope==='project' && !me.projectId) throw new DomainError('NO_PROJECT','먼저 프로젝트에 참여해주세요.',409);
   // The cohort activity gates cohort-wide sharing only; team cards follow the project's own steps.
   if(command.scope==='cohort') {
    const activity=await tx.get(c.collection('activities').doc('discovery'));
    if(activity.data()?.state!=='open'||activity.data()?.closesAt&&activity.data()?.closesAt<=now) throw new DomainError('CLOSED','현재 활동이 마감되었습니다. 나만 보기로 저장할 수 있습니다.',409);
   }
   const ref=c.collection('ideas').doc();
   const idea:Idea={id:ref.id,title:command.title,body:command.body,kind:command.kind,ownerId:uid,scope:command.scope,projectId:command.scope==='project'?me.projectId:null,state:'shared',revision:1,version:1,createdAt:now,updatedAt:now,...(command.authorName?{authorName:command.authorName}:{})};
   tx.create(ref,idea); history(idea,command.scope==='owner'?'첫 생각 저장':'첫 생각 공유','최초 작성'); result={id:ref.id};
  } else if(command.type==='sendMessage') {
   assertChannel(me,command.channel);
   const rateRef=c.collection('messageRates').doc(uid);
   const rate=await tx.get(rateRef);
   if(rate.exists && Date.now()-Date.parse(rate.data()?.sentAt)<1000) throw new DomainError('RATE_LIMITED','잠시 후 메시지를 보내주세요.',429);
   const ref=c.collection('channels').doc(command.channel).collection('messages').doc();
   tx.create(ref,{id:ref.id,authorId:uid,body:command.body,channel:command.channel,createdAt:now,...(command.step&&command.channel!=='cohort'?{step:command.step}:{})});
   tx.set(rateRef,{sentAt:now}); result={id:ref.id};
  } else if(command.type==='setActivity') {
   if(me.role!=='admin' && me.role!=='facilitator') throw new DomainError('FORBIDDEN','운영 권한이 필요합니다.',403);
   const ref=c.collection('activities').doc('discovery'); const featured=await tx.get(ref);
   if(command.state==='open'&&featured.data()?.closesAt&&featured.data()?.closesAt<=now)throw new DomainError('EXPIRED','워크숍 진행에서 활동 마감 시각을 먼저 연장해주세요.',409);
   const linked=featured.data()?.activityId?c.collection('workshop').doc(featured.data()!.activityId):null;
   const linkedSnap=linked?await tx.get(linked):null;
   if(linked&&linkedSnap?.exists)tx.update(linked,{'data.state':command.state,revision:(linkedSnap.data()?.revision||0)+1,updatedAt:now});
   tx.update(ref,{state:command.state,updatedAt:now,updatedBy:uid});
  } else {
   const ideaId=(command.type==='editIdea'||command.type==='refineIdea'||command.type==='deleteIdea')?command.id:command.ideaId;
   const ref=c.collection('ideas').doc(ideaId), snap=await tx.get(ref);
   if(!snap.exists) throw new DomainError('NOT_FOUND','아이디어를 찾을 수 없습니다.',404);
   const idea={...snap.data(),id:ideaId} as Idea; assertCanRead(me,idea);
   if(command.type==='deleteIdea') {
    assertDeletable(me,idea,command.revision);
    // The team's confirmed problem is what planning builds on, so it stays until the leader confirms another card.
    if(idea.projectId){
     const team=await tx.get(c.collection('projects').doc(idea.projectId));
     if(team.data()?.confirmedProblem?.ideaId===idea.id)throw new DomainError('LOCKED','팀이 확정한 문제 카드는 지울 수 없어요. 리더가 다른 카드를 확정한 뒤 지워주세요.',409);
    }
    tx.delete(ref);result={id:ideaId};
   } else if(command.type==='comment') {
    if(idea.state==='closed_unselected') throw new DomainError('LOCKED','종료된 아이디어는 읽기 전용입니다.',409);
    if(command.context){
     const versions=await tx.get(ref.collection('history').where('revision','==',command.context.revision).limit(1));
     const snapshot=versions.docs[0]?.data()?.snapshot||(command.context.revision===idea.revision?idea:undefined);
     validateFeedbackContext(command.context,snapshot);
    }
    const comment=ref.collection('comments').doc();
    tx.create(comment,{id:comment.id,ideaId,authorId:uid,body:command.body,createdAt:now,...(command.context?{context:command.context}:{})});result={id:comment.id};
   } else if(command.type==='refineIdea') {
    assertEditable(me,idea,command.revision);
    if(command.scope==='project'&&!me.projectId)throw new DomainError('NO_PROJECT','프로젝트에 먼저 참여해주세요.',409);
    if(command.scope!==idea.scope&&command.scope!=='owner'){
     const activity=await tx.get(c.collection('activities').doc('discovery'));
     if(activity.data()?.state!=='open'||activity.data()?.closesAt&&activity.data()?.closesAt<=now)throw new DomainError('CLOSED','현재 활동이 마감되어 공유 범위를 바꿀 수 없습니다.',409);
    }
    const refinement=nextRefinement(idea,command.phase,command.input,command.reason);
    const next={...idea,refinement,scope:command.scope,projectId:command.scope==='project'?me.projectId:null,revision:idea.revision+1,version:idea.version+1,updatedAt:now};
    tx.update(ref,next);history(next,command.phase==='questions'?'경험 질문에 답함':'문제정의 초안 '+refinement.draft+(refinement.ready?' · 선정 준비':''),command.reason);result={id:ideaId};
   } else if(command.type==='editIdea') {
    assertEditable(me,idea,command.revision);
    const next={...idea,...(idea.refinement?{refinement:{...idea.refinement,ready:false,definition:{...idea.refinement.definition,solutionReviewed:false}}}:{}),title:command.title,body:command.body,revision:idea.revision+1,version:idea.version+1,updatedAt:now};
    tx.update(ref,next);history(next,'생각을 구체화했어요',command.reason);result={id:ideaId};
   } else if(command.type==='closeIdea') {
    assertAdmin(me);assertRevision(idea,command.revision);
    if(idea.scope!=='cohort'||idea.state!=='shared') throw new DomainError('INVALID_STATE','공유 중인 후보만 종료할 수 있습니다.',409);
    const next={...idea,state:'closed_unselected' as const,revision:idea.revision+1,updatedAt:now};
    tx.update(ref,next);history(next,'아이디어 종료',command.reason);result={id:ideaId};
   } else {
    const ownerRef=c.collection('members').doc(idea.ownerId), ownerSnap=await tx.get(ownerRef);
    if(!ownerSnap.exists || !ownerSnap.data()?.active) throw new DomainError('INVALID_OWNER','제안자의 참여 상태를 확인해주세요.',409);
    const owner={...ownerSnap.data(),id:idea.ownerId} as Member;
    validateSelection(me,idea,command.revision,owner);
    if(settings.data()?.data?.mode==='solo')throw new DomainError('MODE','개인 프로젝트는 워크숍 진행 메뉴에서 시작해주세요.',409);
    const projectRef=c.collection('projects').doc();
    const project:Project={id:projectRef.id,name:command.projectName,problem:idea.refinement?.ready?statement(idea.refinement):idea.title,leaderId:owner.id,memberIds:[owner.id],sourceIdeaId:idea.id,stage:'기획 중',createdAt:now};
    tx.create(projectRef,project);tx.create(c.collection('projectDirectory').doc(projectRef.id),project);
    tx.create(projectRef.collection('members').doc(owner.id),{role:'leader',status:'active',acceptedAt:now});
    const membership={projectId:projectRef.id,projectIds:[...new Set([...projectIdsOf(owner),projectRef.id])]};
    tx.update(ownerRef,membership);tx.update(c.collection('profiles').doc(owner.id),membership);
    const next={...idea,state:'selected' as const,revision:idea.revision+1,updatedAt:now};
    tx.update(ref,next);history(next,'프로젝트로 선정되었어요',command.reason);result={id:projectRef.id};
   }
  }
  tx.create(replayRef,{hash,result,createdAt:now});return result;
 });
}
