import { test, expect, type Page, type Route } from "@playwright/test";
import type { RecordOf, WorkshopRecord } from "../src/lib/workshop/model";

const date = "2026-10-25T00:00:00.000Z";
const ids = ["card-a", "card-b", "card-c", "card-d"];
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

function initialRecords(picks: string[] = [], maxVotes = 3): WorkshopRecord[] {
  const shared = { projectId: "p-onboarding", ownerId: "jun", revision: 1, createdAt: date, updatedAt: date };
  const vote: RecordOf<"teamVote"> = {
    ...shared, id: "vote-local", kind: "teamVote", scope: "project",
    data: { round: 1, state: "open", candidateIds: ids,
      counts: Object.fromEntries(ids.map((id) => [id, Number(picks.includes(id))])),
      voters: Number(picks.length > 0), openedAt: date, closedAt: null, endsAt: null, maxVotes },
  };
  const ballot: RecordOf<"teamBallot"> = {
    ...shared, id: "ballot-local", kind: "teamBallot", scope: "owner",
    data: { round: 1, voteId: vote.id, ideaIds: picks },
  };
  return [vote, ballot];
}

async function mockWorkshop(page: Page, options: {
  picks?: string[];
  maxVotes?: number;
  saveDelay?: number;
  failAt?: number;
  holdSave?: ReturnType<typeof deferred>;
  stalePoll?: ReturnType<typeof deferred>;
} = {}) {
  const state = {
    records: initialRecords(options.picks, options.maxVotes),
    gets: 0, completed: 0, active: 0, maxActive: 0, holdPoll: false,
    commands: [] as { ideaId: string; requestId: string }[],
    unexpected: [] as string[],
  };
  // Every request is either served locally or rejected. No Firebase, AI, storage,
  // or other external service is contacted, including remote avatar images.
  await page.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" || url.port !== "3107") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname !== "/api/workshop") {
      state.unexpected.push(request.method() + " " + url.pathname);
      return route.fulfill({ status: 500, json: { error: "Unexpected test request" } });
    }
    if (request.method() === "GET") {
      state.gets++;
      const records = structuredClone(state.records).filter((record) =>
        record.kind !== "teamBallot" || !request.headers().authorization?.endsWith("local-test-seo"));
      if (state.holdPoll && options.stalePoll) await options.stalePoll.promise;
      return route.fulfill({ json: { records, nextCursor: null, ai: { enabled: false, model: "" } } });
    }
    const body = request.postDataJSON();
    if (body.command?.type !== "castTeamVote") {
      state.unexpected.push(JSON.stringify(body));
      return route.fulfill({ status: 500, json: { error: "Unexpected test command" } });
    }
    state.commands.push({ ideaId: body.command.ideaId, requestId: body.requestId });
    const index = state.commands.length;
    state.active++;
    state.maxActive = Math.max(state.maxActive, state.active);
    if (options.holdSave) await options.holdSave.promise;
    else await delay(options.saveDelay ?? 2500);
    if (index === options.failAt) {
      state.active--;
      state.completed++;
      return route.fulfill({ status: 503, json: { error: "테스트 저장 실패" } });
    }
    const vote = state.records[0] as RecordOf<"teamVote">;
    const ballot = state.records[1] as RecordOf<"teamBallot">;
    const previous = ballot.data.ideaIds ?? [];
    const id = body.command.ideaId as string;
    const picks = previous.includes(id) ? previous.filter((pick) => pick !== id)
      : previous.length < vote.data.maxVotes! ? [...previous, id]
      : vote.data.maxVotes === 1 ? [id] : previous;
    ballot.data.ideaIds = picks;
    ballot.revision++;
    vote.revision++;
    vote.data.counts = Object.fromEntries(ids.map((pick) => [pick, Number(picks.includes(pick))]));
    vote.data.voters = Number(picks.length > 0);
    state.active--;
    state.completed++;
    return route.fulfill({ json: { id: vote.id, records: structuredClone(state.records) } });
  });
  return state;
}

async function enterVote(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "투표하러 가기", exact: true }).click();
  await expect(page.locator(".vote-tile")).toHaveCount(4);
}
const card = (page: Page, label: string) => page.locator(".vote-tile").filter({ has: page.getByRole("heading", { name: new RegExp("후보 " + label) }) });
const choose = (page: Page, label: string) => card(page, label).getByRole("button", { name: "투표", exact: true }).click({ timeout: 700 });
const cancel = (page: Page, label: string) => card(page, label).getByRole("button", { name: "내 선택 · 취소", exact: true }).click({ timeout: 700 });
async function selected(page: Page, labels: string[]) {
  await expect(page.locator(".pj-vote")).toContainText(`내가 고른 카드 ${labels.length}/`, { timeout: 700 });
  for (const label of ["A", "B", "C", "D"]) {
    if (labels.includes(label)) await expect(card(page, label)).toHaveClass(/\bvoted\b/, { timeout: 700 });
    else await expect(card(page, label)).not.toHaveClass(/\bvoted\b/, { timeout: 700 });
  }
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "vote-latency", "Use e2e/vote-latency.config.ts for the isolated local fixture.");
});

