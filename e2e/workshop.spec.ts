import { test, expect, type Page } from "@playwright/test";
function action(page: Page, label: string) {
  return page
    .locator("details.wk-action")
    .filter({ has: page.locator("summary").filter({ hasText: label }) })
    .first();
}
async function open(page: Page, label: string) {
  const a = action(page, label);
  await a.locator("summary").first().click();
  return a;
}
async function submit(a: ReturnType<typeof action>, label = "저장") {
  await a.getByRole("button", { name: label, exact: true }).click();
}
async function tab(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "워크숍 기능" })
    .getByRole("button", { name: label, exact: false })
    .click();
}
test("activities collect revisions and projector hides private submissions", async ({
  page,
}) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "워크숍 진행", exact: true }).click();
  let a = await open(page, "새 활동 열기");
  await a.getByLabel("제목", { exact: true }).fill("현장 질문");
  await a.getByLabel("함께 생각할 질문").fill("오늘 가장 불편했던 순간은?");
  await a.getByLabel("결정·변경 이유").fill("첫 발견");
  await submit(a);
  await expect(
    page.getByRole("heading", { name: "현장 질문", exact: true }),
  ).toBeVisible();
  a = await open(page, "내 활동 결과 정리");
  await a.getByLabel("내용", { exact: true }).fill("나만 보관하는 이야기");
  await a.getByLabel("공개 범위").selectOption("owner");
  await submit(a);
  await expect(
    page.locator(".wk-note").getByText("나만 보관하는 이야기"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "전체 공유 화면", exact: true })
    .click();
  await expect(page.locator(".wk-projector")).toBeVisible();
  await expect(
    page.locator(".wk-projector").getByText("나만 보관하는 이야기"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "프로젝터 종료" }).click();
  await page.screenshot({
    path: "work/workshop/activities-desktop.png",
    fullPage: true,
  });
});
test("solo project completes planning, baseline ZIP, development, release and showcase", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/preview");
  await page.getByRole("button", { name: "워크숍 진행", exact: true }).click();
  await tab(page, "투표·팀 구성");
  let a = await open(page, "개인 프로젝트 만들기");
  await a.getByLabel("내가 전체에 공유한 아이디어").selectOption("i1");
  await a.getByLabel("프로젝트 이름").fill("함께 시작");
  await a.getByLabel("결정·변경 이유").fill("작게 시작");
  await submit(a);
  await tab(page, "기획·개발");
  await expect(
    page.getByRole("heading", { name: "함께 시작 · 제작실" }),
  ).toBeVisible();
  const names = [
    "문제와 사용자",
    "기능과 범위",
    "화면과 흐름",
    "디자인 정의",
    "데이터와 권한",
    "개발 환경·배포",
    "완료 기준",
  ];
  for (const name of names) {
    await page
      .locator(".wk-doc-tabs")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    a = action(page, name + " · r");
    await a
      .getByLabel("Markdown 문서")
      .fill("# " + name + "\n\n테스트 프로젝트를 구현한다.");
    await a.getByLabel("결정·변경 이유").fill("범위 정의");
    await submit(a, "문서 저장");
    await expect(a.getByText("저장되었습니다.", { exact: true })).toBeVisible();
  }
  a = await open(page, "7개 문서 버전 확정");
  await a.getByLabel("결정·변경 이유").fill("개발 착수");
  await submit(a, "기준 버전 확정");
  await expect(
    page
      .locator(".wk-baseline")
      .getByText("개발 착수 기준 v1", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "MD · ZIP 받기" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/baseline-.*\.zip/);
  for (const name of ["코딩 도구 설치", "Node.js 실행 확인"])
    await page
      .locator(".wk-box")
      .filter({
        has: page.getByRole("heading", {
          name: "내 개발 환경 준비",
          exact: true,
        }),
      })
      .getByLabel(name, { exact: true })
      .check();
  const ready = page
    .locator(".wk-box")
    .filter({
      has: page.getByRole("heading", {
        name: "프로젝트 준비와 진행 단계",
        exact: true,
      }),
    });
  for (const name of [
    "GitHub 저장소",
    "Vercel 배포 연결",
    "Firebase 프로젝트",
    "Google 로그인 설정",
    "비밀키 제외·환경변수 확인",
  ])
    await ready.getByRole("checkbox", { name, exact: true }).check();
  a = await open(page, "단계 변경");
  for (const stage of ["planning", "ready", "developing"]) {
    await a.getByLabel("이동할 단계").selectOption(stage);
    await a.getByLabel("결정·변경 이유").fill(stage);
    await submit(a);
    await expect(page.locator(".wk-stage-track span.active")).toHaveText(
      { planning: "기획 중", ready: "개발 준비", developing: "개발 중" }[
        stage
      ]!,
    );
  }
  a = await open(page, "새 배포 등록");
  await a.getByLabel("제목", { exact: true }).fill("첫 배포");
  await a.getByLabel("실행 가능한 HTTPS 주소").fill("https://example.com/demo");
  await a
    .getByLabel("이번 배포의 기획 기준")
    .selectOption({ label: "개발 착수 기준 v1" });
  await a.getByLabel("이번에 구현한 내용").fill("로그인과 핵심 동작");
  await submit(a);
  await tab(page, "발표·피드백");
  a = await open(page, "최종 발표 페이지 편집");
  await a.getByLabel("만든 해결책").fill("첫 행동을 안내하는 공간");
  await a
    .getByLabel("시연 주소", { exact: true })
    .fill("https://example.com/demo");
  await a.getByLabel("배운 점과 다음 계획").fill("작은 기능을 먼저 검증했다.");
  await a
    .getByLabel("공개할 변화 (한 줄에 하나, 최대 5개)")
    .fill("첫 문제 발견\n기획 확정\n배포 완료");
  await a.getByLabel("공개 상태").selectOption("published");
  await submit(a);
  await expect(
    page.locator(".exhibit").getByRole("heading", { name: "함께 시작" }),
  ).toBeVisible();
  await page.screenshot({
    path: "work/workshop/showcase-desktop.png",
    fullPage: true,
  });
  await tab(page, "기획·개발");
  a = await open(page, "단계 변경");
  for (const stage of ["reviewing", "completed"]) {
    await a.getByLabel("이동할 단계").selectOption(stage);
    await a.getByLabel("결정·변경 이유").fill(stage);
    await submit(a);
  }
  await expect(page.locator(".wk-stage-track span.active")).toHaveText("완료");
});
test("source approval, file download and workshop mobile layout work", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await page
    .getByRole("button", { name: "자료·녹취록 남기기", exact: true })
    .click();
  await tab(page, "자료·녹취록");
  let a = await open(page, "새 원문 기록");
  await a.getByLabel("제목", { exact: true }).fill("인터뷰 기록");
  await a.getByLabel("녹취록·원문").fill("처음 오는 사람은 길을 찾기 어렵다.");
  await submit(a);
  a = await open(page, "근거를 붙여 정리 제안");
  await a.getByLabel("제목", { exact: true }).fill("처음 길잡이");
  await a
    .getByLabel("내용", { exact: true })
    .fill("첫 방문자의 길찾기를 돕는다.");
  await a.getByLabel("원문에서 그대로 인용한 근거").fill("길을 찾기 어렵다");
  await submit(a);
  a = await open(page, "검토·수정 후 반영");
  await submit(a);
  await expect(page.getByText("반영 완료", { exact: true })).toBeVisible();
  await page
    .getByLabel("자료 파일 업로드")
    .setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Workshop notes"),
    });
  await expect(
    page.locator(".wk-file-row").getByText("notes.txt", { exact: false }),
  ).toBeVisible();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "다운로드", exact: true }).click();
  expect((await waiting).suggestedFilename()).toBe("notes.txt");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "work/workshop/sources-mobile.png",
    fullPage: true,
  });
  for (const endpoint of [
    "/api/workshop?cohortId=vibe-2026-01",
    "/api/files?cohortId=vibe-2026-01&id=test",
  ])
    expect((await request.get(endpoint)).status()).toBe(401);
  expect((await request.post("/api/ai", { data: {} })).status()).toBe(401);
});
test("vote UI freezes candidates, records a ballot, counts and creates selected project", async ({
  page,
}) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "워크숍 진행", exact: true }).click();
  await tab(page, "투표·팀 구성");
  let a = await open(page, "투표 시작");
  await a
    .getByRole("group", { name: "후보 아이디어" })
    .getByRole("checkbox")
    .first()
    .check();
  await a
    .getByRole("group", { name: "후보 아이디어" })
    .getByRole("checkbox")
    .last()
    .check();
  await a.getByLabel("1인당 표 수").fill("1");
  await a.getByLabel("본인 아이디어 투표 허용").check();
  await a.getByLabel("투표 마감").fill("2099-01-01T12:00");
  await submit(a);
  a = await open(page, "내 투표 선택·변경");
  await a.getByRole("checkbox").first().check();
  await submit(a);
  a = await open(page, "투표 마감·집계");
  await a.getByLabel("결정·변경 이유").fill("전체 참여 완료");
  await submit(a);
  await expect(page.getByText("집계 완료", { exact: true })).toBeVisible();
  a = await open(page, "최종 프로젝트 선정");
  await a.getByRole("checkbox").first().check();
  await a.getByLabel("결정·변경 이유").fill("문제가 구체적이고 실현 가능하다.");
  await submit(a);
  await expect(page.getByText("선정 완료", { exact: true })).toBeVisible();
  await expect(page.locator(".wk-request")).toHaveCount(0);
});
