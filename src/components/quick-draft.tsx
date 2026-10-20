"use client";
import { useState, type ChangeEvent } from "react";
import { FileText, LoaderCircle, Paperclip, RotateCcw, Sparkles, X } from "lucide-react";
import { DRAFT_FILE_BYTES, draftFileTypes, emptyDraft, type DraftAsk, type DraftFields, type DraftFile, type DraftKey } from "@/lib/coaching";
import { emptyRefinement, questionFields, definitionFields, sentenceFields, type Refinement } from "@/lib/refinement";
import type { Member } from "@/lib/types";
import { ProblemCard } from "./card-view";

const labels: Record<DraftKey, string> = {
  title: "1단계 · 무슨 일이었나요?", body: "1단계 · 겪은 일",
  ...Object.fromEntries(questionFields.map(([k, l]) => [k, "2단계 · " + l])),
  ...Object.fromEntries(definitionFields.map(([k, l]) => [k, "3단계 · " + l])),
  sWho: "문제 카드 · 누가", situation: "문제 카드 · 어떤 상황에서", cause: "문제 카드 · 무엇 때문에", difficulty: "문제 카드 · 어떤 어려움",
} as Record<DraftKey, string>;

/** Turns the draft's flat fields into a card refinement, ready when every part of steps 2 and 3 is filled. */
export function draftRefinement(f: DraftFields): Refinement {
  const r = emptyRefinement();
  r.answers = { ...r.answers, who: f.who, whenWhere: f.whenWhere, workaround: f.workaround };
  r.definition = { ...r.definition, why: f.why, change: f.change, focus: f.focus, who: f.sWho, situation: f.situation, cause: f.cause, difficulty: f.difficulty, solutionReviewed: true };
  r.ready = [...questionFields.map(([k]) => r.answers[k]), ...[...definitionFields, ...sentenceFields].map(([k]) => r.definition[k])].every((v) => v.trim());
  return r;
}

const readAs = (file: File, how: "text" | "url") => new Promise<string>((ok, no) => {
  const reader = new FileReader();
  reader.onload = () => ok(String(reader.result));
  reader.onerror = () => no(reader.error);
  if (how === "text") reader.readAsText(file); else reader.readAsDataURL(file);
});

/**
 * One rough text and/or files in, steps 1–3 and the problem card out. Missing parts come back as easy
 * questions; answering them redrafts. Nothing is saved until the writer presses the save button.
 */
