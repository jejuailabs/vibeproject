import test from "node:test";
import assert from "node:assert/strict";
import { previewWorkspace } from "../src/lib/preview";
import { MemoryStore } from "../src/lib/workshop/memory";
import { applyWorkshop } from "../src/lib/workshop/engine";
import type { Context, RecordOf } from "../src/lib/workshop/model";
import type { Member, Project } from "../src/lib/types";

function fixture(role: Member["role"] = "admin") {
  const workspace = previewWorkspace(), store = new MemoryStore(), root = "cohorts/preview";
  const room: Project = { ...workspace.projects[0], id: "p-generated", name: "자동 생성된 프로젝트", memberIds: ["jun"] };
  const jun = workspace.members.find((m) => m.id === "jun")!;
  jun.projectId = room.id; jun.projectIds = ["p-onboarding", room.id];
  // Clean stale membership too, even if the user is no longer in the roster.
  const seo = workspace.members.find((m) => m.id === "seo")!;
  seo.active = false; seo.projectId = room.id; seo.projectIds = [room.id];
  workspace.me.role = role;
  for (const m of workspace.members) for (const collection of ["members", "profiles"]) store.write(root + "/" + collection + "/" + m.id, m);
  for (const p of [...workspace.projects, room]) for (const collection of ["projects", "projectDirectory"]) store.write(root + "/" + collection + "/" + p.id, p);
  const support: RecordOf<"support"> = { id: "support", kind: "support", ownerId: "min", projectId: room.id, scope: "project", revision: 1, createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z", data: { userId: "min", edit: true, expiresAt: "2099-01-01T00:00:00Z" } };
  store.write(root + "/workshop/support", support);
  store.write(root + "/workshop/project-record", { id: "project-record", projectId: room.id, kind: "project", data: { stage: "forming" } });
  store.write(root + "/projectSecrets/" + room.id, { hash: "secret" });
  const context: Context = { store, uid: workspace.me.id, me: workspace.me, cohortId: "preview", requestId: "delete-request", now: "2026-10-26T00:00:00.000Z", grants: [] };
  const command = { type: "deleteProject", projectId: room.id, confirmName: room.name, reason: "잘못 생성된 방 정리" };
  return { context, store, root, room, command };
}

test("admin deletion removes the live project and every membership while preserving other rooms and recovery data", async () => {
  const { context, store, root, room, command } = fixture();
  await applyWorkshop(context, command);
  for (const collection of ["projects", "projectDirectory", "projectSecrets"]) assert.equal(await store.read(root + "/" + collection + "/" + room.id), undefined);
  for (const collection of ["members", "profiles"]) {
    const jun = (await store.read<Member>(root + "/" + collection + "/jun"))!;
    assert.equal(jun.projectId, "p-onboarding"); assert.deepEqual(jun.projectIds, ["p-onboarding"]);
    const seo = (await store.read<Member>(root + "/" + collection + "/seo"))!;
    assert.equal(seo.projectId, null); assert.deepEqual(seo.projectIds, []);
  }
  assert.ok(await store.read(root + "/projects/p-onboarding"));
  assert.equal(await store.read(root + "/workshop/support"), undefined);
  assert.ok(await store.read(root + "/workshop/project-record"), "existing contents are preserved");
  assert.deepEqual(await store.read(root + "/deletedProjects/" + room.id), { project: room, deletedAt: context.now, deletedBy: "min", reason: command.reason });
  await assert.rejects(applyWorkshop(context, { type: "enterProject", projectId: room.id }), /찾을 수 없습니다/);
});

test("only admins may delete, and a wrong confirmation name cannot mutate anything", async () => {
  for (const role of ["participant", "facilitator"] as const) {
    const { context, store, command } = fixture(role), before = structuredClone(store.rows);
    await assert.rejects(applyWorkshop(context, command), /관리자 권한/);
    assert.deepEqual(store.rows, before);
  }
  const { context, store, command } = fixture(), before = structuredClone(store.rows);
  await assert.rejects(applyWorkshop(context, { ...command, confirmName: "다른 프로젝트" }), /이름을 정확히/);
  assert.deepEqual(store.rows, before);
});

test("admin can clean up a completed cohort and deletion of their active room clears their context", async () => {
  const { context, store, root, room, command } = fixture();
  store.write(root + "/workshop/settings", { kind: "settings", data: { state: "completed" } });
  context.me = { ...context.me, projectId: room.id, projectIds: [room.id] };
  for (const collection of ["members", "profiles"]) store.write(root + "/" + collection + "/min", context.me);
  await applyWorkshop(context, command);
  assert.equal(context.me.projectId, null); assert.deepEqual(context.me.projectIds, []);
});
