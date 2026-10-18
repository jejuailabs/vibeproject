"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, Crown, MessageCircle, Plus } from "lucide-react";
import { IdeaRefinement } from "./idea-refinement";
import { characterFor } from "@/lib/characters";
import { canReadIdea } from "@/lib/policy";
import { answered, questionFields, statement } from "@/lib/refinement";
import { docKeys, docNames, type DocKey } from "@/lib/workshop/model";
import { recordsOf, type Props } from "./workshop/common";
import type { Command, Idea, Member, Project } from "@/lib/types";
import { projectTimeline, type StepKey } from "@/lib/steps";
import { ProjectTimeline } from "./project-timeline";
import { ProjectExhibit } from "./project-exhibit";

const steps: { key: StepKey; name: string; title: string; hint: string }[] = [
  { key: "thought", name: "각자 생각", title: "어떤 순간이 불편했나요?", hint: "직접 겪은 일 하나를 짧게 적어요. 팀원 모두의 생각이 아래 벽에 모입니다." },
  { key: "questions", name: "경험 구체화", title: "그 경험을 다섯 질문으로 풀어요", hint: "누가·언제·무엇이 막혔는지 아는 만큼 적고, 모르면 ‘확인 필요’라고 남겨요." },
  { key: "definition", name: "문제정의", title: "문제를 한 문장으로 정리해요", hint: "앱이나 기능 대신 사람이 겪는 어려움으로 적어요. 의견을 받고 초안을 다시 저장할 수 있어요." },
  { key: "confirm", name: "문제 확정", title: "우리 팀이 풀 문제를 정해요", hint: "팀원의 문제정의 카드를 읽고 의견을 남겨요. 리더가 하나를 이유와 함께 확정합니다." },
  { key: "plan", name: "기획", title: "만들 것을 문서 7장으로 정리해요", hint: "확정한 문제에서 시작해 기능·화면·데이터를 한 장씩 채워요." },
  { key: "build", name: "개발·회의", title: "만들고, 회의하고, 결정을 남겨요", hint: "회의 기록·팀 대화·할 일·결정·배포가 모두 프로젝트 이력으로 남습니다." },
  { key: "show", name: "전시", title: "처음 생각에서 결과까지 보여줘요", hint: "문제·해결·시연·회고를 정리해 전체에 공개해요." },
];
type StepsProps = Props & {
  project: Project;
  saveIdea: (c: Command, onResult?: (result: { id?: string }) => void) => Promise<boolean>;
  onIdea: (id: string) => void;
  onNavigate: (tab: string, doc?: DocKey, target?: string) => void;
  initialStep?: StepKey;
  onStepChange: (step: StepKey) => void;
  onGallery: () => void;
};

function Avatar({ member }: { member?: Member }) {
  return <img className="steps-avatar" src={characterFor(member).image} alt="" />;
}
function cardDone(step: StepKey, i: Idea) {
  return step === "thought" ? true : step === "questions" ? answered(i.refinement) === 5 : !!i.refinement?.draft;
}

