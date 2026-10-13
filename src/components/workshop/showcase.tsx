"use client";
import { characterFor } from "@/lib/characters";
import {
  Action,
  Box,
  Empty,
  Badge,
  recordsOf,
  choices,
  body,
  link,
  stamp,
  type Props,
} from "./common";
export function Showcase(p: Props) {
  const w = p.workspace,
    team = w.projects.find((t) => t.id === w.me.projectId),
    leader = team?.leaderId === w.me.id,
    existing = recordsOf(p, "showcase").find((r) => r.projectId === team?.id),
    schedule = recordsOf(p, "schedule")[0];
  const showcases = recordsOf(p, "showcase");
  return (
    <>
      <Box id="showcase-work" title="우리의 4주를 세상에 보여줄 시간" eyebrow="DEMO DAY">
        <p>
          공개할 변화 3~5개를 직접 골라주세요. 비공개 원문이나 팀 대화는 발표에
          자동으로 포함되지 않습니다.
        </p>
        {leader && team && (
          <Action
            id="showcase-editor" label="최종 발표 페이지 편집"
            command={{ type: "showcase", projectId: team.id }}
            fields={[
              {
                name: "problem",
                label: "처음 해결하려던 문제",
                type: "area",
                value: existing?.data.problem || team.problem,
              },
              {
                name: "solution",
                label: "만든 해결책",
                type: "area",
                value: existing?.data.solution,
              },
              {
                name: "demoUrl",
                label: "시연 주소",
                type: "url",
                value: existing?.data.demoUrl,
              },
              {
                name: "slidesUrl",
                label: "발표 자료 주소",
                type: "url",
                optional: true,
                value: existing?.data.slidesUrl,
              },
              {
                name: "retrospective",
                label: "배운 점과 다음 계획",
                type: "area",
                value: existing?.data.retrospective,
              },
              {
                name: "constraints",
                label: "현재 제약",
                type: "area",
                optional: true,
                value: existing?.data.constraints,
              },
              {
                name: "milestonesText",
                label: "공개할 변화 (한 줄에 하나, 최대 5개)",
                type: "area",
                value: existing?.data.milestones.join("\n"),
              },
              {
                name: "state",
                label: "공개 상태",
                type: "select",
                value: existing?.data.state || "draft",
                options: choices(["draft", "published"], {
                  draft: "팀 내부 초안",
                  published: "기수 전체 공개",
                }),
              },
            ]}
            map={({ milestonesText, ...v }) => ({
              ...v,
              milestones: milestonesText
                .split("\n")
                .map((x: string) => x.trim())
                .filter(Boolean),
            })}
            run={p.run}
            busy={p.busy}
          />
        )}
        {showcases.length === 0 && (
          <Empty>
            완성된 프로젝트가 이곳에서 첫 생각부터 구현까지의 여정을 공유합니다.
          </Empty>
        )}
        <div className="wk-grid">
          {showcases.map((s) => (
            <article className="wk-showcase" key={s.id}>
              <div className="wk-showcase-cover"><span>MADE<br/>IT REAL.</span><img src={characterFor(w.members.find(m => m.id === w.projects.find(t => t.id === s.projectId)?.leaderId)).image} alt="프로젝트 리더의 캐릭터" loading="lazy"/><small>DEMO DAY / WEEK 04</small></div>
              <Badge>
                {s.data.state === "published" ? "공개 발표" : "팀 초안"}
              </Badge>
              <h2>{w.projects.find((t) => t.id === s.projectId)?.name}</h2>
              <h4>출발한 문제</h4>
              <p>{s.data.problem}</p>
              <h4>우리의 해결책</h4>
              <p>{s.data.solution}</p>
              <ol>
                {s.data.milestones.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
              <div className="wk-links">
                {link(s.data.demoUrl, "시연 시작")}
                {link(s.data.slidesUrl, "발표 자료")}
              </div>
              <p>{s.data.retrospective}</p>
              <small>{s.data.constraints}</small>
            </article>
          ))}
        </div>
      </Box>
      <Box title="시연·질의응답·네트워킹 일정">
        {w.me.role === "admin" && (
          <Action
            label="발표 일정 편성"
            command={{ type: "schedule" }}
            fields={[
              { name: "startsAt", label: "발표 시작", type: "datetime-local" },
              {
                name: "totalMinutes",
                label: "전체 시간 (분)",
                type: "number",
                value: 120,
                min: 30,
                max: 240,
              },
              {
                name: "networkMinutes",
                label: "네트워킹 (분)",
                type: "number",
                value: 30,
                min: 0,
                max: 120,
              },
              {
                name: "transitionMinutes",
                label: "프로젝트 사이 전환 (분)",
                type: "number",
                value: 2,
                min: 0,
                max: 60,
              },
              {
                name: "projectIds",
                label: "발표 프로젝트 (선택한 순서대로)",
                type: "multi",
                options: w.projects.map((t) => ({
                  value: t.id,
                  label: t.name,
                })),
              },
            ]}
            run={p.run}
            busy={p.busy}
          />
        )}
        {schedule && (
          <>
            <p>
              {stamp(schedule.data.startsAt)} 시작 · 총{" "}
              {schedule.data.totalMinutes}분
            </p>
            <ol className="wk-schedule">
              {schedule.data.projectIds.map((id, i) => {
                const d = schedule.data,
                  n = d.projectIds.length,
                  minutes =
                    (d.totalMinutes -
                      d.networkMinutes -
                      d.transitionMinutes * (n - 1)) /
                    n,
                  start = new Date(
                    Date.parse(d.startsAt) +
                      (minutes + d.transitionMinutes) * i * 60000,
                  ).toISOString();
                return (
                  <li key={id}>
                    <strong>{stamp(start)}</strong>
                    <span>
                      {w.projects.find((t) => t.id === id)?.name}
                      <small>발표·질의응답 {minutes.toFixed(1)}분</small>
                    </span>
                  </li>
                );
              })}
              <li>
                <strong>마지막 {schedule.data.networkMinutes}분</strong>
                <span>네트워킹 · 다음 협업 연결</span>
              </li>
            </ol>
          </>
        )}
      </Box>
      <Box title="써보고, 다음 개선을 함께">
        <div className="wk-grid">
          {recordsOf(p, "release").map((r) => (
            <article className="wk-note" key={r.id}>
              <small>
                {w.projects.find((t) => t.id === r.projectId)?.name}
              </small>
              <h3>{r.data.title}</h3>
              {link(r.data.demoUrl, "직접 사용해보기")}
              <p>{r.data.summary}</p>
              <Action
                label="피드백 남기기"
                command={{
                  type: "feedback",
                  projectId: r.projectId,
                  releaseId: r.id,
                }}
                fields={[body]}
                run={p.run}
                busy={p.busy}
              />
              {recordsOf(p, "feedback")
                .filter((f) => f.data.releaseId === r.id)
                .map((f) => (
                  <div className="wk-feedback" key={f.id}>
                    <Badge>
                      {
                        {
                          open: "확인 전",
                          accepted: "개선 예정",
                          resolved: "반영·답변 완료",
                        }[f.data.status]
                      }
                    </Badge>
                    <p>{f.data.body}</p>
                    {f.data.resolution && <p>팀 답변: {f.data.resolution}</p>}
                    {w.me.projectId === r.projectId && (
                      <Action
                        label="피드백 처리"
                        command={{ type: "resolveFeedback", feedbackId: f.id }}
                        fields={[
                          {
                            name: "status",
                            label: "상태",
                            type: "select",
                            options: choices(["accepted", "resolved"], {
                              accepted: "개선 예정",
                              resolved: "반영·답변 완료",
                            }),
                            value: "accepted",
                          },
                          {
                            name: "resolution",
                            label: "답변과 조치",
                            max: 500,
                          },
                        ]}
                        run={p.run}
                        busy={p.busy}
                      />
                    )}
                  </div>
                ))}
            </article>
          ))}
        </div>
      </Box>
    </>
  );
}
