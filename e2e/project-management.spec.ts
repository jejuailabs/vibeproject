import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Any accidental API call or external resource is blocked before it leaves
  // the browser. All writes exercised here go only to the preview MemoryStore.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:3108" && !url.pathname.startsWith("/api/")) await route.continue();
    else await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "채팅 닫기", exact: true }).click();
});

test("administrator sees every project and can transfer an unjoined team's leader", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const management = page.getByRole("region", { name: "전체 프로젝트 관리", exact: true });
  await expect(management).toBeVisible();
  await expect(management.getByRole("article")).toHaveCount(3);
  const voted = management.getByRole("article", { name: "투표에서 만들어진 프로젝트 관리 정보", exact: true });
  await expect(voted).toContainText("담당 리더 이준호");
  await expect(voted).toContainText("투표 후 참가 시간 종료로 자동 생성");
  await expect(management.getByRole("heading", { name: "개인 진행 프로젝트", exact: true })).toBeVisible();
  await management.screenshot({ path: "work/project-management-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await management.screenshot({ path: "work/project-management-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });

  const first = management.getByRole("article", { name: "첫걸음 관리 정보", exact: true });
  await first.getByText("구성원 2명", { exact: true }).click();
  await expect(first).toContainText("이준호 (리더), 박서연");
  await first.locator("summary").filter({ hasText: "담당 리더 변경" }).click();
  await first.getByLabel("새 담당 리더", { exact: true }).selectOption("seo");
  await first.getByLabel("결정·변경 이유", { exact: true }).fill("운영자가 담당 리더를 변경합니다.");
  await first.getByRole("button", { name: "리더 변경", exact: true }).click();
  await expect(first).toContainText("담당 리더 박서연");
  await expect(first).toContainText("박서연 (리더)");
  // The management action does not enroll the administrator in that project.
  await page.getByLabel("미리보기 참가자").selectOption("jun");
  await page.getByRole("navigation").getByRole("button", { name: "대시보드", exact: true }).click();
  const card = page.getByRole("region", { name: "내 프로젝트", exact: true }).getByRole("button").filter({ hasText: "첫걸음" });
  await expect(card).toContainText("팀원 · 2명");
  await expect(card).toContainText("담당 리더: 박서연");
});

test("participant sees only memberships, named leader and creation reason", async ({ page }) => {
  await page.getByLabel("미리보기 참가자").selectOption("jun");
  const mine = page.getByRole("region", { name: "내 프로젝트", exact: true });
  await expect(mine).toBeVisible();
  await expect(mine.locator(".pj-open")).toHaveCount(2);
  await expect(mine).not.toContainText("개인 진행 프로젝트");
  const voted = mine.getByRole("button").filter({ hasText: "투표에서 만들어진 프로젝트" });
  await expect(voted).toContainText("담당 리더: 이준호");
  await expect(voted).toContainText("투표 후 참가 시간 종료로 자동 생성");
  await expect(page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true })).toHaveCount(0);
  await expect(mine.locator(".project-delete-button")).toHaveCount(0);
  await mine.screenshot({ path: "work/my-projects-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mine.screenshot({ path: "work/my-projects-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("leader reaches the team's management controls from the project home", async ({ page }) => {
  await page.getByLabel("미리보기 참가자").selectOption("jun");
  await page.getByRole("region", { name: "내 프로젝트", exact: true }).getByRole("button").filter({ hasText: "첫걸음" }).click();
  const steps = page.getByRole("region", { name: "프로젝트 단계", exact: true });
  await expect(steps).toContainText("담당 리더: 이준호");
  await steps.getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const own = page.locator("article#p-onboarding");
  await expect(own).toBeVisible();
  await expect(own.locator("summary").filter({ hasText: "팀장 이관" })).toBeVisible();
});

test("ordinary team member has no management controls", async ({ page }) => {
  await page.getByLabel("미리보기 참가자").selectOption("seo");
  const mine = page.getByRole("region", { name: "내 프로젝트", exact: true });
  await expect(mine.locator(".pj-open")).toHaveCount(1);
  await mine.getByRole("button").filter({ hasText: "첫걸음" }).click();
  const steps = page.getByRole("region", { name: "프로젝트 단계", exact: true });
  await expect(steps).toContainText("담당 리더: 이준호");
  await expect(page.getByRole("button", { name: "프로젝트 관리", exact: true })).toHaveCount(0);
});

test("facilitator can inspect all projects but cannot transfer the leader", async ({ page }) => {
  await page.getByLabel("미리보기 참가자").selectOption("fac");
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const management = page.getByRole("region", { name: "전체 프로젝트 관리", exact: true });
  await expect(management.getByRole("article")).toHaveCount(3);
  await expect(management).toContainText("투표 후 참가 시간 종료로 자동 생성");
  await expect(management.locator("summary").filter({ hasText: "담당 리더 변경" })).toHaveCount(0);
  await expect(management.locator(".project-delete-button")).toHaveCount(0);
});

test("admin deletes a one-member generated project and its member keeps the other project", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const management = page.getByRole("region", { name: "전체 프로젝트 관리", exact: true });
  const room = management.getByRole("article", { name: "투표에서 만들어진 프로젝트 관리 정보", exact: true });
  await management.screenshot({ path: "work/project-delete-icons.png" });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("투표에서 만들어진 프로젝트");
    await dialog.accept();
  });
  await room.getByRole("button", { name: "투표에서 만들어진 프로젝트 프로젝트 삭제", exact: true }).click();
  await expect(room).toHaveCount(0);
  await expect(management.getByRole("article")).toHaveCount(2);
  await page.getByLabel("미리보기 참가자").selectOption("jun");
  await page.getByRole("navigation").getByRole("button", { name: "대시보드", exact: true }).click();
  const mine = page.getByRole("region", { name: "내 프로젝트", exact: true });
  await expect(mine.locator(".pj-open")).toHaveCount(1);
  await expect(mine).toContainText("첫걸음");
  await expect(mine).not.toContainText("투표에서 만들어진 프로젝트");
  await mine.getByRole("button").filter({ hasText: "첫걸음" }).click();
  await expect(page.getByRole("region", { name: "프로젝트 단계", exact: true })).toContainText("첫걸음");
});

