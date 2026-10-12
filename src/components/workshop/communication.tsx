"use client";
import { characterFor } from "@/lib/characters";
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
  stamp,
  type Props,
} from "./common";
export function Communication(p: Props) {
  const w = p.workspace,
    [channel, setChannel] = useState("cohort"),
    [filter, setFilter] = useState("");
  const messages = w.messages.filter((m) => m.channel === channel),
    read = recordsOf(p, "read").find((r) => r.data.channel === channel);
  return (
    <>
      <Box title="대화에서 다음 행동으로" eyebrow="KEEP THE CONTEXT">
        <p>
          전체·팀 대화의 답글, 멘션, 수정, 고정과 아이디어·작업 연결을
          관리합니다. 새 메시지는 오른쪽 대화창에서 보낼 수 있습니다.
        </p>
        <div className="wk-toolbar">
          <select
            aria-label="대화 관리 채널"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="cohort">전체 대화</option>
            {w.me.projectId && (
              <option value={w.me.projectId}>우리 팀 대화</option>
            )}
          </select>
          <RunButton p={p} command={{ type: "readChannel", channel }}>
            여기까지 읽음
          </RunButton>
          <Badge>
            안 읽은 대화{" "}
            {
              messages.filter(
                (m) =>
                  m.authorId !== w.me.id &&
                  m.createdAt > (read?.data.lastReadAt || ""),
              ).length
            }
          </Badge>
        </div>
        {messages.map((m) => (
          <article
            className={"wk-message " + (m.pinned ? "pinned" : "")}
            key={m.id}
            id={m.id}
          >
            <div className="wk-meta wk-thread-author">
              <img src={characterFor(w.members.find(x => x.id === m.authorId)).thumbnail} alt="" loading="lazy"/>
              <strong>
                {w.members.find((x) => x.id === m.authorId)?.name}
              </strong>
              <small>
                {stamp(m.createdAt)}
                {m.editedAt ? " · 수정됨" : ""}
              </small>
              {m.pinned && <Badge>고정</Badge>}
            </div>
            {m.replyToId && (
              <blockquote>
                답글:{" "}
                {messages.find((x) => x.id === m.replyToId)?.body ||
                  "이전 메시지"}
              </blockquote>
            )}
            <p>{m.body}</p>
            {m.mentions?.length && (
              <small>
                멘션:{" "}
                {m.mentions
                  .map((id) => w.members.find((x) => x.id === id)?.name)
                  .join(", ")}
              </small>
            )}
            <Action
              label="답글·멘션"
              command={{ type: "replyMessage", channel, replyToId: m.id }}
              fields={[
                { ...body, max: 2000 },
                {
                  name: "mentions",
                  label: "알림을 받을 사람",
                  type: "multi",
                  options: w.members
                    .filter(
                      (x) => channel === "cohort" || x.projectId === channel,
                    )
                    .map((x) => ({ value: x.id, label: x.name })),
                },
              ]}
              run={p.run}
              busy={p.busy}
            />
            {m.authorId === w.me.id && (
              <Action
                label="메시지 수정"
                command={{
                  type: "editMessage",
                  channel,
                  messageId: m.id,
                  revision: m.revision || 1,
                }}
                fields={[{ ...body, value: m.body, max: 2000 }]}
                run={p.run}
                busy={p.busy}
              />
            )}
            {((channel === "cohort" && w.me.role !== "participant") ||
              w.projects.some(
                (t) => t.id === channel && t.leaderId === w.me.id,
              )) && (
              <RunButton
                p={p}
                command={{
                  type: "pinMessage",
                  channel,
                  messageId: m.id,
                  pinned: !m.pinned,
                }}
              >
                {m.pinned ? "고정 해제" : "상단 고정"}
              </RunButton>
            )}
            <Action
              label="대화를 기록으로 연결"
              command={{ type: "messageToRecord", channel, messageId: m.id }}
              fields={[
                {
                  name: "target",
                  label: "연결할 기록",
                  type: "select",
                  value: "idea",
                  options: choices(
                    channel === "cohort"
                      ? ["idea"]
                      : ["idea", "task", "decision"],
                    { idea: "아이디어", task: "할 일", decision: "팀 결정" },
                  ),
                },
                title,
                { ...body, value: m.body },
              ]}
              run={p.run}
              busy={p.busy}
            />
            <Action
              label="이 메시지 신고"
              command={{
                type: "report",
                targetId: m.id,
                targetKind: "message",
                channel,
              }}
              fields={[reason]}
              run={p.run}
              busy={p.busy}
            />
          </article>
        ))}
      </Box>
      <Box title="아이디어 공개 범위와 공감">
        <input
          aria-label="관리할 아이디어 검색"
          placeholder="아이디어 검색"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {w.ideas
          .filter((i) => i.title.includes(filter))
          .map((i) => (
            <article className="wk-note" key={i.id}>
              <h3>{i.title}</h3>
              <p>{i.body}</p>
              <div className="wk-meta">
                <Badge>
                  {i.scope === "owner"
                    ? "나만 보기"
                    : i.scope === "project"
                      ? "팀"
                      : "전체"}{" "}
                  · r{i.revision}
                </Badge>
                <RunButton p={p} command={{ type: "reaction", ideaId: i.id }}>
                  ♡ 공감{" "}
                  {
                    recordsOf(p, "reaction").filter(
                      (r) => r.data.ideaId === i.id,
                    ).length
                  }
                </RunButton>
              </div>
              {i.ownerId === w.me.id && i.state === "shared" && (
                <Action
                  label="공개 범위 변경"
                  command={{
                    type: "shareIdea",
                    ideaId: i.id,
                    revision: i.revision,
                  }}
                  fields={[
                    {
                      name: "scope",
                      label: "공개 범위",
                      type: "select",
                      value: i.scope,
                      options: scopeOptions.filter(
                        (o) => o.value !== "project" || w.me.projectId,
                      ),
                    },
                    reason,
                  ]}
                  run={p.run}
                  busy={p.busy}
                />
              )}
              {w.me.role === "admin" && i.state === "closed_unselected" && (
                <Action
                  label="아이디어 다시 열기"
                  command={{ type: "reopenIdea", ideaId: i.id }}
                  fields={[reason]}
                  run={p.run}
                  busy={p.busy}
                />
              )}
              <Action
                label="이 아이디어 신고"
                command={{
                  type: "report",
                  targetId: i.id,
                  targetKind: "idea",
                  channel: "cohort",
                }}
                fields={[reason]}
                run={p.run}
                busy={p.busy}
              />
            </article>
          ))}
      </Box>
    </>
  );
}
