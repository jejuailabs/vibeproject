"use client";
import {problemMarkdown} from '@/lib/refinement';
import { useState, useEffect } from "react";
import {
  docKeys,
  docNames,
  stages,
  stageNames,
  readinessItems,
  readinessNames,
  type DocKey,
} from "@/lib/workshop/model";
import { templates } from "@/lib/workshop/templates";
import {
  Action,
  Box,
  Empty,
  Badge,
  RunButton,
  recordsOf,
  choices,
  reason,
  title,
  body,
  link,
  stamp,
  uid,
  type Props,
} from "./common";
export function Studio(p: Props & {requestedDocKey?: DocKey}) {
  const w = p.workspace,
    allowed = w.projects.filter(
      (t) =>
        t.id === w.me.projectId ||
        recordsOf(p, "support").some(
          (g) =>
            g.projectId === t.id && g.data.expiresAt > new Date().toISOString(),
        ),
    );
  const [selected, setSelected] = useState(""),
    [docKey, setDocKey] = useState<DocKey>(p.requestedDocKey || "product");
  useEffect(()=>{if(p.requestedDocKey)setDocKey(p.requestedDocKey);},[p.requestedDocKey]);
  const team = allowed.find((t) => t.id === selected) || allowed[0],
    leader = team?.leaderId === w.me.id;
  const personal = recordsOf(p, "readiness").find(
    (r) => r.id === "ready-" + w.me.id,
  );
  return (
    <>
      <Box id="personal-readiness" title="내 개발 환경 준비" eyebrow="READY TO BUILD" className="wk-readiness-panel">
        <p>설치와 계정 연결을 직접 확인하고 체크해주세요.</p>
        <div className="wk-checklist">
          {readinessItems.map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={!!personal?.data.items[item]?.done}
                disabled={p.busy}
                onChange={(e) =>
                  p.run({
                    type: "readiness",
                    projectId: null,
                    item,
                    done: e.target.checked,
                    exception: "",
                  })
                }
              />
              {readinessNames[item]}
            </label>
          ))}
        </div>
      </Box>
      {!team ? (
        <Empty>
          프로젝트에 참여하면 팀 문서, 작업, 배포를 관리할 수 있습니다.
        </Empty>
      ) : (
        <>
          <div className="wk-toolbar">
            <h2>{team.name} · 제작실</h2>
            <select
              aria-label="작업할 프로젝트"
              value={team.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {allowed.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <ProjectStudio
            key={team.id}
            p={p}
            projectId={team.id}
            leader={leader!}
            docKey={docKey}
            setDocKey={setDocKey}
          />
        </>
      )}
    </>
  );
}
function ProjectStudio({
  p,
  projectId,
  leader,
  docKey,
  setDocKey,
}: {
  p: Props;
  projectId: string;
  leader: boolean;
  docKey: DocKey;
  setDocKey: (k: DocKey) => void;
}) {
  const w = p.workspace,
    team = w.projects.find((t) => t.id === projectId)!;
  const config = recordsOf(p, "project").find((r) => r.projectId === projectId),
    docs = recordsOf(p, "document").filter((r) => r.projectId === projectId),
    d = docs.find((d) => d.data.key === docKey),
    baselines = recordsOf(p, "baseline").filter(
      (r) => r.projectId === projectId,
    );
  const tasks = recordsOf(p, "task").filter((r) => r.projectId === projectId),
    ready = recordsOf(p, "readiness").find(
      (r) => r.id === "ready-" + projectId,
    ),
    [taskId, setTaskId] = useState(() => uid("task"));
  return (
    <>
      <Box id="project-docs" title="기획을 구현 가능한 문서로" eyebrow="DEFINE → FREEZE → BUILD" className="wk-document-panel">
        <p>
          AI와 정리한 Markdown을 붙여 넣거나 템플릿을 채워주세요. 7개 문서가
          준비되면 팀장이 버전을 확정합니다.
        </p>
        <div className="wk-document-workspace">
        <nav className="wk-doc-tabs" aria-label="기획 문서 목록">
          {docKeys.map((k) => (
            <button
              key={k}
              aria-current={docKey === k ? "page" : undefined}
              className={docKey === k ? "active" : ""}
              onClick={() => setDocKey(k)}
            >
              {docs.some((d) => d.data.key === k) ? "●" : "○"} {docNames[k]}
            </button>
          ))}
        </nav>
        <div className="wk-document-editor">
        <Action
          key={docKey}
          label={docNames[docKey] + " · r" + (d?.revision || 0)}
          open
          command={{
            type: "document",
            projectId,
            key: docKey,
            revision: d?.revision || 0,
          }}
          fields={[
            {
              name: "markdown",
              label: "Markdown 문서",
              type: "area",
              value: d?.data.markdown || (docKey==="product"&&w.ideas.find(i=>i.id===(team.confirmedProblem?.ideaId||team.sourceIdeaId))?.refinement?problemMarkdown(w.ideas.find(i=>i.id===(team.confirmedProblem?.ideaId||team.sourceIdeaId))!):templates[docKey]),
              max: 20000,
            },
            reason,
          ]}
          run={p.run}
          busy={p.busy}
          submitLabel="문서 저장"
        />
        <details className="wk-version">
          <summary>이 문서의 저장 이력</summary>
          {recordsOf(p, "version")
            .filter((v) => v.projectId === projectId && v.data.key === docKey)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((v) => (
              <details key={v.id}>
                <summary>
                  r{v.data.documentRevision} · {stamp(v.createdAt)} ·{" "}
                  {v.data.reason}
                </summary>
                <pre className="wk-transcript">{v.data.markdown}</pre>
                <Action
                  label="이 저장본으로 복원"
                  command={{
                    type: "restoreDocument",
                    projectId,
                    versionId: v.id,
                    revision: d?.revision || 0,
                  }}
                  fields={[reason]}
                  run={p.run}
                  busy={p.busy}
                />
              </details>
            ))}
        </details>
        </div></div>
        <p className="wk-meta">
          {docs.length}/7개 작성 · 이전 확정본은 변경되지 않습니다.
        </p>
        {leader && (
          <Action
            id="project-baseline" label="7개 문서 버전 확정"
            command={{
              type: "baseline",
              projectId,
              revisions: Object.fromEntries(
                docKeys.map((k) => [
                  k,
                  docs.find((d) => d.data.key === k)?.revision || 0,
                ]),
              ),
            }}
            fields={[
              { ...title, value: "개발 착수 기준 v" + (baselines.length + 1) },
              reason,
            ]}
            run={p.run}
            busy={p.busy}
            submitLabel="기준 버전 확정"
          />
        )}
        {baselines.map((b) => (
          <div className="wk-baseline" key={b.id}>
            <div>
              <strong>{b.data.title}</strong>
              <small>
                {stamp(b.createdAt)} · {b.data.reason}
              </small>
            </div>
            <button
              className="secondary-button"
              disabled={p.busy}
              onClick={() => p.exportBaseline?.(b.id)}
            >
              MD · ZIP 받기
            </button>
            <details>
              <summary>확정 문서 보기·복원</summary>
              {b.data.versions.map((v) => {
                const version = recordsOf(p, "version").find(
                  (x) => x.id === v.id,
                );
                return (
                  <details className="wk-version" key={v.id}>
                    <summary>
                      {docNames[v.key]} · r{v.revision}
                    </summary>
                    <div className="wk-compare">
                      <div>
                        <small>확정 당시</small>
                        <pre>
                          {version?.data.markdown ||
                            "문서를 불러오는 중입니다."}
                        </pre>
                      </div>
                      <div>
                        <small>현재 초안</small>
                        <pre>
                          {
                            docs.find((d) => d.data.key === v.key)?.data
                              .markdown
                          }
                        </pre>
                      </div>
                    </div>
                    <Action
                      label="이 버전을 새 초안으로 복원"
                      command={{
                        type: "restoreDocument",
                        projectId,
                        versionId: v.id,
                        revision:
                          docs.find((d) => d.data.key === v.key)?.revision || 0,
                      }}
                      fields={[reason]}
                      run={p.run}
                      busy={p.busy}
                    />
                  </details>
                );
              })}
            </details>
          </div>
        ))}
      </Box>
      <Box title="프로젝트 준비와 진행 단계">
        <div className="wk-stage-track">
          {stages
            .filter((s) => s !== "archived")
            .map((s) => (
              <span
                key={s}
                className={
                  s === (config?.data.stage || "planning") ? "active" : ""
                }
              >
                {stageNames[s]}
              </span>
            ))}
        </div>
        <div className="wk-checklist">
          {readinessItems.map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={!!ready?.data.items[item]?.done}
                disabled={p.busy}
                onChange={(e) =>
                  p.run({
                    type: "readiness",
                    projectId,
                    item,
                    done: e.target.checked,
                    exception: "",
                  })
                }
              />
              {readinessNames[item]}
              {ready?.data.items[item]?.exception && (
                <small>예외: {ready.data.items[item].exception}</small>
              )}
            </label>
          ))}
        </div>
        <Action
          label="준비 항목 예외 사유"
          command={{ type: "readiness", projectId, done: false }}
          fields={[
            {
              name: "item",
              label: "항목",
              type: "select",
              options: choices(
                readinessItems.filter((k) => k !== "secrets"),
                readinessNames,
              ),
            },
            { name: "exception", label: "확인한 예외와 대안", max: 500 },
          ]}
          run={p.run}
          busy={p.busy}
        />
        {leader && (
          <Action
            label="단계 변경"
            command={{ type: "advance", projectId }}
            fields={[
              {
                name: "stage",
                label: "이동할 단계",
                type: "select",
                value: config?.data.stage || "planning",
                options: choices([...stages], stageNames),
              },
              reason,
            ]}
            run={p.run}
            busy={p.busy}
          />
        )}
        <div className="wk-links">
          {link(config?.data.repositoryUrl || "", "GitHub")}
          {link(config?.data.deployUrl || "", "Vercel 앱")}
          {link(config?.data.firebaseUrl || "", "Firebase")}
        </div>
        {leader && (
          <Action
            label="프로젝트 연결 설정"
            command={{ type: "projectConfig", projectId }}
            fields={[
              {
                name: "mode",
                label: "진행 방식",
                type: "select",
                value: config?.data.mode || team.mode || "team",
                options: choices(["team", "solo"], {
                  team: "팀",
                  solo: "개인",
                }),
              },
              {
                name: "capacity",
                label: "정원",
                type: "number",
                value: config?.data.capacity || team.capacity || 5,
                min: 1,
                max: 100,
              },
              {
                name: "repositoryUrl",
                label: "GitHub 저장소",
                type: "url",
                optional: true,
                value: config?.data.repositoryUrl,
              },
              {
                name: "deployUrl",
                label: "Vercel 앱 주소",
                type: "url",
                optional: true,
                value: config?.data.deployUrl,
              },
              {
                name: "firebaseUrl",
                label: "Firebase 콘솔",
                type: "url",
                optional: true,
                value: config?.data.firebaseUrl,
              },
            ]}
            run={p.run}
            busy={p.busy}
          />
        )}
      </Box>
      <Box title="만들 일과 결정">
        <Action
          key={taskId}
          label="새 작업 추가"
          command={{
            type: "task",
            projectId,
            id: taskId,
            revision: 0,
            status: "todo",
            sourceMessageId: null,
          }}
          fields={[
            title,
            { ...body, optional: true, max: 5000 },
            {
              name: "assigneeId",
              label: "담당자",
              type: "select",
              optional: true,
              options: team.memberIds.map((id) => ({
                value: id,
                label: w.members.find((m) => m.id === id)?.name || id,
              })),
            },
          ]}
          map={(v) => ({ ...v, assigneeId: v.assigneeId || null })}
          run={async (c) => {
            const ok = await p.run(c);
            if (ok) setTaskId(uid("task"));
            return ok;
          }}
          busy={p.busy}
        />
        <div className="wk-kanban">
          {(["todo", "doing", "done"] as const).map((status) => (
            <div key={status}>
              <h3>
                {{ todo: "할 일", doing: "진행 중", done: "완료" }[status]}{" "}
                <Badge>
                  {tasks.filter((t) => t.data.status === status).length}
                </Badge>
              </h3>
              {tasks
                .filter((t) => t.data.status === status)
                .map((t) => (
                  <article className="wk-note" key={t.id} id={t.id}>
                    <h4>{t.data.title}</h4>
                    <p>{t.data.body}</p>
                    <small>
                      {w.members.find((m) => m.id === t.data.assigneeId)
                        ?.name || "담당 미정"}
                    </small>
                    <Action
                      label="작업 수정"
                      command={{
                        type: "task",
                        projectId,
                        id: t.id,
                        revision: t.revision,
                        sourceMessageId: t.data.sourceMessageId,
                      }}
                      fields={[
                        { ...title, value: t.data.title },
                        {
                          ...body,
                          optional: true,
                          value: t.data.body,
                          max: 5000,
                        },
                        {
                          name: "status",
                          label: "진행 상태",
                          type: "select",
                          value: t.data.status,
                          options: choices(["todo", "doing", "done"], {
                            todo: "할 일",
                            doing: "진행 중",
                            done: "완료",
                          }),
                        },
                        {
                          name: "assigneeId",
                          label: "담당자",
                          type: "select",
                          optional: true,
                          value: t.data.assigneeId || "",
                          options: team.memberIds.map((id) => ({
                            value: id,
                            label:
                              w.members.find((m) => m.id === id)?.name || id,
                          })),
                        },
                      ]}
                      map={(v) => ({ ...v, assigneeId: v.assigneeId || null })}
                      run={p.run}
                      busy={p.busy}
                    />
                  </article>
                ))}
            </div>
          ))}
        </div>
        {leader && (
          <Action
            label="결정 기록"
            command={{ type: "decision", projectId, sourceMessageId: null }}
            fields={[title, body, reason]}
            run={p.run}
            busy={p.busy}
          />
        )}
        {recordsOf(p, "decision")
          .filter((r) => r.projectId === projectId)
          .map((r) => (
            <div className="wk-callout" key={r.id}>
              <strong>{r.data.title}</strong>
              <p>{r.data.body}</p>
              <small>결정 이유: {r.data.reason}</small>
            </div>
          ))}
      </Box>
      <Box id="project-releases" title="배포 버전 등록">
        <p>시연할 배포 주소와 그때의 기획 기준을 연결합니다.</p>
        {leader && (
          <Action
            id="project-release" label="새 배포 등록"
            command={{ type: "release", projectId }}
            fields={[
              title,
              { name: "demoUrl", label: "실행 가능한 HTTPS 주소", type: "url" },
              {
                name: "baselineId",
                label: "이번 배포의 기획 기준",
                type: "select",
                options: baselines.map((b) => ({
                  value: b.id,
                  label: b.data.title,
                })),
              },
              { name: "summary", label: "이번에 구현한 내용", type: "area" },
              {
                name: "knownIssues",
                label: "알려진 문제",
                type: "area",
                optional: true,
              },
            ]}
            run={p.run}
            busy={p.busy}
          />
        )}
        {recordsOf(p, "release")
          .filter((r) => r.projectId === projectId)
          .map((r) => (
            <div className="wk-note" key={r.id}>
              <h3>{r.data.title}</h3>
              {link(r.data.demoUrl, "배포 열기")}
              <p>{r.data.summary}</p>
              <small>{r.data.knownIssues}</small>
            </div>
          ))}
      </Box>
      {leader && (
        <Box title="운영자에게 한시적 지원 권한 부여">
          <p>
            초대한 운영자만 팀 자료에 접근할 수 있습니다. 만료되거나 철회하면
            접근이 중지됩니다.
          </p>
          <Action
            label="지원 요청"
            command={{ type: "support", projectId }}
            fields={[
              {
                name: "memberId",
                label: "지원 담당자",
                type: "select",
                options: w.members
                  .filter((m) => m.role !== "participant" && m.id !== w.me.id)
                  .map((m) => ({ value: m.id, label: m.name })),
              },
              { name: "edit", label: "편집도 허용", type: "check" },
              {
                name: "expiresAt",
                label: "권한 만료 (30일 이내)",
                type: "datetime-local",
              },
            ]}
            run={p.run}
            busy={p.busy}
          />
          {recordsOf(p, "support")
            .filter((g) => g.projectId === projectId)
            .map((g) => (
              <div className="wk-meta" key={g.id}>
                {w.members.find((m) => m.id === g.data.userId)?.name} ·{" "}
                {stamp(g.data.expiresAt)}까지
                <RunButton
                  p={p}
                  command={{
                    type: "revokeSupport",
                    projectId,
                    memberId: g.data.userId,
                  }}
                >
                  철회
                </RunButton>
              </div>
            ))}
        </Box>
      )}
    </>
  );
}