export function QuickDraft({ ask, member, initial, doneLabel, onDone, onCancel, authors }: { ask: DraftAsk; member?: Member; initial?: Partial<DraftFields>; doneLabel: string; onDone: (fields: DraftFields, author: string) => Promise<unknown> | void; onCancel?: () => void; authors?: string[] }) {
  const [author, setAuthor] = useState(""), [text, setText] = useState(""), [files, setFiles] = useState<(DraftFile & { size: number })[]>([]);
  const [fields, setFields] = useState<DraftFields | null>(null), [missing, setMissing] = useState<{ field: DraftKey; question: string }[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [error, setError] = useState(""), [engine, setEngine] = useState<"ai" | "basic" | null>(null);

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    setError("");
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    let extra = "";
    const next = [...files];
    for (const f of picked) {
      if (/\.(txt|md|markdown|csv)$/i.test(f.name) || f.type.startsWith("text/")) { extra += "\n\n[" + f.name + "]\n" + (await readAs(f, "text")).slice(0, 15000); continue; }
      if (!draftFileTypes.includes(f.type)) { setError(f.name + " · 지원하지 않는 파일이에요. 텍스트·PDF·사진(png·jpg·webp)만 넣을 수 있어요."); continue; }
      if (next.length >= 3) { setError("PDF·사진은 3개까지 넣을 수 있어요."); break; }
      if (next.reduce((n, x) => n + x.size, 0) + f.size > DRAFT_FILE_BYTES) { setError("파일이 너무 커요. PDF·사진은 합쳐서 3MB까지 넣을 수 있어요."); continue; }
      next.push({ name: f.name, type: f.type, data: await readAs(f, "url"), size: f.size });
    }
    setFiles(next);
    if (extra) setText((t) => (t + extra).slice(0, 20000));
  }

  async function run(redo = false) {
    setBusy(true); setError("");
    try {
      const current = redo ? fields! : initial ? { ...emptyDraft(), ...initial } : undefined;
      const reply = await ask({
        text, files: files.map(({ name, type, data }) => ({ name, type, data })), current,
        answers: redo ? missing.filter((m) => answers[m.field]?.trim()).map((m) => ({ field: m.field, question: m.question, answer: answers[m.field].trim() })) : undefined,
      });
      setEngine(reply.engine); setFields(reply.fields); setMissing(reply.missing); setAnswers({});
    } catch (err) { setError(err instanceof Error ? err.message : "AI가 정리하지 못했어요."); }
    finally { setBusy(false); }
  }

  const card = fields ? draftRefinement(fields) : null;
  const sentence = !!card && sentenceFields.every(([k]) => card.definition[k].trim());
  // Optional for a new card: whose experience this is when someone else (usually an admin) writes it up.
  const authorField = authors && (
    <label className="quick-author">작성자 <small>다른 사람의 이야기를 정리할 때만 적어요. 비우면 내 이름으로 올라가요.</small>
      <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={40} list="quick-authors" placeholder="예: 김지수" disabled={busy} />
      <datalist id="quick-authors">{authors.map((n) => <option key={n} value={n} />)}</datalist>
    </label>
  );
  return (
    <section className="quick-draft" aria-label="긴 글로 한 번에 만들기">
      {!fields ? (
        <>
          {authorField}
          <p className="quick-intro"><Sparkles size={15} /> 겪은 일을 길게, 생각나는 대로 적거나 메모·녹취록·사진·PDF를 넣어주세요. AI가 1·2·3단계를 채우고 문제 카드까지 만들어요. 빠진 부분만 다시 물어봐요.</p>
          <textarea className="quick-text" value={text} onChange={(e) => setText(e.target.value)} rows={9} maxLength={20000} disabled={busy} placeholder={"예: 초등학교 3학년 딸에게 매일 저녁 학습지를 시키려고 하면 꼭 싸우게 돼요. 저도 퇴근하고 피곤해서 까먹는 날이 많고…"} />
          <div className="quick-files">
            <label className="secondary-button"><Paperclip size={14} /> 파일 넣기<input type="file" multiple accept=".txt,.md,.csv,text/plain,application/pdf,image/png,image/jpeg,image/webp" onChange={addFiles} disabled={busy} hidden /></label>
            <small>텍스트·PDF·사진 · PDF·사진은 3개, 합쳐서 3MB까지</small>
            {files.map((f, i) => <span key={i} className="quick-file"><FileText size={12} />{f.name}<button type="button" aria-label={f.name + " 빼기"} onClick={() => setFiles(files.filter((_, k) => k !== i))}><X size={12} /></button></span>)}
          </div>
          <div className="quick-actions">
            {onCancel && <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>닫기</button>}
            <button type="button" className="primary-button" disabled={busy || (!text.trim() && !files.length)} onClick={() => run()}>{busy ? <><LoaderCircle className="spin" size={15} /> AI가 정리하는 중… (10~30초)</> : <><Sparkles size={15} /> AI로 한 번에 정리하기</>}</button>
          </div>
        </>
      ) : (
        <>
          {engine === "basic" && <p className="quick-note">AI가 연결되지 않아 글을 1단계에만 옮겼어요. 아래 질문에 답해 나머지를 채워주세요.</p>}
          {missing.length > 0 && (
            <div className="quick-missing">
              <h5>조금만 더 알려주세요 · {missing.length}개</h5>
              {missing.map((m) => (
                <label key={m.field}><span>{m.question}</span><textarea rows={2} value={answers[m.field] || ""} onChange={(e) => setAnswers({ ...answers, [m.field]: e.target.value })} disabled={busy} placeholder='모르면 "잘 모르겠어요"라고 적어도 돼요' /></label>
              ))}
              <button type="button" className="primary-button" disabled={busy || !missing.some((m) => answers[m.field]?.trim())} onClick={() => run(true)}>{busy ? <><LoaderCircle className="spin" size={15} /> 다시 정리하는 중…</> : <><Sparkles size={15} /> 답하고 다시 정리하기</>}</button>
            </div>
          )}
          {authorField}
          {sentence ? <ProblemCard value={card!} member={member} mine={!author.trim()} author={author.trim() || undefined} origin={fields.title} /> : <p className="quick-note">문제 카드 문장을 만들 내용이 아직 부족해요. 위 질문에 답해주세요.</p>}
          <details className="quick-fields">
            <summary>AI가 채운 1·2·3단계 내용 보기·고치기</summary>
            {(Object.keys(labels) as DraftKey[]).map((k) => (
              <label key={k}>{labels[k]}<textarea rows={k === "body" ? 3 : 2} value={fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} disabled={busy} placeholder="비어 있어요" /></label>
            ))}
          </details>
          <div className="quick-actions">
            <button type="button" className="secondary-button" disabled={busy} onClick={() => { setFields(null); setMissing([]); }}><RotateCcw size={14} /> 처음부터 다시</button>
            <button type="button" className="primary-button" disabled={busy || !fields.title.trim() || !fields.body.trim()} onClick={async () => { setBusy(true); try { await onDone(fields, author.trim()); } finally { setBusy(false); } }}>{doneLabel}{card?.ready ? "" : " (덜 채워진 채로)"}</button>
          </div>
        </>
      )}
      {error && <p className="coach-error" role="alert">{error}</p>}
    </section>
  );
}
