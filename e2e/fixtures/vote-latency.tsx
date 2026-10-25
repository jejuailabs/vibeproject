"use client";

// This fixture is mounted only by the isolated test server, never by the app.
import { useCallback, useState } from "react";
import type { User } from "firebase/auth";
import { ProjectSteps } from "@/components/project-steps";
import { useWorkshop } from "@/components/workshop/use-workshop";
import { previewWorkspace } from "@/lib/preview";
import type { Workspace } from "@/lib/types";

const users = {
  jun: { uid: "jun", getIdToken: async () => "local-test-jun" } as User,
  seo: { uid: "seo", getIdToken: async () => "local-test-seo" } as User,
};
const noop = () => {};

function workspace(): Workspace {
  const w = previewWorkspace();
  w.me = w.members.find((m) => m.id === "jun")!;
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
  const [data, setData] = useState<Workspace | null>(workspace);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloads, setReloads] = useState(0);
  const [visible, setVisible] = useState(true);
  const reload = useCallback(async () => { setReloads((n) => n + 1); }, []);
  const workshop = useWorkshop({ data, setData, user: users[actor], preview: false,
    cohortId: "preview", reload, setError, setNotice });

  return <main>
    <button type="button" onClick={() => setVisible((shown) => !shown)}>{visible ? "투표 화면 나가기" : "투표 화면 돌아가기"}</button>
    <button type="button" onClick={() => {
      setActor("seo");
      setData((current) => current && ({ ...current, me: current.members.find((m) => m.id === "seo")! }));
    }}>다른 참가자로 전환</button>
    <output data-testid="actor">{actor}</output>
    <output data-testid="reloads">{reloads}</output>
    <output data-testid="notice">{notice}</output>
    <output data-testid="error">{error}</output>
    <output data-testid="saved-picks">{JSON.stringify(workshop.records.find((r) => r.kind === "teamBallot")?.data)}</output>
    {visible && data && <ProjectSteps workspace={data} project={data.projects[0]} {...workshop}
      preview={false} initialStep="confirm" saveIdea={async () => false}
      onStepChange={noop} onIdea={noop} onNavigate={noop} onGallery={noop} />}
  </main>;
}
