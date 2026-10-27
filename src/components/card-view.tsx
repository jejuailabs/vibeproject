"use client";
import { AlertCircle, Clock3, Copy, Download, Eye, FileText, HeartCrack, Lightbulb, RotateCcw, Search, Sparkles, Target, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { characterFor } from "@/lib/characters";
import { definitionFields, problemCardMarkdown, problemCardText, questionFields, sentenceFields, statement, type Refinement } from "@/lib/refinement";
import type { Member } from "@/lib/types";

const sentenceReady = (r: Refinement) => sentenceFields.every(([k]) => r.definition[k].trim());

function CardTextDialog({ text, onClose, onDownload }: { text: string; onClose: () => void; onDownload: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), content = useRef<HTMLTextAreaElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("텍스트를 복사했어요.");
    } catch {
      content.current?.focus(); content.current?.select();
      setNotice("복사하지 못했어요. 선택된 텍스트를 직접 복사해주세요.");
    }
  }
  return createPortal(
    <dialog ref={dialog} className="card-text-dialog" aria-label="카드 전체 텍스트"
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      onCancel={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      onClose={(e) => { e.stopPropagation(); onClose(); }}>
      <header><h3>카드 내용 한꺼번에</h3><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></header>
      <textarea ref={content} aria-label="정리된 카드 텍스트" value={text} readOnly spellCheck={false} />
      <div className="card-text-actions">
        <button type="button" className="secondary-button" onClick={copyText}><Copy size={15} /> 텍스트 복사</button>
        <button type="button" className="primary-button" onClick={onDownload}><Download size={15} /> MD 다운로드</button>
      </div>
      <p className="card-text-notice" role="status">{notice}</p>
    </dialog>, document.body,
  );
}

/**
 * The finished problem card as it is exhibited and voted on: the one-sentence problem first, then the same
 * problem laid out piece by piece from the writer's answers, so a reader understands it at a glance.
 */
