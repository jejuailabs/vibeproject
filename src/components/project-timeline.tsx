"use client";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { characterFor } from "@/lib/characters";
import { groupNames, groupOrder, kindNames, type EntryKind, type StepKey, type TimelineEntry, type TimelineGroup } from "@/lib/steps";
import type { Member } from "@/lib/types";

const time = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));

type Props = {
  entries: TimelineEntry[];
  members: Member[];
  focus: StepKey | "all";
  onFocus: (focus: StepKey | "all") => void;
  onClose: () => void;
  onIdea: (id: string) => void;
};

export function ProjectTimeline({ entries, members, focus, onFocus, onClose, onIdea }: Props) {
  const [kind, setKind] = useState<EntryKind | "all">("all");
  const kinds = useMemo(() => [...new Set(entries.map((e) => e.kind))], [entries]);
  const shown = entries.filter((e) => (focus === "all" || e.group === focus) && (kind === "all" || e.kind === kind));
  const groups = groupOrder.filter((g) => shown.some((e) => e.group === g));
  const person = (id: string) => members.find((m) => m.id === id);
  return (
    <section className="timeline-panel" aria-label="프로젝트 이력">
      <header className="timeline-panel-head">
        <button className="secondary-button" onClick={onClose}><ArrowLeft size={14} /> 단계로 돌아가기</button>
        <div>
          <h3>{focus === "all" ? "단계별 프로젝트 이력" : groupNames[focus] + " 단계 이력"}</h3>
          <p>카드 저장·의견·팀 대화·회의·결정·할 일·문서·배포를 단계별로 모았어요. 최근 불러온 기록 기준입니다.</p>
        </div>
      </header>
      <div className="timeline-filters" role="group" aria-label="단계 선택">
        <button aria-pressed={focus === "all"} onClick={() => onFocus("all")}>전체 단계 {entries.length}</button>
        {groupOrder.filter((g): g is StepKey => g !== "team" && g !== "none").map((g) => (
          <button key={g} aria-pressed={focus === g} onClick={() => onFocus(g)}>{groupNames[g]} {entries.filter((e) => e.group === g).length}</button>
        ))}
      </div>
      <div className="timeline-filters kinds" role="group" aria-label="기록 종류">
        <button aria-pressed={kind === "all"} onClick={() => setKind("all")}>모든 기록</button>
        {kinds.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{kindNames[k]}</button>)}
      </div>
      {!groups.length && <p className="steps-note">아직 이 조건의 기록이 없어요.</p>}
      {groups.map((g: TimelineGroup) => (
        <div key={g} className="timeline-group">
          <h4>{groupNames[g]} <span>{shown.filter((e) => e.group === g).length}</span></h4>
          <ol>
            {shown.filter((e) => e.group === g).map((e) => {
              const who = person(e.actorId);
              return (
                <li key={e.id} className={"timeline-entry kind-" + e.kind}>
                  <img src={characterFor(who).image} alt="" />
                  <div>
                    <span className="timeline-meta"><em>{kindNames[e.kind]}</em>{who?.name || "팀원"} · <time dateTime={e.at}>{time(e.at)}</time></span>
                    <strong>{e.title}</strong>
                    {e.detail && <p>{e.detail}</p>}
                    {e.ideaId && <button className="text-button" onClick={() => onIdea(e.ideaId!)}>카드·의견 열기</button>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
