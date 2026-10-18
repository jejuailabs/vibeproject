"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUpRight, Search } from "lucide-react";
import { characterFor } from "@/lib/characters";
import type { Member, Project } from "@/lib/types";
import type { RecordOf } from "@/lib/workshop/model";

type Showcase = RecordOf<"showcase">;
const date = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
const safeUrl = (url: string) => {
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
};

function People({ ids, members }: { ids: string[]; members: Member[] }) {
  return (
    <span className="exhibit-people">
      {ids.map((id) => {
        const m = members.find((x) => x.id === id);
        return <img key={id} src={characterFor(m).image} alt={m?.name || "팀원"} title={m?.name} />;
      })}
    </span>
  );
}

/** One project's story: first thought → confirmed problem → result, built from the leader's saved snapshot. */
export function ProjectExhibit({ project, showcase, members }: { project?: Project; showcase: Showcase; members: Member[] }) {
  const s = showcase.data, story = s.story, j = story?.journey;
  const name = (id: string | null | undefined) => members.find((m) => m.id === id)?.name || "팀원";
  const demo = safeUrl(s.demoUrl), slides = safeUrl(s.slidesUrl);
  return (
    <article className="exhibit">
      <header className="exhibit-head">
        <span className={"exhibit-state " + s.state}>{s.state === "published" ? "전체 공개" : "팀 초안 · 팀원만 봐요"}</span>
        <h2>{project?.name || "프로젝트"}</h2>
        {project && <div className="exhibit-team"><People ids={project.memberIds} members={members} /><small>{project.memberIds.length}명 · 리더 {name(project.leaderId)}</small></div>}
      </header>
      <ol className="exhibit-flow">
        <li>
          <span className="exhibit-label">01 · 처음 생각</span>
          {story?.origin ? (
            <>
              <strong>{story.origin.title}</strong>
              <p>{story.origin.body}</p>
              <small>{name(story.origin.ownerId)} · {date(story.origin.at)}</small>
            </>
          ) : <p className="exhibit-muted">처음 생각은 팀 안에만 남겨두었어요.</p>}
        </li>
        <li aria-hidden="true" className="exhibit-arrow"><ArrowDown size={16} /></li>
        <li>
          <span className="exhibit-label">02 · 확정한 문제</span>
          <blockquote>{story?.problem.statement || s.problem}</blockquote>
          {story?.problem.draft ? <small>{name(story.problem.ownerId)}님의 초안 {story.problem.draft}{story.problem.reason ? " · 고른 이유: " + story.problem.reason : ""}</small> : null}
        </li>
        <li aria-hidden="true" className="exhibit-arrow"><ArrowDown size={16} /></li>
        <li>
          <span className="exhibit-label">03 · 결과</span>
          <p className="exhibit-solution">{s.solution}</p>
          <div className="exhibit-links">
            {demo && <a href={demo} target="_blank" rel="noopener noreferrer">시연 열기 <ArrowUpRight size={14} /></a>}
            {slides && <a href={slides} target="_blank" rel="noopener noreferrer">발표 자료 <ArrowUpRight size={14} /></a>}
          </div>
        </li>
      </ol>
      {j && (
        <dl className="exhibit-journey">
          {([["팀원", j.members], ["생각 카드", j.cards], ["문제정의 초안", j.drafts], ["회의·자료", j.meetings], ["결정", j.decisions], ["할 일 완료", `${j.tasksDone}/${j.tasks}`], ["기획 문서", `${j.docs}/7`], ["배포", j.releases]] as const).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      {s.milestones.length > 0 && (
        <section className="exhibit-section"><h3>생각이 바뀐 순간</h3><ol>{s.milestones.map((m, i) => <li key={i}>{m}</li>)}</ol></section>
      )}
      <section className="exhibit-section"><h3>배운 점과 다음 계획</h3><p>{s.retrospective}</p>{s.constraints && <p className="exhibit-muted">현재 제약 · {s.constraints}</p>}</section>
    </article>
  );
}

/** Workshop-wide gallery of published exhibitions; opening a tile shows the full story. */
export function ExhibitionGallery({ projects, showcases, members, onWrite }: { projects: Project[]; showcases: Showcase[]; members: Member[]; onWrite?: () => void }) {
  const [query, setQuery] = useState(""), [open, setOpen] = useState<string | null>(null);
  const published = useMemo(
    () => showcases.filter((s) => s.data.state === "published").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [showcases],
  );
  const project = (id: string | null) => projects.find((p) => p.id === id);
  const shown = published.filter((s) => {
    const text = [project(s.projectId)?.name, s.data.story?.problem.statement, s.data.problem, s.data.solution].join(" ").toLowerCase();
    return !query || text.includes(query.toLowerCase());
  });
  const selected = published.find((s) => s.id === open);
  if (selected)
    return (
      <section className="gallery">
        <button className="secondary-button gallery-back" onClick={() => setOpen(null)}><ArrowLeft size={14} /> 갤러리로 돌아가기</button>
        <ProjectExhibit project={project(selected.projectId)} showcase={selected} members={members} />
      </section>
    );
  return (
    <section className="gallery" aria-label="워크숍 전시 갤러리">
      <div className="gallery-bar">
        <p><strong>{published.length}</strong>개 프로젝트 전시 중 · 전체 {projects.length}개 프로젝트</p>
        <label className="gallery-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트·문제·결과로 찾기" aria-label="전시 찾기" /></label>
      </div>
      {!shown.length ? (
        <div className="gallery-empty">
          <p>{query ? "찾는 전시가 없어요." : "아직 공개한 전시가 없어요. 팀이 결과를 공개하면 여기에 모입니다."}</p>
          {onWrite && <button className="primary-button" onClick={onWrite}>우리 팀 전시 만들기</button>}
        </div>
      ) : (
        <div className="gallery-grid">
          {shown.map((s) => {
            const p = project(s.projectId);
            return (
              <button key={s.id} className="gallery-tile" onClick={() => setOpen(s.id)} aria-label={(p?.name || "프로젝트") + " 전시 보기"}>
                <span className="gallery-name">{p?.name || "프로젝트"}</span>
                <span className="gallery-step">문제</span>
                <span className="gallery-problem">{s.data.story?.problem.statement || s.data.problem}</span>
                <span className="gallery-step">결과</span>
                <span className="gallery-solution">{s.data.solution}</span>
                <span className="gallery-foot">{p && <People ids={p.memberIds} members={members} />}<small>전시 보기 <ArrowUpRight size={13} /></small></span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
