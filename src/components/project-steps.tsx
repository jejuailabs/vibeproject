"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, Crown, Download, MessageCircle, Pencil, Plus, Sparkles, Trash2, Vote, X } from "lucide-react";
import { IdeaRefinement } from "./idea-refinement";
import { characterFor } from "@/lib/characters";
import { canReadIdea } from "@/lib/policy";
import { answered, definitionFields, questionFields, statement } from "@/lib/refinement";
import { docKeys, docNames, type DocKey } from "@/lib/workshop/model";
import { recordsOf, type Props } from "./workshop/common";
import type { Command, Idea, Member, Project } from "@/lib/types";
import { projectTimeline, type StepKey } from "@/lib/steps";
import { ProjectTimeline } from "./project-timeline";
import { ProjectExhibit } from "./project-exhibit";
import { AICoach } from "./ai-coach";
import { CardPreview, ProblemCard } from "./card-view";
import { QuickDraft, draftRefinement } from "./quick-draft";
import type { DraftFields } from "@/lib/coaching";

const steps: { key: StepKey; name: string; title: string; hint: string; group: "find" | "make" }[] = [
  { key: "thought", name: "각자 생각", title: "어떤 순간이 불편했나요?", hint: "직접 겪은 일 하나를 짧게 올려요.", group: "find" },
  { key: "questions", name: "경험 구체화", title: "그 경험을 조금 더 알려주세요", hint: "누가, 언제 막히는지, 지금은 어떻게 넘기는지 답해요.", group: "find" },
  { key: "definition", name: "문제 카드", title: "AI와 함께 문제 카드를 만들어요", hint: "질문 세 개에 더 답하면 AI가 문제 한 문장 카드로 정리해줘요.", group: "find" },
  { key: "confirm", name: "최종 아이디어·투표", title: "함께 풀 문제를 골라요", hint: "완성된 문제 카드를 모아 보고 투표로 정해요. 확정한 카드는 바로 기획 문서(md)가 돼요.", group: "find" },
  { key: "plan", name: "기획 문서", title: "만들 것을 문서 7장으로 정리해요", hint: "확정한 문제에서 시작해 기능·화면·데이터를 한 장씩 채워요.", group: "make" },
  { key: "build", name: "개발·회의", title: "만들고, 회의하고, 결정을 남겨요", hint: "회의 기록·팀 대화·할 일·결정·배포가 프로젝트 이력으로 남아요.", group: "make" },
  { key: "show", name: "전시", title: "처음 생각에서 결과까지 보여줘요", hint: "문제·해결·시연·회고를 정리해 전체에 공개해요.", group: "make" },
];
const writeSteps: StepKey[] = ["thought", "questions", "definition"];
const tones = ["#fff4c7", "#e3f1ff", "#ffe4ec", "#e4f7ea", "#efe7fb", "#ffeedd"];
const accents = ["#f2b134", "#5b9be6", "#e9708f", "#4fb37c", "#9773cc", "#f08a4b"];
type StepsProps = Props & {
  project: Project;
  saveIdea: (c: Command, onResult?: (result: { id?: string }) => void) => Promise<boolean>;
  onIdea: (id: string) => void;
  onNavigate: (tab: string, doc?: DocKey, target?: string) => void;
  initialStep?: StepKey;
  onStepChange: (step: StepKey) => void;
  onGallery: () => void;
  onBack?: () => void;
};

function Avatar({ member }: { member?: Member }) {
  return <img className="steps-avatar" src={characterFor(member).image} alt="" />;
}
// A card shows on a step's board only once the step before it is finished; otherwise it waits below the board.
function reached(step: StepKey, i: Idea) {
  return step === "definition" ? answered(i.refinement) === questionFields.length : true;
}
const voteTimes = [0, 3, 5, 10, 15, 20, 30, 60];
const clock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
function cardDone(step: StepKey, i: Idea) {
  return step === "thought" ? true : step === "questions" ? answered(i.refinement) === questionFields.length : !!i.refinement?.ready;
}

