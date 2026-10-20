"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle, Send, Sparkles } from "lucide-react";
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

/**
 * Asks one easy question at a time, fitted to what the writer already said. When the answers cover what a field
 * needs, the text goes into that field (the writer can still edit it) and the coach moves to the next empty field.
 */
export function AICoach({ phase, values, context, ask, aiEnabled, disabled, onApply }: Props) {
  const fields = coachFields(phase);
  const [field, setField] = useState(() => nextOpenField(phase, values) || fields[0].key);
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [answer, setAnswer] = useState(""), [waiting, setWaiting] = useState(false), [error, setError] = useState("");
  const [engine, setEngine] = useState<"ai" | "basic" | null>(null), [done, setDone] = useState(false);
  const log = useRef<HTMLOListElement>(null), started = useRef(false);
  // Only this field's turns go to the coach, so its follow-up questions stay about this field.
  const fieldStart = useRef(0);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [turns, waiting]);
  const label = fields.find((f) => f.key === field)?.label || "";

  async function open(next: string, latest: Record<string, string>) {
    setField(next); setError(""); setDone(false); setWaiting(true);
    let question = coachQuestion(phase, next);
    try {
      const r = await ask({ phase, field: next, action: "open", values: latest, context: { ...context, ...(phase === "thought" ? { title: latest.title ?? context.title, body: latest.body ?? context.body } : {}) }, history: [] });
      setEngine(r.engine); question = r.reply || question;
    } catch { /* keep the default question */ }
    setTurns((t) => { fieldStart.current = t.length; return [...t, { role: "coach", text: question }]; });
    setWaiting(false);
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void open(field, values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = answer.trim();
    if (!text || waiting) return;
    const history = turns.slice(fieldStart.current).slice(-16);
    setTurns((t) => [...t, { role: "me", text }]); setAnswer(""); setError(""); setWaiting(true);
    try {
      const r = await ask({ phase, field, action: "answer", answer: text, values, context, history });
      setEngine(r.engine);
      if (r.needsMore || !r.suggestion.trim()) {
        setTurns((t) => [...t, { role: "coach", text: r.reply }]);
        setWaiting(false);
        return;
      }
      onApply(field, r.suggestion);
      setTurns((t) => [...t, { role: "coach", text: "✓ “" + label + "” 칸에 넣었어요. 왼쪽에서 고칠 수 있어요." }]);
      const latest = { ...values, [field]: r.suggestion };
      const next = nextOpenField(phase, latest, field);
      if (next) await open(next, latest);
      else {
        setDone(true); setWaiting(false);
        setTurns((t) => [...t, { role: "coach", text: "이 단계 질문이 다 채워졌어요. 왼쪽 내용을 확인하고 저장해주세요. 고치고 싶은 칸은 위에서 골라 다시 이야기해도 돼요." }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 코치가 답하지 못했어요.");
      setAnswer(text); setWaiting(false);
    }
  }

  return (
    <aside className="coach" aria-label="AI 코치">
      <header>
        <span className="coach-mark"><Sparkles size={15} /></span>
        <div><strong>AI 코치</strong><small>{(engine || (aiEnabled ? "ai" : "basic")) === "ai" ? "질문에 답하면 AI가 칸을 채우고 다음으로 넘어가요" : "기본 질문 모드 · AI가 연결되지 않았어요"}</small></div>
      </header>
      <div className="coach-fields" role="tablist" aria-label="코치와 채울 칸">
        {fields.map((f, i) => (
          <button key={f.key} type="button" role="tab" aria-selected={f.key === field} className={(f.key === field ? "on " : "") + (values[f.key]?.trim() ? "filled" : "")} disabled={waiting} onClick={() => f.key !== field && open(f.key, values)} title={f.label}>
            {values[f.key]?.trim() ? <Check size={11} /> : i + 1}<span>{f.label.replace(/\?$/, "")}</span>
          </button>
        ))}
      </div>
      <ol className="coach-log" ref={log} aria-live="polite">
        {turns.map((t, i) => <li key={i} className={t.role}>{t.text}</li>)}
        {waiting && <li className="coach wait"><LoaderCircle className="spin" size={14} /> 생각하는 중…</li>}
      </ol>
      {error && <p className="coach-error" role="alert">{error}</p>}
      {!done && (
        <form className="coach-input" onSubmit={send}>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} maxLength={2000} placeholder="말하듯 편하게 답해주세요" disabled={disabled || waiting}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} aria-label="코치에게 답하기" />
          <button className="primary-button" disabled={disabled || waiting || !answer.trim()} aria-label="보내기"><Send size={15} /></button>
        </form>
      )}
    </aside>
  );
}
