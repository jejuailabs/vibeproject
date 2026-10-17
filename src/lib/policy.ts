import {assertProblemReady} from './refinement';
import type { Idea, Member } from './types';

export class DomainError extends Error {
 constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function canReadIdea(member: Member, idea: Idea): boolean {
 if (!member.active) return false;
 if (idea.scope === 'owner') return idea.ownerId === member.id;
 if (idea.scope === 'cohort') return true;
 return idea.scope === 'project' && !!member.projectId && idea.projectId === member.projectId;
}
export function assertCanRead(member: Member, idea: Idea) {
 if (!canReadIdea(member, idea)) throw new DomainError('NOT_FOUND', '자료를 찾을 수 없거나 접근 권한이 없습니다.', 404);
}
export function assertEditable(member: Member, idea: Idea, revision: number) {
 assertCanRead(member, idea);
 if (member.id !== idea.ownerId) throw new DomainError('FORBIDDEN', '작성자만 내용을 수정할 수 있습니다.', 403);
 if (idea.state !== 'shared') throw new DomainError('LOCKED', '선정되거나 종료된 원본은 수정할 수 없습니다.', 409);
 assertRevision(idea, revision);
}
export function assertRevision(idea: Idea, revision: number) {
 if (idea.revision !== revision) throw new DomainError('CONFLICT', '다른 변경이 먼저 저장되었습니다. 최신 내용을 확인해주세요.', 409);
}
export function assertAdmin(member: Member) {
 if (!member.active || member.role !== 'admin') throw new DomainError('FORBIDDEN', '기수 관리자 권한이 필요합니다.', 403);
}
export function assertChannel(member: Member, channel: string) {
 if (!member.active || (channel !== 'cohort' && channel !== member.projectId))
  throw new DomainError('FORBIDDEN', '이 대화방에 접근할 수 없습니다.', 403);
}
export function validateSelection(member: Member, idea: Idea, revision: number, owner: Member) {
 assertAdmin(member); assertCanRead(member, idea); assertRevision(idea, revision);
 if (idea.scope !== 'cohort' || idea.state !== 'shared') throw new DomainError('INVALID_STATE', '기수에 공유된 아이디어만 선정할 수 있습니다.', 409);
 assertProblemReady(idea);
 if (owner.projectId) throw new DomainError('ALREADY_JOINED', '제안자가 이미 프로젝트에 참여 중입니다.', 409);
}