test("rapid choices and cancellation respond immediately during 2.5s saves, with no full reload", async ({ page }) => {
  const state = await mockWorkshop(page);
  await enterVote(page);
  const initialGets = state.gets;
  await choose(page, "A");
  await selected(page, ["A"]);
  await choose(page, "B");
  await choose(page, "C");
  await selected(page, ["A", "B", "C"]);
  await expect(card(page, "D").getByRole("button", { name: "표를 다 썼어요", exact: true })).toBeDisabled();
  await cancel(page, "A");
  await selected(page, ["B", "C"]);
  expect(state.completed, "all clicks must be reflected before the first response").toBe(0);
  await expect(page.getByRole("status").filter({ hasText: "투표 저장 중…" })).toBeVisible();
  await expect.poll(() => state.completed, { timeout: 15000 }).toBe(4);
  await expect(page.getByRole("status").filter({ hasText: "투표 저장 중…" })).toHaveCount(0);
  await selected(page, ["B", "C"]);
  expect(state.commands.map((command) => command.ideaId)).toEqual(["card-a", "card-b", "card-c", "card-a"]);
  expect(new Set(state.commands.map((command) => command.requestId)).size).toBe(4);
  expect(state.maxActive).toBe(1);
  expect(state.gets).toBe(initialGets);
  expect(state.unexpected).toEqual([]);
  await expect(page.getByTestId("reloads")).toHaveText("0");
  await expect(page.getByTestId("saved-picks")).toContainText('"ideaIds":["card-b","card-c"]');
});

test("a failed save rolls back unsaved clicks, keeps acknowledged choices, and permits a fresh vote", async ({ page }) => {
  const state = await mockWorkshop(page, { picks: ["card-a"], failAt: 1 });
  await enterVote(page);
  const initialGets = state.gets;
  await choose(page, "B");
  await choose(page, "C");
  await cancel(page, "A");
  await selected(page, ["B", "C"]);
  await expect(page.getByTestId("error")).toHaveText("테스트 저장 실패", { timeout: 5000 });
  await selected(page, ["A"]);
  expect(state.commands.map((command) => command.ideaId)).toEqual(["card-b"]);
  await expect(page.getByRole("status").filter({ hasText: "투표 저장 중…" })).toHaveCount(0);
  await choose(page, "C");
  await selected(page, ["A", "C"]);
  await expect.poll(() => state.completed, { timeout: 5000 }).toBe(2);
  await expect(page.getByTestId("saved-picks")).toContainText('"ideaIds":["card-a","card-c"]');
  await expect(page.getByTestId("error")).toBeEmpty();
  expect(state.gets).toBe(initialGets);
  expect(state.unexpected).toEqual([]);
  await expect(page.getByTestId("reloads")).toHaveText("0");
});

test("a background snapshot started before saving cannot replace the acknowledged vote", async ({ page }) => {
  const save = deferred(), stalePoll = deferred();
  const state = await mockWorkshop(page, { holdSave: save, stalePoll });
  await page.clock.install();
  await enterVote(page);
  const initialGets = state.gets;
  await choose(page, "A");
  await expect.poll(() => state.commands.length).toBe(1);
  state.holdPoll = true;
  await page.clock.fastForward(20000);
  await expect.poll(() => state.gets).toBe(initialGets + 1);
  save.resolve();
  await expect(page.getByTestId("saved-picks")).toContainText('"ideaIds":["card-a"]');
  const oldResponse = page.waitForResponse((response) => response.url().includes("/api/workshop?") && response.request().method() === "GET");
  stalePoll.resolve();
  await oldResponse;
  // Let the response JSON and React state commit before asserting it stays current.
  await page.clock.runFor(1);
  await selected(page, ["A"]);
  await expect(page.getByTestId("saved-picks")).toContainText('"ideaIds":["card-a"]');
  await expect(page.getByTestId("reloads")).toHaveText("0");
  expect(state.unexpected).toEqual([]);
});

test("queued choices finish saving after leaving the vote screen", async ({ page }) => {
  const save = deferred();
  const state = await mockWorkshop(page, { holdSave: save });
  await enterVote(page);
  const initialGets = state.gets;
  await choose(page, "A");
  await choose(page, "B");
  await selected(page, ["A", "B"]);
  await page.getByRole("button", { name: "투표 화면 나가기", exact: true }).click();
  await expect(page.locator(".vote-tile")).toHaveCount(0);
  save.resolve();
  await expect.poll(() => state.completed).toBe(2);
  await expect(page.getByTestId("saved-picks")).toContainText('"ideaIds":["card-a","card-b"]');
  await page.getByRole("button", { name: "투표 화면 돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "투표하러 가기", exact: true }).click();
  await selected(page, ["A", "B"]);
  expect(state.commands.map((command) => command.ideaId)).toEqual(["card-a", "card-b"]);
  expect(state.maxActive).toBe(1);
  expect(state.gets).toBe(initialGets);
  expect(state.unexpected).toEqual([]);
  await expect(page.getByTestId("reloads")).toHaveText("0");
});

test("switching participant discards unsent choices and ignores the previous participant's delayed response", async ({ page }) => {
  const save = deferred();
  const state = await mockWorkshop(page, { holdSave: save });
  await enterVote(page);
  const initialGets = state.gets;
  await choose(page, "A");
  await choose(page, "B");
  await selected(page, ["A", "B"]);
  await expect.poll(() => state.commands.length).toBe(1);
  await page.getByRole("button", { name: "다른 참가자로 전환", exact: true }).click();
  await expect(page.getByTestId("actor")).toHaveText("seo");
  await expect.poll(() => state.gets).toBe(initialGets + 1);
  await selected(page, []);
  const previousActorResponse = page.waitForResponse((response) => response.url().endsWith("/api/workshop") && response.request().method() === "POST");
  save.resolve();
  await (await previousActorResponse).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => state.completed).toBe(1);
  await expect(page.getByTestId("saved-picks")).toBeEmpty();
  await selected(page, []);
  expect(state.commands.map((command) => command.ideaId)).toEqual(["card-a"]);
  await expect(page.getByTestId("notice")).toBeEmpty();
  await expect(page.getByTestId("error")).toBeEmpty();
  await expect(page.getByTestId("reloads")).toHaveText("0");
});
