import {emptyRefinement} from '../refinement';
import type { Context, RecordOf, Scope } from "./model";
import type { WorkshopCommand } from "./commands";
import type { Member, Message, Idea } from "../types";
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
  editableProject,
  canRead,
  saveProject,
  leaveMembership,
  assertChannel,
} from "./core";
import { projectIdsOf } from "../policy";
async function hash(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function message(c: Context, channel: string, id: string) {
  assertChannel(c.me, channel);
  const m = await c.store.read<Message>(
    path(c, "channels/" + channel + "/messages/" + id),
  );
  if (!m) fail("메시지를 찾을 수 없습니다.", 404);
  return m;
}
function newIdea(
  c: Context,
  title: string,
  body: string,
  scope: "owner" | "project" | "cohort",
  projectId: string | null,
  sourceId?: string,
  kind: Idea["kind"] = "thought",
  origin?: { sourceMessageId: string; sourceChannel: string },
) {
  const id = "idea-" + c.requestId;
  const i: Idea = {
    id,
    title,
    body,
    kind,
    ownerId: c.uid,
    scope,
    projectId,
    state: "shared",
    revision: 1,
    version: 1,
    createdAt: c.now,
    updatedAt: c.now,
    ...(sourceId ? { sourceId } : {}),
    ...(origin || {}),
  };
  c.store.write(path(c, "ideas/" + id), i);
  ideaHistory(c, i, "자료에서 첫 생각 생성", "원문을 검토하고 작성");
  return id;
}
export async function operations(
  c: Context,
  cmd: WorkshopCommand,
): Promise<{ id: string } | null> {
  switch (cmd.type) {
    case "settings": {
      admin(c);
      const { type, ...data } = cmd;
      write(c, "settings", "settings", data);
      c.store.write(
        path(c, ""),
        { name: cmd.name, week: cmd.week, status: cmd.state },
        true,
      );
      event(c, "기수 운영 설정", "주차·진행 방식·보관 정책 변경", "settings");
      return { id: "settings" };
    }
    case "invite": {
      admin(c);
      const email = cmd.email.toLowerCase().trim(),
        id = await hash(email);
      const old = await c.store.read<{ status: string }>(
        path(c, "invites/" + id),
      );
      if (old?.status === "accepted")
        fail("이미 가입한 계정입니다. 참가자 관리에서 변경해주세요.");
      c.store.write(path(c, "invites/" + id), {
        email,
        role: cmd.role,
        status: "pending",
        expiresAt: new Date(
          Date.parse(c.now) + cmd.days * 86400000,
        ).toISOString(),
        createdAt: c.now,
        createdBy: c.uid,
      });
      return { id };
    }
    case "revokeInvite": {
      admin(c);
      const old = await c.store.read(path(c, "invites/" + cmd.inviteId));
      if (!old) fail("초대를 찾을 수 없습니다.", 404);
      c.store.write(
        path(c, "invites/" + cmd.inviteId),
        { status: "revoked" },
        true,
      );
      return { id: cmd.inviteId };
    }
    case "memberRole": {
      admin(c);
      const m = await c.store.read<Member>(path(c, "members/" + cmd.memberId));
      if (!m) fail("참가자를 찾을 수 없습니다.", 404);
      if (m.role === "admin" && (!cmd.active || cmd.role !== "admin")) {
        const all = await c.store.list<Member>(path(c, "members"));
        if (all.filter((x) => x.active && x.role === "admin").length <= 1)
          fail("마지막 관리자는 유지해야 합니다.");
      }
      if (!cmd.active) {
        let current = m;
        for (const pid of projectIdsOf(m)) {
          const p = await c.store.read<import("../types").Project>(
            path(c, "projects/" + pid),
          );
          if (p?.leaderId === m.id) fail("리더 이관 후 참여를 중지해주세요.");
          if (p)
            saveProject(c, {
              ...p,
              memberIds: p.memberIds.filter((id) => id !== m.id),
            });
          leaveMembership(c, current, pid);
          current = { ...current, projectIds: projectIdsOf(current).filter((id) => id !== pid), projectId: null };
        }
      }
      const patch = { role: cmd.role, active: cmd.active };
      c.store.write(path(c, "members/" + m.id), patch, true);
      c.store.write(path(c, "profiles/" + m.id), patch, true);
      event(c, "참가자 권한 변경", cmd.reason, m.id);
      return { id: m.id };
    }
    case "activity": {
      operator(c);
      if (cmd.featured && cmd.state === "draft")
        fail("준비 중인 활동은 현재 활동 표시를 해제해주세요.");
      const old = await optional(c, cmd.id, "activity");
      revision(old, cmd.revision);
      const { type, id, revision: rev, ...data } = cmd;
      write(
        c,
        id,
        "activity",
        data,
        "cohort",
        null,
        old?.ownerId || c.uid,
        old,
      );
      if (cmd.featured) {
        const featured = await c.store.list<RecordOf<"activity">>(
          path(c, "workshop"),
          [
            { field: "kind", value: "activity" },
            { field: "data.featured", value: true },
          ],
        );
        for (const a of featured)
          if (a.id !== id)
            c.store.write(path(c, "workshop/" + a.id), {
              ...a,
              data: { ...a.data, featured: false },
            });
        c.store.write(path(c, "activities/discovery"), {
          id: "discovery",
          title: cmd.title,
          question: cmd.question,
          description: cmd.instructions,
          state: cmd.state === "open" ? "open" : "closed",
          week: cmd.week,
          activityId: id,
          closesAt: cmd.closesAt,
        });
        c.store.write(path(c, ""), { featuredActivityId: id }, true);
      }
      event(c, "활동 " + cmd.state, cmd.reason, id);
      return { id };
    }
    case "submitActivity": {
      const a = await record(c, cmd.activityId, "activity");
      if (
        a.data.state !== "open" ||
        (a.data.closesAt && a.data.closesAt <= c.now)
      )
        fail("활동이 마감되었습니다.");
      const id = "submission-" + a.id + "-" + c.uid,
        old = await optional(c, id, "submission");
      revision(old, cmd.revision);
      if (old) {
        const versions = await c.store.list<RecordOf<"submissionVersion">>(
          path(c, "workshop"),
          [
            { field: "kind", value: "submissionVersion" },
            { field: "ownerId", value: c.uid },
            { field: "data.activityId", value: a.id },
          ],
        );
        for (const v of versions)
          c.store.write(
            path(c, "workshop/" + v.id),
            { scope: cmd.scope },
            true,
          );
        write(
          c,
          "submission-version-" + c.requestId,
          "submissionVersion",
          old.data,
          cmd.scope,
          old.projectId,
          c.uid,
        );
      }
      write(
        c,
        id,
        "submission",
        { activityId: a.id, body: cmd.body },
        cmd.scope,
        null,
        c.uid,
        old,
      );
      return { id };
    }
    case "submissionIdea": {
      const s = await record(c, cmd.submissionId, "submission");
      if (s.ownerId !== c.uid)
        fail("본인 활동 결과를 아이디어로 연결해주세요.", 403);
      const id = newIdea(
        c,
        cmd.title,
        s.data.body,
        s.scope as "owner" | "cohort",
        null,
      );
      c.store.write(path(c, "ideas/" + id), { sourceSubmissionId: s.id }, true);
      return { id };
    }
    case "source": {
      if (cmd.scope === "project") {
        if (!cmd.projectId) fail("프로젝트를 선택해주세요.");
        await editableProject(c, cmd.projectId);
      }
      if (cmd.scope !== "project" && cmd.projectId)
        fail("원본 범위와 프로젝트가 일치하지 않습니다.");
      const old = await optional(c, cmd.id, "source");
      if (
        old &&
        (old.ownerId !== c.uid ||
          old.scope !== cmd.scope ||
          old.projectId !== cmd.projectId)
      )
        fail("본인 원본을 같은 공개 범위에서만 수정할 수 있습니다.", 403);
      revision(old, cmd.revision);
      if (old?.data.redacted) fail("정정된 원본은 다시 사용하지 않습니다.");
      if (old)
        write(
          c,
          "source-version-" + c.requestId,
          "sourceVersion",
          {
            sourceId: old.id,
            title: old.data.title,
            text: old.data.text,
            sourceRevision: old.revision,
          },
          old.scope,
          old.projectId,
          old.ownerId,
        );
      write(
        c,
        cmd.id,
        "source",
        {
          title: cmd.title,
          text: cmd.text,
          sourceType: cmd.sourceType,
          ...((cmd.step || old?.data.step) && cmd.projectId ? { step: cmd.step || old?.data.step } : {}),
          consent: cmd.consent,
          redacted: false,
        },
        cmd.scope,
        cmd.projectId,
        c.uid,
        old,
      );
      return { id: cmd.id };
    }
    case "proposal": {
      const s = await record(c, cmd.sourceId, "source");
      revision(s, cmd.sourceRevision);
      if (s.projectId) await editableProject(c, s.projectId);
      if (s.data.redacted || !s.data.text.includes(cmd.evidence))
        fail("원본에 있는 근거 구간을 입력해주세요.");
      const id = "proposal-" + c.requestId;
      write(
        c,
        id,
        "proposal",
        {
          sourceId: s.id,
          sourceRevision: s.revision,
          type: cmd.proposalType,
          title: cmd.title,
          body: cmd.body,
          evidence: cmd.evidence,
          state: "proposed",
          resultId: null,
        },
        s.scope,
        s.projectId,
        c.uid,
      );
      return { id };
    }
    case "resolveProposal": {
      const p = await record(c, cmd.proposalId, "proposal");
      if (p.projectId) await editableProject(c, p.projectId);
      if (p.data.state === "accepted") return { id: p.data.resultId! };
      if (p.data.state !== "proposed") fail("이미 거절된 제안입니다.");
      const s = await record(c, p.data.sourceId, "source");
      if (
        cmd.accept &&
        (s.revision !== p.data.sourceRevision || s.data.redacted)
      )
        fail("원본이 바뀌었습니다. 최신 원본을 기준으로 다시 검토해주세요.");
      let id: string | null = null;
      if (cmd.accept) {
        if (p.data.type === "task" || p.data.type === "decision") {
          if (!p.projectId) fail("작업·결정은 팀 원본에서 생성해주세요.");
          if (p.data.type === "decision")
            await project(c, p.projectId, "leader");
          else await editableProject(c, p.projectId);
          id = p.data.type + "-" + c.requestId;
          if (p.data.type === "task")
            write(
              c,
              id,
              "task",
              {
                title: cmd.title,
                body: cmd.body,
                status: "todo",
                assigneeId: c.uid,
                sourceMessageId: null,
              },
              "project",
              p.projectId,
            );
          else
            write(
              c,
              id,
              "decision",
              {
                title: cmd.title,
                body: cmd.body,
                reason: "원본 검토 후 승인",
                sourceMessageId: null,
              },
              "project",
              p.projectId,
            );
        } else
          id = newIdea(
            c,
            cmd.title,
            cmd.body,
            p.scope as "owner" | "project" | "cohort",
            p.projectId,
            s.id,
            p.data.type === "question"
              ? "question"
              : p.data.type === "summary"
                ? "progress"
                : "thought",
          );
      }
      write(
        c,
        p.id,
        "proposal",
        {
          ...p.data,
          title: cmd.title,
          body: cmd.body,
          state: cmd.accept ? "accepted" : "rejected",
          resultId: id,
        },
        p.scope,
        p.projectId,
        p.ownerId,
        p,
      );
      return { id: id || p.id };
    }
    case "approveDraft": {
      const d = await record(c, cmd.draftId, "aiDraft");
      if (d.data.state !== "proposed") fail("이미 처리된 초안입니다.");
      if (!d.projectId) fail("팀 문서가 아닙니다.");
      await editableProject(c, d.projectId);
      if (cmd.accept) {
        const source = await record(c, d.data.sourceId, "source");
        if (source.revision !== d.data.sourceRevision || source.data.redacted)
          fail("원문이 바뀌었습니다. 다시 검토해주세요.");
        const id = "doc-" + d.projectId + "-" + d.data.key,
          old = await optional(c, id, "document");
        revision(old, d.data.documentRevision);
        write(
          c,
          "draft-version-" + c.requestId,
          "version",
          {
            key: d.data.key,
            title: d.data.key,
            markdown: cmd.markdown,
            documentRevision: (old?.revision || 0) + 1,
            reason: cmd.reason,
            sourceId: source.id,
          },
          "project",
          d.projectId,
        );
        write(
          c,
          id,
          "document",
          {
            key: d.data.key,
            title: d.data.key,
            markdown: cmd.markdown,
            reason: cmd.reason,
            sourceId: source.id,
          },
          "project",
          d.projectId,
          old?.ownerId || c.uid,
          old,
        );
        event(c, "AI 문서 초안 검토 후 반영", cmd.reason, id, d.projectId);
      }
      write(
        c,
        d.id,
        "aiDraft",
        {
          ...d.data,
          markdown: cmd.markdown,
          state: cmd.accept ? "accepted" : "rejected",
        },
        d.scope,
        d.projectId,
        d.ownerId,
        d,
      );
      return { id: d.id };
    }
    case "redactSource": {
      const s = await record(c, cmd.sourceId, "source");
      if (s.ownerId !== c.uid) fail("원본 작성자가 정정할 수 있습니다.", 403);
      const derivatives = await c.store.list<import("./model").WorkshopRecord>(
        path(c, "workshop"),
        [{ field: "data.sourceId", value: s.id }],
      );
      for (const d of derivatives) {
        if (d.kind === "aiDraft")
          c.store.write(path(c, "workshop/" + d.id), {
            ...d,
            data: {
              ...d.data,
              markdown: "원문 정정으로 숨겨졌습니다.",
              evidence: "",
              state: "rejected",
            },
          });
        if (d.kind === "document" || d.kind === "version")
          c.store.write(path(c, "workshop/" + d.id), {
            ...d,
            revision: d.revision + 1,
            updatedAt: c.now,
            data: {
              ...d.data,
              markdown: "원문 정정으로 숨겨졌습니다.",
              reason: "원문 정정",
              redacted: true,
            },
          });
      }
      const oldVersions = await c.store.list<RecordOf<"sourceVersion">>(
        path(c, "workshop"),
        [
          { field: "kind", value: "sourceVersion" },
          { field: "data.sourceId", value: s.id },
        ],
      );
      for (const v of oldVersions)
        c.store.write(path(c, "workshop/" + v.id), {
          ...v,
          data: { ...v.data, title: "정정된 원본", text: "" },
        });
      const proposals = await c.store.list<RecordOf<"proposal">>(
        path(c, "workshop"),
        [
          { field: "kind", value: "proposal" },
          { field: "data.sourceId", value: s.id },
        ],
      );
      for (const p of proposals) {
        if (p.data.resultId) {
          if (["new_idea", "question", "summary"].includes(p.data.type)) {
            const i = await c.store.read<Idea>(
              path(c, "ideas/" + p.data.resultId),
            );
            if (i) {
              c.store.write(path(c, "ideas/" + i.id), {
                ...i,
                refinement: emptyRefinement(),
                title: "원본 정정으로 숨겨진 생각",
                body: "원본 작성자의 정정 요청으로 내용을 숨겼습니다.",
                state: "closed_unselected",
                revision: i.revision + 1,
                updatedAt: c.now,
              });
              const comments = await c.store.list<{ id: string }>(
                path(c, "ideas/" + i.id + "/comments"),
              );
              for (const cm of comments)
                c.store.write(
                  path(c, "ideas/" + i.id + "/comments/" + cm.id),
                  { body: "원본 정정으로 연결된 의견을 숨겼습니다." },
                  true,
                );
              const projects = await c.store.list<import("../types").Project>(
                path(c, "projects"),
                [{ field: "sourceIdeaId", value: i.id }],
              );
              for (const p of projects)
                saveProject(c, {
                  ...p,
                  problem: "출발 원문이 정정된 프로젝트",
                });
              const rounds = await c.store.list<RecordOf<"round">>(
                path(c, "workshop"),
                [{ field: "kind", value: "round" }],
              );
              for (const round of rounds) {
                if (
                  round.data.candidates.some(
                    (candidate) => candidate.ideaId === i.id,
                  )
                ) {
                  write(
                    c,
                    round.id,
                    "round",
                    {
                      ...round.data,
                      candidates: round.data.candidates.map((candidate) =>
                        candidate.ideaId === i.id
                          ? {
                              ...candidate,
                              refinement: emptyRefinement(),
                              title: "정정된 후보",
                              body: "원문 정정으로 내용을 숨겼습니다.",
                            }
                          : candidate,
                      ),
                    },
                    round.scope,
                    round.projectId,
                    round.ownerId,
                    round,
                  );
                }
              }
              const history = await c.store.list<{ id: string }>(
                path(c, "ideas/" + i.id + "/history"),
              );
              for (const h of history)
                c.store.write(
                  path(c, "ideas/" + i.id + "/history/" + h.id),
                  {
                    snapshot: {
                      refinement: emptyRefinement(),
                      title: "정정된 내용",
                      body: "원본 정정으로 비공개 처리됨",
                      scope: i.scope,
                      state: "closed_unselected",
                    },
                    reason: "원본 정정",
                  },
                  true,
                );
            }
          } else {
            const r = await c.store.read<import("./model").WorkshopRecord>(
              path(c, "workshop/" + p.data.resultId),
            );
            if (r && (r.kind === "task" || r.kind === "decision"))
              c.store.write(path(c, "workshop/" + r.id), {
                ...r,
                data: {
                  ...r.data,
                  title: "원본 정정",
                  body: "원본 작성자의 정정으로 비공개 처리됨",
                },
              });
          }
        }
        write(
          c,
          p.id,
          "proposal",
          {
            ...p.data,
            title: "정정된 제안",
            body: "",
            evidence: "",
            state: "rejected",
          },
          p.scope,
          p.projectId,
          p.ownerId,
          p,
        );
      }
      write(
        c,
        s.id,
        "source",
        {
          ...s.data,
          title: "정정된 원본",
          text: "",
          redacted: true,
          consent: false,
        },
        s.scope,
        s.projectId,
        s.ownerId,
        s,
      );
      write(
        c,
        "event-" + c.requestId,
        "event",
        { title: "원본과 파생 내용 정정", reason: cmd.reason, targetId: s.id },
        s.scope,
        s.projectId,
        s.ownerId,
      );
      return { id: s.id };
    }
    case "help": {
      const id = "help-" + c.requestId;
      write(
        c,
        id,
        "help",
        { title: cmd.title, body: cmd.body, state: "open", resolution: "" },
        "owner",
      );
      return { id };
    }
    case "resolveHelp": {
      operator(c);
      const h = await record(c, cmd.helpId, "help", false);
      write(
        c,
        h.id,
        "help",
        { ...h.data, state: "resolved", resolution: cmd.resolution },
        "owner",
        null,
        h.ownerId,
        h,
      );
      notify(c, h.ownerId, "도움 요청에 답변이 도착했습니다.", h.id, "help");
      return { id: h.id };
    }
    case "reaction": {
      const i = await idea(c, cmd.ideaId);
      const id = "reaction-" + i.id + "-" + c.uid,
        old = await optional(c, id, "reaction");
      if (old) c.store.remove(path(c, "workshop/" + id));
      else write(c, id, "reaction", { ideaId: i.id }, i.scope, i.projectId);
      return { id: i.id };
    }
    case "replyMessage": {
      await message(c, cmd.channel, cmd.replyToId);
      const rate = await c.store.read<{ sentAt: string }>(
        path(c, "messageRates/" + c.uid),
      );
      if (rate && Date.parse(c.now) - Date.parse(rate.sentAt) < 1000)
        fail("잠시 후 메시지를 보내주세요.", 429);
      c.store.write(path(c, "messageRates/" + c.uid), { sentAt: c.now });
      if (new Set(cmd.mentions).size !== cmd.mentions.length)
        fail("멘션 대상이 중복되었습니다.");
      for (const uid of cmd.mentions) {
        const m = await member(c, uid);
        if (cmd.channel !== "cohort" && m.projectId !== cmd.channel)
          fail("대화방 밖의 참가자를 멘션할 수 없습니다.", 403);
      }
      const id = "message-" + c.requestId;
      c.store.write(path(c, "channels/" + cmd.channel + "/messages/" + id), {
        id,
        authorId: c.uid,
        body: cmd.body,
        channel: cmd.channel,
        createdAt: c.now,
        replyToId: cmd.replyToId,
        mentions: cmd.mentions,
        revision: 1,
        ...(cmd.step && cmd.channel !== "cohort" ? { step: cmd.step } : {}),
      });
      for (const uid of cmd.mentions)
        notify(c, uid, "대화에서 나를 멘션했습니다.", id, "message");
      return { id };
    }
    case "pinMessage": {
      const m = await message(c, cmd.channel, cmd.messageId);
      if (cmd.channel === "cohort") operator(c);
      else await project(c, cmd.channel, "leader");
      c.store.write(
        path(c, "channels/" + cmd.channel + "/messages/" + m.id),
        { pinned: cmd.pinned },
        true,
      );
      return { id: m.id };
    }
    case "editMessage": {
      const m = await message(c, cmd.channel, cmd.messageId);
      if (m.authorId !== c.uid)
        fail("본인의 메시지만 수정할 수 있습니다.", 403);
      revision({ revision: m.revision || 1 }, cmd.revision);
      c.store.write(
        path(
          c,
          "channels/" +
            cmd.channel +
            "/messages/" +
            m.id +
            "/revisions/" +
            c.requestId,
        ),
        { body: m.body, revision: m.revision || 1, createdAt: c.now },
      );
      c.store.write(
        path(c, "channels/" + cmd.channel + "/messages/" + m.id),
        { body: cmd.body, revision: (m.revision || 1) + 1, editedAt: c.now },
        true,
      );
      return { id: m.id };
    }
    case "messageToRecord": {
      const m = await message(c, cmd.channel, cmd.messageId);
      if (cmd.target === "idea")
        return {
          id: newIdea(
            c,
            cmd.title,
            cmd.body,
            cmd.channel === "cohort" ? "cohort" : "project",
            cmd.channel === "cohort" ? null : cmd.channel,
            undefined,
            "thought",
            { sourceMessageId: m.id, sourceChannel: cmd.channel },
          ),
        };
      if (cmd.channel === "cohort")
        fail("팀 대화에서 작업과 결정을 연결해주세요.");
      if (cmd.target === "decision") await project(c, cmd.channel, "leader");
      else await editableProject(c, cmd.channel);
      const id = cmd.target + "-" + c.requestId;
      // A record made from chat keeps the chat's step unless the member is now working in another step.
      const step = cmd.step || (m as { step?: import("../steps").StepKey }).step;
      if (cmd.target === "task")
        write(
          c,
          id,
          "task",
          {
            title: cmd.title,
            body: cmd.body,
            status: "todo",
            assigneeId: c.uid,
            sourceMessageId: m.id,
            ...(step ? { step } : {}),
          },
          "project",
          cmd.channel,
        );
      else
        write(
          c,
          id,
          "decision",
          {
            title: cmd.title,
            body: cmd.body,
            reason: "팀 대화 검토",
            sourceMessageId: m.id,
            ...(step ? { step } : {}),
          },
          "project",
          cmd.channel,
        );
      return { id };
    }
    case "readChannel": {
      assertChannel(c.me, cmd.channel);
      const id = "read-" + cmd.channel + "-" + c.uid;
      write(
        c,
        id,
        "read",
        { channel: cmd.channel, lastReadAt: c.now },
        "owner",
      );
      return { id };
    }
    case "readNotification": {
      const n = await record(c, cmd.notificationId, "notification");
      write(
        c,
        n.id,
        "notification",
        { ...n.data, read: true },
        "owner",
        null,
        c.uid,
        n,
      );
      return { id: n.id };
    }
    case "report": {
      if (cmd.targetKind === "idea") await idea(c, cmd.targetId);
      else if (cmd.targetKind === "message")
        await message(c, cmd.channel, cmd.targetId);
      else await record(c, cmd.targetId, "source");
      const id = "report-" + c.requestId;
      write(
        c,
        id,
        "report",
        {
          targetId: cmd.targetId,
          targetKind: cmd.targetKind,
          channel: cmd.channel,
          reason: cmd.reason,
          state: "open",
          resolution: "",
        },
        "admin",
      );
      return { id };
    }
    case "resolveReport": {
      admin(c);
      const r = await record(c, cmd.reportId, "report");
      write(
        c,
        r.id,
        "report",
        { ...r.data, state: "resolved", resolution: cmd.resolution },
        "admin",
        null,
        r.ownerId,
        r,
      );
      notify(c, r.ownerId, "신고 검토 결과가 등록되었습니다.", r.id, "report");
      return { id: r.id };
    }
    default:
      return null;
  }
}
