import type { StepKey } from "../steps";
import type { Workspace, Member, Idea, Project } from "../types";
export type Scope = "owner" | "project" | "cohort" | "admin";
export type DocKey =
  | "product"
  | "features"
  | "screens"
  | "design"
  | "data-auth"
  | "setup-deploy"
  | "acceptance";
export const docKeys = [
  "product",
  "features",
  "screens",
  "design",
  "data-auth",
  "setup-deploy",
  "acceptance",
] as const;
export const docNames: Record<DocKey, string> = {
  product: "문제와 사용자",
  features: "기능과 범위",
  screens: "화면과 흐름",
  design: "디자인 정의",
  "data-auth": "데이터와 권한",
  "setup-deploy": "개발 환경·배포",
  acceptance: "완료 기준",
};
export const stages = [
  "forming",
  "planning",
  "ready",
  "developing",
  "reviewing",
  "completed",
  "archived",
] as const;
export const stageNames: Record<string, string> = {
  forming: "팀 구성",
  planning: "기획 중",
  ready: "개발 준비",
  developing: "개발 중",
  reviewing: "시연·검토",
  completed: "완료",
  archived: "보관",
};
export const readinessItems = [
  "editor",
  "node",
  "github",
  "vercel",
  "firebase",
  "google",
  "secrets",
] as const;
export const readinessNames: Record<string, string> = {
  editor: "코딩 도구 설치",
  node: "Node.js 실행 확인",
  github: "GitHub 저장소",
  vercel: "Vercel 배포 연결",
  firebase: "Firebase 프로젝트",
  google: "Google 로그인 설정",
  secrets: "비밀키 제외·환경변수 확인",
};
export type VoteData = {
  title: string;
  state: "open" | "closed" | "selected";
  budget: number;
  allowSelfVote: boolean;
  closesAt: string;
  candidates: {
    ideaId: string;
    refinement?: import("../refinement").Refinement;
    revision: number;
    title: string;
    body: string;
    ownerId: string;
  }[];
  counts: Record<string, number>;
  reason: string;
};
// Snapshot taken when the leader saves the showcase; private parts are included only on the leader's choice.
export type ExhibitStory = {
  origin?: { title: string; body: string; ownerId: string; at: string };
  problem: { statement: string; draft: number; reason: string; ownerId: string | null };
  journey?: { members: number; cards: number; drafts: number; meetings: number; decisions: number; tasks: number; tasksDone: number; docs: number; releases: number };
  builtAt: string;
};
export type ProjectData = {
  mode: "solo" | "team";
  capacity: number;
  stage: (typeof stages)[number];
  baselineId: string | null;
  repositoryUrl: string;
  deployUrl: string;
  firebaseUrl: string;
  inviteCode?: string;
};
export interface DataMap {
  settings: {
    name: string;
    week: number;
    mode: "solo" | "team" | "mixed";
    retentionDays: number;
    startsAt: string;
    notice: string;
    state: "running" | "completed";
  };
  activity: {
    title: string;
    question: string;
    instructions: string;
    state: "draft" | "open" | "closed";
    week: number;
    closesAt: string;
    reason: string;
    featured: boolean;
  };
  submission: { activityId: string; body: string };
  submissionVersion: { activityId: string; body: string };
  sourceVersion: {
    sourceId: string;
    title: string;
    text: string;
    sourceRevision: number;
  };
  round: VoteData;
  ballot: { roundId: string; candidateIds: string[] };
  // A project's own vote among its members' problem cards; the leader opens and closes it, then confirms a problem.
  teamVote: { round: number; state: "open" | "closed" | "cancelled" | "deleted"; candidateIds: string[]; counts: Record<string, number>; voters: number; openedAt: string; closedAt: string | null; maxVotes?: number;
    // endsAt is the voting deadline; whoever has not voted by the close counts as abstained.
    endsAt?: string | null; abstained?: number; endedBy?: "time" | "manual";
    // Set at close: cards ranked 1st to 5th with at least one vote; tied cards share a rank.
    top?: { ideaId: string; rank: number; votes: number }[] };
  // ideaId is the single pick of votes opened before multi-vote; ideaIds holds every pick.
  teamBallot: { round: number; voteId?: string; ideaId?: string; ideaIds?: string[] };
  project: ProjectData;
  join: {
    applicantId: string;
    message: string;
    state: "pending" | "accepted" | "rejected" | "withdrawn";
    reason: string;
  };
  support: { userId: string; edit: boolean; expiresAt: string };
  document: {
    key: DocKey;
    title: string;
    markdown: string;
    reason: string;
    sourceId?: string;
    redacted?: boolean;
  };
  version: {
    key: DocKey;
    title: string;
    markdown: string;
    documentRevision: number;
    reason: string;
    sourceId?: string;
    redacted?: boolean;
  };
  baseline: {
    title: string;
    reason: string;
    versions: { key: DocKey; id: string; revision: number }[];
  };
  task: {
    title: string;
    body: string;
    status: "todo" | "doing" | "done";
    assigneeId: string | null;
    sourceMessageId: string | null;
    step?: StepKey;
  };
  decision: {
    title: string;
    body: string;
    reason: string;
    sourceMessageId: string | null;
    step?: StepKey;
  };
  readiness: {
    items: Record<string, { done: boolean; exception: string }>;
    scope: "personal" | "project";
  };
  release: {
    title: string;
    demoUrl: string;
    summary: string;
    knownIssues: string;
    baselineId: string;
  };
  feedback: {
    releaseId: string;
    body: string;
    status: "open" | "accepted" | "resolved";
    resolution: string;
  };
  showcase: {
    problem: string;
    solution: string;
    demoUrl: string;
    slidesUrl: string;
    retrospective: string;
    constraints: string;
    milestones: string[];
    state: "draft" | "published";
    story?: ExhibitStory;
  };
  schedule: {
    startsAt: string;
    totalMinutes: number;
    networkMinutes: number;
    transitionMinutes: number;
    projectIds: string[];
  };
  source: {
    title: string;
    text: string;
    sourceType: "transcript" | "notes";
    consent: boolean;
    redacted: boolean;
    step?: StepKey;
  };
  proposal: {
    sourceId: string;
    sourceRevision: number;
    type: "new_idea" | "question" | "decision" | "task" | "summary";
    title: string;
    body: string;
    evidence: string;
    state: "proposed" | "accepted" | "rejected";
    resultId: string | null;
  };
  aiDraft: {
    key: DocKey;
    markdown: string;
    evidence: string;
    sourceId: string;
    sourceRevision: number;
    documentRevision: number;
    state: "proposed" | "accepted" | "rejected";
  };
  job: {
    sourceId: string;
    sourceRevision: number;
    state: "running" | "ready" | "failed";
    error: string;
    model: string;
    requestHash?: string;
  };
  notification: {
    title: string;
    targetId: string;
    targetKind: string;
    read: boolean;
  };
  help: {
    title: string;
    body: string;
    state: "open" | "resolved";
    resolution: string;
  };
  resource: { title: string; url: string };
  asset: {
    name: string;
    contentType: string;
    size: number;
    storagePath: string;
    state: "pending" | "ready";
    generation: string;
  };
  event: { title: string; reason: string; targetId: string };
  reaction: { ideaId: string };
  read: { channel: string; lastReadAt: string };
  report: {
    targetId: string;
    targetKind: "idea" | "message" | "source";
    channel: string;
    reason: string;
    state: "open" | "resolved";
    resolution: string;
  };
}
export type Kind = keyof DataMap;
export type RecordOf<K extends Kind> = {
  id: string;
  kind: K;
  scope: Scope;
  ownerId: string;
  projectId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  data: DataMap[K];
};
export type WorkshopRecord = { [K in Kind]: RecordOf<K> }[Kind];
export type Snapshot = {
  records: WorkshopRecord[];
  nextCursor: string | null;
  ai: { enabled: boolean; model: string };
  invites?: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
  }[];
};
export type JsonDoc = Record<string, unknown>;
export interface Store {
  read<T>(path: string): Promise<T | undefined>;
  list<T>(
    path: string,
    where?: { field: string; value: unknown }[],
  ): Promise<T[]>;
  write(path: string, value: unknown, merge?: boolean): void;
  remove(path: string): void;
}
export type Context = {
  store: Store;
  uid: string;
  me: Member;
  cohortId: string;
  now: string;
  requestId: string;
  grants: RecordOf<"support">[];
};
export type PreviewState = { workspace: Workspace; records: WorkshopRecord[] };
export type BaseMember = Member;
export type BaseIdea = Idea;
export type BaseProject = Project;
