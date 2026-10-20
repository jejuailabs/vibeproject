"use client";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Check, Copy, KeyRound, Link2, Lock, LogIn, Plus, Search, Settings2, Unlock, UserCheck, Users } from "lucide-react";
import type { JoinPolicy, Project, Workspace } from "@/lib/types";
import type { RecordOf, WorkshopRecord } from "@/lib/workshop/model";
import { projectIdsOf } from "@/lib/policy";

const policyLabel: Record<JoinPolicy, string> = { open: "누구나 참여", password: "비밀번호", request: "리더 승인" };
const policyHelp: Record<JoinPolicy, string> = {
  open: "목록에서 누르면 바로 참여합니다.",
  password: "비밀번호를 아는 사람만 참여합니다.",
  request: "참여 신청을 리더가 승인합니다.",
};
const PolicyIcon = ({ policy }: { policy: JoinPolicy }) =>
  policy === "open" ? <Unlock size={13} /> : policy === "password" ? <Lock size={13} /> : <UserCheck size={13} />;

type Props = {
  workspace: Workspace;
  records: WorkshopRecord[];
  busy: boolean;
  preview: boolean;
  invite: { projectId: string; code: string } | null;
  run: (command: unknown) => Promise<boolean>;
  onEnter: () => void;
  onInviteHandled: () => void;
};