export function ProjectSteps(p: StepsProps) {
  const w = p.workspace, me = w.me, team = p.project, leader = team.leaderId === me.id;
  const members = team.memberIds.map((id) => w.members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  const cards = useMemo(
    () => w.ideas.filter((i) => canReadIdea(me, i) && (i.projectId === team.id || i.id === team.sourceIdeaId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [w.ideas, me, team.id, team.sourceIdeaId],
  );
  const mine = cards.filter((i) => i.ownerId === me.id);
  const [step, setStep] = useState<StepKey>(() => {
    if (p.initialStep) return p.initialStep;
    if (!mine.length) return "thought";
    if (!mine.some((i) => answered(i.refinement) === 5)) return "questions";
    if (!mine.some((i) => i.refinement?.draft)) return "definition";
    return team.confirmedProblem ? "plan" : "confirm";
  });
  const [selectedId, setSelectedId] = useState((mine.find((i) => i.state === "shared") || mine[0])?.id || "");
  const myCard = mine.find((i) => i.id === selectedId) || (selectedId === "new" ? undefined : mine[0]);
  const [title, setTitle] = useState(""), [body, setBody] = useState("");
  const [pick, setPick] = useState(""), [reason, setReason] = useState("");
  const [history, setHistory] = useState<StepKey | "all" | null>(null);
  const { onStepChange } = p;
  useEffect(() => onStepChange(step), [step, onStepChange]);

  const docs = recordsOf(p, "document").filter((x) => x.projectId === team.id && !x.data.redacted && x.data.markdown.trim());
  const baselines = recordsOf(p, "baseline").filter((x) => x.projectId === team.id);
  const releases = recordsOf(p, "release").filter((x) => x.projectId === team.id);
  const tasks = recordsOf(p, "task").filter((x) => x.projectId === team.id);
  const decisions = recordsOf(p, "decision").filter((x) => x.projectId === team.id);
  const meetings = recordsOf(p, "source").filter((x) => x.projectId === team.id && !x.data.redacted);
  const showcase = recordsOf(p, "showcase").find((x) => x.projectId === team.id);
  const chats = w.messages.filter((m) => m.channel === team.id).length;
  const ended = recordsOf(p, "settings")[0]?.data.state === "completed";
  const commentCount = (id: string) => w.comments.filter((c) => c.ideaId === id).length;
  const wrote = (key: StepKey) => members.filter((m) => cards.some((i) => i.ownerId === m.id && cardDone(key, i))).length;

  const progress: Record<StepKey, { label: string; done: boolean }> = {
    thought: { label: `${wrote("thought")}/${members.length}명`, done: wrote("thought") === members.length },
    questions: { label: `${wrote("questions")}/${members.length}명`, done: wrote("questions") === members.length },
    definition: { label: `${wrote("definition")}/${members.length}명`, done: wrote("definition") === members.length },
    confirm: { label: team.confirmedProblem ? "확정됨" : "확정 전", done: !!team.confirmedProblem },
    plan: { label: `문서 ${docs.length}/7`, done: baselines.length > 0 },
    build: { label: `배포 ${releases.length}`, done: releases.length > 0 },
    show: { label: showcase?.data.state === "published" ? "공개" : showcase ? "작성 중" : "시작 전", done: showcase?.data.state === "published" },
  };
  const entries = useMemo(
    () => projectTimeline({ project: team, ideas: cards, events: w.events, comments: w.comments, messages: w.messages, records: p.records }),
    [team, cards, w.events, w.comments, w.messages, p.records],
  );
  const stepEntries = entries.filter((e) => e.group === step).length;
  const index = steps.findIndex((s) => s.key === step), spec = steps[index];

  async function createCard(e: FormEvent) {
    e.preventDefault();
    await p.saveIdea({ type: "createIdea", title: title.trim(), body: body.trim(), kind: "thought", scope: "project" }, (r) => {
      if (r.id) { setSelectedId(r.id); setTitle(""); setBody(""); setStep("questions"); }
    });
  }
  async function confirm(e: FormEvent) {
    e.preventDefault();
    const card = cards.find((i) => i.id === pick);
    if (card && (await p.run({ type: "confirmProblem", projectId: team.id, ideaId: card.id, revision: card.revision, reason: reason.trim() }))) {
      setPick(""); setReason("");
    }
  }

  return (
    <section className="steps" aria-label="프로젝트 단계">
      <nav className="steps-rail" aria-label="프로젝트 진행 단계">
        {steps.map((s, i) => (
          <button key={s.key} type="button" aria-current={step === s.key ? "step" : undefined} className={(step === s.key ? "active " : "") + (progress[s.key].done ? "done" : "")} onClick={() => setStep(s.key)}>
            <span className="steps-num">{progress[s.key].done ? <Check size={14} /> : i + 1}</span>
            <span><strong>{s.name}</strong><small>{progress[s.key].label}</small></span>
          </button>
        ))}
        <button type="button" className={"steps-history" + (history !== null ? " active" : "")} aria-pressed={history !== null} onClick={() => setHistory(history === null ? "all" : null)}>
          <span><strong>이력</strong><small>기록 {entries.length}</small></span>
        </button>
      </nav>
      {history !== null ? (
        <ProjectTimeline entries={entries} members={w.members} focus={history} onFocus={setHistory} onIdea={p.onIdea} onClose={() => { if (history !== "all") setStep(history); setHistory(null); }} />
      ) : (<>

      {team.confirmedProblem && step !== "confirm" && (
        <p className="steps-problem"><Crown size={14} /> 확정한 문제 · {team.confirmedProblem.statement}</p>
      )}

      <header className="steps-head">
        <span className="steps-kicker">STEP {index + 1} / 7 · {spec.name}</span>
        <h2>{spec.title}</h2>
        <p>{spec.hint}</p>
      </header>
      {ended && <p className="steps-note">종료된 기수입니다. 남긴 기록을 둘러보세요.</p>}

      {(step === "thought" || step === "questions" || step === "definition") && (
        <>
          <div className="steps-panel">
            <div className="steps-panel-head">
              <h3>내 입력</h3>
              {mine.length > 0 && (
                <label>내 카드
                  <select value={myCard?.id || "new"} onChange={(e) => { setSelectedId(e.target.value); if (e.target.value === "new") setStep("thought"); }} disabled={p.busy}>
                    {mine.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                    <option value="new">+ 새 생각 추가</option>
                  </select>
                </label>
              )}
            </div>
            {step === "thought" && (!myCard ? (
              <form className="steps-form" onSubmit={createCard}>
                <label>무슨 일이었나요?<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="예: 모임에 처음 가면 누구에게 말을 걸지 모르겠어요" disabled={p.busy || ended} /></label>
                <label>언제, 누구에게, 무엇이 불편했나요?<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={5000} required placeholder="직접 겪은 일을 편하게 적어요." disabled={p.busy || ended} /></label>
                <div className="steps-actions"><small>저장하면 팀 벽에 올라가고 다음 단계로 넘어가요.</small><button className="primary-button" disabled={p.busy || ended || !title.trim() || !body.trim()}>팀 벽에 올리기 <ArrowRight size={15} /></button></div>
              </form>
            ) : (
              <div className="steps-mine">
                <strong>{myCard.title}</strong><p>{myCard.body}</p>
                <div className="steps-actions"><button className="secondary-button" onClick={() => p.onIdea(myCard.id)}>원문·이력</button><button className="primary-button" onClick={() => setStep("questions")}>경험 구체화로 <ArrowRight size={15} /></button></div>
              </div>
            ))}
            {step !== "thought" && (!myCard ? (
              <div className="steps-empty"><p>먼저 생각 카드를 하나 올려주세요.</p><button className="primary-button" onClick={() => setStep("thought")}>1단계로 <ArrowRight size={15} /></button></div>
            ) : step === "definition" && answered(myCard.refinement) !== 5 ? (
              <div className="steps-empty"><p>다섯 질문에 모두 답하면 문제정의를 쓸 수 있어요. ({answered(myCard.refinement)}/5)</p><button className="primary-button" onClick={() => setStep("questions")}>경험 구체화로 <ArrowRight size={15} /></button></div>
            ) : myCard.state !== "shared" ? (
              <div className="steps-empty"><p>이 카드는 {myCard.state === "selected" ? "프로젝트 출발 카드로" : "투표·종료로"} 고정되어 수정할 수 없어요. 새 생각을 추가해 이어갈 수 있어요.</p><button className="primary-button" onClick={() => { setSelectedId("new"); setStep("thought"); }}><Plus size={15} /> 새 생각 추가</button></div>
            ) : (
              <IdeaRefinement key={myCard.id + step} idea={myCard} editable={!ended} hasProject teamOnly busy={p.busy} run={p.saveIdea} activePanel={step === "definition" ? "definition" : "questions"} onPanelChange={(panel) => setStep(panel)} />
            ))}
          </div>

          <div className="steps-wall-head">
            <h3>팀 벽 · {spec.name}</h3>
            <span>{progress[step].label} 작성</span>
          </div>
          <div className="steps-wall">
            {cards.map((i) => {
              const owner = w.members.find((m) => m.id === i.ownerId), done = cardDone(step, i);
              return (
                <article key={i.id} className={"steps-card" + (done ? "" : " waiting") + (i.ownerId === me.id ? " mine" : "")}>
                  <header><Avatar member={owner} /><span><strong>{owner?.name || "팀원"}</strong><small>{i.title}</small></span></header>
                  {step === "thought" && <p>{i.body}</p>}
                  {step === "questions" && (done || answered(i.refinement) ? (
                    <dl>{questionFields.map(([k, label]) => i.refinement?.answers[k]?.trim() ? <div key={k}><dt>{label}</dt><dd>{i.refinement.answers[k]}</dd></div> : null)}</dl>
                  ) : <p className="steps-muted">아직 질문에 답하지 않았어요.</p>)}
                  {step === "definition" && (done ? (
                    <><blockquote>{statement(i.refinement!)}</blockquote><small className="steps-badge">초안 {i.refinement!.draft}{i.refinement!.ready ? " · 점검 완료" : ""}</small></>
                  ) : <p className="steps-muted">문제정의 초안을 쓰는 중이에요.</p>)}
                  <footer><button className="text-button" onClick={() => p.onIdea(i.id)}><MessageCircle size={13} /> 의견 {commentCount(i.id)}</button></footer>
                </article>
              );
            })}
            {members.filter((m) => !cards.some((i) => i.ownerId === m.id)).map((m) => (
              <article key={m.id} className="steps-card ghost"><header><Avatar member={m} /><span><strong>{m.name}</strong><small>아직 카드가 없어요</small></span></header></article>
            ))}
          </div>
        </>
      )}

      {step === "confirm" && (
        <div className="steps-panel">
          {team.confirmedProblem ? (
            <div className="steps-confirmed">
              <span><Crown size={15} /> 확정한 문제 · 초안 {team.confirmedProblem.draft}</span>
              <blockquote>{team.confirmedProblem.statement}</blockquote>
              <small>{w.members.find((m) => m.id === team.confirmedProblem!.ownerId)?.name}님의 카드 · 이유: {team.confirmedProblem.reason}</small>
            </div>
          ) : <p className="steps-note">{leader ? "아래 카드 중 하나를 골라 이유와 함께 확정하세요." : "카드에 의견을 남겨 주세요. 리더가 하나를 확정합니다."}</p>}
          <form onSubmit={confirm}>
            <div className="steps-wall">
              {cards.filter((i) => i.refinement?.draft).map((i) => {
                const owner = w.members.find((m) => m.id === i.ownerId), chosen = team.confirmedProblem?.ideaId === i.id;
                return (
                  <label key={i.id} className={"steps-card pick" + (pick === i.id ? " picked" : "") + (chosen ? " chosen" : "")}>
                    {leader && !ended && <input type="radio" name="problem" value={i.id} checked={pick === i.id} onChange={() => setPick(i.id)} />}
                    <header><Avatar member={owner} /><span><strong>{owner?.name}</strong><small>초안 {i.refinement!.draft}{chosen ? " · 확정됨" : ""}</small></span></header>
                    <blockquote>{statement(i.refinement!)}</blockquote>
                    <footer><button type="button" className="text-button" onClick={() => p.onIdea(i.id)}><MessageCircle size={13} /> 의견 {commentCount(i.id)}</button></footer>
                  </label>
                );
              })}
              {!cards.some((i) => i.refinement?.draft) && <div className="steps-empty"><p>아직 문제정의 초안이 없어요.</p><button type="button" className="primary-button" onClick={() => setStep("definition")}>문제정의 쓰러 가기 <ArrowRight size={15} /></button></div>}
            </div>
            {leader && !ended && cards.some((i) => i.refinement?.draft) && (
              <div className="steps-confirm-bar">
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="이 문제를 고른 이유" aria-label="확정 이유" />
                <button className="primary-button" disabled={p.busy || !pick || !reason.trim()}><Crown size={15} /> {team.confirmedProblem ? "이 문제로 다시 확정" : "이 문제로 확정"}</button>
              </div>
            )}
          </form>
        </div>
      )}

      {step === "plan" && (
        <div className="steps-panel">
          <div className="steps-docs">
            {docKeys.map((key, i) => {
              const has = docs.some((d) => d.data.key === key);
              return (
                <button key={key} className={"steps-doc" + (has ? " done" : "")} onClick={() => p.onNavigate("studio", key, "project-docs")}>
                  <span>{has ? <Check size={15} /> : i + 1}</span><strong>{docNames[key]}</strong><small>{has ? "작성함 · 다듬기" : "작성하기"} <ArrowUpRight size={13} /></small>
                </button>
              );
            })}
          </div>
          <div className="steps-actions">
            <small>{baselines.length ? `확정한 기획 버전 ${baselines.length}개` : "7장을 채운 뒤 리더가 기획 버전을 확정합니다."}</small>
            <button className="primary-button" onClick={() => p.onNavigate("studio", undefined, leader ? "project-baseline" : "project-docs")}>{leader ? "기획 버전 확정" : "기획 문서 열기"} <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {step === "build" && (
        <div className="steps-tiles">
          <Tile n={meetings.length} label="회의·자료 기록" hint="회의 메모나 녹취록을 남기고 결정·할 일로 옮겨요." button="회의 기록 남기기" onClick={() => p.onNavigate("sources")} />
          <Tile n={chats} label="팀 대화" hint="대화는 아이디어·할 일·결정으로 바꿀 수 있어요." button="팀 대화 열기" onClick={() => p.onNavigate("communication")} />
          <Tile n={tasks.length} label={`할 일 · 완료 ${tasks.filter((t) => t.data.status === "done").length}`} hint="누가 무엇을 맡았는지 정리해요." button="할 일·결정 보기" onClick={() => p.onNavigate("studio")} />
          <Tile n={decisions.length} label="결정 기록" hint="무엇을 왜 정했는지 남겨요." button="결정 남기기" onClick={() => p.onNavigate("studio")} />
          <Tile n={releases.length} label="배포 기록" hint="실행 주소와 알려진 문제를 남겨요." button={leader ? "배포 기록 남기기" : "배포 기록 보기"} onClick={() => p.onNavigate("studio", undefined, leader ? "project-release" : "project-releases")} />
        </div>
      )}

      {step === "show" && (
        <div className="steps-panel">
          {showcase ? (
            <ProjectExhibit project={team} showcase={showcase} members={w.members} />
          ) : (
            <div className="steps-preview">
              <span>01 · 처음 생각</span><p>{team.confirmedProblem ? cards.find((i) => i.id === team.confirmedProblem!.ideaId)?.title || "확정한 카드의 처음 생각" : "팀 카드 중 하나"}</p>
              <span>02 · 확정한 문제</span><p>{team.confirmedProblem?.statement || "4단계에서 리더가 문제를 확정하면 여기에 들어가요."}</p>
              <span>03 · 결과</span><p>만든 해결책, 시연 주소, 생각이 바뀐 순간, 회고</p>
              <small>{leader ? "전시 카드를 저장하면 이 흐름으로 보여요. 처음 생각과 진행 숫자는 포함할지 직접 고릅니다." : "리더가 전시 카드를 정리합니다. 팀 대화에 결과와 회고를 보태주세요."}</small>
            </div>
          )}
          <div className="steps-actions">
            <button className="secondary-button" onClick={p.onGallery}>워크숍 전시 갤러리</button>
            {leader && <button className="primary-button" onClick={() => p.onNavigate("showcase", undefined, "showcase-editor")}>{showcase ? "전시 고치기" : "전시 카드 작성"} <ArrowRight size={15} /></button>}
          </div>
        </div>
      )}

      <div className="steps-nav">
        <button className="text-button" onClick={() => setHistory(step)}>이 단계 기록 {stepEntries}개 보기</button>
        {index > 0 && <button className="secondary-button" onClick={() => setStep(steps[index - 1].key)}>이전 · {steps[index - 1].name}</button>}
        {index < steps.length - 1 && <button className="primary-button" onClick={() => setStep(steps[index + 1].key)}>다음 · {steps[index + 1].name} <ArrowRight size={15} /></button>}
      </div>
      </>)}
    </section>
  );
}

function Tile({ n, label, hint, button, onClick }: { n: number; label: string; hint: string; button: string; onClick: () => void }) {
  return (
    <article className="steps-tile">
      <strong>{n}</strong><h3>{label}</h3><p>{hint}</p>
      <button className="secondary-button" onClick={onClick}>{button} <ArrowRight size={14} /></button>
    </article>
  );
}

export function ProjectStepsEmpty({ onLobby }: { onLobby: () => void }) {
  return (
    <section className="steps steps-none">
      <h2>아직 참여한 프로젝트가 없어요</h2>
      <p>프로젝트를 만들거나, 목록에서 골라 참여하세요.</p>
      <button className="primary-button" onClick={onLobby}><Plus size={15} /> 프로젝트 만들기 · 참여하기</button>
    </section>
  );
}