export function ProjectSteps(p: StepsProps) {
  const w = p.workspace, me = w.me, team = p.project, leader = team.leaderId === me.id;
  const members = team.memberIds.map((id) => w.members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  const cards = useMemo(
    () => w.ideas.filter((i) => canReadIdea(me, i) && (i.projectId === team.id || i.id === team.sourceIdeaId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [w.ideas, me, team.id, team.sourceIdeaId],
  );
  const mine = cards.filter((i) => i.ownerId === me.id);
  const [step, setStep] = useState<StepKey | null>(p.initialStep ?? null);
  const [writing, setWriting] = useState(false), [quick, setQuick] = useState(false);
  const [editCard, setEditCard] = useState<Idea | null>(null), [editTitle, setEditTitle] = useState(""), [editBody, setEditBody] = useState("");
  const [selectedId, setSelectedId] = useState((mine.find((i) => i.state === "shared") || mine[0])?.id || "");
  const myCard = mine.find((i) => i.id === selectedId) || mine.find((i) => i.state === "shared") || mine[0];
  const [title, setTitle] = useState(""), [body, setBody] = useState("");
  const [pick, setPick] = useState(""), [reason, setReason] = useState("");
  const [history, setHistory] = useState<StepKey | "all" | null>(null);
  const composer = useRef<HTMLDialogElement>(null);
  const { onStepChange } = p;
  useEffect(() => { if (step) onStepChange(step); }, [step, onStepChange]);
  useEffect(() => {
    if (writing && !composer.current?.open) composer.current?.showModal();
    else if (!writing) { composer.current?.close(); setQuick(false); setEditCard(null); }
  }, [writing]);

  const docs = recordsOf(p, "document").filter((x) => x.projectId === team.id && !x.data.redacted && x.data.markdown.trim());
  const baselines = recordsOf(p, "baseline").filter((x) => x.projectId === team.id);
  const releases = recordsOf(p, "release").filter((x) => x.projectId === team.id);
  const tasks = recordsOf(p, "task").filter((x) => x.projectId === team.id);
  const decisions = recordsOf(p, "decision").filter((x) => x.projectId === team.id);
  const meetings = recordsOf(p, "source").filter((x) => x.projectId === team.id && !x.data.redacted);
  const showcase = recordsOf(p, "showcase").find((x) => x.projectId === team.id);
  const votes = recordsOf(p, "teamVote").filter((x) => x.projectId === team.id && x.data.state !== "deleted").sort((a, b) => b.data.round - a.data.round);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const vote = votes.find((x) => x.id === selectedVoteId);
  const [voteBoard, setVoteBoard] = useState(false);
  useEffect(() => { if (step !== "confirm") setVoteBoard(false); }, [step]);
  useEffect(() => { if (selectedVoteId && !vote) { setSelectedVoteId(null); setVoteBoard(false); } }, [selectedVoteId, vote]);

  const myBallot = vote && recordsOf(p, "teamBallot").find((x) => x.projectId === team.id && x.ownerId === me.id && x.data.round === vote.data.round && (x.data.voteId === vote.id || (!x.data.voteId && vote.id === "teamvote-" + team.id)));
  const savedPicks = myBallot ? myBallot.data.ideaIds ?? (myBallot.data.ideaId ? [myBallot.data.ideaId] : []) : [];
  // A pick shows right away while it saves; a failed save drops it and the saved picks show again.
  const [optimistic, setOptimistic] = useState<{ voteId: string; picks: string[] } | null>(null);
  const myPicks = optimistic && optimistic.voteId === vote?.id ? optimistic.picks : savedPicks;
  const maxVotes = vote?.data.maxVotes || 1;
  const [voteLimit, setVoteLimit] = useState(1), [voteMinutes, setVoteMinutes] = useState(10);
  // A timed vote ticks every second; past its deadline nobody can vote, and the opener's screen closes it.
  const [now, setNow] = useState(() => Date.now());
  const timed = step === "confirm" && votes.some((v) => v.data.state === "open" && v.data.endsAt);
  useEffect(() => { if (!timed) return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [timed]);
  const timeUp = (v: (typeof votes)[number]) => v.data.state === "open" && !!v.data.endsAt && Date.parse(v.data.endsAt) <= now;
  const closing = useRef(new Set<string>());
  const { run } = p;
  useEffect(() => {
    for (const v of votes) if (timeUp(v) && v.ownerId === me.id && !closing.current.has(v.id)) { closing.current.add(v.id); void run({ type: "closeTeamVote", projectId: team.id, voteId: v.id }); }
  });
  const voteOpen = vote?.data.state === "open" && !timeUp(vote);
  const chats = w.messages.filter((m) => m.channel === team.id).length;
  const ended = recordsOf(p, "settings")[0]?.data.state === "completed";
  const commentCount = (id: string) => w.comments.filter((c) => c.ideaId === id).length;
  const wrote = (key: StepKey) => members.filter((m) => cards.some((i) => i.ownerId === m.id && cardDone(key, i))).length;
  const problems = cards.filter((i) => i.refinement?.ready && i.state !== "closed_unselected");
  const boardProblems = vote ? problems.filter((i) => vote.data.candidateIds.includes(i.id)) : problems;
  // Finished cards that are not in the open vote yet, e.g. written after the leader opened it.
  const fresh = vote?.data.state === "open" ? problems.filter((i) => !vote.data.candidateIds.includes(i.id)) : [];
  const top = vote ? [...boardProblems].sort((a, b) => (vote.data.counts[b.id] || 0) - (vote.data.counts[a.id] || 0))[0] : undefined;
  useEffect(() => { if (vote?.data.state === "closed" && top && !pick) setPick(top.id); }, [vote?.data.state, top, pick]);

  const progress: Record<StepKey, { label: string; done: boolean }> = {
    thought: { label: `${wrote("thought")}/${members.length}명 작성`, done: wrote("thought") === members.length },
    questions: { label: `${wrote("questions")}/${members.length}명 작성`, done: wrote("questions") === members.length },
    definition: { label: `${wrote("definition")}/${members.length}명 작성`, done: wrote("definition") === members.length },
    confirm: { label: team.confirmedProblem ? "확정됨" : votes.some((v) => v.data.state === "open") ? `투표 중 · ${votes.filter((v) => v.data.state === "open").length}개 방` : `문제 카드 ${problems.length}개`, done: !!team.confirmedProblem },
    plan: { label: `문서 ${docs.length}/7`, done: baselines.length > 0 },
    build: { label: `배포 ${releases.length}`, done: releases.length > 0 },
    show: { label: showcase?.data.state === "published" ? "공개" : showcase ? "작성 중" : "시작 전", done: showcase?.data.state === "published" },
  };
  const entries = useMemo(
    () => projectTimeline({ project: team, ideas: cards, events: w.events, comments: w.comments, messages: w.messages, records: p.records }),
    [team, cards, w.events, w.comments, w.messages, p.records],
  );

  // One-shot draft: a new card goes through all three saves (thought, experience, problem card) in order.
  async function saveDraft(f: DraftFields, author: string) {
    const r = draftRefinement(f);
    let id = "";
    if (!(await p.saveIdea({ type: "createIdea", title: f.title.trim().slice(0, 120), body: f.body.trim().slice(0, 5000), kind: "thought", scope: "project", ...(author ? { authorName: author } : {}) }, (res) => { id = res.id || ""; })) || !id) return;
    const input = { answers: r.answers, definition: r.definition, ready: false };
    const reason = "AI로 한 번에 정리";
    if (questionFields.some(([k]) => r.answers[k].trim()) && !(await p.saveIdea({ type: "refineIdea", id, revision: 1, phase: "questions", input, reason, scope: "project" }))) return;
    if (questionFields.every(([k]) => r.answers[k].trim()) && definitionFields.some(([k]) => r.definition[k].trim()))
      await p.saveIdea({ type: "refineIdea", id, revision: 2, phase: "definition", input: { ...input, ready: r.ready }, reason, scope: "project" });
    setSelectedId(id); setWriting(false); setStep(r.ready ? "definition" : questionFields.every(([k]) => r.answers[k].trim()) ? "definition" : "questions");
  }
  async function createCard(e: FormEvent) {
    e.preventDefault();
    await p.saveIdea({ type: "createIdea", title: title.trim(), body: body.trim(), kind: "thought", scope: "project" }, (r) => {
      if (r.id) { setSelectedId(r.id); setTitle(""); setBody(""); setWriting(false); }
    });
  }
  async function confirm(e: FormEvent) {
    e.preventDefault();
    const card = cards.find((i) => i.id === pick);
    if (card && (await p.run({ type: "confirmProblem", projectId: team.id, ideaId: card.id, revision: card.revision, reason: reason.trim() }))) {
      setPick(""); setReason("");
    }
  }
  // My own unlocked card opens the writing window with the AI coach; anyone else's opens the full card.
  const canContinue = (i: Idea) => i.ownerId === me.id && i.state === "shared" && !ended;
  function continueAt(at: StepKey, i: Idea) { setSelectedId(i.id); setStep(at); setWriting(true); }
  // Fixing a card opens its title and story right away; deleting asks once and removes it.
  function startEdit(i: Idea) { setEditCard(i); setEditTitle(i.title); setEditBody(i.body); setWriting(true); }
  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (editCard && (await p.saveIdea({ type: "editIdea", id: editCard.id, revision: editCard.revision, title: editTitle.trim(), body: editBody.trim(), reason: "카드 내용 고침" }))) setWriting(false);
  }
  const canDelete = (i: Idea) => (i.ownerId === me.id || me.role === "admin") && i.state !== "selected" && team.confirmedProblem?.ideaId !== i.id && !ended;
  async function removeCard(i: Idea) {
    if (!window.confirm("\"" + i.title + "\" 카드를 지울까요? 지운 카드는 되돌릴 수 없어요.")) return;
    await p.saveIdea({ type: "deleteIdea", id: i.id, revision: i.revision });
  }
  function openCard(i: Idea) { if (step && step !== "thought" && canContinue(i)) continueAt(step, i); else p.onIdea(i.id); }
  async function castVote(ideaId: string) {
    if (!vote) return;
    // Same rule as the server: picking a chosen card takes it back; with one vote a new pick replaces the old one.
    const picks = myPicks.includes(ideaId) ? myPicks.filter((id) => id !== ideaId) : myPicks.length < maxVotes ? [...myPicks, ideaId] : maxVotes === 1 ? [ideaId] : myPicks;
    setOptimistic({ voteId: vote.id, picks });
    await p.run({ type: "castTeamVote", projectId: team.id, voteId: vote.id, ideaId });
    setOptimistic(null);
  }
  function openVoteBoard(voteId: string | null) {
    setSelectedVoteId(voteId); setPick(""); setReason(""); setDetailId(null); setVoteBoard(true);
  }
  // A new vote starts with every finished card checked; the leader unchecks the ones to leave out.
  const [picking, setPicking] = useState(false), [chosen, setChosen] = useState<string[]>([]), pickerRef = useRef<HTMLDialogElement>(null);
  const picked = problems.filter((i) => chosen.includes(i.id));
  useEffect(() => { const d = pickerRef.current; if (!d) return; if (picking && !d.open) d.showModal(); else if (!picking && d.open) d.close(); }, [picking]);
  // Live vote dashboard, only for the person who opened that vote.
  const [dashId, setDashId] = useState<string | null>(null), dashRef = useRef<HTMLDialogElement>(null);
  const dash = votes.find((v) => v.id === dashId && v.ownerId === me.id);
  useEffect(() => { const d = dashRef.current; if (!d) return; if (dash && !d.open) d.showModal(); else if (!dash && d.open) d.close(); }, [dash]);
  // "PDF로 저장" prints only the report, copied straight under <body>; the browser's print window saves it as PDF.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing || !dash) return;
    const title = document.title;
    document.title = team.name + " " + dash.data.round + "번째 투표 결과";
    window.print();
    document.title = title;
    setPrinting(false);
  }, [printing, dash, team.name]);
  // The live dashboard while a vote runs; once it closes, the same view becomes the result report.
  function dashBody(v: (typeof votes)[number], print: boolean) {
    const d = v.data, max = d.maxVotes || 1, possible = members.length * max;
    const cast = d.candidateIds.reduce((n, id) => n + (d.counts[id] || 0), 0);
    const live = d.state === "open" && !timeUp(v), final = d.state === "closed";
    const rows = cards.filter((i) => d.candidateIds.includes(i.id)).map((i) => ({ i, n: d.counts[i.id] || 0 })).sort((a, b) => b.n - a.n)
      .map((r, _, all) => ({ ...r, rank: all.filter((o) => o.n > r.n).length + 1, pct: cast ? Math.round((r.n / cast) * 1000) / 10 : 0 }));
    const top = d.top ? d.top.map((t) => t.ideaId) : rows.filter((r) => r.n > 0 && r.rank <= 5).map((r) => r.i.id);
    const leaders = rows.filter((r) => r.rank === 1 && r.n > 0);
    const when = (s: string) => new Date(s).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const abstained = d.abstained ?? Math.max(0, members.length - d.voters);
    return (
      <>
        <header className="vote-dash-head">
          <div>
            <span>{team.name} · {d.round}번째 투표 · {live ? "실시간 현황" : final ? "결과 보고서" : "투표 종료"}</span>
            <h2>{final ? d.round + "번째 투표 결과" : "투표 대시보드"}</h2>
            {final && <small>{when(d.openedAt)} 열림 · {d.closedAt ? when(d.closedAt) + (d.endedBy === "time" ? " 시간 종료" : " 마감") : ""} · 후보 {d.candidateIds.length}장 · 한 사람당 {max}표</small>}
          </div>
          {!print && <button type="button" className="icon-button" aria-label="닫기" onClick={() => setDashId(null)}><X size={22} /></button>}
        </header>
        <div className="vote-dash-top">
          <div className="vote-dash-stat"><small>투표된 표</small><strong>{cast}<em>/{possible}표</em></strong><span>{final ? "쓰지 않은 표 " : "남은 표 "}{Math.max(0, possible - cast)}표</span></div>
          {final ? (
            <div className="vote-dash-clock win">
              <small>{leaders.length > 1 ? "공동 1위" : "1위"}</small>
              <strong>{leaders.length ? leaders.map((r) => r.i.title).join(" · ") : "득표 없음"}</strong>
              <span>{leaders.length ? leaders[0].n + "표 · " + leaders[0].pct + "%" : "아무도 투표하지 않았어요"}</span>
            </div>
          ) : (
            <div className={"vote-dash-clock" + (live && d.endsAt && Date.parse(d.endsAt) - now < 60000 ? " soon" : "")} role="timer" aria-label="남은 시간">
              <small>{live ? (d.endsAt ? "남은 시간" : "시간 제한 없음") : "투표 종료"}</small>
              <strong>{live ? (d.endsAt ? clock(Date.parse(d.endsAt) - now) : "--:--") : "00:00"}</strong>
              <span>{live ? "한 사람당 " + max + "표" : "결과를 모으고 있어요"}</span>
            </div>
          )}
          <div className="vote-dash-stat"><small>참여한 사람</small><strong>{d.voters}<em>/{members.length}명</em></strong><span>{live ? "아직 " + Math.max(0, members.length - d.voters) + "명" : "기권 " + abstained + "명"}</span></div>
        </div>
        <ol className="vote-dash-bars">
          {rows.map(({ i, n, rank, pct }, k) => (
            <li key={i.id} className={rank === 1 && n > 0 ? "lead" : ""} style={{ ["--accent" as string]: accents[k % accents.length] }}>
              <span className="vote-dash-rank">{rank}</span>
              <div className="vote-dash-bar">
                <p><strong>{i.title}</strong>{final && top.includes(i.id) && <span className="vote-dash-top5">TOP 5</span>}<b>{pct}%</b><em>{n}표</em></p>
                <div className="vote-dash-track"><i style={{ width: pct + "%" }} /></div>
              </div>
            </li>
          ))}
        </ol>
        {!print && d.state === "open" && !ended && (
          <footer className="vote-dash-foot">
            <button type="button" className="primary-button" disabled={p.busy} onClick={() => { if (window.confirm("지금 투표를 마감할까요? 아직 투표하지 않은 사람은 기권으로 처리돼요.")) p.run({ type: "closeTeamVote", projectId: team.id, voteId: v.id }); }}>투표 종료</button>
          </footer>
        )}
        {!print && final && (
          <footer className="vote-dash-foot">
            <button type="button" className="primary-button" onClick={() => setPrinting(true)}><Download size={15} /> PDF로 저장</button>
          </footer>
        )}
      </>
    );
  }
  function startPicking() { setChosen(problems.map((i) => i.id)); setPicking(true); }
  async function openNewVote() {
    if (!picked.length) return;
    if (await p.run({ type: "openTeamVote", projectId: team.id, candidateIds: picked.map((i) => i.id), maxVotes: Math.min(voteLimit, picked.length), ...(voteMinutes ? { minutes: voteMinutes } : {}) })) {
      setPicking(false); setSelectedVoteId(null); setPick(""); setReason(""); setVoteBoard(false);
    }
  }
  // Step 4 board: tapping a card opens all of it in a popup; the vote button is on the card and in the popup.
  const [detailId, setDetailId] = useState<string | null>(null), detailRef = useRef<HTMLDialogElement>(null);
  const detail = detailId ? cards.find((i) => i.id === detailId && i.refinement?.ready) : undefined;
  useEffect(() => { const d = detailRef.current; if (!d) return; if (detail && !d.open) d.showModal(); else if (!detail && d.open) d.close(); }, [detail]);
  function cardAction(i: Idea) {
    if (ended) return null;
    if (vote && voteOpen && vote.data.candidateIds.includes(i.id)) {
      const mineVote = myPicks.includes(i.id), full = !mineVote && maxVotes > 1 && myPicks.length >= maxVotes;
      return <button type="button" className={mineVote ? "primary-button" : "secondary-button vote-btn"} disabled={p.busy || full} title={full ? "고른 카드 하나를 먼저 취소해주세요." : undefined} onClick={(e) => { e.stopPropagation(); castVote(i.id); }}>{mineVote ? <><Check size={14} /> 내 선택 · 취소</> : full ? "표를 다 썼어요" : <><Vote size={14} /> 투표</>}</button>;
    }
    if (leader && vote?.data.state !== "open") return <label className="pad-pick" onClick={(e) => e.stopPropagation()}><input type="radio" name="problem" checked={pick === i.id} onChange={() => setPick(i.id)} /> 확정 후보</label>;
    return null;
  }

  if (history !== null)
    return (
      <section className="steps" aria-label="프로젝트 이력">
        <ProjectTimeline entries={entries} members={w.members} focus={history} onFocus={setHistory} onIdea={p.onIdea} onClose={() => { if (history !== "all") setStep(history); setHistory(null); }} />
      </section>
    );

  // Home: the project and its step buttons, nothing else.
  if (!step)
    return (
      <section className="pj" aria-label="프로젝트 단계">
        <header className="pj-head">
          {p.onBack && <button className="pj-back" onClick={p.onBack}><ArrowLeft size={15} /> 내 프로젝트</button>}
          <h2>{team.name}</h2>
          <p>{team.confirmedProblem ? <><Crown size={14} /> {team.confirmedProblem.statement}</> : "함께 풀 문제를 찾고 있어요. 단계를 눌러 팀원들의 생각을 보고, 내 생각도 남겨요."}</p>
          <div className="pj-members">{members.map((m) => <span key={m.id} title={m.name}><Avatar member={m} />{m.id === team.leaderId && <Crown size={10} />}</span>)}</div>
        </header>
        {(["find", "make"] as const).map((g) => (
          <div key={g} className="pj-group">
            <h3>{g === "find" ? "문제 찾기" : "만들기"}</h3>
            <div className="pj-steps">
              {steps.map((s, i) => s.group === g && (
                <button key={s.key} className={"pj-step" + (progress[s.key].done ? " done" : "")} onClick={() => setStep(s.key)}>
                  <span className="pj-num">{progress[s.key].done ? <Check size={16} /> : i + 1}</span>
                  <strong>{s.name}</strong>
                  <small>{progress[s.key].label}</small>
                  <ArrowRight className="pj-go" size={16} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="pj-history" onClick={() => setHistory("all")}>지금까지의 기록 {entries.length}개 보기</button>
      </section>
    );

  const index = steps.findIndex((s) => s.key === step), spec = steps[index];
  const writable = writeSteps.includes(step);
  const myDone = writable && mine.some((i) => cardDone(step, i));
  const writeLabel = step === "thought" ? (mine.length ? "생각 하나 더 올리기" : "나도 입력하기") : myDone ? "내 카드 고치기" : "나도 입력하기";

  return (
    <section className="pj" aria-label="프로젝트 단계">
      <nav className="pj-bar" aria-label="단계 이동">
        <button className="pj-back" onClick={() => setStep(null)}><ArrowLeft size={15} /> 단계 목록</button>
        <div className="pj-tabs">
          {steps.map((s, i) => (
            <button key={s.key} aria-current={s.key === step ? "step" : undefined} className={(s.key === step ? "on " : "") + (progress[s.key].done ? "done" : "")} onClick={() => setStep(s.key)}>
              {progress[s.key].done ? <Check size={12} /> : i + 1} <span>{s.name}</span>
            </button>
          ))}
        </div>
      </nav>

      <header className="pj-step-head">
        <div>
          <span>STEP {index + 1} · {spec.name}</span>
          <h2>{spec.title}</h2>
          <p>{spec.hint}</p>
        </div>
        {writable && !ended && <div className="pj-write-row">
          {p.makeDraft && <button className="pj-quick" onClick={() => { setQuick(true); setWriting(true); }}><Sparkles size={16} /> 긴 글·파일로 한 번에</button>}
          <button className="pj-write" onClick={() => setWriting(true)}><Plus size={17} /> {writeLabel}</button>
        </div>}
      </header>
      {ended && <p className="steps-note">종료된 기수입니다. 남긴 기록을 둘러보세요.</p>}
      {team.confirmedProblem && step !== "confirm" && <p className="steps-problem"><Crown size={14} /> 확정한 문제 · {team.confirmedProblem.statement}</p>}

      {writable && (
        <div className="pad-board">
          {!ended && (
            <button className="pad-add" onClick={() => setWriting(true)}><Plus size={22} /><strong>{writeLabel}</strong><small>{progress[step].label}</small></button>
          )}
          {cards.filter((i) => reached(step, i)).map((i, n) => {
            const owner = w.members.find((m) => m.id === i.ownerId), done = cardDone(step, i);
            return (
              <article key={i.id} className={"pad-card" + (done ? "" : " waiting") + (i.ownerId === me.id ? " mine" : "")} style={{ background: done ? tones[n % tones.length] : undefined }} role="button" tabIndex={0}
                aria-label={(i.authorName || owner?.name || "팀원") + "의 카드 전체 보기 · " + i.title}
                onClick={() => openCard(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(i); } }}>
                <Owner member={owner} mine={i.ownerId === me.id} author={i.authorName} />
                <CardProgress idea={i} step={step} />
                {canContinue(i) && step !== "thought" && <span className="pad-continue">{cardDone(step, i) ? "눌러서 고치기 · AI 코치" : "눌러서 이어 쓰기 · AI 코치"}</span>}
                {step === "thought" && <><h4>{i.title}</h4><p>{i.body}</p></>}
                {step === "questions" && <><h4>{i.title}</h4><p className="pad-origin">{i.body}</p>{answered(i.refinement) ? (
                  <dl>{questionFields.map(([k, label]) => i.refinement?.answers[k]?.trim() ? <div key={k}><dt>{label}</dt><dd>{i.refinement.answers[k]}</dd></div> : null)}</dl>
                ) : <p className="steps-muted">아직 질문에 답하지 않았어요.</p>}</>}
                {step === "definition" && (done ? <ProblemCard value={i.refinement!} origin={i.title} compact /> : <><h4>{i.title}</h4><p className="pad-origin">{i.body}</p><p className="steps-muted">{answered(i.refinement) === questionFields.length ? "문제 카드를 만드는 중이에요." : "2단계 경험 질문부터 답해야 해요."}</p></>)}
                <footer>
                  {canContinue(i) && <button type="button" className="text-button pad-manage" disabled={p.busy} onClick={(e) => { e.stopPropagation(); startEdit(i); }}><Pencil size={12} /> 고치기</button>}
                  {canDelete(i) && <button type="button" className="text-button pad-manage danger" disabled={p.busy} onClick={(e) => { e.stopPropagation(); void removeCard(i); }}><Trash2 size={12} /> 삭제</button>}
                  <em><MessageCircle size={12} /> 의견 {commentCount(i.id)}</em>
                </footer>
              </article>
            );
          })}
          {!cards.some((i) => reached(step, i)) && <div className="pad-none">아직 이 단계에 온 카드가 없어요. 앞 단계를 마친 카드부터 여기에 올라와요.</div>}
        </div>
      )}
      {writable && (cards.some((i) => !reached(step, i)) || members.some((m) => !cards.some((i) => i.ownerId === m.id))) && (
        <section className="pad-waiting" aria-label="아직 앞 단계에 있는 카드">
          <h4>아직 앞 단계에 있어요</h4>
          <ul>
            {cards.filter((i) => !reached(step, i)).map((i) => {
              const owner = w.members.find((m) => m.id === i.ownerId);
              return <li key={i.id}><button onClick={() => (canContinue(i) ? continueAt("questions", i) : p.onIdea(i.id))}><Avatar member={owner} /><span><strong>{i.title}</strong><small>{i.authorName ? i.authorName + " · 정리 " + (owner?.name || "팀원") : owner?.name}{i.ownerId === me.id ? " · 나" : ""} · 2단계 경험 질문 {answered(i.refinement)}/{questionFields.length}</small></span><em>{i.ownerId === me.id ? "2단계부터 하기" : "앞 단계 진행 중"}</em></button></li>;
            })}
            {members.filter((m) => !cards.some((i) => i.ownerId === m.id)).map((m) => (
              <li key={m.id}><div><Avatar member={m} /><span><strong>{m.name}</strong><small>1단계 생각 카드를 아직 올리지 않았어요</small></span></div></li>
            ))}
          </ul>
        </section>
      )}

      {step === "confirm" && !voteBoard && (
        <div className="vote-list">
          {votes.map((room) => {
            const roomTop = problems.filter((i) => room.data.candidateIds.includes(i.id)).sort((a, b) => (room.data.counts[b.id] || 0) - (room.data.counts[a.id] || 0))[0];
            return <article key={room.id} className={"vote-card " + room.data.state}>
              <span className="vote-card-state">{timeUp(room) ? "시간 종료" : room.data.state === "open" ? "투표 중" + (room.data.endsAt ? " · " + clock(Date.parse(room.data.endsAt) - now) + " 남음" : "") : room.data.state === "closed" ? "투표 마감" : "투표 취소됨"}</span>
              <h3>{room.data.round}번째 투표</h3>
              <p>후보 문제 카드 <b>{room.data.candidateIds.length}장</b> · {room.data.voters}/{members.length}명 참여 · 한 사람당 {room.data.maxVotes || 1}표{room.data.state === "closed" && room.data.abstained !== undefined ? " · 기권 " + room.data.abstained + "명" : ""}</p>
              <small>{new Date(room.data.openedAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} 열림{room.data.closedAt ? " · " + new Date(room.data.closedAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) + (room.data.state === "cancelled" ? " 취소" : " 마감") : ""}</small>
              {room.data.state === "closed" && roomTop && (room.data.counts[roomTop.id] || 0) > 0 && <blockquote><Crown size={13} /> {room.data.counts[roomTop.id]}표 · {statement(roomTop.refinement!)}</blockquote>}
              <div className="vote-card-actions">
                <button type="button" className="primary-button" onClick={() => openVoteBoard(room.id)}>{room.data.state === "open" ? "투표하러 가기" : "카드·결과 보기"} <ArrowRight size={15} /></button>
                {room.ownerId === me.id && room.data.state !== "cancelled" && <button type="button" className="secondary-button" onClick={() => setDashId(room.id)}><BarChart3 size={14} /> 대시보드</button>}
                {leader && !ended && <button type="button" className="secondary-button danger" disabled={p.busy} onClick={() => { if (window.confirm(room.data.round + "번째 투표를 지울까요? 받은 표도 함께 사라지고 되돌릴 수 없어요.")) p.run({ type: "deleteTeamVote", projectId: team.id, voteId: room.id }); }}><Trash2 size={14} /> 투표 삭제</button>}
              </div>
            </article>;
          })}
          {!votes.length && (
            <article className="vote-card empty">
              <span className="vote-card-state">투표 없음</span>
              <h3>아직 열린 투표가 없어요</h3>
              <p>완성된 문제 카드 <b>{problems.length}장</b>{leader ? "" : " · 리더가 투표를 열면 여기서 고를 수 있어요."}</p>
              <div className="vote-card-actions"><button type="button" className="secondary-button" onClick={() => openVoteBoard(null)}>카드 보기 <ArrowRight size={15} /></button></div>
            </article>
          )}
          {leader && !ended && (
            <article className="vote-card new">
              <span className="vote-card-state"><Plus size={12} /> 새 투표</span>
              <h3>새로운 투표 열기</h3>
              <p>기존 투표와 별개로 새 투표방을 열어요. 완성된 문제 카드 <b>{problems.length}장</b> 중에서 투표에 올릴 카드를 골라요.</p>
              <div className="vote-card-actions">
                <button type="button" className="primary-button" disabled={p.busy || !problems.length} onClick={startPicking}><Vote size={15} /> 새 투표 열기</button>
              </div>
            </article>
          )}
        </div>
      )}

      {step === "confirm" && voteBoard && (
        <>
          <button type="button" className="text-button vote-back" onClick={() => setVoteBoard(false)}><ArrowLeft size={14} /> 투표 목록</button>
          {vote && <h3 className="vote-board-title">{vote.data.round}번째 투표{vote.ownerId === me.id && vote.data.state !== "cancelled" && <button type="button" className="secondary-button" onClick={() => setDashId(vote.id)}><BarChart3 size={14} /> 대시보드</button>}</h3>}
          <div className="pj-vote">
            {team.confirmedProblem ? (
              <div className="steps-confirmed">
                <span><Crown size={15} /> 확정한 문제 · 초안 {team.confirmedProblem.draft}</span>
                <blockquote>{team.confirmedProblem.statement}</blockquote>
                <small>{w.members.find((m) => m.id === team.confirmedProblem!.ownerId)?.name}님의 카드 · 이유: {team.confirmedProblem.reason}</small>
                <p className="pj-md">이 카드가 기획 문서 <b>문제와 사용자(product.md)</b>로 저장됐어요. <button type="button" className="primary-button" onClick={() => p.onNavigate("studio", "product", "project-docs")}>md 문서 보기 <ArrowUpRight size={14} /></button></p>
              </div>
            ) : vote && timeUp(vote) ? (
              <p><Check size={16} /> <strong>투표 시간 종료</strong> · 결과를 모으고 있어요.</p>
            ) : vote?.data.state === "open" ? (
              <p><Vote size={16} /> <strong>투표 중</strong>{vote.data.endsAt && <> · 남은 시간 <strong>{clock(Date.parse(vote.data.endsAt) - now)}</strong></>} · {vote.data.voters}/{members.length}명 참여 · 한 사람당 <strong>{maxVotes}표</strong> · 내가 고른 카드 {myPicks.length}/{maxVotes} · 다시 누르면 취소돼요.{fresh.length > 0 && <> · 후보가 아닌 완성 카드 {fresh.length}개{leader ? "" : " (리더가 추가하면 고를 수 있어요)"}</>}</p>
            ) : vote?.data.state === "closed" ? (
              <p><Check size={16} /> <strong>투표 마감</strong> · {vote.data.voters}명 참여 · {leader ? "가장 많이 받은 카드를 골라 두었어요. 이유를 적고 확정하세요." : "리더가 결과를 보고 문제를 확정합니다."}</p>
            ) : (
              <p><Vote size={16} /> {leader ? "모두가 문제 카드를 완성했다면 투표를 열어 주세요." : "리더가 투표를 열면 여기서 고를 수 있어요."} · 문제 카드 {problems.length}개</p>
            )}
            {leader && !ended && (
              vote?.data.state === "open"
                ? <div className="pj-vote-open">
                    {fresh.length > 0 && <button className="secondary-button" disabled={p.busy} onClick={() => p.run({ type: "refreshTeamVote", projectId: team.id, voteId: vote.id })}><Plus size={14} /> 새로 완성된 카드 {fresh.length}개 후보에 추가</button>}
                    <button className="secondary-button" disabled={p.busy} onClick={() => { if (window.confirm("투표를 취소할까요? 지금까지 받은 표는 사라지고, 다시 열면 처음부터 투표해요.")) p.run({ type: "cancelTeamVote", projectId: team.id, voteId: vote.id }); }}>투표 취소</button>
                    <button className="primary-button" disabled={p.busy} onClick={() => p.run({ type: "closeTeamVote", projectId: team.id, voteId: vote.id })}>투표 마감하기</button>
                  </div>
                : <div className="pj-vote-open">
                    <button type="button" className={team.confirmedProblem || vote ? "secondary-button" : "primary-button"} disabled={p.busy || !problems.length} onClick={startPicking}><Vote size={15} /> 새 투표 열기</button>
                  </div>
            )}
          </div>
          <form onSubmit={confirm}>
            <div className="vote-tiles">
              {boardProblems.map((i, n) => {
                const owner = w.members.find((m) => m.id === i.ownerId), chosen = team.confirmedProblem?.ideaId === i.id, mineVote = myPicks.includes(i.id);
                return (
                  <article key={i.id} className={"vote-tile" + (mineVote ? " voted" : "") + (pick === i.id ? " picked" : "") + (chosen ? " chosen" : "")} style={{ ["--accent" as string]: accents[n % accents.length] }} role="button" tabIndex={0} aria-label={(i.authorName || owner?.name || "팀원") + "의 문제 카드 자세히 보기"} onClick={() => setDetailId(i.id)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setDetailId(i.id); } }}>
                    <header>
                      <img src={characterFor(owner).image} alt="" />
                      <strong>{i.authorName || owner?.name || "팀원"}</strong>
                      {i.authorName && <small>정리 {owner?.name || "팀원"}</small>}
                      {chosen ? <span className="tile-flag chosen"><Crown size={12} /> 확정</span> : mineVote ? <span className="tile-flag"><Check size={12} /> 내 선택</span> : vote?.data.state === "closed" ? <span className="tile-flag count">{vote.data.counts[i.id] || 0}표</span> : null}
                    </header>
                    <h3 className="tile-title">{i.title}</h3>
                    <p className="tile-sentence">{statement(i.refinement!)}</p>
                    <footer onClick={(e) => e.stopPropagation()}>
                      <span className="tile-comments"><MessageCircle size={13} /> {commentCount(i.id)}</span>
                      <button type="button" className="tile-more" aria-label="자세히 보기" onClick={() => setDetailId(i.id)}><ChevronDown size={18} /></button>
                      <span className="tile-act">{cardAction(i)}</span>
                    </footer>
                  </article>
                );
              })}
              {!boardProblems.length && <div className="steps-empty"><p>아직 완성된 문제 카드가 없어요.</p><button type="button" className="primary-button" onClick={() => setStep("definition")}>문제 카드 만들러 가기 <ArrowRight size={15} /></button></div>}
            </div>
            <dialog ref={detailRef} className="modal vote-detail" onCancel={() => setDetailId(null)} onClick={(e) => { if (e.target === e.currentTarget) setDetailId(null); }}>
              {detail && (
                <>
                  <div className="vote-detail-head">
                    <Owner member={w.members.find((m) => m.id === detail.ownerId)} mine={detail.ownerId === me.id} author={detail.authorName} />
                    <button type="button" className="icon-button" aria-label="닫기" onClick={() => setDetailId(null)}><X size={20} /></button>
                  </div>
                  <ProblemCard value={detail.refinement!} origin={detail.title} badge={vote?.data.state === "closed" ? <span className="pad-count">{vote.data.counts[detail.id] || 0}표</span> : undefined} />
                  <div className="vote-detail-actions">
                    <button type="button" className="secondary-button" onClick={() => { setDetailId(null); p.onIdea(detail.id); }}><MessageCircle size={14} /> 의견 {commentCount(detail.id)} · 남기기</button>
                    {cardAction(detail)}
                  </div>
                </>
              )}
            </dialog>
            {leader && !ended && problems.length > 0 && vote?.data.state !== "open" && (
              <div className="steps-confirm-bar">
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="이 문제를 고른 이유" aria-label="확정 이유" />
                <button className="primary-button" disabled={p.busy || !pick || !reason.trim()}><Crown size={15} /> {team.confirmedProblem ? "이 문제로 다시 확정" : "이 문제로 확정"}</button>
              </div>
            )}
          </form>
        </>
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

      <div className="pj-nav">
        <button className="text-button" onClick={() => setHistory(step)}>이 단계 기록 보기</button>
        {index > 0 && <button className="secondary-button" onClick={() => setStep(steps[index - 1].key)}>이전 · {steps[index - 1].name}</button>}
        {index < steps.length - 1 && <button className="primary-button" onClick={() => setStep(steps[index + 1].key)}>다음 · {steps[index + 1].name} <ArrowRight size={15} /></button>}
      </div>

      {/* New vote: pick which finished cards go on the ballot. */}
      <dialog ref={pickerRef} className="modal vote-picker" aria-label="투표 후보 고르기" onCancel={() => setPicking(false)} onClose={() => setPicking(false)} onClick={(e) => { if (e.target === e.currentTarget) setPicking(false); }}>
        {picking && (
          <>
            <div className="vote-detail-head">
              <div><h3>투표 후보 고르기</h3><small>투표에 올리지 않을 카드는 체크를 풀어요. 뺀 카드도 완성 카드 목록에는 그대로 남아요.</small></div>
              <button type="button" className="icon-button" aria-label="닫기" onClick={() => setPicking(false)}><X size={20} /></button>
            </div>
            <div className="vote-picker-bar">
              <span><b>{picked.length}</b>/{problems.length}장 선택</span>
              <button type="button" className="text-button" disabled={picked.length === problems.length} onClick={() => setChosen(problems.map((i) => i.id))}>전체 선택</button>
              <button type="button" className="text-button" disabled={!picked.length} onClick={() => setChosen([])}>전체 해제</button>
            </div>
            <ul className="vote-picker-list">
              {problems.map((i) => (
                <li key={i.id}><label><input type="checkbox" checked={chosen.includes(i.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, i.id] : c.filter((x) => x !== i.id)))} /> <span>{i.title}</span></label></li>
              ))}
            </ul>
            <div className="vote-detail-actions">
              <label>투표 시간 <select aria-label="새 투표의 투표 시간" value={voteMinutes} onChange={(e) => setVoteMinutes(Number(e.target.value))} disabled={p.busy}>{voteTimes.map((m) => <option key={m} value={m}>{m ? m + "분" : "제한 없음"}</option>)}</select></label>
              <label>한 사람당 <select aria-label="새 투표의 한 사람당 투표 수" value={Math.min(voteLimit, Math.max(1, picked.length))} onChange={(e) => setVoteLimit(Number(e.target.value))} disabled={p.busy || !picked.length}>{Array.from({ length: Math.max(1, Math.min(10, picked.length)) }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}표</option>)}</select></label>
              <button type="button" className="secondary-button" onClick={() => setPicking(false)}>취소</button>
              <button type="button" className="primary-button" disabled={p.busy || !picked.length} onClick={openNewVote}><Vote size={15} /> {picked.length}장으로 투표 시작</button>
            </div>
          </>
        )}
      </dialog>

      <dialog ref={dashRef} className="vote-dash" aria-label="투표 대시보드" onCancel={() => setDashId(null)} onClose={() => setDashId(null)}>
        {dash && dashBody(dash, false)}
      </dialog>
      {printing && dash && createPortal(<div className="vote-print">{dashBody(dash, true)}</div>, document.body)}

      {/* Writing window: the form, the AI coach and the wall preview for the current step. */}
      <dialog ref={composer} className="pad-composer" onCancel={() => setWriting(false)} onClose={() => setWriting(false)} aria-label={spec.name + " 입력"}>
        {writing && writable && (
          <>
            <header>
              <div><span>{editCard ? "카드 고치기" : quick ? "AI로 한 번에 · 1·2·3단계와 문제 카드" : "STEP " + (index + 1) + " · " + spec.name}</span><h3>{editCard ? "제목과 겪은 일을 고쳐요" : quick ? "긴 글이나 파일로 문제 카드까지 만들어요" : spec.title}</h3></div>
              {!quick && !editCard && step !== "thought" && mine.length > 1 && (
                <select aria-label="이어 쓸 내 카드" value={myCard?.id} onChange={(e) => setSelectedId(e.target.value)} disabled={p.busy}>
                  {mine.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                </select>
              )}
              <button className="icon-button" aria-label="닫기" onClick={() => setWriting(false)}><X size={20} /></button>
            </header>
            {editCard ? (
              <form className="steps-form" onSubmit={saveEdit}>
                <label>무슨 일이었나요?<input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} required disabled={p.busy} /></label>
                <label>언제, 누구에게, 무엇이 불편했나요?<textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={6} maxLength={5000} required disabled={p.busy} /></label>
                <div className="steps-actions">
                  {answered(editCard.refinement) > 0 && <button type="button" className="secondary-button" disabled={p.busy} onClick={() => { const i = editCard; setEditCard(null); continueAt(answered(i.refinement) === questionFields.length ? "definition" : "questions", i); }}>2·3단계 답 고치기</button>}
                  <small>{editCard.refinement?.ready ? "제목·내용을 고치면 문제 카드는 다시 확인 상태가 돼요." : ""}</small>
                  <button className="primary-button" disabled={p.busy || !editTitle.trim() || !editBody.trim() || (editTitle.trim() === editCard.title && editBody.trim() === editCard.body)}>고친 내용 저장</button>
                </div>
              </form>
            ) : quick && p.makeDraft ? (
              <QuickDraft ask={p.makeDraft} member={me} doneLabel="새 카드로 저장하기" onDone={saveDraft} onCancel={() => setWriting(false)} authors={members.map((m) => m.name)} />
            ) : step === "thought" ? (
              <div className={p.askCoach ? "write-grid" : ""}>
                <form className="steps-form" onSubmit={createCard}>
                  <label>무슨 일이었나요?<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="예: 모임에 처음 가면 누구에게 말을 걸지 모르겠어요" disabled={p.busy} /></label>
                  <label>언제, 누구에게, 무엇이 불편했나요?<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} required placeholder="직접 겪은 일을 편하게 적어요. 오른쪽 AI 코치에게 말하듯 답해도 돼요." disabled={p.busy} /></label>
                  <div className="steps-actions"><small>올리면 팀 보드에 바로 보여요.</small><button className="primary-button" disabled={p.busy || !title.trim() || !body.trim()}>보드에 올리기 <ArrowRight size={15} /></button></div>
                </form>
                {p.askCoach && (
                  <div className="write-aside">
                    <AICoach phase="thought" ask={p.askCoach} aiEnabled={p.ai?.enabled} disabled={p.busy} values={{ title, body }} context={{ title, body }} onApply={(k, t) => (k === "title" ? setTitle(t.slice(0, 120)) : setBody(t))} />
                    <CardPreview phase="thought" member={me} title={title} body={body} />
                  </div>
                )}
              </div>
            ) : !myCard ? (
              <div className="steps-empty"><p>먼저 1단계에서 생각 카드를 하나 올려주세요.</p><button className="primary-button" onClick={() => setStep("thought")}>각자 생각 올리기 <ArrowRight size={15} /></button></div>
            ) : step === "definition" && answered(myCard.refinement) !== questionFields.length ? (
              <div className="steps-empty"><p>경험 질문 세 개에 먼저 답해주세요. ({answered(myCard.refinement)}/{questionFields.length})</p><button className="primary-button" onClick={() => setStep("questions")}>경험 구체화로 <ArrowRight size={15} /></button></div>
            ) : myCard.state !== "shared" ? (
              <div className="steps-empty"><p>이 카드는 {myCard.state === "selected" ? "프로젝트 출발 카드로" : "투표·종료로"} 고정되어 고칠 수 없어요.</p><button className="primary-button" onClick={() => setStep("thought")}><Plus size={15} /> 새 생각 올리기</button></div>
            ) : (
              <IdeaRefinement key={myCard.id + step} idea={myCard} editable hasProject teamOnly busy={p.busy} run={p.saveIdea} activePanel={step === "definition" ? "definition" : "questions"} onPanelChange={(panel) => setStep(panel)} coach={p.askCoach} makeCard={p.makeCard} makeDraft={p.makeDraft} aiEnabled={p.ai?.enabled} owner={me} />
            )}
          </>
        )}
      </dialog>
    </section>
  );
}

/** Who wrote the card, at the top where it is seen first; my own cards say so plainly. */
function Owner({ member, mine, author }: { member?: Member; mine: boolean; author?: string }) {
  return (
    <div className="pad-owner">
      <img className="pad-owner-avatar" src={characterFor(member).image} alt="" />
      <strong>{author || member?.name || "팀원"}</strong>
      {author && <small className="pad-by">정리 · {member?.name || "팀원"}</small>}
      {mine && <span className="pad-me">{author ? "내가 정리" : "나"}</span>}
    </div>
  );
}

/** Where a card stands across steps 1–3, and whether it still needs work in the step being viewed. */
function CardProgress({ idea, step }: { idea: Idea; step: StepKey }) {
  const n = answered(idea.refinement), total = questionFields.length, r = idea.refinement;
  const parts: { label: string; state: "done" | "doing" | "todo" }[] = [
    { label: "생각", state: "done" },
    { label: n === total ? "경험" : `경험 ${n}/${total}`, state: n === total ? "done" : n ? "doing" : "todo" },
    { label: "문제 카드", state: r?.ready ? "done" : r?.draft ? "doing" : "todo" },
  ];
  const here = step === "thought" ? 0 : step === "questions" ? 1 : 2, need = parts[here].state !== "done";
  return (
    <div className="pad-progress">
      <span className={"pad-state " + (need ? "need" : "ok")}>{need ? (parts[here].state === "doing" ? "이 단계 작성 중" : "이 단계 해야 해요") : "이 단계 완료"}</span>
      <ol>{parts.map((s, k) => <li key={k} className={s.state + (k === here ? " here" : "")}>{s.state === "done" ? <Check size={10} /> : k + 1} {s.label}</li>)}</ol>
    </div>
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

/** What a member sees first: only the projects they belong to, one button each. */
export function MyProjects({ projects, me, members, busy, onOpen, onLobby }: { projects: Project[]; me: Member; members: Member[]; busy: boolean; onOpen: (p: Project) => void; onLobby: () => void }) {
  return (
    <section className="pj my-projects" aria-label="내 프로젝트">
      <header className="pj-head"><h2>내 프로젝트</h2><p>들어갈 프로젝트를 눌러주세요.</p></header>
      <div className="pj-list">
        {projects.map((p) => (
          <button key={p.id} className="pj-open" disabled={busy} onClick={() => onOpen(p)}>
            <span className="pj-open-tag">{p.leaderId === me.id ? "리더" : "팀원"} · {p.memberIds.length}명</span>
            <strong>{p.name}</strong>
            <small>{p.confirmedProblem?.statement || p.intro || p.problem || "함께 풀 문제를 찾는 중"}</small>
            <span className="pj-open-avatars">{p.memberIds.slice(0, 6).map((id) => <img key={id} className="steps-avatar" src={characterFor(members.find((m) => m.id === id)).image} alt="" />)}</span>
            <span className="pj-open-go">들어가기 <ArrowRight size={16} /></span>
          </button>
        ))}
      </div>
      <button className="pj-history" onClick={onLobby}><Plus size={14} /> 다른 프로젝트 만들기 · 참여하기</button>
    </section>
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
