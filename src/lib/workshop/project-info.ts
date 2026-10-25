import type { Project } from "../types";
import type { WorkshopRecord } from "./model";

// Older projects keep their origin on the source room's join board. Use it only
// when it is already readable; a source idea alone does not prove vote creation.
export function projectOriginLabel(project: Project, records: WorkshopRecord[] = []) {
  const board = records.find((r) => r.kind === "joinBoard" &&
    r.data.state === "closed" && Object.values(r.data.projects || {}).includes(project.id));
  const endedBy = project.createdFromVote?.endedBy ||
    (board?.kind === "joinBoard" ? board.data.endedBy : undefined);
  if (endedBy === "time") return "투표 후 참가 시간 종료로 자동 생성";
  if (endedBy === "manual") return "투표 후 참가 접수 마감으로 생성";
  if (board || project.createdFromVote) return "투표 후 참가 접수에서 생성";
  return "생성 경위 기록 없음";
}

export function projectVisibilityLabel(project: Project) {
  if (project.mode === "solo") return "개인 프로젝트 · 본인만 참여";
  return ({ open: "기수 참가자 누구나 참여", password: "비밀번호로 참여", request: "리더 승인 후 참여" })[project.joinPolicy || "request"];
}
