import { test, expect, type Locator, type Page } from "@playwright/test";

async function fits(page: Page, element?: Locator) {
  expect(await page.evaluate(() => window.innerWidth)).toBe(page.viewportSize()!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (element) {
    const bounds = await element.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    expect(await element.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === "http://127.0.0.1:3108" && !url.pathname.startsWith("/api/") ? route.continue() : route.abort();
  });
  await page.goto("/?mobile=1");
  await expect(page.getByLabel("미리보기 참가자")).toBeVisible();
});

test("mobile navigation can scroll to administration, close, and return to all projects", async ({ page }, info) => {
  const menu = page.getByRole("button", { name: "메뉴 열기", exact: true });
  await fits(page, page.locator(".topbar"));
  const tabs = await page.locator(".space-tabs").boundingBox(), menuBounds = await menu.boundingBox();
  expect(tabs!.y).toBeGreaterThanOrEqual(menuBounds!.y + menuBounds!.height);
  await menu.tap();
  await expect(page.getByRole("button", { name: "메뉴 닫기", exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "전체 프로젝트 관리", exact: true })).toBeVisible();
  await expect(page.locator(".sidebar.mobile-open")).toHaveCount(0);
  await menu.tap();
  await page.getByRole("button", { name: "메뉴 닫기", exact: true }).tap();
  await expect(page.locator(".sidebar.mobile-open")).toHaveCount(0);
  await menu.tap();
  await page.getByRole("button", { name: "메뉴 바깥 영역 닫기", exact: true }).tap({ position: { x: page.viewportSize()!.width - 12, y: 100 } });
  await expect(page.locator(".sidebar.mobile-open")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await menu.tap();
  await page.getByRole("navigation").getByRole("button", { name: "대시보드", exact: true }).tap();
  await page.getByRole("button", { name: "프로젝트 공간", exact: true }).tap();
  const all = page.getByRole("region", { name: "전체 프로젝트", exact: true });
  await expect(all.locator(".pj-open")).toHaveCount(3);
  await fits(page, all);
  await page.screenshot({ path: "work/" + info.project.name + "-projects.png", fullPage: true });
});

test("mobile chat remains usable when the visible screen becomes shorter", async ({ page }, info) => {
  await page.getByRole("button", { name: "채팅 열기 또는 닫기", exact: true }).tap();
  const chat = page.locator(".chat-panel"), input = page.getByLabel("메시지", { exact: true });
  await input.fill("모바일에서 첫 메시지");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).tap();
  await expect(chat.locator(".message").filter({ hasText: "모바일에서 첫 메시지" })).toBeVisible();
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 380 });
  await input.fill("짧아진 화면에서도 전송");
  const send = page.getByRole("button", { name: "메시지 보내기", exact: true });
  const rect = await send.boundingBox();
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(380);
  await send.tap();
  await expect(chat.locator(".message").filter({ hasText: "짧아진 화면에서도 전송" })).toBeInViewport();
  await fits(page, chat);
  await page.screenshot({ path: "work/" + info.project.name + "-chat-short.png" });
  await page.getByRole("button", { name: "채팅 닫기", exact: true }).tap();
  await expect(chat).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("mobile member can create a vote, vote and operate its dashboard", async ({ page }, info) => {
  await page.getByLabel("미리보기 참가자").selectOption("jun");
  await page.locator(".pj-open").filter({ hasText: "첫걸음" }).tap();
  await page.locator(".pj-step").filter({ hasText: "최종 아이디어·투표" }).tap();
  await page.getByRole("button", { name: "새 투표 열기", exact: true }).tap();
  const picker = page.getByRole("dialog", { name: "투표 후보 고르기", exact: true });
  await fits(page, picker);
  await picker.getByLabel("새 투표의 투표 시간").selectOption("4320");
  await picker.getByRole("button", { name: "2장으로 투표 시작", exact: true }).tap();
  await expect(picker).not.toBeVisible();
  const room = page.locator(".vote-card.open");
  await fits(page, room);
  await room.getByRole("button", { name: "투표하러 가기", exact: true }).tap();
  await page.locator(".vote-tile").first().getByRole("button", { name: "투표", exact: true }).tap();
  await expect(page.locator(".pj-vote")).toContainText("내가 고른 카드 1/");
  await page.getByRole("button", { name: "투표 목록", exact: true }).tap();
  await room.getByRole("button", { name: "대시보드", exact: true }).tap();
  const dash = page.getByRole("dialog", { name: "투표 대시보드", exact: true });
  await fits(page, dash);
  await dash.screenshot({ path: "work/" + info.project.name + "-vote-dashboard.png" });
  await dash.getByRole("button", { name: "닫기", exact: true }).tap();
  await expect(dash).not.toBeVisible();
  await room.getByRole("button", { name: "대시보드", exact: true }).tap();
  page.once("dialog", (dialog) => dialog.accept());
  await dash.getByRole("button", { name: "투표 종료", exact: true }).tap();
  await dash.getByRole("button", { name: "닫기", exact: true }).tap();
  const closed = page.locator(".vote-card.closed");
  await closed.getByRole("button", { name: "팀·개별 투표 열기", exact: true }).tap();
  const path = page.getByRole("dialog", { name: "팀·개별 투표", exact: true });
  await fits(page, path);
  await path.getByLabel("닉네임", { exact: true }).fill("모바일 참가자");
  await path.getByRole("button", { name: /팀으로 갈래요/ }).tap();
  await path.getByRole("button", { name: "제출", exact: true }).tap();
  page.once("dialog", (dialog) => dialog.accept());
  await path.getByRole("button", { name: "팀·개별 투표 종료", exact: true }).tap();
  await path.getByRole("button", { name: "닫기", exact: true }).tap();
  await closed.getByRole("button", { name: "프로젝트 참가 받기", exact: true }).tap();
  const join = page.getByRole("dialog", { name: "선정 프로젝트", exact: true });
  await fits(page, join);
  await join.getByRole("button", { name: "참가", exact: true }).first().tap();
  await expect(join.getByRole("button", { name: "참가함 · 취소", exact: true })).toBeVisible();
  await join.screenshot({ path: "work/" + info.project.name + "-participation.png" });
  await join.getByRole("button", { name: "닫기", exact: true }).tap();
});

