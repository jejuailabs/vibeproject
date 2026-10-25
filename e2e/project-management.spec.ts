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
  await expect(management.getByRole("button", { name: "프로젝트 삭제", exact: true })).toHaveCount(0);
});

test("admin deletes a one-member generated project and its member keeps the other project", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const management = page.getByRole("region", { name: "전체 프로젝트 관리", exact: true });
  const room = management.getByRole("article", { name: "투표에서 만들어진 프로젝트 관리 정보", exact: true });
  await room.getByRole("button", { name: "프로젝트 삭제", exact: true }).click();
  await room.getByLabel("삭제 이유", { exact: true }).fill("테스트 중 만들어진 프로젝트 정리");
  await room.getByLabel("삭제할 프로젝트 이름", { exact: true }).fill("다른 방");
  await expect(room.getByRole("button", { name: "삭제 확정", exact: true })).toBeDisabled();
  await room.getByLabel("삭제할 프로젝트 이름", { exact: true }).fill("투표에서 만들어진 프로젝트");
  await room.screenshot({ path: "work/project-delete-confirm.png" });
  await room.getByRole("button", { name: "삭제 확정", exact: true }).click();
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

test("closing the deletion form keeps the project", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const room = page.getByRole("article", { name: "투표에서 만들어진 프로젝트 관리 정보", exact: true });
  const remove = room.getByRole("button", { name: "프로젝트 삭제", exact: true });
  await remove.click();
  await expect(room.getByLabel("삭제할 프로젝트 이름", { exact: true })).toBeVisible();
  await remove.click();
  await expect(room.getByLabel("삭제할 프로젝트 이름", { exact: true })).toHaveCount(0);
  await expect(room).toBeVisible();
});

test("administrator's project home opens the complete management screen", async ({ page }) => {
  await page.goto("/?adminMember=1");
  await page.getByRole("button", { name: "채팅 닫기", exact: true }).click();
  await page.getByRole("button", { name: "프로젝트 공간", exact: true }).click();
  await page.getByRole("region", { name: "내 프로젝트", exact: true }).getByRole("button").filter({ hasText: "첫걸음" }).click();
  await page.getByRole("region", { name: "프로젝트 단계", exact: true }).getByRole("button", { name: "프로젝트 관리", exact: true }).click();
  const management = page.getByRole("region", { name: "전체 프로젝트 관리", exact: true });
  await expect(management).toBeVisible();
  await expect(management.getByRole("article")).toHaveCount(3);
});
