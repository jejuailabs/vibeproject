import { z } from "zod";
import type { Comment, HistoryEvent, Idea, Message, Project } from "./types";
import type { WorkshopRecord } from "./workshop/model";
import { docNames } from "./workshop/model";

export const stepKeys = ["thought", "questions", "definition", "confirm", "plan", "build", "show"] as const;
export type StepKey = (typeof stepKeys)[number];
export const stepKey = z.enum(stepKeys);
export const stepNames: Record<StepKey, string> = {
  thought: "각자 생각",
  questions: "경험 구체화",
  definition: "문제정의",
  confirm: "문제 확정",
  plan: "기획",
  build: "개발·회의",
  show: "전시",
};

// Timeline groups: the seven steps, team setup events, and records saved before step tags existed.
export type TimelineGroup = StepKey | "team" | "none";
export const groupNames: Record<TimelineGroup, string> = { ...stepNames, team: "팀 구성·운영", none: "단계 표시 없음" };
export const groupOrder: TimelineGroup[] = ["team", ...stepKeys, "none"];
export type EntryKind = "save" | "comment" | "chat" | "meeting" | "decision" | "task" | "doc" | "release" | "showcase" | "project";
export const kindNames: Record<EntryKind, string> = {
  save: "카드 저장",
  comment: "의견",
  chat: "팀 대화",
  meeting: "회의·자료",
  decision: "결정",
  task: "할 일",
  doc: "기획 문서",
  release: "배포",
  showcase: "전시",
  project: "팀 운영",
};
export type TimelineEntry = { id: string; group: TimelineGroup; kind: EntryKind; at: string; actorId: string; title: string; detail: string; ideaId?: string };

const refinementStep = (prev: HistoryEvent | undefined, cur: HistoryEvent): StepKey => {
  if (cur.title === "프로젝트 문제로 확정") return "confirm";
  const before = prev?.snapshot.refinement, after = cur.snapshot.refinement;
  if ((after?.draft || 0) > (before?.draft || 0)) return "definition";
  if (after && JSON.stringify(after.answers) !== JSON.stringify(before?.answers)) return "questions";
  if (after?.ready !== before?.ready && after?.draft) return "definition";
  return "thought";
};
const commentStep: Record<string, StepKey> = { thought: "thought", questions: "questions", definition: "definition", ready: "definition" };
const teamEvents = new Set(["프로젝트 만들기", "프로젝트 참여", "참여 방식 변경", "팀원 탈퇴", "리더 이관", "팀 신청 처리", "지원 권한 부여", "지원 권한 회수"]);

/** Builds a project's history from the records already loaded for the viewer; nothing private is fetched here. */
export function projectTimeline(input: {
  project: Project;
  ideas: Idea[];
  events: HistoryEvent[];
  comments: Comment[];
  messages: Message[];
  records: WorkshopRecord[];
}): TimelineEntry[] {
  const { project } = input, out: TimelineEntry[] = [];
  const cards = new Map(input.ideas.map((i) => [i.id, i]));
  const savedSteps = new Map<string, { at: string; step: StepKey }[]>();
  for (const [ideaId] of cards) {
    const history = input.events.filter((e) => e.ideaId === ideaId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const steps: { at: string; step: StepKey }[] = [];
    history.forEach((e, i) => {
      const step = refinementStep(history[i - 1], e);
      steps.push({ at: e.createdAt, step });
      out.push({ id: "h-" + e.id, group: step, kind: "save", at: e.createdAt, actorId: e.actorId, title: e.title, detail: e.reason === "최초 작성" ? e.snapshot.title : e.snapshot.title + " · " + e.reason, ideaId });
    });
    savedSteps.set(ideaId, steps);
  }
  for (const c of input.comments) {
    if (!cards.has(c.ideaId)) continue;
    const prior = (savedSteps.get(c.ideaId) || []).filter((s) => s.at <= c.createdAt).pop();
    out.push({ id: "c-" + c.id, group: c.context ? commentStep[c.context.stage] : prior?.step || "thought", kind: "comment", at: c.createdAt, actorId: c.authorId, title: "의견 · " + cards.get(c.ideaId)!.title, detail: c.body, ideaId: c.ideaId });
  }
  for (const m of input.messages)
    if (m.channel === project.id)
      out.push({ id: "m-" + m.id, group: m.step || "none", kind: "chat", at: m.createdAt, actorId: m.authorId, title: "팀 대화", detail: m.body });
  const documented = new Set<string>();
  for (const r of input.records) {
    if (r.projectId !== project.id) continue;
    const base = { at: r.updatedAt || r.createdAt, actorId: r.ownerId };
    if (r.kind === "source" && !r.data.redacted)
      out.push({ ...base, id: r.id, group: r.data.step || "build", kind: "meeting", title: r.data.sourceType === "transcript" ? "회의 녹취록" : "회의·자료 메모", detail: r.data.title });
    else if (r.kind === "decision")
      out.push({ ...base, id: r.id, group: r.data.step || "build", kind: "decision", title: "결정 · " + r.data.title, detail: r.data.reason });
    else if (r.kind === "task")
      out.push({ ...base, id: r.id, group: r.data.step || "build", kind: "task", title: "할 일 · " + r.data.title, detail: r.data.status === "done" ? "완료" : r.data.status === "doing" ? "진행 중" : "할 일" });
    else if (r.kind === "version" && !r.data.redacted) {
      documented.add(r.data.key);
      out.push({ ...base, id: r.id, group: "plan", kind: "doc", title: docNames[r.data.key] + " 저장", detail: r.data.reason });
    } else if (r.kind === "baseline")
      out.push({ ...base, id: r.id, group: "plan", kind: "doc", title: "기획 버전 확정", detail: r.data.reason });
    else if (r.kind === "release")
      out.push({ ...base, id: r.id, group: "build", kind: "release", title: "배포 · " + r.data.title, detail: r.data.demoUrl });
    else if (r.kind === "showcase")
      out.push({ ...base, id: r.id, group: "show", kind: "showcase", title: r.data.state === "published" ? "전시 공개" : "전시 작성", detail: r.data.problem });
    else if (r.kind === "event" && teamEvents.has(r.data.title))
      out.push({ ...base, id: r.id, group: "team", kind: "project", title: r.data.title, detail: r.data.reason });
  }
  for (const r of input.records)
    if (r.projectId === project.id && r.kind === "document" && !r.data.redacted && !documented.has(r.data.key))
      out.push({ id: r.id, group: "plan", kind: "doc", at: r.updatedAt, actorId: r.ownerId, title: docNames[r.data.key] + " 저장", detail: r.data.reason });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