test("mobile member can write and save a problem card in the scrollable editor", async ({ page }, info) => {
  await page.getByLabel("미리보기 참가자").selectOption("jun");
  await page.locator(".pj-open").filter({ hasText: "첫걸음" }).tap();
  await page.locator(".pj-step").filter({ hasText: "각자 생각" }).tap();
  await page.getByRole("button", { name: "긴 글·파일로 한 번에", exact: true }).tap();
  const editor = page.getByRole("dialog", { name: "각자 생각 입력", exact: true });
  await fits(page, editor);
  await editor.locator(".quick-text").fill("모바일로 모임에 처음 참가할 때 안내 정보를 찾기가 어렵습니다.");
  await editor.getByRole("button", { name: "AI로 한 번에 정리하기", exact: true }).tap();
  await editor.getByText("AI가 채운 1·2·3단계 내용 보기·고치기", { exact: true }).tap();
  const fields = editor.locator(".quick-fields textarea");
  await expect(fields).toHaveCount(12);
  for (let i = 0; i < 12; i++) await fields.nth(i).fill(i === 0 ? "모바일에서 저장한 카드" : "처음 온 사람이 모임 시작 전 안내를 찾지 못하고 기다립니다.");
  await fits(page, editor);
  await editor.screenshot({ path: "work/" + info.project.name + "-editor.png" });
  await editor.getByRole("button", { name: "새 카드로 저장하기", exact: true }).tap();
  await expect(editor).not.toBeVisible();
  await expect(page.locator(".pad-card").filter({ hasText: "모바일에서 저장한 카드" })).toBeVisible();
});
