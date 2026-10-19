"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle, RotateCcw, Send, Sparkles } from "lucide-react";
import { coachFields, coachQuestion, nextOpenField, type CoachAsk, type CoachPhase, type CoachTurn } from "@/lib/coaching";

type Props = {
  phase: CoachPhase;
  values: Record<string, string>;
  context: { title: string; body: string };
  ask: CoachAsk;
  aiEnabled?: boolean;
  disabled?: boolean;
  onApply: (field: string, text: string) => void;
};

/** Asks one question per field, turns the answer into text for that field, and fills the form only when the writer accepts. */
export function AICoach({ phase, values, context, ask, aiEnabled, disabled, onApply }: Props) {
  const fields = coachFields(phase);
  const [field, setField] = useState(() => nextOpenField(phase, values) || fields[0].key);
  const [turns, setTurns] = useState<CoachTurn[]>(() => [{ role: "coach", text: coachQuestion(phase, field) }]);
  const [answer, setAnswer] = useState(""), [proposal, setProposal] = useState(""), [waiting, setWaiting] = useState(false), [error, setError] = useState("");
  const [engine, setEngine] = useState<"ai" | "basic" | null>(null), [done, setDone] = useState(false);
  const log = useRef<HTMLOListElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [turns, proposal]);
  const label = fields.find((f) => f.key === field)?.label || "";

  function moveTo(next: string) {
    setField(next); setProposal(""); setError(""); setDone(false);
    setTurns((t) => [...t, { role: "coach", text: coachQuestion(phase, next) }]);
  }
  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = answer.trim();
    if (!text || waiting) return;
    const history = turns.slice(-12);
    setTurns((t) => [...t, { role: "me", text }]); setAnswer(""); setProposal(""); setError(""); setWaiting(true);
    try {
      const r = await ask({ phase, field, answer: text, values, context, history });
      setEngine(r.engine);
      setTurns((t) => [...t, { role: "coach", text: r.reply }]);
      if (!r.needsMore && r.suggestion.trim()) setProposal(r.suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 코치가 답하지 못했어요.");
      setAnswer(text);
    } finally { setWaiting(false); }
  }
  function apply() {
    onApply(field, proposal);
    const next = nextOpenField(phase, { ...values, [field]: proposal }, field);
    setTurns((t) => [...t, { role: "me", text: "✓ \"" + label + "\" 칸에 넣었어요" }]);
    setProposal("");
    if (next) moveTo(next);
    else { setDone(true); setTurns((t) => [...t, { role: "coach", text: "모든 칸이 채워졌어요. 왼쪽 입력 내용과 미리보기를 확인하고 저장해주세요. 고치고 싶은 칸은 위에서 골라 다시 이야기해도 돼요." }]); }
  }

  return (
    <aside className="coach" aria-label="AI 코치">
      <header>
        <span className="coach-mark"><Sparkles size={15} /></span>
        <div><strong>AI 코치</strong><small>{(engine || (aiEnabled ? "ai" : "basic")) === "ai" ? "질문에 답하면 AI가 칸에 맞게 다듬어줘요" : "기본 질문 모드 · 서버에 AI 키를 설정하면 AI가 답을 다듬어줘요"}</small></div>
      </header>
      <div className="coach-fields" role="tablist" aria-label="코치와 채울 칸">
        {fields.map((f, i) => (
          <button key={f.key} type="button" role="tab" aria-selected={f.key === field} className={(f.key === field ? "on " : "") + (values[f.key]?.trim() ? "filled" : "")} disabled={waiting} onClick={() => f.key !== field && moveTo(f.key)} title={f.label}>
            {values[f.key]?.trim() ? <Check size={11} /> : i + 1}<span>{f.label.replace(/\?$/, "")}</span>
          </button>
        ))}
      </div>
      <ol className="coach-log" ref={log} aria-live="polite">
        {turns.map((t, i) => <li key={i} className={t.role}>{t.text}</li>)}
        {waiting && <li className="coach wait"><LoaderCircle className="spin" size={14} /> 생각하는 중…</li>}
      </ol>
      {proposal && (
        <div className="coach-proposal">
          <small>“{label}” 칸에 넣을 내용 · 고쳐도 돼요</small>
          <textarea value={proposal} onChange={(e) => setProposal(e.target.value)} rows={Math.min(6, Math.max(2, Math.ceil(proposal.length / 38)))} aria-label="넣을 내용" />
          <div><button type="button" className="secondary-button" onClick={() => setProposal("")}><RotateCcw size={13} /> 다시 말하기</button><button type="button" className="primary-button" disabled={!proposal.trim()} onClick={apply}><Check size={14} /> 이 칸에 넣기</button></div>
        </div>
      )}
      {error && <p className="coach-error" role="alert">{error}</p>}
      {!done && (
        <form className="coach-input" onSubmit={send}>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} maxLength={2000} placeholder={"“" + label + "” · 말하듯 편하게 적어주세요"} disabled={disabled || waiting}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} aria-label="코치에게 답하기" />
          <button className="primary-button" disabled={disabled || waiting || !answer.trim()} aria-label="보내기"><Send size={15} /></button>
        </form>
      )}
    </aside>
  );
}
