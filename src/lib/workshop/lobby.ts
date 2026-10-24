import type { Context, RecordOf } from "./model";
import type { WorkshopCommand } from "./commands";
import type { Idea, Project } from "../types";
import { problemMarkdown, statement } from "../refinement";
import { docNames } from "./model";
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
  project,
  idea,
  ideaHistory,
  optional,
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
/** The team's finished problem cards that can be voted on, including the card the project started from. */
async function voteCards(c: Context, p: Project) {
  const listed = await c.store.list<Idea>(path(c, "ideas"), [{ field: "projectId", value: p.id }]);
  if (p.sourceIdeaId && !listed.some((i) => i.id === p.sourceIdeaId)) listed.push(await idea(c, p.sourceIdeaId));
  return listed.filter((i) => i.refinement?.ready && i.state !== "closed_unselected");
}
async function teamVotes(c: Context, projectId: string) {
  return c.store.list<RecordOf<"teamVote">>(path(c, "workshop"), [
    { field: "kind", value: "teamVote" },
    { field: "projectId", value: projectId },
  ]);
}
async function teamVote(c: Context, projectId: string, voteId?: string) {
  if (voteId) {
    const vote = await optional(c, voteId, "teamVote");
    if (!vote || vote.projectId !== projectId) fail("이 프로젝트의 투표방이 아닙니다.");
    return vote;
  }
  // Older clients did not send a room ID. Never guess a room when several exist.
  const votes = await teamVotes(c, projectId);
  if (votes.length > 1) fail("투표 목록에서 투표방을 다시 선택해주세요.");
  return votes[0];
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
    case "confirmProblem": {
      const p = await project(c, cmd.projectId, "leader");
      const i = await idea(c, cmd.ideaId);
      if (i.projectId !== p.id && i.id !== p.sourceIdeaId)
        fail("이 프로젝트에 올린 카드만 확정할 수 있습니다.");
      if (i.revision !== cmd.revision)
        fail("작성자가 카드를 먼저 고쳤습니다. 최신 내용을 확인한 뒤 확정해주세요.");
      if (!i.refinement?.draft) fail("문제정의 초안을 저장한 카드만 확정할 수 있습니다.");
      const text = statement(i.refinement);
      saveProject(c, {
        ...p,
        problem: text,
        // Keep the original source card; planning reads the confirmed card first.
        sourceIdeaId: p.sourceIdeaId || i.id,
        confirmedProblem: {
          ideaId: i.id,
          ownerId: i.ownerId,
          revision: i.revision,
          draft: i.refinement.draft,
          statement: text,
          reason: cmd.reason,
          confirmedBy: c.uid,
          confirmedAt: c.now,
        },
      });
      ideaHistory(c, i, "프로젝트 문제로 확정", cmd.reason);
      // The confirmed card becomes the first planning document right away; earlier text stays in its versions.
      const docId = "doc-" + p.id + "-product", oldDoc = await optional(c, docId, "document");
      const markdown = problemMarkdown(i), docReason = "확정한 문제 카드에서 작성 · " + cmd.reason;
      write(c, "draft-version-" + c.requestId, "version", { key: "product", title: docNames.product, markdown, documentRevision: (oldDoc?.revision || 0) + 1, reason: docReason }, "project", p.id);
      write(c, docId, "document", { key: "product", title: docNames.product, markdown, reason: docReason }, "project", p.id, oldDoc?.ownerId || c.uid, oldDoc);
      event(c, "문제 확정", text, p.id, p.id);
      for (const uid of p.memberIds)
        if (uid !== c.uid) notify(c, uid, "리더가 프로젝트 문제를 확정했습니다.", p.id, "project");
      return { id: p.id };
    }
    case "openTeamVote": {
      const p = await project(c, cmd.projectId, "leader");
      const ready = await voteCards(c, p);
      if (ready.length < 1) fail("완성된 문제 카드가 있어야 투표를 열 수 있습니다.");
      // The leader may leave some finished cards out; without a list every finished card is a candidate.
      const picked = cmd.candidateIds;
      if (picked && new Set(picked).size !== picked.length) fail("후보가 중복되었습니다.");
      if (picked?.some((id) => !ready.some((i) => i.id === id))) fail("완성된 문제 카드만 투표 후보로 고를 수 있습니다.");
      const ideas = picked ? ready.filter((i) => picked.includes(i.id)) : ready;
      const votes = await teamVotes(c, p.id);
      const counterPath = path(c, "control/teamvote-" + p.id);
      const counter = await c.store.read<{ round: number }>(counterPath);
      const round = Math.max(counter?.round || 0, ...votes.map((v) => v.data.round)) + 1;
      const id = "teamvote-" + c.requestId;
      const maxVotes = Math.min(cmd.maxVotes || 1, ideas.length);
      const endsAt = cmd.minutes ? new Date(Date.parse(c.now) + cmd.minutes * 60000).toISOString() : null;
      write(c, id, "teamVote", { round, state: "open", candidateIds: ideas.map((i) => i.id), counts: {}, voters: 0, openedAt: c.now, closedAt: null, maxVotes, endsAt }, "project", p.id);
      c.store.write(counterPath, { round });
      event(c, "투표 열기", "문제 카드 " + ideas.length + "개 · 1인당 " + maxVotes + "표", p.id, p.id);
      for (const uid of p.memberIds) if (uid !== c.uid) notify(c, uid, "리더가 함께 풀 문제 투표를 열었습니다.", p.id, "project");
      return { id };
    }
    case "castTeamVote": {
      const p = await project(c, cmd.projectId);
      const vote = await teamVote(c, p.id, cmd.voteId);
      if (vote?.data.state !== "open") fail("열려 있는 투표가 없습니다.");
      if (vote.data.endsAt && vote.data.endsAt <= c.now) fail("투표 시간이 끝났습니다.");
      if (!vote.data.candidateIds.includes(cmd.ideaId)) fail("투표 후보 카드만 고를 수 있습니다.");
      const ballotId = vote.id === "teamvote-" + p.id
        ? "teamballot-" + p.id + "-" + c.uid
        : "teamballot-" + vote.id + "-" + c.uid;
      const prior = await optional(c, ballotId, "teamBallot");
      // Picking a chosen card again takes the vote back; with one vote a new pick replaces the old one.
      const max = vote.data.maxVotes || 1, counts = { ...vote.data.counts };
      const before = prior?.data.round === vote.data.round ? prior.data.ideaIds ?? (prior.data.ideaId ? [prior.data.ideaId] : []) : [];
      let picks = [...before];
      if (picks.includes(cmd.ideaId)) picks = picks.filter((id) => id !== cmd.ideaId);
      else if (picks.length < max) picks.push(cmd.ideaId);
      else if (max === 1) picks = [cmd.ideaId];
      else fail("한 사람당 " + max + "개까지 고를 수 있어요. 고른 카드 하나를 먼저 취소해주세요.");
      for (const id of before) counts[id] = Math.max(0, (counts[id] || 0) - 1);
      for (const id of picks) counts[id] = (counts[id] || 0) + 1;
      const voters = vote.data.voters + (!before.length && picks.length ? 1 : before.length && !picks.length ? -1 : 0);
      write(c, ballotId, "teamBallot", { round: vote.data.round, voteId: vote.id, ideaIds: picks }, "project", p.id, c.uid, prior);
      write(c, vote.id, "teamVote", { ...vote.data, counts, voters }, "project", p.id, vote.ownerId, vote);
      return { id: p.id };
    }
    case "refreshTeamVote": {
      // Cards finished after the vote opened join it; votes already cast stay.
      const p = await project(c, cmd.projectId, "leader");
      const vote = await teamVote(c, p.id, cmd.voteId);
      if (vote?.data.state !== "open") fail("열려 있는 투표가 없습니다.");
      const added = (await voteCards(c, p)).map((i) => i.id).filter((id) => !vote.data.candidateIds.includes(id));
      if (!added.length) fail("새로 추가할 완성된 문제 카드가 없습니다.");
      write(c, vote.id, "teamVote", { ...vote.data, candidateIds: [...vote.data.candidateIds, ...added] }, "project", p.id, vote.ownerId, vote);
      event(c, "투표 후보 추가", "문제 카드 " + added.length + "개", p.id, p.id);
      return { id: p.id };
    }
    case "cancelTeamVote": {
      // Throws the open vote away without a result; a new vote starts a new round, so old ballots no longer count.
      const p = await project(c, cmd.projectId, "leader");
      const vote = await teamVote(c, p.id, cmd.voteId);
      if (vote?.data.state !== "open") fail("열려 있는 투표가 없습니다.");
      write(c, vote.id, "teamVote", { ...vote.data, state: "cancelled", counts: {}, voters: 0, closedAt: c.now }, "project", p.id, vote.ownerId, vote);
      event(c, "투표 취소", vote.data.voters + "명 참여 중 취소", p.id, p.id);
      return { id: p.id };
    }
    case "deleteTeamVote": {
      // Removes the vote from the team's view. The round number is kept so old ballots never count in a later vote.
      const p = await project(c, cmd.projectId, "leader");
      const vote = await teamVote(c, p.id, cmd.voteId);
      if (!vote || vote.data.state === "deleted") fail("지울 투표가 없습니다.");
      write(c, vote.id, "teamVote", { ...vote.data, state: "deleted", candidateIds: [], counts: {}, voters: 0, closedAt: vote.data.closedAt || c.now }, "project", p.id, vote.ownerId, vote);
      event(c, "투표 삭제", vote.data.round + "번째 투표", p.id, p.id);
      return { id: p.id };
    }
    case "closeTeamVote": {
      // The leader closes any time; once the deadline passes any member's screen may close it.
      const p = await project(c, cmd.projectId);
      const vote = await teamVote(c, p.id, cmd.voteId);
      if (vote?.data.state !== "open") fail("열려 있는 투표가 없습니다.");
      const timeUp = !!vote.data.endsAt && vote.data.endsAt <= c.now;
      if (p.leaderId !== c.uid && !timeUp) fail("팀장이 확정할 수 있습니다.", 403);
      const abstained = Math.max(0, p.memberIds.length - vote.data.voters);
      write(c, vote.id, "teamVote", { ...vote.data, state: "closed", closedAt: c.now, abstained, endedBy: timeUp ? "time" : "manual" }, "project", p.id, vote.ownerId, vote);
      event(c, "투표 마감", vote.data.voters + "명 참여 · 기권 " + abstained + "명" + (timeUp ? " · 시간 종료" : ""), p.id, p.id);
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
