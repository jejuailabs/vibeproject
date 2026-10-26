"use client";
import { Trash2 } from "lucide-react";
import type { Project } from "@/lib/types";
import type { Props } from "./common";

export function ProjectDeleteButton({ project, run, busy }: { project: Project; run: Props["run"]; busy: boolean }) {
  return <button type="button" className="project-delete-button" aria-label={project.name + " 프로젝트 삭제"} title="프로젝트 삭제" disabled={busy} onClick={async (e) => {
    e.stopPropagation();
    if (!window.confirm("‘" + project.name + "’ 프로젝트를 삭제할까요?\n모든 참가자의 프로젝트 목록에서 제거됩니다. 기존 자료와 삭제 이력은 보존됩니다.")) return;
    await run({ type: "deleteProject", projectId: project.id, confirmName: project.name, reason: "관리자가 프로젝트 목록에서 삭제" });
  }}><Trash2 size={18} aria-hidden="true" /></button>;
}
