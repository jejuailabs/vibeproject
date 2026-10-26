import test from "node:test";
import assert from "node:assert/strict";
import { previewWorkspace } from "../src/lib/preview";
import { previewWorkshop } from "../src/lib/workshop/memory";
import { projectIdsOf } from "../src/lib/policy";
import { projectOriginLabel } from "../src/lib/workshop/project-info";
import { canRead } from "../src/lib/workshop/core";
import type { Context, PreviewState, RecordOf } from "../src/lib/workshop/model";

function fixture(timed: boolean): PreviewState {
  const workspace = previewWorkspace(), now = new Date().toISOString();
  workspace.me = workspace.members.find((m) => m.id === "jun")!;
  const board: RecordOf<"joinBoard"> = {
    id: "board", kind: "joinBoard", ownerId: "jun", projectId: "p-onboarding",
    scope: "project", revision: 1, createdAt: now, updatedAt: now,
    data: { pathId: "path", voteId: "vote", round: 1, state: "open", openedAt: now,
      endsAt: timed ? "2020-01-01T00:00:00.000Z" : null, closedAt: null, capacity: 5,
      options: [{ ideaId: "idea", title: "선정 프로젝트", problem: "문제", ownerId: "jun" }],
      picks: { seo: { ideaId: "idea", at: now } } },
  };
  return { workspace, records: [board] };
}

for (const timed of [true, false]) test(`closing participation retains a public origin and named leader (${timed ? "time" : "manual"})`, async () => {
  const state = await previewWorkshop(fixture(timed), { type: "closeJoinBoard", projectId: "p-onboarding", boardId: "board" });
  const generated = state.workspace.projects.find((p) => p.createdFromVote)!;
  assert.equal(generated.leaderId, "seo", "first participant leads when the author did not join");
  assert.deepEqual(generated.memberIds, ["seo"]);
  assert.deepEqual(generated.createdFromVote, { projectId: "p-onboarding", projectName: "첫걸음", voteId: "vote", boardId: "board", endedBy: timed ? "time" : "manual" });
  assert.ok(projectIdsOf(state.workspace.members.find((m) => m.id === "seo")!).includes(generated.id));
  assert.ok(!projectIdsOf(state.workspace.members.find((m) => m.id === "min")!).includes(generated.id));
  assert.equal(projectOriginLabel(generated), timed ? "투표 후 참가 시간 종료로 자동 생성" : "투표 후 참가 접수 마감으로 생성");
  const legacy = { ...generated, createdFromVote: undefined };
  assert.equal(projectOriginLabel(legacy, state.records), projectOriginLabel(generated));
  assert.equal(projectOriginLabel(legacy), "생성 경위 기록 없음", "source idea alone must not imply automatic creation");
});

test("an administrator can transfer a project's leader without joining or gaining private access", async () => {
  const workspace = previewWorkspace();
  const before = structuredClone(workspace.me);
  const state = await previewWorkshop({ workspace, records: [] }, { type: "transferLeader", projectId: "p-onboarding", memberId: "seo", reason: "담당자 변경" });
  assert.equal(state.workspace.projects[0].leaderId, "seo");
  assert.deepEqual(state.workspace.me, before);
  const context = { me: state.workspace.me, uid: state.workspace.me.id, grants: [], now: new Date().toISOString() } as unknown as Context;
  const privateEvent = state.records.find((r) => r.kind === "event" && r.projectId === "p-onboarding")!;
  assert.equal(canRead(context, privateEvent), false);
  for (const role of ["participant", "facilitator"] as const) {
    const outsider = { ...before, role };
    const candidate = { ...workspace, me: outsider, members: workspace.members.map((m) => m.id === outsider.id ? outsider : m) };
    await assert.rejects(previewWorkshop({ workspace: candidate, records: [] }, { type: "transferLeader", projectId: "p-onboarding", memberId: "seo", reason: "권한 없음" }), /팀 구성 권한/);
  }
});

test("a project's leader and any administrator can edit its name, intro and capacity; others cannot", async () => {
  const edit = { type: "editProject", projectId: "p-space", name: "빈자리 잇기", intro: "새 소개", capacity: 8 };
  const asUser = (id: string) => { const workspace = previewWorkspace(); workspace.me = workspace.members.find((m) => m.id === id)!; return { workspace, records: [] }; };
  for (const id of ["ha", "min"]) {
    const state = await previewWorkshop(asUser(id), edit);
    const p = state.workspace.projects.find((x) => x.id === "p-space")!;
    assert.deepEqual([p.name, p.intro, p.capacity, p.mode], ["빈자리 잇기", "새 소개", 8, "team"]);
    assert.equal(state.records.find((r): r is RecordOf<"project"> => r.kind === "project" && r.projectId === "p-space")!.data.capacity, 8);
  }
  await assert.rejects(previewWorkshop(asUser("jun"), edit), /리더나 관리자만/);
  await assert.rejects(previewWorkshop(asUser("jun"), { ...edit, projectId: "p-onboarding", capacity: 1 }), /정원을 줄일 수 없습니다/);
});

test("an administrator sees every leader's project in the workspace", () => {
  const w = previewWorkspace();
  assert.ok(new Set(w.projects.map((p) => p.leaderId)).size > 1);
  assert.ok(w.projects.some((p) => !p.memberIds.includes(w.me.id)));
});
