import type { Context } from "./model";
import type { WorkshopCommand } from "./commands";
import type { Project } from "../types";
import {
  fail,
  path,
  write,
  event,
  notify,
  defaults,
  saveProject,
  joinMembership,
  activateMembership,
} from "./core";

// Join passwords live outside projects/projectDirectory so no client response ever carries the hash.
type Secret = { salt: string; hash: string; iterations: number };
type Attempts = { count: number; since: string };
const ITERATIONS = 120000,
  MAX_ATTEMPTS = 5,
  WINDOW_MS = 10 * 60 * 1000;
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
function randomHex(size: number) {
  return hex(crypto.getRandomValues(new Uint8Array(size)));
}
async function derive(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations },
      key,
      256,
    ),
  );
}
function same(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function checkPassword(password: string | undefined) {
  const value = password?.trim() || "";
  if (value.length < 4) fail("비밀번호는 4자 이상으로 정해주세요.", 400);
  return value;
}
async function storeSecret(c: Context, projectId: string, password: string) {
  const salt = randomHex(16);
  c.store.write(path(c, "projectSecrets/" + projectId), {
    salt,
    hash: await derive(password, salt, ITERATIONS),
    iterations: ITERATIONS,
  } satisfies Secret);
}
function addMember(c: Context, p: Project, role: "leader" | "member") {
  saveProject(c, { ...p, memberIds: [...new Set([...p.memberIds, c.uid])] });
  joinMembership(c, c.me, p.id);
  c.store.write(path(c, "projects/" + p.id + "/members/" + c.uid), {
    role,
    status: "active",
    acceptedAt: c.now,
  });
}

export async function lobby(c: Context, cmd: WorkshopCommand) {
  switch (cmd.type) {
    case "openProject": {
      const password = cmd.joinPolicy === "password" ? checkPassword(cmd.password) : "";
      const id = "p-" + c.requestId,
        mode = cmd.capacity === 1 ? ("solo" as const) : ("team" as const);
      const p: Project = {
        id,
        name: cmd.name,
        problem: cmd.intro,
        intro: cmd.intro,
        leaderId: c.uid,
        memberIds: [],
        sourceIdeaId: "",
        stage: "팀 구성",
        createdAt: c.now,
        mode,
        capacity: cmd.capacity,
        joinPolicy: mode === "solo" ? "request" : cmd.joinPolicy,
      };
      write(
        c,
        "project-" + id,
        "project",
        {
          mode,
          capacity: cmd.capacity,
          stage: "forming",
          baselineId: null,
          repositoryUrl: "",
          deployUrl: "",
          firebaseUrl: "",
          inviteCode: randomHex(16),
        },
        "project",
        id,
      );
      if (password) await storeSecret(c, id, password);
      addMember(c, p, "leader");
      event(c, "프로젝트 만들기", cmd.intro || cmd.name, id, id);
      return { id };
    }
    case "enterProject": {
      const p = await c.store.read<Project>(path(c, "projects/" + cmd.projectId));
      if (!p) fail("프로젝트를 찾을 수 없습니다.", 404);
      if (p.memberIds.includes(c.uid)) {
        activateMembership(c, c.me, p.id);
        return { id: p.id };
      }
      const cfg = await defaults(c, p.id);
      if (["completed", "archived"].includes(cfg.data.stage)) fail("종료된 프로젝트입니다.");
      if (cfg.data.mode === "solo") fail("개인 프로젝트에는 참여할 수 없습니다.");
      if (p.memberIds.length >= (p.capacity ?? cfg.data.capacity))
        fail("프로젝트 정원이 가득 찼습니다.");
      const policy = p.joinPolicy ?? "request";
      if (cmd.invite) {
        if (!cfg.data.inviteCode || !same(cmd.invite, cfg.data.inviteCode))
          fail("초대 링크가 만료되었거나 올바르지 않습니다.", 403);
      } else if (policy === "request") {
        fail("이 프로젝트는 참여 신청 후 리더의 승인이 필요합니다.", 403);
      } else if (policy === "password") {
        const secret = await c.store.read<Secret>(path(c, "projectSecrets/" + p.id));
        if (!secret) fail("비밀번호가 아직 설정되지 않았습니다. 리더에게 문의해주세요.", 403);
        const attemptPath = path(c, "projectSecrets/" + p.id + "/attempts/" + c.uid);
        const prior = await c.store.read<Attempts>(attemptPath);
        const recent = prior && Date.parse(c.now) - Date.parse(prior.since) < WINDOW_MS ? prior : undefined;
        if ((recent?.count || 0) >= MAX_ATTEMPTS)
          fail("비밀번호를 여러 번 틀렸습니다. 10분 뒤에 다시 시도해주세요.", 429);
        if (!same(await derive(cmd.password || "", secret.salt, secret.iterations), secret.hash)) {
          // Returned instead of thrown so the failed attempt is committed with the transaction.
          const count = (recent?.count || 0) + 1;
          c.store.write(attemptPath, { count, since: recent?.since || c.now } satisfies Attempts);
          return {
            id: p.id,
            denied: true,
            message:
              count >= MAX_ATTEMPTS
                ? "비밀번호를 여러 번 틀렸습니다. 10분 뒤에 다시 시도해주세요."
                : `비밀번호가 맞지 않습니다. (남은 시도 ${MAX_ATTEMPTS - count}회)`,
          };
        }
        if (prior) c.store.remove(attemptPath);
      }
      addMember(c, p, "member");
      event(c, "프로젝트 참여", cmd.invite ? "초대 링크" : policy === "password" ? "비밀번호" : "공개 참여", p.id, p.id);
      notify(c, p.leaderId, "새 팀원이 프로젝트에 참여했습니다.", p.id, "project");
      return { id: p.id };
    }
    case "projectAccess": {
      const p = await c.store.read<Project>(path(c, "projects/" + cmd.projectId));
      if (!p) fail("프로젝트를 찾을 수 없습니다.", 404);
      if (p.leaderId !== c.uid) fail("리더만 참여 방식을 바꿀 수 있습니다.", 403);
      const cfg = await defaults(c, p.id);
      if (cmd.joinPolicy === "password") {
        if (cmd.password) await storeSecret(c, p.id, checkPassword(cmd.password));
        else if (!(await c.store.read<Secret>(path(c, "projectSecrets/" + p.id))))
          fail("비밀번호를 입력해주세요.", 400);
      } else c.store.remove(path(c, "projectSecrets/" + p.id));
      saveProject(c, { ...p, joinPolicy: cmd.joinPolicy });
      if (cmd.resetInvite || !cfg.data.inviteCode)
        write(c, cfg.id, "project", { ...cfg.data, inviteCode: randomHex(16) }, "project", p.id, cfg.ownerId, cfg);
      event(c, "참여 방식 변경", cmd.resetInvite ? "초대 링크 새로 만들기" : cmd.joinPolicy, p.id, p.id);
      return { id: p.id };
    }
    default:
      return null;
  }
}
