import {assertProblemReady,statement} from '../refinement';
import type { Context, RecordOf } from "./model";
import type { WorkshopCommand } from "./commands";
import type { Idea, Member, Project } from "../types";
import {
  admin,
  operator,
  fail,
  path,
  record,
  optional,
  write,
  revision,
  event,
  notify,
  idea,
  ideaHistory,
  member,
  project,
  defaults,
  saveProject,
  setMembership,
} from "./core";

async function makeProject(
  c: Context,
  source: Idea,
  name: string,
  mode: "solo" | "team",
  capacity: number,
  reason: string,
  suffix = "",
) {
  // Already frozen rounds created before refinement existed keep their original selection path.
  if(!(source.state==="candidate"&&!source.refinement))assertProblemReady(source);
  const owner = await member(c, source.ownerId);
  if (owner.projectId) fail("제안자가 이미 다른 프로젝트에 참여하고 있습니다.");
  const settings = await optional(c, "settings", "settings");
  if (settings?.data.mode === "solo" && mode !== "solo")
    fail("현재 기수는 개인 프로젝트 방식입니다.");
  if (settings?.data.mode === "team" && mode !== "team")
    fail("현재 기수는 팀 프로젝트 방식입니다.");
  const id = "p-" + c.requestId + suffix;
  const p: Project = {
    id,
    name,
    problem: source.refinement?.ready?statement(source.refinement):source.title,
    leaderId: owner.id,
    memberIds: [owner.id],
    sourceIdeaId: source.id,
    stage: "팀 구성",
    createdAt: c.now,
    mode,
    capacity: mode === "solo" ? 1 : capacity,
  };
  saveProject(c, p);
  setMembership(c, owner, id);
  c.store.write(path(c, "projects/" + id + "/members/" + owner.id), {
    role: "leader",
    status: "active",
    acceptedAt: c.now,
  });
  write(
    c,
    "project-" + id,
    "project",
    {
      mode,
      capacity: mode === "solo" ? 1 : capacity,
      stage: "forming",
      baselineId: null,
      repositoryUrl: "",
      deployUrl: "",
      firebaseUrl: "",
    },
    "project",
    id,
  );
  const next = {
    ...source,
    state: "selected" as const,
    revision: source.revision + 1,
    updatedAt: c.now,
  };
  c.store.write(path(c, "ideas/" + source.id), next);
  ideaHistory(c, next, "프로젝트로 선정", reason);
  event(c, "프로젝트 시작", reason, id, id);
  notify(c, owner.id, "프로젝트가 만들어졌습니다.", id, "project");
  return id;
}
export async function voting(
  c: Context,
  cmd: WorkshopCommand,
): Promise<{ id: string } | null> {
  switch (cmd.type) {
    case "openVote": {
      admin(c);
      if (new Set(cmd.candidateIds).size !== cmd.candidateIds.length)
        fail("후보가 중복되었습니다.");
      if (cmd.closesAt <= c.now) fail("마감은 현재보다 이후여야 합니다.");
      const current = await c.store.read<{ roundId: string }>(
        path(c, "control/vote"),
      );
      if (current) {
        const r = await optional(c, current.roundId, "round");
        if (r && r.data.state === "open")
          fail("열린 투표를 먼저 마감해주세요.");
      }
      const sources = await Promise.all(
        cmd.candidateIds.map((id) => idea(c, id)),
      );
      for (const i of sources)
        if (i.scope !== "cohort" || i.state !== "shared")
          fail("전체에 공유 중인 아이디어만 후보로 지정할 수 있습니다.");
      for(const i of sources)assertProblemReady(i);
      const id = "round-" + c.requestId;
      write(c, id, "round", {
        title: cmd.title,
        state: "open",
        budget: Math.min(cmd.budget, sources.length),
        allowSelfVote: cmd.allowSelfVote,
        closesAt: cmd.closesAt,
        candidates: sources.map((i) => ({
          ideaId: i.id,
          revision: i.revision,
          title: i.title,
          body: i.body,
          ownerId: i.ownerId,
          ...(i.refinement?{refinement:i.refinement}:{}),
        })),
        counts: {},
        reason: "",
      });
      for (const i of sources) {
        const next = {
          ...i,
          state: "candidate" as const,
          revision: i.revision + 1,
          updatedAt: c.now,
        };
        c.store.write(path(c, "ideas/" + i.id), next);
        ideaHistory(c, next, "투표 후보 버전 고정", cmd.title);
      }
      c.store.write(path(c, "control/vote"), { roundId: id });
      event(c, "투표 시작", cmd.title, id);
      return { id };
    }
    case "ballot": {
      const round = await record(c, cmd.roundId, "round");
      if (round.data.state !== "open" || round.data.closesAt <= c.now)
        fail("투표가 마감되었습니다.");
      const ids = cmd.candidateIds;
      if (new Set(ids).size !== ids.length || ids.length > round.data.budget)
        fail("중복 선택 또는 표 예산 초과입니다.");
      for (const id of ids) {
        const candidate = round.data.candidates.find((x) => x.ideaId === id);
        if (!candidate) fail("등록된 후보가 아닙니다.");
        if (!round.data.allowSelfVote && candidate.ownerId === c.uid)
          fail("본인 후보 투표는 허용되지 않습니다.");
      }
      const id = "ballot-" + round.id + "-" + c.uid;
      const previous = await optional(c, id, "ballot");
      revision(previous, cmd.revision);
      write(
        c,
        id,
        "ballot",
        { roundId: round.id, candidateIds: ids },
        "owner",
        null,
        c.uid,
        previous,
      );
      return { id: round.id };
    }
    case "closeVote": {
      admin(c);
      const r = await record(c, cmd.roundId, "round");
      if (r.data.state !== "open") fail("이미 마감된 투표입니다.");
      const ballots = await c.store.list<RecordOf<"ballot">>(
        path(c, "workshop"),
        [
          { field: "kind", value: "ballot" },
          { field: "data.roundId", value: r.id },
        ],
      );
      const counts = Object.fromEntries(
        r.data.candidates.map((x) => [x.ideaId, 0]),
      );
      for (const b of ballots)
        for (const id of b.data.candidateIds) if (id in counts) counts[id]++;
      write(
        c,
        r.id,
        "round",
        { ...r.data, state: "closed", counts, reason: cmd.reason },
        "cohort",
        null,
        r.ownerId,
        r,
      );
      event(c, "투표 마감", cmd.reason, r.id);
      return { id: r.id };
    }
    case "selectVote": {
      admin(c);
      const r = await record(c, cmd.roundId, "round");
      if (r.data.state !== "closed")
        fail("집계가 마감된 투표만 선정할 수 있습니다.");
      if (
        new Set(cmd.selected.map((s) => s.ideaId)).size !== cmd.selected.length
      )
        fail("선정 후보가 중복되었습니다.");
      for (const s of cmd.selected)
        if (!r.data.candidates.some((x) => x.ideaId === s.ideaId))
          fail("이 라운드의 후보가 아닙니다.");
      const selectedOwners = new Set<string>();
      for (const candidate of r.data.candidates) {
        const i = await idea(c, candidate.ideaId);
        if (i.state !== "candidate" || i.revision !== candidate.revision + 1)
          fail("후보 버전이 변경되었습니다.");
        const selected = cmd.selected.find((s) => s.ideaId === i.id);
        if (selected) {
          if (selectedOwners.has(i.ownerId))
            fail("제안자당 한 프로젝트를 선정해주세요.");
          selectedOwners.add(i.ownerId);
          await makeProject(
            c,
            i,
            selected.name,
            selected.mode,
            selected.capacity,
            cmd.reason,
            "-" + cmd.selected.indexOf(selected),
          );
        } else {
          const next = {
            ...i,
            state: "closed_unselected" as const,
            revision: i.revision + 1,
            updatedAt: c.now,
          };
          c.store.write(path(c, "ideas/" + i.id), next);
          ideaHistory(c, next, "미선정 후보 종료", cmd.reason);
        }
      }
      write(
        c,
        r.id,
        "round",
        { ...r.data, state: "selected", reason: cmd.reason },
        "cohort",
        null,
        r.ownerId,
        r,
      );
      event(c, "최종 선정", cmd.reason, r.id);
      return { id: r.id };
    }
    case "createProject": {
      const i = await idea(c, cmd.ideaId);
      if (c.me.role !== "admin" && (i.ownerId !== c.uid || cmd.mode !== "solo"))
        fail("개인 프로젝트는 본인 아이디어로만 시작할 수 있습니다.", 403);
      if (i.scope !== "cohort" || i.state !== "shared")
        fail(
          "전체에 공유한 아이디어가 필요합니다. 투표 후보는 라운드에서 선정해주세요.",
        );
      return {
        id: await makeProject(
          c,
          i,
          cmd.name,
          cmd.mode,
          cmd.capacity,
          cmd.reason,
        ),
      };
    }
    case "reopenIdea": {
      admin(c);
      const i = await idea(c, cmd.ideaId);
      if (i.state !== "closed_unselected")
        fail("종료 보관된 아이디어만 다시 열 수 있습니다.");
      const next = {
        ...i,
        state: "shared" as const,
        revision: i.revision + 1,
        updatedAt: c.now,
      };
      c.store.write(path(c, "ideas/" + i.id), next);
      ideaHistory(c, next, "아이디어 다시 열기", cmd.reason);
      return { id: i.id };
    }
    case "shareIdea": {
      const i = await idea(c, cmd.ideaId);
      if (i.ownerId !== c.uid || i.state !== "shared")
        fail("본인의 작성 중인 생각만 공유 범위를 바꿀 수 있습니다.", 403);
      revision(i, cmd.revision);
      if (cmd.scope === "project" && !c.me.projectId)
        fail("먼저 프로젝트에 참여해주세요.");
      const next = {
        ...i,
        scope: cmd.scope,
        projectId: cmd.scope === "project" ? c.me.projectId : null,
        revision: i.revision + 1,
        version: i.version + 1,
        updatedAt: c.now,
      };
      const reactions = await c.store.list<RecordOf<"reaction">>(
        path(c, "workshop"),
        [
          { field: "kind", value: "reaction" },
          { field: "data.ideaId", value: i.id },
        ],
      );
      for (const r of reactions)
        c.store.write(path(c, "workshop/" + r.id), {
          ...r,
          scope: next.scope,
          projectId: next.projectId,
        });
      c.store.write(path(c, "ideas/" + i.id), next);
      ideaHistory(c, next, "공유 범위 변경", cmd.reason);
      return { id: i.id };
    }
    case "join": {
      if (c.me.projectId) fail("현재 프로젝트에서 탈퇴한 후 신청해주세요.");
      const p = await c.store.read<Project>(
        path(c, "projects/" + cmd.projectId),
      );
      if (!p) fail("프로젝트를 찾을 수 없습니다.", 404);
      const cfg = await defaults(c, p.id);
      if (cfg.data.mode === "solo")
        fail("개인 프로젝트는 참여 신청을 받지 않습니다.");
      if (["completed", "archived"].includes(cfg.data.stage))
        fail("종료된 프로젝트입니다.");
      const id = "join-" + p.id + "-" + c.uid,
        old = await optional(c, id, "join");
      if (old?.data.state === "pending")
        fail("이미 대기 중인 신청이 있습니다.");
      write(
        c,
        id,
        "join",
        {
          applicantId: c.uid,
          message: cmd.message,
          state: "pending",
          reason: "",
        },
        "owner",
        p.id,
        c.uid,
        old,
      );
      notify(c, p.leaderId, "새 팀 참여 신청이 있습니다.", id, "join");
      return { id };
    }
    case "resolveJoin": {
      const r = await record(c, cmd.requestId, "join", false),
        p = await project(c, r.projectId!, "roster");
      if (r.data.state !== "pending") fail("이미 처리된 신청입니다.");
      const applicant = await member(c, r.data.applicantId),
        cfg = await defaults(c, p.id);
      if (cmd.accept) {
        if (applicant.projectId)
          fail("신청자가 이미 다른 프로젝트에 참여하고 있습니다.");
        if (cfg.data.mode === "solo" || p.memberIds.length >= cfg.data.capacity)
          fail("프로젝트 정원이 가득 찼습니다.");
        if (["completed", "archived"].includes(cfg.data.stage))
          fail("종료된 프로젝트입니다.");
        saveProject(c, { ...p, memberIds: [...p.memberIds, applicant.id] });
        setMembership(c, applicant, p.id);
        c.store.write(
          path(c, "projects/" + p.id + "/members/" + applicant.id),
          { role: "member", status: "active", acceptedAt: c.now },
        );
      }
      write(
        c,
        r.id,
        "join",
        {
          ...r.data,
          state: cmd.accept ? "accepted" : "rejected",
          reason: cmd.reason,
        },
        "owner",
        p.id,
        r.ownerId,
        r,
      );
      event(c, "팀 신청 처리", cmd.reason, p.id, p.id);
      notify(
        c,
        applicant.id,
        cmd.accept ? "팀 참여가 승인됐습니다." : "팀 참여 신청이 반려됐습니다.",
        p.id,
        "project",
      );
      return { id: p.id };
    }
    case "withdrawJoin": {
      const r = await record(c, cmd.requestId, "join");
      if (r.ownerId !== c.uid || r.data.state !== "pending")
        fail("본인의 대기 신청만 취소할 수 있습니다.", 403);
      write(
        c,
        r.id,
        "join",
        { ...r.data, state: "withdrawn" },
        "owner",
        r.projectId,
        r.ownerId,
        r,
      );
      return { id: r.id };
    }
    case "leaveProject": {
      const p = await project(c, cmd.projectId);
      if (!p.memberIds.includes(c.uid))
        fail("프로젝트 구성원이 아닙니다.", 403);
      if (p.leaderId === c.uid) fail("리더를 이관한 후 탈퇴해주세요.");
      saveProject(c, {
        ...p,
        memberIds: p.memberIds.filter((id) => id !== c.uid),
      });
      setMembership(c, c.me, null);
      c.store.write(
        path(c, "projects/" + p.id + "/members/" + c.uid),
        { status: "left", leftAt: c.now },
        true,
      );
      event(c, "팀원 탈퇴", cmd.reason, p.id, p.id);
      return { id: p.id };
    }
    case "transferLeader": {
      const p = await project(c, cmd.projectId, "roster");
      const next = await member(c, cmd.memberId);
      if (next.id === p.leaderId) fail("현재 팀장과 동일합니다.");
      if (next.projectId !== p.id || !p.memberIds.includes(next.id))
        fail("현재 팀원에게만 리더를 이관할 수 있습니다.");
      saveProject(c, { ...p, leaderId: next.id });
      c.store.write(
        path(c, "projects/" + p.id + "/members/" + next.id),
        { role: "leader" },
        true,
      );
      c.store.write(
        path(c, "projects/" + p.id + "/members/" + p.leaderId),
        { role: "member" },
        true,
      );
      event(c, "리더 이관", cmd.reason, p.id, p.id);
      return { id: p.id };
    }
    case "projectConfig": {
      const p = await project(c, cmd.projectId, "leader"),
        cfg = await defaults(c, p.id);
      if (
        cmd.capacity < p.memberIds.length ||
        (cmd.mode === "solo" && p.memberIds.length > 1)
      )
        fail("현재 인원보다 정원을 줄일 수 없습니다.");
      write(
        c,
        cfg.id,
        "project",
        {
          ...cfg.data,
          mode: cmd.mode,
          capacity: cmd.mode === "solo" ? 1 : cmd.capacity,
          repositoryUrl: cmd.repositoryUrl,
          deployUrl: cmd.deployUrl,
          firebaseUrl: cmd.firebaseUrl,
        },
        "project",
        p.id,
        cfg.ownerId,
        cfg,
      );
      saveProject(c, {
        ...p,
        mode: cmd.mode,
        capacity: cmd.mode === "solo" ? 1 : cmd.capacity,
      });
      return { id: p.id };
    }
    case "support": {
      await project(c, cmd.projectId, "leader");
      const target = await member(c, cmd.memberId);
      if (!["admin", "facilitator"].includes(target.role))
        fail("운영자에게만 지원 권한을 줄 수 있습니다.");
      if (
        cmd.expiresAt <= c.now ||
        Date.parse(cmd.expiresAt) - Date.parse(c.now) > 30 * 86400000
      )
        fail("지원 기간은 최대 30일입니다.");
      const id = "support-" + cmd.projectId + "-" + target.id;
      write(
        c,
        id,
        "support",
        { userId: target.id, edit: cmd.edit, expiresAt: cmd.expiresAt },
        "owner",
        cmd.projectId,
        target.id,
      );
      event(c, "지원 권한 부여", cmd.expiresAt, cmd.projectId, cmd.projectId);
      return { id };
    }
    case "revokeSupport": {
      await project(c, cmd.projectId, "leader");
      const id = "support-" + cmd.projectId + "-" + cmd.memberId;
      c.store.remove(path(c, "workshop/" + id));
      event(c, "지원 권한 회수", "팀장의 회수", cmd.projectId, cmd.projectId);
      return { id };
    }
    default:
      return null;
  }
}
