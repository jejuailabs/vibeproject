"use client";
import type { Project } from "@/lib/types";
import { Action, type Props } from "./common";

/** Name, intro and capacity of a project; the server lets its leader or a cohort administrator save it. */
export function ProjectEditAction({ project, run, busy }: { project: Project; run: Props["run"]; busy: boolean }) {
  return (
    <Action
      key={[project.name, project.intro, project.capacity].join("|")}
      label="프로젝트 정보 수정"
      command={{ type: "editProject", projectId: project.id }}
      fields={[
        { name: "name", label: "프로젝트 이름", value: project.name, max: 60 },
        { name: "intro", label: "한 줄 소개", type: "area", value: project.intro || project.problem || "", max: 300, optional: true },
        { name: "capacity", label: "최대 인원 (현재 " + project.memberIds.length + "명)", type: "number", value: project.capacity || Math.max(project.memberIds.length, 6), min: Math.max(1, project.memberIds.length), max: 100, hint: "1명이면 개인 프로젝트가 됩니다." },
      ]}
      run={run}
      busy={busy}
    />
  );
}
