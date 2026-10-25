"use client";
import {statement} from '@/lib/refinement';
import {RefinementSummary} from '../idea-refinement';
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
  stamp,
  type Props,
} from "./common";
export function Votes(p: Props) {
  const { workspace: w } = p,
    admin = w.me.role === "admin",
    rounds = recordsOf(p, "round"),
    own = w.projects.find((x) => x.id === w.me.projectId);
  const available = w.ideas.filter(
    (i) => i.scope === "cohort" && i.state === "shared" && i.refinement?.ready===true,
  );
  return (
    <>
      <Box id="vote-rounds" title="어떤 문제에 함께 도전할까요?" eyebrow="VOTE & FORM A SQUAD">
        <p>
          전체 공유한 카드 중 문제정의의 선정 준비를 완료한 카드가 후보로 표시됩니다. 후보는 투표 시작 시점의 내용으로 고정됩니다. 투표는 비공개로 저장하고,
          마감 후 후보별 합계를 공개합니다.
        </p>
        {admin && (
          <Action
            label="투표 시작"
            command={{ type: "openVote" }}
            fields={[
              { ...title, value: "함께 해결할 문제 선정" },
              {
                name: "candidateIds",
                label: "후보 아이디어",
                type: "multi",
                options: available.map((i) => ({
                  value: i.id,
                  label: i.title,
                })),
              },
              {
                name: "budget",
                label: "1인당 표 수",
                type: "number",
                value: 3,
                min: 1,
                max: 10,
              },
              {
                name: "allowSelfVote",
                label: "본인 아이디어 투표 허용",
                type: "check",
              },
              { name: "closesAt", label: "투표 마감", type: "datetime-local" },
            ]}
            run={p.run}
            busy={p.busy}
          />
        )}
        {rounds.length === 0 && (
          <Empty>
            아직 열린 투표가 없습니다. 개인 방식은 아래에서 바로 프로젝트를
            시작할 수 있습니다.
          </Empty>
        )}
        {rounds.map((r) => {
          const b = recordsOf(p, "ballot").find((b) => b.data.roundId === r.id);
          return (
            <article key={r.id} id={r.id} className="wk-round">
              <div className="wk-meta">
                <h3>{r.data.title}</h3>
                <Badge>
                  {r.data.state === "open"
                    ? "투표 중"
                    : r.data.state === "closed"
                      ? "집계 완료"
                      : "선정 완료"}
                </Badge>
              </div>
              <p>
                최대 {r.data.budget}표 · {stamp(r.data.closesAt)} 마감
              </p>
              <div className="wk-grid">
                {r.data.candidates.map((c) => (
                  <div className="wk-note" key={c.ideaId}>
                    <h4>{c.title}</h4>
                    <p>{c.refinement?statement(c.refinement):c.body}</p><RefinementSummary value={c.refinement}/>
                    <small>고정된 원본 r{c.revision}</small>
                    {r.data.state !== "open" && (
                      <strong className="wk-votes">
                        {r.data.counts[c.ideaId] || 0}
                        <small> 표</small>
                      </strong>
                    )}
                  </div>
                ))}
              </div>
              {r.data.state === "open" && (
                <Action
                  label="내 투표 선택·변경"
                  command={{
                    type: "ballot",
                    roundId: r.id,
                    revision: b?.revision || 0,
                  }}
                  fields={[
                    {
                      name: "candidateIds",
                      label: "선택한 후보",
                      type: "multi",
                      value: b?.data.candidateIds || [],
                      options: r.data.candidates
                        .filter(
                          (c) => r.data.allowSelfVote || c.ownerId !== w.me.id,
                        )
                        .map((c) => ({ value: c.ideaId, label: c.title })),
                    },
                  ]}
                  run={p.run}
                  busy={p.busy}
                />
              )}
              {admin && r.data.state === "open" && (
                <Action
                  label="투표 마감·집계"
                  command={{ type: "closeVote", roundId: r.id }}
                  fields={[reason]}
                  run={p.run}
                  busy={p.busy}
                />
              )}
              {admin && r.data.state === "closed" && (
                <Action
                  label="최종 프로젝트 선정"
                  command={{ type: "selectVote", roundId: r.id }}
                  fields={[
                    {
                      name: "selectedIds",
                      label: "선정할 후보",
                      type: "multi",
                      options: r.data.candidates.map((c) => ({
                        value: c.ideaId,
                        label:
                          c.title +
                          " (" +
                          (r.data.counts[c.ideaId] || 0) +
                          "표)",
                      })),
                    },
                    {
                      name: "mode",
                      label: "프로젝트 방식",
                      type: "select",
                      options: choices(["team", "solo"], {
                        team: "팀",
                        solo: "개인",
                      }),
                      value: "team",
                    },
                    {
                      name: "capacity",
                      label: "프로젝트 정원",
                      type: "number",
                      value: 5,
                      min: 1,
                      max: 100,
                    },
                    reason,
                  ]}
                  map={({ selectedIds, mode, capacity, ...rest }) => ({
                    ...rest,
                    selected: selectedIds.map((id: string) => ({
                      ideaId: id,
                      name: r.data.candidates.find((c) => c.ideaId === id)!
                        .title,
                      mode,
                      capacity,
                    })),
                  })}
                  run={p.run}
                  busy={p.busy}
                />
              )}
              {r.data.reason && (
                <p className="wk-callout">운영 결정: {r.data.reason}</p>
              )}
            </article>
          );
        })}
      </Box>
      {!own && (
        <Box title="내 문제로 개인 프로젝트 시작">
          <Action
            label="개인 프로젝트 만들기"
            command={{ type: "createProject", mode: "solo", capacity: 1 }}
            fields={[
              {
                name: "ideaId",
                label: "내가 전체에 공유한 아이디어",
                type: "select",
                options: available
                  .filter((i) => i.ownerId === w.me.id)
                  .map((i) => ({ value: i.id, label: i.title })),
              },
              { name: "name", label: "프로젝트 이름" },
              reason,
            ]}
            run={p.run}
            busy={p.busy}
          />
        </Box>
      )}
      <Box id="project-join" title="프로젝트에 합류하기">
        <div className="wk-grid">
          {w.projects.map((team) => {
            const leader = team.leaderId === w.me.id,
              requests = recordsOf(p, "join").filter(
                (j) => j.projectId === team.id && j.data.state === "pending",
              );
            return (
              <article className="wk-note" key={team.id} id={team.id}>
                <Badge>{team.stage}</Badge>
                <h3>{team.name}</h3>
                <p>{team.problem}</p>
                <p>
                  {team.memberIds.length} / {team.capacity || 100}명 · 팀장{" "}
                  {w.members.find((m) => m.id === team.leaderId)?.name}
                </p>
                {!own &&
                  team.mode !== "solo" &&
                  !requests.some((j) => j.ownerId === w.me.id) && (
                    <Action
                      label="참여 신청"
                      command={{ type: "join", projectId: team.id }}
                      fields={[
                        {
                          name: "message",
                          label: "함께하고 싶은 이유",
                          type: "area",
                          optional: true,
                        },
                      ]}
                      run={p.run}
                      busy={p.busy}
                    />
                  )}
                {requests.map((j) => (
                  <div className="wk-request" key={j.id}>
                    <p>
                      {w.members.find((m) => m.id === j.ownerId)?.name}:{" "}
                      {j.data.message || "참여를 신청했습니다."}
                    </p>
                    {j.ownerId === w.me.id ? (
                      <RunButton
                        p={p}
                        command={{ type: "withdrawJoin", requestId: j.id }}
                      >
                        신청 취소
                      </RunButton>
                    ) : (
                      (leader || admin) && (
                        <Action
                          label="참여 신청 검토"
                          command={{ type: "resolveJoin", requestId: j.id }}
                          fields={[
                            {
                              name: "accept",
                              label: "참여 승인 (해제하면 거절)",
                              type: "check",
                              value: true,
                            },
                            reason,
                          ]}
                          run={p.run}
                          busy={p.busy}
                        />
                      )
                    )}
                  </div>
                ))}
                {own?.id === team.id && !leader && (
                  <Action
                    label="프로젝트 나가기"
                    command={{ type: "leaveProject", projectId: team.id }}
                    fields={[reason]}
                    run={p.run}
                    busy={p.busy}
                  />
                )}
                {(leader || admin) && (
                  <Action
                    label="팀장 이관"
                    command={{ type: "transferLeader", projectId: team.id }}
                    fields={[
                      {
                        name: "memberId",
                        label: "새 팀장",
                        type: "select",
                        options: team.memberIds
                          .filter((id) => id !== team.leaderId && w.members.some((m) => m.id === id && m.active))
                          .map((id) => ({
                            value: id,
                            label:
                              w.members.find((m) => m.id === id)?.name || id,
                          })),
                      },
                      reason,
                    ]}
                    run={p.run}
                    busy={p.busy}
                  />
                )}
              </article>
            );
          })}
        </div>
      </Box>
    </>
  );
}
