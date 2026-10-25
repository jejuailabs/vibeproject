"use client";

// This fixture is mounted only by the isolated test server, never by the app.
import { useCallback, useState } from "react";
import type { User } from "firebase/auth";
import { ProjectSteps } from "@/components/project-steps";
import { useWorkshop } from "@/components/workshop/use-workshop";
import { useSharedVote } from "@/components/workshop/use-shared-vote";
import type { SharedVoteTarget } from "@/lib/workshop/vote-link";
import { previewWorkspace } from "@/lib/preview";
import type { Workspace } from "@/lib/types";

const users = {
  jun: { uid: "jun", getIdToken: async () => "local-test-jun" } as User,
  seo: { uid: "seo", getIdToken: async () => "local-test-seo" } as User,
};
const noop = () => {};
type FixtureOptions = { signedOut?: boolean; currentProject?: string; nonmember?: boolean };
const fixtureOptions = () => (window as Window & { voteFixture?: FixtureOptions }).voteFixture ?? {};

function workspace(): Workspace {
  const w = previewWorkspace();
  w.me = w.members.find((m) => m.id === "jun")!;
  const options = fixtureOptions();
  if (options.currentProject || options.nonmember) {
    w.projects.push({ ...w.projects[0], id: "p-other", name: "다른 프로젝트", sourceIdeaId: "" });
    w.me.projectId = options.currentProject || "p-other";
    w.me.projectIds = options.nonmember ? ["p-other"] : ["p-onboarding", "p-other"];
    if (options.nonmember) w.projects[0].memberIds = ["seo"];
  }
  const sample = w.ideas.find((i) => i.refinement?.ready)!;
  w.ideas = ["A", "B", "C", "D"].map((label) => ({
    ...structuredClone(sample),
    id: "card-" + label.toLowerCase(),
    title: "후보 " + label,
    ownerId: "seo",
    scope: "project",
    projectId: "p-onboarding",
  }));
  return w;
}

export default function VoteLatencyFixture() {
  const [actor, setActor] = useState<"jun" | "seo">("jun");
  const [data, setData] = useState<Workspace | null>(() => fixtureOptions().signedOut ? null : workspace());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloads, setReloads] = useState(0);
  const [visible, setVisible] = useState(true);
  const [sharedTarget, setSharedTarget] = useState<SharedVoteTarget | null>(null);
  const [sharedCommands, setSharedCommands] = useState<unknown[]>([]);
  const [sharedOpens, setSharedOpens] = useState(0);
  const reload = useCallback(async () => { setReloads((n) => n + 1); }, []);
  const workshop = useWorkshop({ data, setData, user: data ? users[actor] : null, preview: false,
    cohortId: "preview", reload, setError, setNotice });
  const runShared = useCallback(async (command: unknown) => {
    setSharedCommands((commands) => [...commands, command]);
    const input = command as { type: string; projectId: string };
    if (input.type !== "enterProject") return false;
    setData((current) => current && ({ ...current, me: { ...current.me, projectId: input.projectId } }));
    return true;
  }, []);
  const openShared = useCallback((target: SharedVoteTarget) => {
    setSharedTarget(target);
    setSharedOpens((count) => count + 1);
    setVisible(true);
  }, []);
  useSharedVote({ workspace: data, run: runShared, onOpen: openShared, onError: setError });
  const project = data && (data.projects.find((candidate) => candidate.id === data.me.projectId) || data.projects[0]);

  return <main>
    <button type="button" onClick={() => setVisible((shown) => !shown)}>{visible ? "투표 화면 나가기" : "투표 화면 돌아가기"}</button>
    <button type="button" onClick={() => {
      setActor("seo");
      setData((current) => current && ({ ...current, me: current.members.find((m) => m.id === "seo")! }));
    }}>다른 참가자로 전환</button>
    <output data-testid="actor">{actor}</output>
    {!data && <button type="button" onClick={() => setData(workspace())}>테스트 로그인</button>}
    <output data-testid="shared-commands">{JSON.stringify(sharedCommands)}</output>
    <output data-testid="shared-opens">{sharedOpens}</output>
    <output data-testid="active-project">{data?.me.projectId}</output>
    <output data-testid="reloads">{reloads}</output>
    <output data-testid="notice">{notice}</output>
    <output data-testid="error">{error}</output>
    <output data-testid="saved-picks">{JSON.stringify(workshop.records.find((r) => r.kind === "teamBallot")?.data)}</output>
    {visible && data && project && <ProjectSteps key={project.id} workspace={data} project={project} {...workshop} initialVoteId={sharedTarget?.voteId}
      preview={false} initialStep="confirm" saveIdea={async () => false}
      onStepChange={noop} onIdea={noop} onNavigate={noop} onGallery={noop} />}
  </main>;
}
