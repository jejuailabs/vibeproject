import test from "node:test";
import assert from "node:assert/strict";
import { previewWorkspace } from "../src/lib/preview";
import { previewWorkshop } from "../src/lib/workshop/memory";
import { canRead } from "../src/lib/workshop/core";
import { workshopCommand } from "../src/lib/workshop/commands";
import { baselineArchive } from "../src/lib/workshop/export";
import {
  docKeys,
  type PreviewState,
  type RecordOf,
  type Context,
} from "../src/lib/workshop/model";
import { unzipSync, strFromU8 } from "fflate";
const fresh = (): PreviewState => ({
  workspace: previewWorkspace(),
  records: [],
});
const as = (s: PreviewState, id: string) => ({
  ...s,
  workspace: {
    ...s.workspace,
    me: s.workspace.members.find((m) => m.id === id)!,
  },
});
const run = previewWorkshop;
test("vote freezes candidates, secret ballots enforce budget, self-vote and revision; selection archives only candidates", async () => {
  let s = fresh();
  s = await run(s, {
    type: "openVote",
    title: "Test",
    candidateIds: ["i1", "i3"],
    budget: 1,
    allowSelfVote: false,
    closesAt: "2099-01-01T00:00:00Z",
  });
  const round = s.records.find((r) => r.kind === "round")!;
  assert.equal(
    s.workspace.ideas.find((i) => i.id === "i1")!.state,
    "candidate",
  );
  await assert.rejects(
    run(s, {
      type: "ballot",
      roundId: round.id,
      revision: 0,
      candidateIds: ["i1"],
    }),
    /본인/,
  );
  await assert.rejects(
    run(as(s, "jun"), {
      type: "ballot",
      roundId: round.id,
      revision: 0,
      candidateIds: ["i1", "i3"],
    }),
    /예산/,
  );
  s = await run(as(s, "jun"), {
    type: "ballot",
    roundId: round.id,
    revision: 0,
    candidateIds: ["i1"],
  });
  await assert.rejects(
    run(s, {
      type: "ballot",
      roundId: round.id,
      revision: 0,
      candidateIds: ["i3"],
    }),
    /다른 변경/,
  );
  const ballot = s.records.find((r) => r.kind === "ballot")!;
  assert.equal(
    canRead(
      {
        me: s.workspace.members[0],
        uid: "min",
        now: "",
        grants: [],
      } as unknown as Context,
      ballot,
    ),
    false,
  );
  s = await run(as(s, "min"), {
    type: "closeVote",
    roundId: round.id,
    reason: "close",
  });
  assert.equal(
    (s.records.find((r) => r.kind === "round") as RecordOf<"round">).data.counts
      .i1,
    1,
  );
  await assert.rejects(
    run(as(s, "jun"), {
      type: "ballot",
      roundId: round.id,
      revision: 1,
      candidateIds: ["i3"],
    }),
    /마감/,
  );
  s = await run(as(s, "min"), {
    type: "selectVote",
    roundId: round.id,
    selected: [
      { ideaId: "i1", name: "New project", mode: "team", capacity: 2 },
    ],
    reason: "test selection",
  });
  assert.equal(
    s.workspace.ideas.find((i) => i.id === "i3")!.state,
    "closed_unselected",
  );
  assert.equal(s.workspace.ideas.find((i) => i.id === "i2")!.state, "selected");
  assert.equal(s.workspace.projects.length, 2);
});
test("membership rejects second team, capacity overflow and leader leaving; leave permits a new request", async () => {
  let s = fresh();
  s = await run(s, {
    type: "join",
    projectId: "p-onboarding",
    message: "join",
  });
  const j = s.records.find((r) => r.kind === "join")!;
  s = await run(as(s, "jun"), {
    type: "projectConfig",
    projectId: "p-onboarding",
    mode: "team",
    capacity: 2,
    repositoryUrl: "",
    deployUrl: "",
    firebaseUrl: "",
  });
  await assert.rejects(
    run(s, {
      type: "resolveJoin",
      requestId: j.id,
      accept: true,
      reason: "approve",
    }),
    /정원/,
  );
  s = await run(s, {
    type: "projectConfig",
    projectId: "p-onboarding",
    mode: "team",
    capacity: 3,
    repositoryUrl: "",
    deployUrl: "",
    firebaseUrl: "",
  });
  s = await run(s, {
    type: "resolveJoin",
    requestId: j.id,
    accept: true,
    reason: "approve",
  });
  assert.equal(
    s.workspace.members.find((m) => m.id === "min")!.projectId,
    "p-onboarding",
  );
  await assert.rejects(
    run(as(s, "min"), { type: "join", projectId: "p-onboarding", message: "" }),
    /탈퇴/,
  );
  await assert.rejects(
    run(s, {
      type: "leaveProject",
      projectId: "p-onboarding",
      reason: "leave",
    }),
    /리더/,
  );
  s = await run(as(s, "min"), {
    type: "leaveProject",
    projectId: "p-onboarding",
    reason: "leave",
  });
  s = await run(s, {
    type: "join",
    projectId: "p-onboarding",
    message: "return",
  });
  assert.equal(
    (s.records.find((r) => r.id === j.id) as RecordOf<"join">).data.state,
    "pending",
  );
});
test("documents protect revisions and baselines; restore creates a new draft and ZIP is immutable", async () => {
  let s = as(fresh(), "jun");
  for (const key of docKeys)
    s = await run(s, {
      type: "document",
      projectId: "p-onboarding",
      key,
      revision: 0,
      markdown: "# " + key,
      reason: "initial",
    });
  await assert.rejects(
    run(s, {
      type: "document",
      projectId: "p-onboarding",
      key: "product",
      revision: 0,
      markdown: "stale",
      reason: "stale",
    }),
    /다른 변경/,
  );
  await assert.rejects(
    run(s, {
      type: "baseline",
      projectId: "p-onboarding",
      title: "wrong",
      reason: "wrong",
      revisions: Object.fromEntries(docKeys.map((k) => [k, 0])),
    }),
    /다른 변경/,
  );
  s = await run(s, {
    type: "baseline",
    projectId: "p-onboarding",
    title: "v1",
    reason: "ready",
    revisions: Object.fromEntries(docKeys.map((k) => [k, 1])),
  });
  const baseline = s.records.find(
    (r) => r.kind === "baseline",
  ) as RecordOf<"baseline">;
  const before = await baselineArchive(
    baseline,
    s.records.filter((r) => r.kind === "version") as RecordOf<"version">[],
    "First",
  );
  s = await run(s, {
    type: "document",
    projectId: "p-onboarding",
    key: "product",
    revision: 1,
    markdown: "# changed",
    reason: "change",
  });
  const after = await baselineArchive(
    baseline,
    s.records.filter((r) => r.kind === "version") as RecordOf<"version">[],
    "First",
  );
  assert.deepEqual(before.bytes, after.bytes);
  const zip = unzipSync(before.bytes);
  assert.equal(Object.keys(zip).length, 9);
  assert.equal(strFromU8(zip["docs/product.md"]), "# product");
  s = await run(s, {
    type: "restoreDocument",
    projectId: "p-onboarding",
    versionId: baseline.data.versions[0].id,
    revision: 2,
    reason: "restore",
  });
  assert.equal(
    (
      s.records.find(
        (r) => r.kind === "document" && r.data.key === "product",
      ) as RecordOf<"document">
    ).revision,
    3,
  );
});
test("private data stays private; support expires and revoke removes access", async () => {
  let s = as(fresh(), "jun");
  s = await run(s, {
    type: "document",
    projectId: "p-onboarding",
    key: "product",
    revision: 0,
    markdown: "private",
    reason: "start",
  });
  const doc = s.records.find((r) => r.kind === "document")!,
    admin = s.workspace.members.find((m) => m.id === "min")!,
    c = {
      uid: "min",
      me: admin,
      now: new Date().toISOString(),
      grants: [],
    } as unknown as Context;
  assert.equal(canRead(c, doc), false);
  s = await run(s, {
    type: "support",
    projectId: "p-onboarding",
    memberId: "min",
    edit: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  c.grants = s.records.filter(
    (r) => r.kind === "support",
  ) as RecordOf<"support">[];
  assert.equal(canRead(c, doc), true);
  c.now = "2099-01-01T00:00:00Z";
  assert.equal(canRead(c, doc), false);
  await assert.rejects(
    run(as(s, "min"), {
      type: "document",
      projectId: "p-onboarding",
      key: "product",
      revision: 1,
      markdown: "overwrite",
      reason: "try",
    }),
    /편집/,
  );
  s = await run(s, {
    type: "revokeSupport",
    projectId: "p-onboarding",
    memberId: "min",
  });
  await assert.rejects(
    run(as(s, "min"), {
      type: "document",
      projectId: "p-onboarding",
      key: "product",
      revision: 1,
      markdown: "overwrite",
      reason: "try",
    }),
    /권한/,
  );
});
test("proposals require actual evidence, approve once, and redaction hides derivatives and stays private", async () => {
  let s = fresh();
  s = await run(s, {
    type: "source",
    id: "s1",
    revision: 0,
    title: "Source",
    text: "사람들은 처음 오면 길을 찾기 어렵다.",
    sourceType: "notes",
    scope: "owner",
    projectId: null,
    consent: false,
  });
  await assert.rejects(
    run(s, {
      type: "proposal",
      sourceId: "s1",
      sourceRevision: 1,
      proposalType: "new_idea",
      title: "Guide",
      body: "Build a guide",
      evidence: "invented",
    }),
    /근거/,
  );
  s = await run(s, {
    type: "proposal",
    sourceId: "s1",
    sourceRevision: 1,
    proposalType: "new_idea",
    title: "Guide",
    body: "Build a guide",
    evidence: "길을 찾기 어렵다",
  });
  const proposal = s.records.find((r) => r.kind === "proposal")!;
  assert.equal(s.workspace.ideas.length, 3);
  s = await run(s, {
    type: "resolveProposal",
    proposalId: proposal.id,
    accept: true,
    title: "Guide",
    body: "Build a guide",
  });
  s = await run(s, {
    type: "resolveProposal",
    proposalId: proposal.id,
    accept: true,
    title: "Guide",
    body: "Build a guide",
  });
  assert.equal(s.workspace.ideas.length, 4);
  const derived=s.workspace.ideas.find(i=>i.sourceId==='s1')!;
  derived.refinement=structuredClone(previewWorkspace().ideas[0].refinement!);

  s = await run(s, {
    type: "redactSource",
    sourceId: "s1",
    reason: "Correction",
  });
  assert.equal(
    s.workspace.ideas.find((i) => i.sourceId === "s1")!.state,
    "closed_unselected",
  );
  assert.equal(s.workspace.ideas.find(i=>i.sourceId==='s1')?.refinement?.definition.who,'');
  assert.equal(
    (s.records.find((r) => r.id === proposal.id) as RecordOf<"proposal">).data
      .evidence,
    "",
  );
  assert.equal(
    s.records.find((r) => r.kind === "event" && r.data.targetId === "s1")!
      .scope,
    "owner",
  );
});
test("malformed URL is rejected, last admin protected and completed cohort locked", async () => {
  let s = fresh();
  assert.equal(
    workshopCommand.safeParse({
      type: "resource",
      projectId: "p",
      title: "bad",
      url: "https://",
    }).success,
    false,
  );
  await assert.rejects(
    run(s, {
      type: "memberRole",
      memberId: "min",
      active: false,
      role: "participant",
      reason: "remove",
    }),
    /마지막 관리자/,
  );
  s = await run(s, {
    type: "settings",
    name: "End",
    week: 4,
    mode: "mixed",
    retentionDays: 365,
    startsAt: "",
    notice: "",
    state: "completed",
  });
  await assert.rejects(
    run(s, { type: "help", title: "new", body: "new" }),
    /읽기 전용/,
  );
});
