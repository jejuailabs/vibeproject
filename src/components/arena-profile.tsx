"use client";
import { ArrowUpRight, Pencil, Lightbulb, MessageCircle, GitBranch } from "lucide-react";
import { characterFor } from "@/lib/characters";
import type { Workspace } from "@/lib/types";
import type { WorkshopRecord } from "@/lib/workshop/model";

type Props = { workspace: Workspace; records: WorkshopRecord[]; space: "me" | "project" | "cohort"; compact?: boolean; onCharacter: () => void; onIdeas: () => void; onStage: (tab: string) => void };
const stages = [ ["발견", "현장 활동", "activities"], ["연결", "투표·팀 구성", "votes"], ["구현", "기획·개발", "studio"], ["공유", "발표·피드백", "showcase"] ];
export function ArenaProfile({ workspace: w, records, space, compact, onCharacter, onIdeas, onStage }: Props) {
  const project = w.projects.find(p => p.id === w.me.projectId);
  const members = w.members.filter(m => m.active && (space !== "project" || !!project && project.memberIds.includes(m.id)));
  const ideas = w.ideas.filter(i => space === "me" ? i.ownerId === w.me.id : space === "project" ? !!project && (i.projectId === project.id || i.id === project.sourceIdeaId) : true);
  const ideaIds = new Set(ideas.map(i => i.id));
  const comments = w.comments.filter(c => ideaIds.has(c.ideaId));
  const changes = w.events.filter(e => ideaIds.has(e.ideaId));
  const documents = records.filter(r => r.kind === "document" && (space === "cohort" || !!project && r.projectId === project.id));
  const week = Math.max(1, Math.min(4, w.cohort.week));
  const label = space === "me" ? w.me.name : space === "project" ? project?.name || "다음 팀의 시작" : w.cohort.name;
  return <section className={"arena-profile" + (compact ? " compact" : "") + (space !== "me" ? " is-squad" : "")} aria-label={space === "me" ? "메이커 프로필과 활동 기록" : "메이커 라인업과 활동 기록"}>
    <div className="arena-portrait-zone">
      <span className="arena-portrait-word" aria-hidden="true">{space === "me" ? "MAKER" : "SQUAD"}</span>
      {space === "me" ? <img className="hero-portrait" src={characterFor(w.me).image} alt={w.me.name + "의 선택한 캐릭터"} fetchPriority="high"/> : <div className="arena-lineup">{members.slice(0, 4).map((m, i) => <div key={m.id} className={"arena-lineup-player player-" + i}><img src={characterFor(m).image} alt={m.name + "의 캐릭터"}/><span>{m.name}</span></div>)}{members.length === 0 && <p className="arena-no-team">함께할 문제를 고르면<br/>우리 팀의 여기가 채워집니다.</p>}</div>}
      <span className="arena-shirt-number" aria-hidden="true">{String(space === "me" ? Math.max(1, w.members.findIndex(m => m.id === w.me.id) + 1) : members.length).padStart(2, "0")}</span>
      {space === "me" && <button className="hero-character-change" onClick={onCharacter}><Pencil size={13}/>프로필 편집</button>}
    </div>
    <div className="arena-season" aria-label={"현재 " + week + "주차, " + stages[week - 1][0]}>
      <span className="arena-overline">THE FOUR WEEK JOURNEY</span>
      <div className="arena-orbit">
        <svg viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="112"/><circle cx="150" cy="150" r="79"/><path className="arena-cross" d="M150 18V282 M18 150H282"/><circle className="arena-current-arc" cx="150" cy="150" r="112" strokeDasharray="160 544" transform={"rotate(" + (-133 + (week - 1) * 90) + " 150 150)"}/></svg>
        <div className="arena-week-number"><strong>{String(week).padStart(2, "0")}</strong><span>현재 주차 · {stages[week - 1][0]}</span></div>
        {stages.map(([name, description, tab], i) => <button key={name} className={"arena-stage stage-" + i + (week === i + 1 ? " current" : "")} onClick={() => onStage(tab)} aria-label={(i + 1) + "주차 " + description}><small>WEEK 0{i + 1}</small><strong>{name}</strong></button>)}
      </div>
      <button className="arena-season-link" onClick={() => onStage(stages[week - 1][2])}>이번 주 활동으로 <ArrowUpRight size={15}/></button>
    </div>
    <div className="arena-identity">
      <span className="arena-overline">{space === "me" ? "PLAYER PROFILE / " + (w.me.role === "participant" ? "MAKER" : "FACILITATOR") : space === "project" ? "PROJECT LINEUP" : "COHORT LINEUP"}</span>
      <h2>{label}</h2><p className="arena-affiliation"><span className="arena-team-mark">V</span>{space === "me" ? project?.name || w.cohort.name : members.length + "명의 메이커 · 함께 만드는 4주"}</p>
      <div className="arena-scores">
        {[[Lightbulb, ideas.length, "생각"], [MessageCircle, comments.length, "의견"], [GitBranch, changes.length, "변화 기록"]].map(([Icon, count, text], i) => { const Symbol = Icon as typeof Lightbulb; return <button key={i} className={"arena-score score-" + i} onClick={onIdeas} aria-label={text + " " + count + "개, 아이디어 보기"}><Symbol size={23}/><span>{text as string}</span><strong>{count as number}<small>개</small></strong></button>; })}
      </div>
      <dl className="arena-facts"><div><dt>{space === "me" ? "참여 역할" : "프로젝트"}</dt><dd>{space === "me" ? w.me.role === "admin" ? "기수 관리자" : w.me.role === "facilitator" ? "퍼실리테이터" : project?.leaderId === w.me.id ? "팀 리더" : "메이커" : space === "project" ? project?.mode === "solo" ? "개인 프로젝트" : "팀 프로젝트" : w.projects.length + "개의 도전"}</dd></div><div><dt>기획 문서</dt><dd>{documents.length}<small>개 기록</small></dd></div><div><dt>지금의 단계</dt><dd>{stages[week - 1][0]}<small>WEEK 0{week}</small></dd></div><div><dt>워크숍</dt><dd>04<small>WEEKS</small></dd></div></dl>
    </div>
  </section>;
}