test("cancelling deletion keeps the project", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const room = page.getByRole("article", { name: "투표에서 만들어진 프로젝트 관리 정보", exact: true });
  page.once("dialog", (dialog) => dialog.dismiss());
  await room.getByRole("button", { name: "투표에서 만들어진 프로젝트 프로젝트 삭제", exact: true }).click();
  await expect(room).toBeVisible();
});

test("admin dashboard lists and deletes generated projects outside their membership", async ({ page }) => {
  await page.goto("/?adminMember=1");
  await page.getByRole("button", { name: "채팅 닫기", exact: true }).click();
  await page.getByRole("button", { name: "프로젝트 공간", exact: true }).click();
  const mine = page.getByRole("region", { name: "전체 프로젝트", exact: true });
  await expect(mine.locator(".pj-open")).toHaveCount(3);
  await expect(mine.locator(".pj-project-card").filter({ hasText: "투표에서 만들어진 프로젝트" })).toContainText("관리자 조회 · 1명");
  await expect(mine).toContainText("개인 진행 프로젝트");
  const remove = mine.getByRole("button", { name: "투표에서 만들어진 프로젝트 프로젝트 삭제", exact: true });
  await expect(remove).toBeVisible();
  await mine.screenshot({ path: "work/my-projects-admin-trash.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mine.screenshot({ path: "work/all-projects-admin-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(mine.locator(".pj-open")).toHaveCount(2);
  await expect(mine).not.toContainText("투표에서 만들어진 프로젝트");
  await expect(mine).toContainText("첫걸음");
  await expect(page.getByRole("region", { name: "프로젝트 단계", exact: true })).toHaveCount(0);
});

test("admin without any membership still sees all dashboard projects and opens only management information", async ({ page }) => {
  await page.getByRole("button", { name: "프로젝트 공간", exact: true }).click();
  const all = page.getByRole("region", { name: "전체 프로젝트", exact: true });
  await expect(all.locator(".pj-open")).toHaveCount(3);
  await expect(all.locator(".project-delete-button")).toHaveCount(3);
  await all.getByRole("button").filter({ hasText: "투표에서 만들어진 프로젝트" }).click();
  await expect(page.getByRole("article", { name: "투표에서 만들어진 프로젝트 관리 정보", exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "대시보드", exact: true }).click();
  await expect(all.locator(".pj-open")).toHaveCount(3);
  await expect(all.locator(".pj-project-card").filter({ hasText: "투표에서 만들어진 프로젝트" })).toContainText("관리자 조회 · 1명");
});

test("admin dashboard returns from an entered room to the complete project list", async ({ page }) => {
  await page.goto("/?adminMember=1");
  await page.getByRole("button", { name: "채팅 닫기", exact: true }).click();
  await page.getByRole("button", { name: "프로젝트 공간", exact: true }).click();
  const all = page.getByRole("region", { name: "전체 프로젝트", exact: true });
  await all.getByRole("button").filter({ hasText: "첫걸음" }).click();
  await expect(page.getByRole("region", { name: "프로젝트 단계", exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "대시보드", exact: true }).click();
  await expect(all.locator(".pj-open")).toHaveCount(3);
});

test("admin can delete directly from the ordinary project participation list", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트", exact: true }).click();
  const row = page.locator(".lobby-row").filter({ hasText: "투표에서 만들어진 프로젝트" });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "투표에서 만들어진 프로젝트 프로젝트 삭제", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.locator(".lobby-row").filter({ hasText: "첫걸음" })).toBeVisible();
});

test("administrator's project home opens the complete management screen", async ({ page }) => {
  await page.goto("/?adminMember=1");
  await page.getByRole("button", { name: "채팅 닫기", exact: true }).click();
  await page.getByRole("button", { name: "프로젝트 공간", exact: true }).click();
  await page.getByRole("region", { name: "전체 프로젝트", exact: true }).getByRole("button").filter({ hasText: "첫걸음" }).click();
  await page.getByRole("region", { name: "프로젝트 단계", exact: true }).getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const management = page.getByRole("region", { name: "전체 프로젝트 관리", exact: true });
  await expect(management).toBeVisible();
  await expect(management.getByRole("article")).toHaveCount(3);
});
