import type {CharacterId} from './characters';
export type Role = 'participant' | 'facilitator' | 'admin';
export type Scope = 'owner' | 'project' | 'cohort';
export type IdeaState = 'shared' | 'candidate' | 'selected' | 'closed_unselected';
export type Member = { id: string; name: string; avatar: string; role: Role; projectId: string | null; active: boolean };
export type Idea = {
 id: string; title: string; body: string; kind: 'thought' | 'question' | 'progress';
 ownerId: string; scope: Scope; projectId: string | null; state: IdeaState;
 revision: number; version: number; createdAt: string; updatedAt: string; sourceId?: string; sourceMessageId?: string; sourceChannel?: string; sourceSubmissionId?: string;
};
export type Comment = { id: string; ideaId: string; authorId: string; body: string; createdAt: string };
export type Project = { id: string; name: string; problem: string; leaderId: string; memberIds: string[]; sourceIdeaId: string; stage: string; createdAt: string; mode?: 'solo'|'team'; capacity?: number };
export type Message = { id: string; authorId: string; body: string; channel: string; createdAt: string; replyToId?: string; mentions?: string[]; revision?: number; pinned?: boolean; editedAt?: string };
export type Activity = { id: string; title: string; question: string; description: string; state: 'open' | 'closed'; week: number };
export type HistoryEvent = { id: string; ideaId: string; title: string; reason: string; actorId: string; createdAt: string; revision: number; snapshot: Pick<Idea, 'title' | 'body' | 'scope' | 'state'> };
export type Workspace = {
 cohort: { id: string; name: string; week: number }; me: Member; members: Member[]; ideas: Idea[];
 comments: Comment[]; projects: Project[]; activity: Activity; messages: Message[]; events: HistoryEvent[];
};
export type Command =
 | { type: 'createIdea'; title: string; body: string; kind: Idea['kind']; scope: Scope }
 | { type: 'editIdea'; id: string; revision: number; title: string; body: string; reason: string }
 | { type: 'comment'; ideaId: string; body: string }
 | { type: 'sendMessage'; channel: string; body: string }
 | { type: 'selectIdea'; ideaId: string; revision: number; projectName: string; reason: string }
 | { type: 'closeIdea'; ideaId: string; revision: number; reason: string }
 | { type: 'setAvatar'; avatarId: CharacterId }
 | { type: 'setActivity'; state: 'open' | 'closed' };
