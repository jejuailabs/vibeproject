"use client";
import { characterFor } from "@/lib/characters";
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
  stamp,
  type Props,
} from "./common";
export function Inbox(p: Props) {
  return (
    <>
      <Box title="내 알림" eyebrow="YOUR NEXT STEP">
        {recordsOf(p, "notification").length === 0 && (
          <Empty>새 알림이 없습니다.</Empty>
        )}
        {recordsOf(p, "notification").map((n) => (
          <article className="wk-file-row" key={n.id}>
            <span>
              <a
                className="wk-link"
                href={
                  "?view=workshop&tab=" +
                  ({
                    project: "votes",
                    join: "votes",
                    task: "studio",
                    message: "communication",
                    feedback: "showcase",
                    help: "inbox",
                    report: "inbox",
                  }[n.data.targetKind] || "inbox") +
                  "&item=" +
                  encodeURIComponent(n.data.targetId)
                }
              >
                <strong>{n.data.title}</strong>
              </a>
              <small>
                {stamp(n.createdAt)} · {n.data.read ? "읽음" : "새 알림"}
              </small>
            </span>
            {!n.data.read && (
              <RunButton
                p={p}
                command={{ type: "readNotification", notificationId: n.id }}
              >
                읽음
              </RunButton>
            )}
          </article>
        ))}
        {recordsOf(p, "report")
          .filter((r) => r.ownerId === p.workspace.me.id)
          .map((r) => (
            <div className="wk-note" key={r.id} id={r.id}>
              <strong>
                내 신고 · {r.data.state === "open" ? "검토 중" : "처리 완료"}
              </strong>
              <p>{r.data.reason}</p>
              <p>{r.data.resolution}</p>
            </div>
          ))}
      </Box>
      <Box title="막히는 부분을 함께 풀어요">
        <Action
          label="도움 요청"
          command={{ type: "help" }}
          fields={[title, body]}
          run={p.run}
          busy={p.busy}
        />
        {recordsOf(p, "help").map((h) => (
          <div className="wk-note" key={h.id}>
            <Badge>{h.data.state === "open" ? "답변 대기" : "답변 완료"}</Badge>
            <h3>{h.data.title}</h3>
            <p>{h.data.body}</p>
            <p>{h.data.resolution}</p>
            {p.workspace.me.role !== "participant" &&
              h.data.state === "open" && (
                <Action
                  label="도움 답변"
                  command={{ type: "resolveHelp", helpId: h.id }}
                  fields={[
                    { name: "resolution", label: "해결 방법", max: 500 },
                  ]}
                  run={p.run}
                  busy={p.busy}
                />
              )}
          </div>
        ))}
      </Box>
    </>
  );
}
export function Admin(p: Props) {
  const w = p.workspace,
    s = recordsOf(p, "settings")[0],
    admin = w.me.role === "admin";
  return (
    <>
      <Box title="운영 현황" eyebrow="FACILITATOR CONTROL">
        <div className="wk-metrics">
          <div>
            <strong>{w.members.length}</strong>
            <span>등록 참가자</span>
          </div>
          <div>
            <strong>{w.projects.length}</strong>
            <span>진행 프로젝트</span>
          </div>
          <div>
            <strong>
              {
                recordsOf(p, "help").filter((h) => h.data.state === "open")
                  .length
              }
            </strong>
            <span>도움 요청</span>
          </div>
          <div>
            <strong>
              {
                recordsOf(p, "showcase").filter(
                  (s) => s.data.state === "published",
                ).length
              }
            </strong>
            <span>발표 준비 완료</span>
          </div>
        </div>
        <p>
          팀의 비공개 문서와 대화는 팀장이 지원 권한을 부여한 경우에만 열립니다.
        </p>
        <div className="wk-operator-lineup" aria-label="참가자 라인업">
          {w.members.filter(m => m.active).map((m, i) => {
            const ready = Object.values(recordsOf(p, "readiness").find(r => r.id === "ready-" + m.id)?.data.items || {}).filter(v => v.done).length;
            return <article key={m.id}><img src={characterFor(m).image} alt={m.name + " 캐릭터"} loading="lazy"/><span className="wk-roster-number">{String(i + 1).padStart(2, "0")}</span><div><strong>{m.name}</strong><small>{w.projects.find(t => t.id === m.projectId)?.name || "프로젝트 탐색 중"}</small>{admin && <><progress max={7} value={ready} aria-label={m.name + " 개발 환경 준비"}/><small>개발 환경 {ready}/7</small></>}</div></article>;
          })}
        </div>
        <div className="wk-table-wrap">
          <table>
            <thead>
              <tr>
                <th>프로젝트</th>
                <th>인원</th>
                <th>단계</th>
                <th>공개 배포</th>
              </tr>
            </thead>
            <tbody>
              {w.projects.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.memberIds.length}</td>
                  <td>{t.stage}</td>
                  <td>
                    {
                      recordsOf(p, "release").filter(
                        (r) => r.projectId === t.id,
                      ).length
                    }
                    개
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {admin && (
          <details>
            <summary>참가자 환경 준비 현황</summary>
            <div className="wk-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>참가자</th>
                    <th>개인 준비</th>
                    <th>프로젝트</th>
                  </tr>
                </thead>
                <tbody>
                  {w.members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>
                        {
                          Object.values(
                            recordsOf(p, "readiness").find(
                              (r) => r.id === "ready-" + m.id,
                            )?.data.items || {},
                          ).filter((i) => i.done).length
                        }
                        /7
                      </td>
                      <td>
                        {w.projects.find((t) => t.id === m.projectId)?.name ||
                          "구성 전"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Box>
      {admin && (
        <>
          <Box title="기수 운영 설정">
            <Action
              label="주차·진행 방식·보관 정책"
              command={{ type: "settings" }}
              fields={[
                {
                  name: "name",
                  label: "기수 이름",
                  value: s?.data.name || w.cohort.name,
                },
                {
                  name: "week",
                  label: "현재 주차",
                  type: "number",
                  value: s?.data.week || w.cohort.week,
                  min: 1,
                  max: 4,
                },
                {
                  name: "mode",
                  label: "진행 방식",
                  type: "select",
                  value: s?.data.mode || "mixed",
                  options: choices(["solo", "team", "mixed"], {
                    solo: "개인만",
                    team: "팀만",
                    mixed: "개인·팀 선택",
                  }),
                },
                {
                  name: "startsAt",
                  label: "시작일",
                  optional: true,
                  value: s?.data.startsAt,
                },
                {
                  name: "retentionDays",
                  label: "보관 기간 (일)",
                  type: "number",
                  value: s?.data.retentionDays || 365,
                  min: 1,
                  max: 3650,
                  hint: "운영 정책으로 기록됩니다. 자동 삭제는 실행하지 않습니다.",
                },
                {
                  name: "notice",
                  label: "전체 공지",
                  type: "area",
                  optional: true,
                  value: s?.data.notice,
                },
                {
                  name: "state",
                  label: "기수 상태",
                  type: "select",
                  value: s?.data.state || "running",
                  options: choices(["running", "completed"], {
                    running: "진행 중",
                    completed: "종료 · 읽기 전용",
                  }),
                },
              ]}
              run={p.run}
              busy={p.busy}
            />
          </Box>
          <Box title="참가자 초대·권한">
            <p>
              초대 이메일을 등록한 뒤 앱 주소를 공유해주세요. 해당 Google
              계정으로 로그인하면 참여됩니다.
            </p>
            <Action
              label="Google 계정 초대 등록"
              command={{ type: "invite", days: 30 }}
              fields={[
                { name: "email", label: "Google 이메일", type: "email" },
                {
                  name: "role",
                  label: "참여 권한",
                  type: "select",
                  value: "participant",
                  options: choices(["participant", "facilitator", "admin"], {
                    participant: "참가자",
                    facilitator: "퍼실리테이터",
                    admin: "관리자",
                  }),
                },
              ]}
              run={p.run}
              busy={p.busy}
            />
            {p.invites?.map((i) => (
              <div className="wk-file-row" key={i.id}>
                <span>
                  {i.email}
                  <small>
                    {i.role} · {i.status} · {stamp(i.expiresAt)} 만료
                  </small>
                </span>
                {i.status === "pending" && (
                  <RunButton
                    p={p}
                    command={{ type: "revokeInvite", inviteId: i.id }}
                  >
                    초대 철회
                  </RunButton>
                )}
              </div>
            ))}
            {w.members.map((m) => (
              <Action
                key={m.id}
                label={m.name + " · " + m.role}
                command={{ type: "memberRole", memberId: m.id }}
                fields={[
                  {
                    name: "role",
                    label: "권한",
                    type: "select",
                    value: m.role,
                    options: choices(["participant", "facilitator", "admin"], {
                      participant: "참가자",
                      facilitator: "퍼실리테이터",
                      admin: "관리자",
                    }),
                  },
                  {
                    name: "active",
                    label: "참여 활성화",
                    type: "check",
                    value: m.active,
                  },
                  reason,
                ]}
                run={p.run}
                busy={p.busy}
              />
            ))}
          </Box>
          <Box title="신고 검토">
            {recordsOf(p, "report").length === 0 && (
              <Empty>접수된 신고가 없습니다.</Empty>
            )}
            {recordsOf(p, "report").map((r) => (
              <article className="wk-note" key={r.id}>
                <Badge>{r.data.state}</Badge>
                <p>{r.data.reason}</p>
                <small>
                  대상 {r.data.targetKind} · {r.data.targetId}
                </small>
                <p>{r.data.resolution}</p>
                {r.data.state === "open" && (
                  <Action
                    label="조치 결과 기록"
                    command={{ type: "resolveReport", reportId: r.id }}
                    fields={[
                      { name: "resolution", label: "조치와 안내", max: 500 },
                    ]}
                    run={p.run}
                    busy={p.busy}
                  />
                )}
              </article>
            ))}
          </Box>
        </>
      )}
      <Inbox {...p} />
    </>
  );
}
