"use client";
import { Share } from "./share";
import { useState } from "react";
import {
  Action,
  Box,
  Empty,
  Badge,
  recordsOf,
  choices,
  reason,
  title,
  body,
  stamp,
  inputDate,
  uid,
  type Props,
  type Field,
} from "./common";
export function Activities(p: Props) {
  const [projector, setProjector] = useState(false),
    [newId, setNewId] = useState(() => uid("activity"));
  const activities = recordsOf(p, "activity"),
    operator = p.workspace.me.role !== "participant";
  const fields = (a?: (typeof activities)[number]): Field[] =>
    (
      [
        title,
        {
          name: "question",
          label: "함께 생각할 질문",
          type: "area",
          value: a?.data.question,
        },
        {
          name: "instructions",
          label: "오프라인 진행 안내",
          type: "area",
          optional: true,
          value: a?.data.instructions,
        },
        {
          name: "week",
          label: "주차",
          type: "number",
          value: a?.data.week || p.workspace.cohort.week,
          min: 1,
          max: 4,
        },
        {
          name: "state",
          label: "활동 상태",
          type: "select",
          options: choices(["draft", "open", "closed"], {
            draft: "준비",
            open: "진행 중",
            closed: "마감",
          }),
          value: a?.data.state || "open",
        },
        {
          name: "closesAt",
          label: "마감 시각",
          type: "datetime-local",
          optional: true,
          value: inputDate(a?.data.closesAt),
          hint: "비워두면 운영자가 직접 마감합니다.",
        },
        {
          name: "featured",
          label: "대시보드의 현재 활동으로 표시",
          type: "check",
          value: a?.data.featured ?? true,
        },
        reason,
      ] as Field[]
    ).map((f) => (f.name === "title" ? { ...f, value: a?.data.title } : f));
  return (
    <div className={projector ? "wk-projector" : ""}>
      {projector && (
        <button className="primary-button" onClick={() => setProjector(false)}>
          프로젝터 종료
        </button>
      )}
      <div className="wk-toolbar">
        <div>
          <span className="eyebrow">FACILITATION BOARD</span>
          <h2>현장의 생각을, 함께 보는 기록으로.</h2>
        </div>
        <button
          className="secondary-button"
          onClick={() => setProjector(!projector)}
        >
          전체 공유 화면
        </button>
      </div>
      {!projector && operator && (
        <Action
          key={newId}
          label="새 활동 열기"
          fields={fields()}
          command={{ type: "activity", id: newId, revision: 0 }}
          run={async (c) => {
            const ok = await p.run(c);
            if (ok) setNewId(uid("activity"));
            return ok;
          }}
          busy={p.busy}
        />
      )}
      {activities.length === 0 && (
        <Empty>
          운영자가 질문과 활동을 등록하면 여기에 제출 보드가 열립니다.
        </Empty>
      )}
      {activities.map((a) => (
        <Box key={a.id} title={a.data.title} eyebrow={"WEEK " + a.data.week}>
          <div className="wk-meta">
            <Badge>
              {a.data.state === "open"
                ? "진행 중"
                : a.data.state === "closed"
                  ? "마감"
                  : "준비"}
            </Badge>
            {a.data.closesAt && <span>마감 {stamp(a.data.closesAt)}</span>}
          </div>
          <div id={a.id} data-record-id={a.id}>
            <h3>{a.data.question}</h3>
          </div>
          <Share tab="activities" item={a.id} />
          <p className="wk-prose">{a.data.instructions}</p>
          {!projector && a.data.state === "open" && (
            <Action
              label="내 활동 결과 정리"
              command={{
                type: "submitActivity",
                activityId: a.id,
                revision:
                  recordsOf(p, "submission").find(
                    (s) =>
                      s.data.activityId === a.id &&
                      s.ownerId === p.workspace.me.id &&
                      !s.id.startsWith("submission-version"),
                  )?.revision || 0,
              }}
              fields={[
                {
                  ...body,
                  value: recordsOf(p, "submission").find(
                    (s) =>
                      s.data.activityId === a.id &&
                      s.ownerId === p.workspace.me.id &&
                      !s.id.startsWith("submission-version"),
                  )?.data.body,
                },
                {
                  name: "scope",
                  label: "공개 범위",
                  type: "select",
                  value: "cohort",
                  options: choices(["owner", "cohort"], {
                    owner: "나만 보기",
                    cohort: "기수 전체",
                  }),
                },
              ]}
              run={p.run}
              busy={p.busy}
            />
          )}
          <div className="wk-grid">
            {recordsOf(p, "submission")
              .filter(
                (s) =>
                  s.data.activityId === a.id &&
                  !s.id.startsWith("submission-version") &&
                  (!projector || s.scope === "cohort"),
              )
              .map((s) => (
                <article className="wk-note" key={s.id}>
                  <small>
                    {p.workspace.members.find((m) => m.id === s.ownerId)?.name}{" "}
                    · r{s.revision} · {s.scope === "owner" ? "개인" : "전체"}
                  </small>
                  <p>{s.data.body}</p>
                  {!projector && s.ownerId === p.workspace.me.id && (
                    <Action
                      label="활동 결과를 아이디어로 연결"
                      command={{ type: "submissionIdea", submissionId: s.id }}
                      fields={[title]}
                      run={p.run}
                      busy={p.busy}
                    />
                  )}
                </article>
              ))}
          </div>
          {!projector && operator && (
            <Action
              label="활동 수정·마감"
              command={{ type: "activity", id: a.id, revision: a.revision }}
              fields={fields(a)}
              run={p.run}
              busy={p.busy}
            />
          )}
        </Box>
      ))}
    </div>
  );
}
