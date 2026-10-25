import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Admin } from "../src/components/workshop/admin";
import type { Member, Workspace } from "../src/lib/types";

function workspace(role: Member["role"]): Workspace {
  const me: Member = { id: "operator", name: "운영자", avatar: "", role, projectId: null, projectIds: [], active: true };
  const leader: Member = { ...me, id: "leader", name: "담당자", role: "participant", projectId: "created-project" };
  const teammate: Member = { ...leader, id: "teammate", name: "다음 담당자" };
  const inactive: Member = { ...leader, id: "inactive", name: "중지된 팀원", active: false };
  return {
    cohort: { id: "cohort", name: "기수", week: 1 }, me,
    members: [me, leader, teammate, inactive],
    projects: [{ id: "created-project", name: "투표에서 생긴 프로젝트", problem: "문제", leaderId: leader.id, memberIds: [leader.id, teammate.id, inactive.id], sourceIdeaId: "idea", stage: "팀 구성", createdAt: "2026-10-25T00:00:00.000Z", joinPolicy: "request" }],
    ideas: [], comments: [], messages: [], events: [],
    activity: { id: "activity", title: "활동", question: "질문", description: "", state: "closed", week: 1 },
  };
}

function management(role: Member["role"]) {
  const markup = renderToStaticMarkup(createElement(Admin, { workspace: workspace(role), records: [], run: async () => true, busy: false, preview: true }));
  const section = markup.match(/<section id="project-management"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  return section;
}

test("admin management includes projects outside the operator's memberships and offers active teammates for leadership", () => {
  const html = management("admin");
  assert.match(html, /전체 프로젝트 관리/);
  assert.match(html, /투표에서 생긴 프로젝트/);
  assert.match(html, /담당 리더<\/strong> 담당자/);
  assert.match(html, /리더 승인 후 참여/);
  assert.match(html, /생성 경위 기록 없음/);
  assert.match(html, /구성원 3명/);
  assert.match(html, /담당자 \(리더\), 다음 담당자, 중지된 팀원 · 참여 중지/);
  assert.match(html, /<option value="teammate">다음 담당자<\/option>/);
  for (const id of ["operator", "leader", "inactive"]) assert.doesNotMatch(html, new RegExp(`<option value="${id}">`));
});

test("facilitators can read the complete project management metadata without leadership controls", () => {
  const html = management("facilitator");
  assert.match(html, /투표에서 생긴 프로젝트/);
  assert.match(html, /담당자 \(리더\)/);
  assert.doesNotMatch(html, /새 담당 리더|담당 리더 변경|<form/);
});
