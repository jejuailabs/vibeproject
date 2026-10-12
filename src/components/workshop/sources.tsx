"use client";
import { useState } from "react";
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
  scopeOptions,
  uid,
  link,
  type Props,
} from "./common";
export function Sources(p: Props) {
  const [newId, setNewId] = useState(() => uid("source")),
    [imported, setImported] = useState(""),
    [importError, setImportError] = useState(""),
    [fileScope, setFileScope] = useState("owner");
  const sources = recordsOf(p, "source"),
    projectId = p.workspace.me.projectId;
  async function importText(file?: File) {
    if (!file) return;
    setImportError("");
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 800000) {
      setImportError("TXT·MD 파일 800KB 이하를 선택해주세요.");
      return;
    }
    const text = await file.text();
    if (text.length > 200000) {
      setImportError("원문은 20만 자 이내로 나눠주세요.");
      return;
    }
    setImported(text);
    setNewId(uid("source"));
  }
  return (
    <>
      <Box title="현장의 대화를 다음 생각으로" eyebrow="SOURCE → REVIEW → IDEA">
        <p>
          녹취록 또는 직접 쓴 기록을 넣고, 원문에서 확인한 근거와 함께
          정리합니다. 외부 AI에서 정리한 결과도 아래에서 검토·반영할 수
          있습니다.{" "}
          {p.ai?.enabled
            ? "AI 분석을 요청하면 원문이 설정된 공급자에게 전송됩니다."
            : "자동 AI 분석은 서버 공급자 설정 후 활성화됩니다."}
        </p>
        <label className="wk-file">
          TXT·MD 원문 가져오기
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={(e) => importText(e.target.files?.[0])}
          />
        </label>
        {importError && <p role="alert">{importError}</p>}
        <Action
          key={newId}
          label="새 원문 기록"
          command={{ type: "source", id: newId, revision: 0 }}
          fields={[
            title,
            {
              name: "text",
              label: "녹취록·원문",
              type: "area",
              value: imported,
              max: 200000,
            },
            {
              name: "sourceType",
              label: "원문 유형",
              type: "select",
              value: "transcript",
              options: choices(["transcript", "notes"], {
                transcript: "녹취록",
                notes: "직접 기록",
              }),
            },
            {
              name: "scope",
              label: "공개 범위",
              type: "select",
              value: "owner",
              options: scopeOptions.filter(
                (o) => o.value !== "project" || projectId,
              ),
            },
            {
              name: "consent",
              label: "참가자에게 기록·분석 동의를 받았습니다",
              type: "check",
            },
          ]}
          map={(v) => ({
            ...v,
            projectId: v.scope === "project" ? projectId : null,
          })}
          run={async (c) => {
            const ok = await p.run(c);
            if (ok) {
              setImported("");
              setNewId(uid("source"));
            }
            return ok;
          }}
          busy={p.busy}
        />
        {sources.length === 0 && <Empty>아직 등록한 원문이 없습니다.</Empty>}
        {sources.map((s) => (
          <article className="wk-source" key={s.id} id={s.id}>
            <div className="wk-meta">
              <h3>{s.data.title}</h3>
              <Badge>
                {s.scope === "owner"
                  ? "나만 보기"
                  : s.scope === "project"
                    ? "팀"
                    : "전체"}{" "}
                · r{s.revision}
              </Badge>
            </div>
            <details>
              <summary>원문 보기</summary>
              <pre className="wk-transcript">
                {s.data.text || "정정된 원문입니다."}
              </pre>
            </details>
            <details>
              <summary>이전 원문 이력</summary>
              {recordsOf(p, "sourceVersion")
                .filter((v) => v.data.sourceId === s.id)
                .map((v) => (
                  <div key={v.id}>
                    <small>r{v.data.sourceRevision}</small>
                    <pre className="wk-transcript">
                      {v.data.text || "정정된 원문"}
                    </pre>
                  </div>
                ))}
            </details>
            {!s.data.redacted && (
              <>
                {p.ai?.enabled && s.ownerId === p.workspace.me.id && (
                  <Action
                    label="AI 초안 만들기"
                    command={{
                      type: "analyze",
                      sourceId: s.id,
                      sourceRevision: s.revision,
                    }}
                    fields={[
                      {
                        name: "mode",
                        label: "분석 목적",
                        type: "select",
                        value: "ideas",
                        options: choices(
                          s.projectId ? ["ideas", "planning"] : ["ideas"],
                          {
                            ideas: "아이디어·질문 정리",
                            planning: "기획 문서 초안",
                          },
                        ),
                      },
                      {
                        name: "instruction",
                        label: "정리할 방향",
                        type: "area",
                        optional: true,
                        max: 2000,
                      },
                    ]}
                    run={p.run}
                    busy={p.busy}
                  />
                )}
                {recordsOf(p, "job")
                  .filter((j) => j.data.sourceId === s.id)
                  .map((j) => (
                    <p className="wk-callout" key={j.id}>
                      AI{" "}
                      {j.data.state === "running"
                        ? Date.now() - Date.parse(j.createdAt) > 180000
                          ? "응답 확인 필요 · 새 요청으로 재시도해주세요."
                          : "분석 중"
                        : j.data.state === "ready"
                          ? "검토 준비 완료"
                          : "실패"}{" "}
                      {j.data.error}
                    </p>
                  ))}
                <Action
                  label="근거를 붙여 정리 제안"
                  command={{
                    type: "proposal",
                    sourceId: s.id,
                    sourceRevision: s.revision,
                  }}
                  fields={[
                    {
                      name: "proposalType",
                      label: "정리 유형",
                      type: "select",
                      value: "new_idea",
                      options: choices(
                        s.projectId
                          ? [
                              "new_idea",
                              "question",
                              "summary",
                              "task",
                              "decision",
                            ]
                          : ["new_idea", "question", "summary"],
                        {
                          new_idea: "아이디어",
                          question: "질문",
                          summary: "요약",
                          task: "할 일",
                          decision: "팀 결정",
                        },
                      ),
                    },
                    title,
                    body,
                    {
                      name: "evidence",
                      label: "원문에서 그대로 인용한 근거",
                      type: "area",
                      max: 1000,
                      hint: "원문에 실제로 존재하는 구간이어야 합니다.",
                    },
                  ]}
                  run={p.run}
                  busy={p.busy}
                />
                {s.ownerId === p.workspace.me.id && (
                  <>
                    <Action
                      key={"edit-" + s.revision}
                      label="원문 수정"
                      command={{
                        type: "source",
                        id: s.id,
                        revision: s.revision,
                        scope: s.scope,
                        projectId: s.projectId,
                        sourceType: s.data.sourceType,
                        consent: s.data.consent,
                      }}
                      fields={[
                        { ...title, value: s.data.title },
                        {
                          name: "text",
                          label: "원문",
                          type: "area",
                          value: s.data.text,
                          max: 200000,
                        },
                      ]}
                      run={p.run}
                      busy={p.busy}
                    />
                    <Action
                      label="원문·연결된 파생 내용 정정"
                      command={{ type: "redactSource", sourceId: s.id }}
                      fields={[reason]}
                      run={p.run}
                      busy={p.busy}
                      submitLabel="원문과 파생 내용 숨기기"
                    />
                  </>
                )}
              </>
            )}
            {recordsOf(p, "proposal")
              .filter((r) => r.data.sourceId === s.id)
              .map((r) => (
                <div className="wk-note" key={r.id}>
                  <Badge>
                    {r.data.state === "proposed"
                      ? "검토 대기"
                      : r.data.state === "accepted"
                        ? "반영 완료"
                        : "반영 안 함"}
                  </Badge>
                  <h4>{r.data.title}</h4>
                  <p>{r.data.body}</p>
                  <blockquote>{r.data.evidence}</blockquote>
                  {r.data.state === "proposed" && (
                    <Action
                      label="검토·수정 후 반영"
                      command={{ type: "resolveProposal", proposalId: r.id }}
                      fields={[
                        { ...title, value: r.data.title },
                        { ...body, value: r.data.body },
                        {
                          name: "accept",
                          label: "반영 승인 (해제하면 거절)",
                          type: "check",
                          value: true,
                        },
                      ]}
                      run={p.run}
                      busy={p.busy}
                    />
                  )}
                </div>
              ))}
            {recordsOf(p, "aiDraft")
              .filter((d) => d.data.sourceId === s.id)
              .map((d) => (
                <div className="wk-note" key={d.id}>
                  <Badge>
                    {d.data.key} · {d.data.state}
                  </Badge>
                  <blockquote>{d.data.evidence}</blockquote>
                  {d.data.state === "proposed" && (
                    <Action
                      label="기획 초안 검토"
                      command={{ type: "approveDraft", draftId: d.id }}
                      fields={[
                        {
                          name: "markdown",
                          label: "검토할 Markdown",
                          type: "area",
                          value: d.data.markdown,
                          max: 20000,
                        },
                        {
                          name: "accept",
                          label: "문서에 반영 승인",
                          type: "check",
                          value: true,
                        },
                        reason,
                      ]}
                      run={p.run}
                      busy={p.busy}
                    />
                  )}
                </div>
              ))}
          </article>
        ))}
      </Box>
      <Box title="공유 자료실">
        <p>
          이미지·PDF·TXT·MD 파일은 최대 10MB까지 Firebase Storage에 보관합니다.
          공개 범위는 업로드 시 정합니다.
        </p>
        <div className="wk-upload">
          <select
            aria-label="파일 공개 범위"
            value={fileScope}
            onChange={(e) => setFileScope(e.target.value)}
          >
            {scopeOptions
              .filter((o) => o.value !== "project" || projectId)
              .map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
          </select>
          <input
            aria-label="자료 파일 업로드"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md"
            disabled={p.busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f)
                await p.upload?.(
                  f,
                  fileScope,
                  fileScope === "project" ? projectId : null,
                );
              e.target.value = "";
            }}
          />
        </div>
        {recordsOf(p, "asset")
          .filter((a) => a.data.state === "ready")
          .map((a) => (
            <div className="wk-file-row" key={a.id}>
              <span>
                {a.data.name}
                <small>
                  {Math.ceil(a.data.size / 1024)}KB ·{" "}
                  {a.scope === "owner"
                    ? "개인"
                    : a.scope === "project"
                      ? "팀"
                      : "전체"}
                </small>
              </span>
              <button
                className="secondary-button"
                onClick={() => p.download?.(a.id)}
              >
                다운로드
              </button>
            </div>
          ))}
        {projectId && (
          <Action
            label="팀 참고 링크 추가"
            command={{ type: "resource", projectId }}
            fields={[title, { name: "url", label: "HTTPS 링크", type: "url" }]}
            run={p.run}
            busy={p.busy}
          />
        )}
        {recordsOf(p, "resource").map((r) => (
          <p key={r.id}>{link(r.data.url, r.data.title)}</p>
        ))}
      </Box>
    </>
  );
}