/** `summary` shows only the one-sentence problem, for boards where every card keeps the same height until opened. */
export function ProblemCard({ value, member, mine, origin, compact, badge, author, summary }: { value: Refinement; member?: Member; mine?: boolean; origin?: string; compact?: boolean; badge?: ReactNode; author?: string; summary?: boolean }) {
  const d = value.definition, a = value.answers;
  const [textOpen, setTextOpen] = useState(false);
  function downloadMarkdown() {
    const title = origin?.trim() || "문제 카드";
    const filename = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100).replace(/[. ]+$/, "") || "문제 카드";
    const url = URL.createObjectURL(new Blob([problemCardMarkdown(value, title, author || member?.name)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = filename + ".md";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const rows: { icon: ReactNode; label: string; text: string; group: "problem" | "why" | "try" }[] = [
    { icon: <UserRound size={14} />, label: "누가 겪나요", text: d.who, group: "problem" },
    { icon: <Clock3 size={14} />, label: "언제, 어떤 상황에서", text: d.situation, group: "problem" },
    { icon: <Search size={14} />, label: "왜 생기나요", text: d.cause, group: "problem" },
    { icon: <AlertCircle size={14} />, label: "어떤 어려움인가요", text: d.difficulty, group: "problem" },
    { icon: <RotateCcw size={14} />, label: "지금은 이렇게 넘겨요", text: a.workaround, group: "why" },
    { icon: <HeartCrack size={14} />, label: "그래서 힘든 점", text: d.why, group: "why" },
    { icon: <Sparkles size={14} />, label: "풀리면 달라지는 것", text: d.change, group: "why" },
    { icon: <Target size={14} />, label: "4주 동안 해볼 범위", text: d.focus, group: "try" },
  ];
  const groups = [["problem", "문제를 나눠 보면"], ["why", "왜 풀어야 하나요"], ["try", "이번에 해볼 것"]] as const;
  return (
    <article className={"problem-card" + (compact ? " compact" : "") + (summary ? " summary" : "") + (mine ? " mine" : "")}>
      <header>
        <span className="problem-card-kicker"><Lightbulb size={13} /> 문제 카드{value.draft ? ` · 초안 ${value.draft}` : ""}</span>
        {badge}
        {(member || author) && <span className="problem-card-author"><img src={characterFor(member).image} alt="" />{author || member!.name}{mine && <b>나</b>}</span>}
      </header>
      <blockquote>{statement(value)}</blockquote>
      {!summary && groups.map(([g, title]) => {
        const list = rows.filter((r) => r.group === g && r.text.trim());
        return list.length ? (
          <section key={g} className={"problem-card-group " + g}>
            <h5>{title}</h5>
            <dl>{list.map((r) => <div key={r.label}><dt>{r.icon}{r.label}</dt><dd>{r.text}</dd></div>)}</dl>
          </section>
        ) : null;
      })}
      {origin && !summary && <footer>출발한 생각 · {origin}</footer>}
      {value.ready && <div className="problem-card-actions"><button type="button" className="secondary-button" onKeyDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setTextOpen(true); }}><FileText size={15} /> 텍스트로 한꺼번에</button></div>}
      {textOpen && <CardTextDialog text={problemCardText(value, origin?.trim() || "문제 카드", author || member?.name)} onClose={() => setTextOpen(false)} onDownload={downloadMarkdown} />}
    </article>
  );
}

/** Live preview of how the card being written appears on the team wall for the current step. */
export function CardPreview({ phase, member, title, body, refinement, author }: { phase: "thought" | "questions" | "definition"; member?: Member; title: string; body?: string; refinement?: Refinement; author?: string }) {
  const answers = refinement ? questionFields.filter(([k]) => refinement.answers[k].trim()) : [];
  if (phase === "definition" && refinement && sentenceReady(refinement))
    return (
      <section className="card-preview" aria-label="팀 벽 미리보기">
        <span className="card-preview-label"><Eye size={13} /> 보드에 이렇게 전시돼요</span>
        <ProblemCard value={refinement} member={member} mine={!author} author={author} origin={title} compact />
      </section>
    );
  return (
    <section className="card-preview" aria-label="팀 벽 미리보기">
      <span className="card-preview-label"><Eye size={13} /> 팀 벽에 이렇게 보여요</span>
      <article className="steps-card mine">
        <header><img className="steps-avatar" src={characterFor(member).image} alt="" /><span><strong>{author || member?.name || "나"}</strong><small>{title.trim() || "제목을 적으면 여기에 보여요"}</small></span></header>
        {phase === "thought" && <p className={body?.trim() ? "" : "steps-muted"}>{body?.trim() || "겪은 일을 적으면 여기에 보여요."}</p>}
        {phase === "questions" && (answers.length ? (
          <dl>{answers.map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{refinement!.answers[k]}</dd></div>)}</dl>
        ) : <p className="steps-muted">답한 질문이 여기에 차례로 보여요.</p>)}
        {phase === "definition" && <p className="steps-muted">질문에 답하고 "AI로 문제 카드 만들기"를 누르면 여기에 문제 카드가 보여요.</p>}
      </article>
    </section>
  );
}

/** Everything written on a card, laid out by step, for reading in full. */
export function RefinementView({ value, origin, member, author }: { value?: Refinement; origin?: string; member?: Member; author?: string }) {
  if (!value) return <p className="card-full-empty">아직 경험 질문에 답하지 않았어요.</p>;
  const asked = questionFields.filter(([k]) => value.answers[k].trim());
  return (
    <div className="card-full">
      {value.draft > 0 && sentenceReady(value) && <ProblemCard value={value} origin={origin} member={member} author={author} />}
      <section>
        <h4>02 · 경험 구체화 <small>{asked.length}/{questionFields.length}</small></h4>
        <dl>{questionFields.map(([k, label]) => <div key={k}><dt>{label}</dt><dd className={value.answers[k].trim() ? "" : "empty"}>{value.answers[k].trim() || "아직 작성하지 않음"}</dd></div>)}</dl>
      </section>
      {value.draft > 0 && !sentenceReady(value) && (
        <section>
          <h4>03 · 문제 카드 <small>초안 {value.draft}</small></h4>
          <dl>{definitionFields.map(([k, label]) => <div key={k}><dt>{label}</dt><dd className={value.definition[k].trim() ? "" : "empty"}>{value.definition[k].trim() || "아직 작성하지 않음"}</dd></div>)}</dl>
        </section>
      )}
    </div>
  );
}
