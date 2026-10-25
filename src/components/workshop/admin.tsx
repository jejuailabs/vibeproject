"use client";
import { characterFor } from "@/lib/characters";
import { projectOriginLabel, projectVisibilityLabel } from "@/lib/workshop/project-info";
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
      <Box id="project-management" title="전체 프로젝트 관리" eyebrow="PROJECT MANAGEMENT">
        <p>이 기수의 모든 프로젝트입니다. 직접 참여하지 않은 프로젝트와 투표 후 생성된 프로젝트도 표시됩니다.</p>
        <p>담당 리더가 프로젝트와 참여 신청을 관리합니다. 기수 관리자는 아래에서 리더를 변경할 수 있습니다.</p>
        <p>프로젝트 목록은 기수 참가자에게 공개되며, 내부 문서와 대화는 참여자와 지원 권한을 받은 운영자가 볼 수 있습니다.</p>
        {w.projects.length === 0 ? <Empty>아직 생성된 프로젝트가 없습니다.</Empty> : (
          <div className="wk-grid">
            {w.projects.map((project) => {
              const leader = w.members.find((m) => m.id === project.leaderId);
              const candidates = w.members.filter((m) => m.active && m.id !== project.leaderId && project.memberIds.includes(m.id));
              return (
                <article className="wk-note" key={project.id} aria-label={project.name + " 관리 정보"}>
                  <Badge>{project.stage}</Badge>
                  <h3>{project.name}</h3>
                  <p><strong>담당 리더</strong> {leader?.name || "이름 확인 필요"}</p>
                  <p><strong>참여 방식</strong> {projectVisibilityLabel(project)}</p>
                  <p><strong>생성 경위</strong> {projectOriginLabel(project, p.records)}</p>
                  {project.createdFromVote && <p><strong>출발 프로젝트</strong> {project.createdFromVote.projectName}</p>}
                  <small>생성일 <time dateTime={project.createdAt}>{stamp(project.createdAt)}</time></small>
                  <p>공개 배포 {recordsOf(p, "release").filter((r) => r.projectId === project.id).length}개</p>
                  <details>
                    <summary>구성원 {project.memberIds.length}명</summary>
                    <p>{project.memberIds.map((id) => {
                      const member = w.members.find((m) => m.id === id);
                      return (member?.name || "이름 확인 필요") + (id === project.leaderId ? " (리더)" : "") + (member && !member.active ? " · 참여 중지" : "");
                    }).join(", ") || "참가자가 없습니다."}</p>
                  </details>
                  {admin && (candidates.length ? (
                    <Action
                      key={project.leaderId + ":" + candidates.map((m) => m.id).join(",")}
                      label="담당 리더 변경"
                      submitLabel="리더 변경"
                      command={{ type: "transferLeader", projectId: project.id }}
                      fields={[
                        { name: "memberId", label: "새 담당 리더", type: "select", options: candidates.map((m) => ({ value: m.id, label: m.name })) },
                        reason,
                      ]}
                      run={p.run}
                      busy={p.busy || s?.data.state === "completed"}
                    />
                  ) : <p>리더를 맡길 다른 활성 팀원이 없습니다.</p>)}
                </article>
              );
            })}
          </div>
        )}
      </Box>
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
          <Box title="참가자 가입·권한">
            <p>Google 계정으로 로그인하면 참가자로 자동 가입됩니다. 초대 코드나 이메일 사전 등록은 필요하지 않습니다.</p>
            <p>아래에서 참가자에게 퍼실리테이터·관리자 권한을 부여하거나 참여를 중지할 수 있습니다.</p>
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
