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
  holdInitial?: ReturnType<typeof deferred>;
  records?: WorkshopRecord[];
} = {}) {
  const state = {
    records: structuredClone(options.records ?? initialRecords(options.picks, options.maxVotes)),
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
      if (options.holdInitial) await options.holdInitial.promise;
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

function sharedVoteRecords() {
  const records = initialRecords();
  const target = records[0] as RecordOf<"teamVote">;
  target.data.title = "공유 대상 투표";
  const newer = structuredClone(target);
  newer.id = "vote-newer";
  newer.data.round = 2;
  newer.data.title = "다른 투표";
  return [...records, newer];
}

const sharedUrl = (voteId = "vote-local") => `/?cohort=preview&project=p-onboarding&vote=${voteId}`;

test("share buttons copy a clean exact-vote link that opens after delayed records", async ({ page, context }) => {
  const records = sharedVoteRecords();
  const state = await mockWorkshop(page, { records });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => { (window as Window & { copiedVoteLink?: string }).copiedVoteLink = value; },
    } });
  });
  await page.goto("/?invite=remove-me&unrelated=ignore#section");
  const targetRoom = page.locator('.vote-card[data-vote-id="vote-local"]');
  await targetRoom.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect(targetRoom.getByRole("button", { name: "복사했어요", exact: true })).toBeVisible();
  const copied = await page.evaluate(() => (window as Window & { copiedVoteLink?: string }).copiedVoteLink!);
  const url = new URL(copied);
  expect(url.origin).toBe("http://127.0.0.1:3107");
  expect(Object.fromEntries(url.searchParams)).toEqual({ cohort: "preview", project: "p-onboarding", vote: "vote-local" });
  expect(url.hash).toBe("");
  await targetRoom.getByRole("button", { name: "투표하러 가기", exact: true }).click();
  await page.getByRole("button", { name: "공유하기", exact: true }).click();
  await expect(page.getByRole("button", { name: "복사했어요", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { copiedVoteLink?: string }).copiedVoteLink)).toBe(copied);

  const recipient = await context.newPage();
  const snapshot = deferred();
  const received = await mockWorkshop(recipient, { records, holdInitial: snapshot });
  await recipient.goto(copied);
  await expect(recipient.getByText("공유한 투표를 불러오는 중이에요.", { exact: true })).toBeVisible();
  await expect(recipient.getByText("이 투표는 삭제되었거나 더 이상 볼 수 없어요.", { exact: true })).toHaveCount(0);
  await expect(recipient.locator(".vote-tile")).toHaveCount(0);
  snapshot.resolve();
  await expect(recipient.locator(".vote-board-title")).toContainText("공유 대상 투표");
  await expect(recipient.locator(".vote-tile")).toHaveCount(4);
  await expect(recipient.getByTestId("shared-opens")).toHaveText("1");
  await expect(recipient.getByTestId("shared-commands")).toHaveText("[]");
  await recipient.getByRole("button", { name: "투표 목록", exact: true }).click();
  await expect(recipient.locator(".vote-card[data-vote-id]")).toHaveCount(2);
  await expect(recipient.locator(".vote-board-title")).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
  expect(received.unexpected).toEqual([]);
  await recipient.close();
});

test("share button provides a readonly exact-vote link when clipboard access is denied", async ({ page }) => {
  await mockWorkshop(page, { records: sharedVoteRecords() });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new Error("Clipboard denied in test"); },
    } });
  });
  await page.goto("/?invite=remove-me");
  const room = page.locator('.vote-card[data-vote-id="vote-local"]');
  await room.getByRole("button", { name: "공유하기", exact: true }).click();
  const link = room.getByRole("textbox", { name: "투표 공유 링크", exact: true });
  await expect(link).toHaveAttribute("readonly", "");
  expect(Object.fromEntries(new URL(await link.inputValue()).searchParams)).toEqual({ cohort: "preview", project: "p-onboarding", vote: "vote-local" });
  await link.focus();
  expect(await link.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)).toBe((await link.inputValue()).length);
});

test("shared vote waits for login then switches only an existing project membership", async ({ page }) => {
  const state = await mockWorkshop(page, { records: sharedVoteRecords() });
  await page.addInitScript(() => {
    (window as Window & { voteFixture?: unknown }).voteFixture = { signedOut: true, currentProject: "p-other" };
  });
  await page.goto(sharedUrl());
  await expect(page.getByRole("button", { name: "테스트 로그인", exact: true })).toBeVisible();
  await expect(page.getByTestId("shared-opens")).toHaveText("0");
  await expect(page.getByTestId("shared-commands")).toHaveText("[]");
  expect(state.gets).toBe(0);
  await page.getByRole("button", { name: "테스트 로그인", exact: true }).click();
  await expect(page.getByTestId("active-project")).toHaveText("p-onboarding");
  await expect(page.locator(".vote-board-title")).toContainText("공유 대상 투표");
  await expect(page.getByTestId("shared-commands")).toHaveText('[{"type":"enterProject","projectId":"p-onboarding"}]');
  await expect(page.getByTestId("shared-opens")).toHaveText("1");
  expect(state.unexpected).toEqual([]);
});

test("shared vote refuses nonmembers without entering or joining a project", async ({ page }) => {
  const state = await mockWorkshop(page, { records: sharedVoteRecords() });
  await page.addInitScript(() => {
    (window as Window & { voteFixture?: unknown }).voteFixture = { nonmember: true };
  });
  await page.goto(sharedUrl());
  await expect(page.getByTestId("error")).toHaveText("이 투표를 보려면 해당 프로젝트에 먼저 참여해주세요.");
  await expect(page.getByTestId("active-project")).toHaveText("p-other");
  await expect(page.getByTestId("shared-commands")).toHaveText("[]");
  await expect(page.getByTestId("shared-opens")).toHaveText("0");
  await expect(page.locator(".vote-board-title")).toHaveCount(0);
  expect(state.commands).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("shared vote reports missing or deleted rooms after records finish loading", async ({ page }) => {
  const records = sharedVoteRecords();
  (records[0] as RecordOf<"teamVote">).data.state = "deleted";
  await mockWorkshop(page, { records });
  for (const voteId of ["vote-missing", "vote-local"]) {
    await page.goto(sharedUrl(voteId));
    await expect(page.getByText("이 투표는 삭제되었거나 더 이상 볼 수 없어요.", { exact: true })).toBeVisible();
    await expect(page.locator(".vote-board-title")).toHaveCount(0);
    await expect(page.locator(".vote-tile")).toHaveCount(0);
  }
});
