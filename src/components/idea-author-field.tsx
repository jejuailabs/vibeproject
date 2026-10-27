"use client";
import { useId } from "react";

export function IdeaAuthorField({ value, onChange, authors = [], disabled, accountName }: {
  value: string; onChange: (value: string) => void; authors?: string[]; disabled?: boolean; accountName?: string;
}) {
  const listId = useId();
  return <label className="quick-author">작성자 · 문제를 제안한 사람
    <small>이름을 고르거나 직접 적어요. 비우면 {accountName || "내 이름"}으로 표시돼요.</small>
    <input aria-label="문제를 제안한 작성자" value={value} onChange={(e) => onChange(e.target.value)} maxLength={40} list={listId} placeholder="예: 김지수" disabled={disabled} />
    <datalist id={listId}>{[...new Set(authors)].map((name) => <option key={name} value={name} />)}</datalist>
  </label>;
}
