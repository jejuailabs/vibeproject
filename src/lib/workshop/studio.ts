import type { Context, RecordOf, DocKey } from "./model";
import { docKeys, docNames, readinessItems, stages, stageNames } from "./model";
import type { WorkshopCommand } from "./commands";
import type { Idea, Message } from "../types";
import {
  admin,
  fail,
  path,
  record,
  optional,
  write,
  revision,
  event,
  notify,
  member,
  project,
  editableProject,
  defaults,
  saveProject,
} from "./core";

async function sourceMessage(c: Context, projectId: string, id: string | null) {
  if (
    id &&
    !(await c.store.read<Message>(
      path(c, "channels/" + projectId + "/messages/" + id),
    ))
  )
    fail("이 팀의 원본 메시지를 찾을 수 없습니다.");
}
export async function studio(
  c: Context,
  cmd: WorkshopCommand,
): Promise<{ id: string } | null> {
  switch (cmd.type) {
    case "document": {
      const team = await editableProject(c, cmd.projectId);
      const id = "doc-" + cmd.projectId + "-" + cmd.key,
        old = await optional(c, id, "document");
      const sourceIdea=cmd.key==="product"?await c.store.read<Idea>(path(c,"ideas/"+team.sourceIdeaId)):undefined;
      const sourceId=old?.data.sourceId||(sourceIdea?.refinement?sourceIdea.sourceId:undefined);
      if(sourceId){
        const source=await optional(c,sourceId,"source");
        if(source?.data.redacted)fail("출발 원문이 정정되어 이 문서의 저장이 중지되었습니다.");
      }
      revision(old, cmd.revision);
      write(
        c,
        "draft-version-" + c.requestId,
        "version",
        {
          key: cmd.key,
          title: docNames[cmd.key],
          markdown: cmd.markdown,
          documentRevision: (old?.revision || 0) + 1,
          reason: cmd.reason,
          ...(sourceId ? { sourceId } : {}),
        },
        "project",
        cmd.projectId,
      );
      write(
        c,
        id,
        "document",
        {
          key: cmd.key,
          title: docNames[cmd.key],
          markdown: cmd.markdown,
          reason: cmd.reason,
          ...(sourceId ? { sourceId } : {}),
        },
        "project",
        cmd.projectId,
        old?.ownerId || c.uid,
        old,
      );
      event(c, "기획 문서 수정", cmd.reason, id, cmd.projectId);
      return { id };
    }
    case "baseline": {
      await project(c, cmd.projectId, "leader");
      const docs = await Promise.all(
        docKeys.map((key) =>
          record(c, "doc-" + cmd.projectId + "-" + key, "document"),
        ),
      );
      for (const doc of docs) {
        revision(doc, cmd.revisions[doc.data.key]);
        if (!doc.data.markdown.trim()) fail("모든 필수 문서를 작성해주세요.");
      }
      const id = "baseline-" + c.requestId,
        versions = docs.map((doc) => {
          const vid = "version-" + c.requestId + "-" + doc.data.key;
          write(
            c,
            vid,
            "version",
            { ...doc.data, documentRevision: doc.revision, reason: cmd.reason },
            "project",
            cmd.projectId,
          );
          return { key: doc.data.key, id: vid, revision: doc.revision };
        });
      write(
        c,
        id,
        "baseline",
        { title: cmd.title, reason: cmd.reason, versions },
        "project",
        cmd.projectId,
      );
      const cfg = await defaults(c, cmd.projectId);
      write(
        c,
        cfg.id,
        "project",
        { ...cfg.data, baselineId: id },
        "project",
        cmd.projectId,
        cfg.ownerId,
        cfg,
      );
      event(c, "기획 베이스라인 확정", cmd.reason, id, cmd.projectId);
      return { id };
    }
    case "restoreDocument": {
      await editableProject(c, cmd.projectId);
      const version = await record(c, cmd.versionId, "version");
      if (version.projectId !== cmd.projectId)
        fail("다른 프로젝트의 버전입니다.", 403);
      const id = "doc-" + cmd.projectId + "-" + version.data.key,
        old = await optional(c, id, "document");
      revision(old, cmd.revision);
      write(
        c,
        id,
        "document",
        {
          key: version.data.key,
          title: version.data.title,
          markdown: version.data.markdown,
          reason: cmd.reason,
          ...(version.data.sourceId ? { sourceId: version.data.sourceId } : {}),
        },
        "project",
        cmd.projectId,
        old?.ownerId || c.uid,
        old,
      );
      event(c, "과거 기획 복원", cmd.reason, id, cmd.projectId);
      return { id };
    }
    case "task": {
      const p = await editableProject(c, cmd.projectId);
      if (cmd.assigneeId && !p.memberIds.includes(cmd.assigneeId))
        fail("현재 팀원에게만 할 일을 배정할 수 있습니다.");
      await sourceMessage(c, p.id, cmd.sourceMessageId);
      const id = cmd.id,
        old = await optional(c, id, "task");
      if (old?.projectId && old.projectId !== p.id)
        fail("다른 팀의 작업입니다.", 403);
      revision(old, cmd.revision);
      write(
        c,
        id,
        "task",
        {
          title: cmd.title,
          body: cmd.body,
          status: cmd.status,
          assigneeId: cmd.assigneeId,
          sourceMessageId: cmd.sourceMessageId,
        },
        "project",
        p.id,
        old?.ownerId || c.uid,
        old,
      );
      if (cmd.assigneeId && cmd.assigneeId !== c.uid)
        notify(c, cmd.assigneeId, "새 작업이 배정됐습니다.", id, "task");
      return { id };
    }
    case "decision": {
      await project(c, cmd.projectId, "leader");
      await sourceMessage(c, cmd.projectId, cmd.sourceMessageId);
      const id = "decision-" + c.requestId;
      write(
        c,
        id,
        "decision",
        {
          title: cmd.title,
          body: cmd.body,
          reason: cmd.reason,
          sourceMessageId: cmd.sourceMessageId,
        },
        "project",
        cmd.projectId,
      );
      event(c, "팀 결정 확정", cmd.reason, id, cmd.projectId);
      return { id };
    }
    case "readiness": {
      if (cmd.projectId) await editableProject(c, cmd.projectId);
      if (cmd.item === "secrets" && cmd.exception)
        fail("비밀키 보호 항목은 예외 처리할 수 없습니다.");
      const id = "ready-" + (cmd.projectId || c.uid),
        old = await optional(c, id, "readiness");
      const items = {
        ...(old?.data.items || {}),
        [cmd.item]: { done: cmd.done, exception: cmd.exception },
      };
      write(
        c,
        id,
        "readiness",
        { items, scope: cmd.projectId ? "project" : "personal" },
        cmd.projectId ? "project" : "owner",
        cmd.projectId,
        c.uid,
        old,
      );
      return { id };
    }
    case "advance": {
      const p = await project(
        c,
        cmd.projectId,
        cmd.stage === "archived" ? "roster" : "leader",
      );
      if (cmd.stage === "archived") admin(c);
      const cfg = await defaults(c, p.id),
        from = stages.indexOf(cfg.data.stage),
        to = stages.indexOf(cmd.stage);
      if (to > from + 1) fail("필수 단계를 차례로 확정해주세요.");
      if (to === from) fail("현재와 같은 단계입니다.");
      if (to > from) {
        if (cmd.stage === "ready" && !cfg.data.baselineId)
          fail("기획 베이스라인을 먼저 확정해주세요.");
        if (cmd.stage === "developing") {
          const teamReady = await optional(c, "ready-" + p.id, "readiness");
          for (const key of [
            "github",
            "vercel",
            "firebase",
            "google",
            "secrets",
          ]) {
            const item = teamReady?.data.items[key];
            if (!item?.done && !item?.exception)
              fail("프로젝트 개발 준비 항목을 완료해주세요.");
          }
          for (const uid of p.memberIds) {
            const personal = await optional(c, "ready-" + uid, "readiness");
            for (const key of ["editor", "node"]) {
              const item = personal?.data.items[key];
              if (!item?.done && !item?.exception)
                fail("모든 팀원의 개인 환경 준비가 필요합니다.");
            }
          }
        }
        if (cmd.stage === "reviewing") {
          const releases = await c.store.list<RecordOf<"release">>(
            path(c, "workshop"),
            [
              { field: "kind", value: "release" },
              { field: "projectId", value: p.id },
            ],
          );
          if (!releases.length) fail("첫 배포 기록을 등록해주세요.");
        }
        if (cmd.stage === "completed") {
          const showcase = await optional(c, "showcase-" + p.id, "showcase");
          if (showcase?.data.state !== "published")
            fail("발표·회고와 공개 요약을 먼저 게시해주세요.");
        }
      }
      write(
        c,
        cfg.id,
        "project",
        { ...cfg.data, stage: cmd.stage },
        "project",
        p.id,
        cfg.ownerId,
        cfg,
      );
      saveProject(c, { ...p, stage: stageNames[cmd.stage] });
      event(
        c,
        "프로젝트 단계 변경",
        stageNames[cfg.data.stage] +
          " → " +
          stageNames[cmd.stage] +
          ": " +
          cmd.reason,
        p.id,
        p.id,
      );
      return { id: p.id };
    }
    case "release": {
      await project(c, cmd.projectId, "leader");
      const baseline = await record(c, cmd.baselineId, "baseline");
      if (baseline.projectId !== cmd.projectId)
        fail("이 팀의 베이스라인이 아닙니다.", 403);
      const id = "release-" + c.requestId;
      write(
        c,
        id,
        "release",
        {
          title: cmd.title,
          demoUrl: cmd.demoUrl,
          summary: cmd.summary,
          knownIssues: cmd.knownIssues,
          baselineId: baseline.id,
        },
        "cohort",
        cmd.projectId,
      );
      event(c, "배포 기록", cmd.summary, id, cmd.projectId);
      return { id };
    }
    case "feedback": {
      const release = await record(c, cmd.releaseId, "release");
      if (release.projectId !== cmd.projectId)
        fail("배포와 프로젝트가 일치하지 않습니다.");
      const id = "feedback-" + c.requestId;
      write(
        c,
        id,
        "feedback",
        {
          releaseId: release.id,
          body: cmd.body,
          status: "open",
          resolution: "",
        },
        "cohort",
        cmd.projectId,
      );
      const p = await c.store.read<{ leaderId: string }>(
        path(c, "projects/" + cmd.projectId),
      );
      if (p)
        notify(c, p.leaderId, "새 시연 피드백이 있습니다.", id, "feedback");
      return { id };
    }
    case "resolveFeedback": {
      const feedback = await record(c, cmd.feedbackId, "feedback");
      await editableProject(c, feedback.projectId!);
      write(
        c,
        feedback.id,
        "feedback",
        { ...feedback.data, status: cmd.status, resolution: cmd.resolution },
        "cohort",
        feedback.projectId,
        feedback.ownerId,
        feedback,
      );
      notify(
        c,
        feedback.ownerId,
        "남긴 피드백에 답변이 있습니다.",
        feedback.id,
        "feedback",
      );
      return { id: feedback.id };
    }
    case "showcase": {
      await project(c, cmd.projectId, "leader");
      const id = "showcase-" + cmd.projectId,
        old = await optional(c, id, "showcase");
      const { type, projectId, ...data } = cmd;
      write(
        c,
        id,
        "showcase",
        data,
        cmd.state === "published" ? "cohort" : "project",
        cmd.projectId,
        c.uid,
        old,
      );
      event(
        c,
        cmd.state === "published" ? "최종 발표 게시" : "발표 초안 저장",
        cmd.retrospective,
        id,
        cmd.projectId,
      );
      return { id };
    }
    case "schedule": {
      admin(c);
      if (
        cmd.networkMinutes +
          cmd.transitionMinutes * (cmd.projectIds.length - 1) >=
        cmd.totalMinutes
      )
        fail("발표 시간을 남겨주세요.");
      if (new Set(cmd.projectIds).size !== cmd.projectIds.length)
        fail("프로젝트가 중복되었습니다.");
      for (const id of cmd.projectIds)
        if (!(await c.store.read(path(c, "projects/" + id))))
          fail("등록되지 않은 프로젝트입니다.");
      const { type, ...data } = cmd;
      write(c, "schedule", "schedule", data);
      return { id: "schedule" };
    }
    case "resource": {
      await editableProject(c, cmd.projectId);
      const id = "resource-" + c.requestId;
      write(
        c,
        id,
        "resource",
        { title: cmd.title, url: cmd.url },
        "project",
        cmd.projectId,
      );
      return { id };
    }
    default:
      return null;
  }
}
