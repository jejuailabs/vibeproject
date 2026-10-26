import { DomainError, assertCanRead, assertChannel, projectIdsOf } from "../policy";
import type { Member, Project, Idea } from "../types";
import type {
  Context,
  WorkshopRecord,
  RecordOf,
  Kind,
  DataMap,
  Scope,
} from "./model";
export { assertCanRead, assertChannel };
export function fail(message: string, status = 409): never {
  throw new DomainError("WORKSHOP_ERROR", message, status);
}
export function admin(c: Context) {
  if (c.me.role !== "admin") fail("관리자 권한이 필요합니다.", 403);
}
export function operator(c: Context) {
  if (!["admin", "facilitator"].includes(c.me.role))
    fail("활동 운영 권한이 필요합니다.", 403);
}
export function path(c: Context, suffix: string) {
  return "cohorts/" + c.cohortId + "/" + suffix;
}
export async function member(c: Context, uid: string) {
  const m = await c.store.read<Member>(path(c, "members/" + uid));
  if (!m?.active) fail("활성 참가자가 아닙니다.", 403);
  return m;
}
export async function project(
  c: Context,
  id: string,
  access: "member" | "leader" | "roster" = "member",
) {
  const p = await c.store.read<Project>(path(c, "projects/" + id));
  if (!p) fail("프로젝트를 찾을 수 없습니다.", 404);
  const inTeam = p.memberIds.includes(c.uid) && c.me.projectId === id;
  const grant = c.grants.find(
    (g) => g.projectId === id && g.data.expiresAt > c.now,
  );
  if (access === "member" && !inTeam && !grant)
    fail("팀 자료 접근 권한이 없습니다.", 403);
  if (access === "leader" && p.leaderId !== c.uid && c.me.role !== "admin")
    fail("팀장이 확정할 수 있습니다.", 403);
  if (access === "roster" && p.leaderId !== c.uid && c.me.role !== "admin")
    fail("팀 구성 권한이 없습니다.", 403);
  return p;
}
export async function editableProject(c: Context, id: string) {
  const p = await project(c, id);
  if (
    !p.memberIds.includes(c.uid) &&
    !c.grants.some(
      (g) => g.projectId === id && g.data.edit && g.data.expiresAt > c.now,
    )
  )
    fail("편집 지원 권한이 없습니다.", 403);
  return p;
}
export function canRead(c: Context, r: WorkshopRecord) {
  if (!c.me.active) return false;
  if (r.kind === "activity" && r.data.state === "draft")
    return c.me.role !== "participant";
  if (r.kind === "support")
    return (
      r.ownerId === c.uid || (!!r.projectId && r.projectId === c.me.projectId)
    );
  if (r.kind === "report") return r.ownerId === c.uid || c.me.role === "admin";
  if (r.kind === "readiness" && c.me.role === "admin") return true;
  if (r.kind === "notification" || r.kind === "ballot" || r.kind === "teamBallot" || r.kind === "read")
    return r.ownerId === c.uid;
  if (r.kind === "join")
    return (
      r.ownerId === c.uid ||
      c.me.role === "admin" ||
      r.projectId === c.me.projectId
    );
  if (r.kind === "help")
    return r.ownerId === c.uid || ["admin", "facilitator"].includes(c.me.role);
  if (r.scope === "cohort") return true;
  if (r.scope === "admin") return c.me.role === "admin";
  if (r.scope === "owner") return r.ownerId === c.uid;
  return (
    !!r.projectId &&
    (r.projectId === c.me.projectId ||
      c.grants.some(
        (g) => g.projectId === r.projectId && g.data.expiresAt > c.now,
      ))
  );
}
export async function record<K extends Kind>(
  c: Context,
  id: string,
  kind: K,
  check = true,
): Promise<RecordOf<K>> {
  const r = await c.store.read<WorkshopRecord>(path(c, "workshop/" + id));
  if (!r || r.kind !== kind) fail("자료를 찾을 수 없습니다.", 404);
  if (check && !canRead(c, r)) fail("자료 접근 권한이 없습니다.", 403);
  return r as RecordOf<K>;
}
export async function optional<K extends Kind>(
  c: Context,
  id: string,
  kind: K,
): Promise<RecordOf<K> | undefined> {
  const r = await c.store.read<WorkshopRecord>(path(c, "workshop/" + id));
  if (!r) return undefined;
  if (r.kind !== kind) fail("자료 유형이 다릅니다.");
  return r as RecordOf<K>;
}
export function write<K extends Kind>(
  c: Context,
  id: string,
  kind: K,
  data: DataMap[K],
  scope: Scope = "cohort",
  projectId: string | null = null,
  ownerId = c.uid,
  previous?: RecordOf<K>,
) {
  const value = {
    id,
    kind,
    data,
    scope,
    projectId,
    ownerId,
    revision: (previous?.revision || 0) + 1,
    createdAt: previous?.createdAt || c.now,
    updatedAt: c.now,
  };
  c.store.write(path(c, "workshop/" + id), value);
  return value as RecordOf<K>;
}
export function revision(
  current: { revision: number } | undefined,
  expected: number,
) {
  if ((current?.revision || 0) !== expected)
    fail(
      "다른 변경이 먼저 저장되었습니다. 최신 내용과 비교한 뒤 다시 저장해주세요.",
    );
}
export function event(
  c: Context,
  title: string,
  reason: string,
  targetId: string,
  projectId: string | null = null,
) {
  write(
    c,
    "event-" + crypto.randomUUID(),
    "event",
    { title, reason, targetId },
    projectId ? "project" : "cohort",
    projectId,
  );
}
export function notify(
  c: Context,
  uid: string,
  title: string,
  targetId: string,
  targetKind: string,
) {
  write(
    c,
    "notice-" + crypto.randomUUID(),
    "notification",
    { title, targetId, targetKind, read: false },
    "owner",
    null,
    uid,
  );
}
export async function idea(c: Context, id: string) {
  const i = await c.store.read<Idea>(path(c, "ideas/" + id));
  if (!i) fail("아이디어를 찾을 수 없습니다.", 404);
  assertCanRead(c.me, i);
  return i;
}
export function ideaHistory(
  c: Context,
  i: Idea,
  title: string,
  reason: string,
) {
  const id = c.requestId;
  c.store.write(path(c, "ideas/" + i.id + "/history/" + id), {
    id,
    ideaId: i.id,
    title,
    reason,
    actorId: c.uid,
    createdAt: c.now,
    revision: i.revision,
    snapshot: { title: i.title, body: i.body, scope: i.scope, state: i.state, ...(i.refinement?{refinement:i.refinement}:{}) },
  });
}
export async function defaults(c: Context, id: string) {
  return (
    (await optional(c, "project-" + id, "project")) ||
    write(
      c,
      "project-" + id,
      "project",
      {
        mode: "team",
        capacity: 100,
        stage: "planning",
        baselineId: null,
        repositoryUrl: "",
        deployUrl: "",
        firebaseUrl: "",
      },
      "project",
      id,
    )
  );
}
export function saveProject(c: Context, p: Project) {
  c.store.write(path(c, "projects/" + p.id), p);
  c.store.write(path(c, "projectDirectory/" + p.id), p);
}
function membership(c: Context, m: Member, projectId: string | null, projectIds: string[]) {
  const patch = { projectId, projectIds };
  c.store.write(path(c, "members/" + m.id), patch, true);
  c.store.write(path(c, "profiles/" + m.id), patch, true);
  if (m.id === c.uid) c.me = { ...c.me, ...patch };
}
// A member may belong to several projects; joining also makes the project the one they work in.
export function joinMembership(c: Context, m: Member, projectId: string) {
  membership(c, m, projectId, [...new Set([...projectIdsOf(m), projectId])]);
}
// Adds a project to someone's list without changing the project they are working in now.
export function addMembership(c: Context, m: Member, projectId: string) {
  membership(c, m, m.projectId ?? projectId, [...new Set([...projectIdsOf(m), projectId])]);
}
export function leaveMembership(c: Context, m: Member, projectId: string) {
  const rest = projectIdsOf(m).filter((id) => id !== projectId);
  membership(c, m, m.projectId === projectId ? rest[0] || null : m.projectId, rest);
}
export function activateMembership(c: Context, m: Member, projectId: string) {
  if (!projectIdsOf(m).includes(projectId)) fail("참여한 프로젝트가 아닙니다.", 403);
  membership(c, m, projectId, projectIdsOf(m));
}