export function ProjectLobby({ workspace: w, records, busy, preview, invite, run, onEnter, onInviteHandled }: Props) {
  const me = w.me,
    mine = projectIdsOf(me);
  // Open on the list of existing projects whenever there is one to join; creating is the fallback.
  const [mode, setMode] = useState<"join" | "create">(mine.length || w.projects.some((p) => !mine.includes(p.id) && p.mode !== "solo") ? "join" : "create");
  const [query, setQuery] = useState(""),
    [passwords, setPasswords] = useState<Record<string, string>>({}),
    [copied, setCopied] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState(""),
    [intro, setIntro] = useState(""),
    [capacity, setCapacity] = useState(6),
    [policy, setPolicy] = useState<JoinPolicy>("open"),
    [password, setPassword] = useState("");
  const person = (id: string) => w.members.find((m) => m.id === id);
  const myProjects = w.projects.filter((p) => mine.includes(p.id));
  const others = useMemo(
    () =>
      w.projects
        .filter((p) => !mine.includes(p.id) && p.mode !== "solo")
        .filter((p) => !query || (p.name + " " + (p.intro || p.problem)).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [w.projects, mine, query],
  );
  const pending = new Set(
    records
      .filter((r): r is RecordOf<"join"> => r.kind === "join" && r.ownerId === me.id && r.data.state === "pending")
      .map((r) => r.projectId),
  );
  const active = w.projects.find((p) => p.id === me.projectId);
  const config = records.find(
    (r): r is RecordOf<"project"> => r.kind === "project" && r.projectId === active?.id,
  );
  const inviteLink =
    active && config?.data.inviteCode && typeof location !== "undefined"
      ? location.origin + (preview ? "/preview" : "/") + "?project=" + active.id + "&invite=" + config.data.inviteCode
      : "";
  const invited = invite ? w.projects.find((p) => p.id === invite.projectId) : undefined;
  const [accessPolicy, setAccessPolicy] = useState<JoinPolicy>(active?.joinPolicy || "request"),
    [accessPassword, setAccessPassword] = useState("");

  async function enter(p: Project, extra: Record<string, string> = {}) {
    if (await run({ type: "enterProject", projectId: p.id, ...extra })) onEnter();
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    const ok = await run({
      type: "openProject",
      name: name.trim(),
      intro: intro.trim(),
      capacity,
      joinPolicy: policy,
      ...(policy === "password" ? { password } : {}),
    });
    if (ok) {
      setName("");
      setIntro("");
      setPassword("");
      onEnter();
    }
  }
  async function saveAccess(resetInvite: boolean) {
    if (!active) return;
    const ok = await run({
      type: "projectAccess",
      projectId: active.id,
      joinPolicy: accessPolicy,
      resetInvite,
      ...(accessPolicy === "password" && accessPassword ? { password: accessPassword } : {}),
    });
    if (ok) setAccessPassword("");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("초대 링크를 복사하세요", inviteLink);
    }
  }

  return (
    <section className="lobby" aria-label="프로젝트 만들기와 참여">
      {invite && (
        <div className="lobby-invite" role="status">
          {invited ? (
            mine.includes(invited.id) ? (
              <>
                <span>이미 참여한 프로젝트예요: <strong>{invited.name}</strong></span>
                <button className="primary-button" disabled={busy} onClick={async () => { onInviteHandled(); await enter(invited); }}>들어가기 <ArrowRight size={15} /></button>
              </>
            ) : (
              <>
                <span><Link2 size={16} /> <strong>{invited.name}</strong> 프로젝트에 초대받았어요.</span>
                <button className="primary-button" disabled={busy} onClick={async () => { await enter(invited, { invite: invite.code }); onInviteHandled(); }}>초대 수락하고 참여 <ArrowRight size={15} /></button>
              </>
            )
          ) : (
            <span>초대받은 프로젝트를 찾을 수 없어요. 링크를 다시 확인해주세요.</span>
          )}
        </div>
      )}

      {myProjects.length > 0 && (
        <div className="lobby-block">
          <div className="lobby-heading">
            <span className="lobby-step">내 프로젝트</span>
            <h2>참여 중인 프로젝트 {myProjects.length}개</h2>
            <p>작업할 프로젝트를 골라 들어가세요. 여러 프로젝트에 함께 참여할 수 있어요.</p>
          </div>
          <div className="lobby-mine">
            {myProjects.map((p) => (
              <article key={p.id} className={"lobby-card" + (p.id === me.projectId ? " current" : "")}>
                <header>
                  <span className="lobby-tag">{p.leaderId === me.id ? "리더" : "팀원"}</span>
                  {p.id === me.projectId && <span className="lobby-tag on">지금 작업 중</span>}
                </header>
                <h3>{p.name}</h3>
                <p>{p.intro || p.problem || "소개가 아직 없어요."}</p>
                <footer>
                  <small><Users size={13} /> {p.memberIds.length}명</small>
                  <button className="primary-button" disabled={busy} onClick={() => enter(p)}>
                    {p.id === me.projectId ? "프로젝트로 이동" : "이 프로젝트로 들어가기"} <ArrowRight size={14} />
                  </button>
                </footer>
              </article>
            ))}
          </div>
          {active && active.leaderId === me.id && (
            <div className="lobby-leader">
              <div className="lobby-leader-row">
                <div>
                  <strong>{active.name} 초대하기</strong>
                  <small>초대 링크로 들어오면 비밀번호·승인 없이 바로 참여합니다.</small>
                </div>
                {inviteLink ? (
                  <button className="secondary-button" onClick={copy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "복사했어요" : "초대 링크 복사"}
                  </button>
                ) : (
                  <button className="secondary-button" disabled={busy} onClick={() => run({ type: "projectAccess", projectId: active.id, joinPolicy: active.joinPolicy || "request", resetInvite: true })}>
                    <Link2 size={14} /> 초대 링크 만들기
                  </button>
                )}
                <button className="secondary-button" aria-expanded={settingsOpen} onClick={() => { setAccessPolicy(active.joinPolicy || "request"); setSettingsOpen((v) => !v); }}>
                  <Settings2 size={14} /> 참여 방식
                </button>
              </div>
              {settingsOpen && (
                <div className="lobby-access">
                  <PolicyPicker value={accessPolicy} onChange={setAccessPolicy} name="access-policy" />
                  {accessPolicy === "password" && (
                    <label>
                      {active.joinPolicy === "password" ? "새 비밀번호 (비워두면 기존 비밀번호 유지)" : "비밀번호"}
                      <input type="password" autoComplete="new-password" minLength={4} maxLength={64} value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} />
                    </label>
                  )}
                  <div className="lobby-actions">
                    <button className="text-button" disabled={busy} onClick={() => saveAccess(true)}>초대 링크 새로 만들기</button>
                    <button className="primary-button" disabled={busy} onClick={() => saveAccess(false)}>참여 방식 저장</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="lobby-block">
        <div className="lobby-heading">
          <span className="lobby-step">{myProjects.length ? "다른 프로젝트" : "시작하기"}</span>
          <h2>프로젝트를 만들거나 참여하세요</h2>
        </div>
        <div className="lobby-choice" role="tablist" aria-label="시작 방법">
          <button role="tab" aria-selected={mode === "create"} className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>
            <Plus size={20} /><span><strong>프로젝트 만들기</strong><small>내가 리더가 되어 팀원을 모아요</small></span>
          </button>
          <button role="tab" aria-selected={mode === "join"} className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
            <LogIn size={20} /><span><strong>프로젝트 참여하기</strong><small>만들어진 프로젝트 {others.length}개 중에서 골라요</small></span>
          </button>
        </div>

        {mode === "create" ? (
          <form className="lobby-form" onSubmit={create}>
            <label>
              <span className="lobby-num">1</span> 프로젝트 이름
              <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 우리 동네 모임 길잡이" />
            </label>
            <label>
              <span className="lobby-num">2</span> 한 줄 소개 <em>선택</em>
              <input maxLength={300} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="어떤 불편을 함께 다뤄보고 싶은지 적어주세요" />
            </label>
            <label>
              <span className="lobby-num">3</span> 최대 인원
              <input type="number" min={1} max={100} required value={capacity} onChange={(e) => setCapacity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
              {capacity === 1 && <small>1명이면 혼자 하는 개인 프로젝트가 되고, 다른 사람은 참여할 수 없어요.</small>}
            </label>
            {capacity > 1 && (
              <fieldset>
                <legend><span className="lobby-num">4</span> 참여 방식</legend>
                <PolicyPicker value={policy} onChange={setPolicy} name="create-policy" />
                {policy === "password" && (
                  <label className="lobby-password">
                    참여 비밀번호 <small>4자 이상, 팀원에게 따로 알려주세요</small>
                    <input type="password" autoComplete="new-password" required minLength={4} maxLength={64} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                )}
              </fieldset>
            )}
            <div className="lobby-actions">
              <small>만들면 내가 리더가 되고 초대 링크가 생겨요.</small>
              <button className="primary-button" disabled={busy || !name.trim()}>프로젝트 만들기 <ArrowRight size={15} /></button>
            </div>
          </form>
        ) : (
          <div className="lobby-list">
            <label className="lobby-search">
              <Search size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트 이름이나 소개로 찾기" aria-label="프로젝트 찾기" />
            </label>
            {others.length === 0 ? (
              <div className="lobby-empty">
                <p>{query ? "찾는 프로젝트가 없어요." : "아직 참여할 수 있는 프로젝트가 없어요."}</p>
                <button className="text-button" onClick={() => setMode("create")}>직접 프로젝트 만들기 <ArrowRight size={14} /></button>
              </div>
            ) : (
              others.map((p) => {
                const joinPolicy = p.joinPolicy || "request",
                  full = p.memberIds.length >= (p.capacity || 100),
                  leader = person(p.leaderId);
                return (
                  <article key={p.id} className="lobby-row">
                    <div className="lobby-row-main">
                      <h3>{p.name}</h3>
                      <p>{p.intro || p.problem || "소개가 아직 없어요."}</p>
                      <div className="lobby-meta">
                        <span>리더 {leader?.name || "알 수 없음"}</span>
                        <span><Users size={12} /> {p.memberIds.length}{p.capacity ? " / " + p.capacity : ""}명</span>
                        <span className={"lobby-policy " + joinPolicy}><PolicyIcon policy={joinPolicy} /> {policyLabel[joinPolicy]}</span>
                      </div>
                    </div>
                    <div className="lobby-row-action">
                      {full ? (
                        <span className="lobby-note">정원이 찼어요</span>
                      ) : joinPolicy === "open" ? (
                        <button className="primary-button" disabled={busy} onClick={() => enter(p)}>바로 참여 <ArrowRight size={14} /></button>
                      ) : joinPolicy === "password" ? (
                        <form onSubmit={(e) => { e.preventDefault(); enter(p, { password: passwords[p.id] || "" }); }}>
                          <label className="sr-only" htmlFor={"pw-" + p.id}>{p.name} 참여 비밀번호</label>
                          <KeyRound size={14} aria-hidden="true" />
                          <input id={"pw-" + p.id} type="password" autoComplete="off" placeholder="비밀번호" maxLength={64} value={passwords[p.id] || ""} onChange={(e) => setPasswords({ ...passwords, [p.id]: e.target.value })} />
                          <button className="primary-button" disabled={busy || !passwords[p.id]}>참여</button>
                        </form>
                      ) : pending.has(p.id) ? (
                        <span className="lobby-note">승인 대기 중</span>
                      ) : (
                        <button className="secondary-button" disabled={busy} onClick={() => run({ type: "join", projectId: p.id, message: "" })}>참여 신청</button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PolicyPicker({ value, onChange, name }: { value: JoinPolicy; onChange: (v: JoinPolicy) => void; name: string }) {
  return (
    <div className="lobby-policies">
      {(["open", "password", "request"] as const).map((p) => (
        <label key={p} className={value === p ? "active" : ""}>
          <input type="radio" name={name} value={p} checked={value === p} onChange={() => onChange(p)} />
          <PolicyIcon policy={p} />
          <span><strong>{policyLabel[p]}</strong><small>{policyHelp[p]}</small></span>
        </label>
      ))}
    </div>
  );
}
