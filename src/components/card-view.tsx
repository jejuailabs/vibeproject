"use client";
import { Eye } from "lucide-react";
import { characterFor } from "@/lib/characters";
import { definitionFields, questionFields, statement, type Refinement } from "@/lib/refinement";
import type { Member } from "@/lib/types";

/** Live preview of how the card being written appears on the team wall for the current step. */
export function CardPreview({ phase, member, title, body, refinement }: { phase: "thought" | "questions" | "definition"; member?: Member; title: string; body?: string; refinement?: Refinement }) {
  const answers = refinement ? questionFields.filter(([k]) => refinement.answers[k].trim()) : [];
  return (
    <section className="card-preview" aria-label="팀 벽 미리보기">
      <span className="card-preview-label"><Eye size={13} /> 팀 벽에 이렇게 보여요</span>
      <article className="steps-card mine">
        <header><img className="steps-avatar" src={characterFor(member).image} alt="" /><span><strong>{member?.name || "나"}</strong><small>{title.trim() || "제목을 적으면 여기에 보여요"}</small></span></header>
        {phase === "thought" && <p className={body?.trim() ? "" : "steps-muted"}>{body?.trim() || "겪은 일을 적으면 여기에 보여요."}</p>}
        {phase === "questions" && (answers.length ? (
          <dl>{answers.map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{refinement!.answers[k]}</dd></div>)}</dl>
        ) : <p className="steps-muted">답한 질문이 여기에 차례로 보여요.</p>)}
        {phase === "definition" && refinement && <><blockquote>{statement(refinement)}</blockquote><small className="steps-badge">저장하면 초안 {refinement.draft + 1}</small></>}
      </article>
    </section>
  );
}

/** Everything written on a card, laid out by step, for reading in full. */
export function RefinementView({ value }: { value?: Refinement }) {
  if (!value) return <p className="card-full-empty">아직 다섯 질문에 답하지 않았어요.</p>;
  const asked = questionFields.filter(([k]) => value.answers[k].trim());
  return (
    <div className="card-full">
      <section>
        <h4>02 · 경험 구체화 <small>{asked.length}/5</small></h4>
        <dl>{questionFields.map(([k, label]) => <div key={k}><dt>{label}</dt><dd className={value.answers[k].trim() ? "" : "empty"}>{value.answers[k].trim() || "아직 작성하지 않음"}</dd></div>)}</dl>
      </section>
      {value.draft > 0 && (
        <section>
          <h4>03 · 문제정의 <small>초안 {value.draft}{value.ready ? " · 점검 완료" : ""}</small></h4>
          <blockquote>{statement(value)}</blockquote>
          <dl>{definitionFields.map(([k, label]) => <div key={k}><dt>{label}</dt><dd className={value.definition[k].trim() ? "" : "empty"}>{value.definition[k].trim() || "아직 작성하지 않음"}</dd></div>)}</dl>
        </section>
      )}
    </div>
  );
}
