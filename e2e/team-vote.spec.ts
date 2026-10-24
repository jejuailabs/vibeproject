import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function addProblem(page: Page, title: string) {
  await page.getByRole('navigation', { name: '단계 이동' }).getByRole('button', { name: /각자 생각/ }).click();
  await page.getByRole('button', { name: '긴 글·파일로 한 번에', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '각자 생각 입력' });
  await dialog.locator('.quick-text').fill(title + ' 때문에 불편했던 경험입니다.');
  await dialog.getByRole('button', { name: 'AI로 한 번에 정리하기', exact: true }).click();
  await dialog.getByText('AI가 채운 1·2·3단계 내용 보기·고치기', { exact: true }).click();
  const fields = dialog.locator('.quick-fields textarea');
  await expect(fields).toHaveCount(12);
  for (let i = 0; i < 12; i++) await fields.nth(i).fill(i === 0 ? title : '처음 온 사람이 모임 시작 전 대화 상대를 찾지 못해 혼자 기다립니다.');
  await dialog.getByRole('button', { name: '새 카드로 저장하기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('leaders open simultaneous rooms and members keep independent votes and results', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/preview');
  await page.getByLabel('미리보기 참가자').selectOption('jun');
  await page.getByRole('button', { name: '대시보드', exact: true }).click();
  await page.getByRole('button', { name: '채팅 닫기', exact: true }).click();
  await page.locator('.pj-open').filter({ hasText: '첫걸음' }).click();
  await page.getByRole('button', { name: /각자 생각/ }).click();
  await addProblem(page, '첫 모임의 대화');
  await addProblem(page, '신규 참가자 안내');
  await page.getByRole('navigation', { name: '단계 이동' }).getByRole('button', { name: /최종 아이디어·투표/ }).click();

  const room = (n: number) => page.locator('.vote-card').filter({ has: page.getByRole('heading', { name: `${n}번째 투표`, exact: true }) });
  const firstCard = () => page.locator('.vote-tile').filter({ has: page.getByRole('heading', { name: /첫 모임의 대화/ }) });
  const picker = page.getByRole('dialog', { name: '투표 후보 고르기', exact: true });
  await page.getByRole('button', { name: '새 투표 열기', exact: true }).click();
  await expect(picker.getByRole('checkbox')).toHaveCount(2);
  await expect(picker.getByRole('checkbox', { checked: true })).toHaveCount(2);
  await picker.getByRole('button', { name: '전체 해제', exact: true }).click();
  await expect(picker.getByRole('button', { name: '0장으로 투표 시작', exact: true })).toBeDisabled();
  await picker.getByRole('button', { name: '전체 선택', exact: true }).click();
  await picker.getByRole('button', { name: '2장으로 투표 시작', exact: true }).click();
  await expect(picker).not.toBeVisible();
  await room(1).getByRole('button', { name: '투표하러 가기' }).click();
  await firstCard().getByRole('button', { name: '투표', exact: true }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 1/1');
  await page.getByRole('button', { name: '투표 목록', exact: true }).click();

  await page.getByRole('button', { name: '새 투표 열기', exact: true }).click();
  await picker.getByLabel('새 투표의 한 사람당 투표 수').selectOption('2');
  await picker.getByRole('button', { name: '2장으로 투표 시작', exact: true }).click();
  await expect(page.locator('.vote-card.open')).toHaveCount(2);
  await expect(room(1)).toContainText('1/2명 참여 · 한 사람당 1표');
  await expect(room(2)).toContainText('0/2명 참여 · 한 사람당 2표');
  await room(2).getByRole('button', { name: '투표하러 가기' }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 0/2');
  await page.locator('.vote-tile').nth(0).getByRole('button', { name: '투표', exact: true }).click();
  await page.locator('.vote-tile').nth(1).getByRole('button', { name: '투표', exact: true }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 2/2');
  await page.getByRole('button', { name: '투표 목록', exact: true }).click();
  await room(1).getByRole('button', { name: '투표하러 가기' }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 1/1');
  await expect(firstCard()).toContainText('내 선택');
  await page.getByRole('button', { name: '투표 마감하기', exact: true }).click();
  await firstCard().getByRole('button', { name: '자세히 보기', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.pad-count')).toHaveText('1표');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '투표 목록', exact: true }).click();
  await expect(room(1)).toContainText('투표 마감');
  await expect(room(2)).toContainText('투표 중');

  await page.getByLabel('미리보기 참가자').selectOption('seo');
  await expect(page.getByRole('button', { name: '새 투표 열기', exact: true })).toHaveCount(0);
  await room(2).getByRole('button', { name: '투표하러 가기' }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 0/2');
  await firstCard().getByRole('button', { name: '투표', exact: true }).click();
  await page.getByRole('button', { name: '투표 목록', exact: true }).click();
  await page.getByLabel('미리보기 참가자').selectOption('jun');
  await expect(room(2)).toContainText('2/2명 참여');
  await room(2).getByRole('button', { name: '투표하러 가기' }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 2/2');
  await page.getByRole('button', { name: '투표 마감하기', exact: true }).click();
  await firstCard().getByRole('button', { name: '자세히 보기', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.pad-count')).toHaveText('2표');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '투표 목록', exact: true }).click();
  // A card left out of the new vote stays among the finished cards but is not a candidate.
  await page.getByRole('button', { name: '새 투표 열기', exact: true }).click();
  await picker.getByRole('checkbox', { name: /첫 모임의 대화/ }).uncheck();
  await picker.getByRole('button', { name: '1장으로 투표 시작', exact: true }).click();
  await expect(room(3)).toContainText('후보 문제 카드 1장');
  page.once('dialog', dialog => dialog.accept());
  await room(1).getByRole('button', { name: '투표 삭제', exact: true }).click();
  await expect(room(1)).toHaveCount(0);
  await expect(room(2)).toContainText('투표 마감');
  await expect(room(3)).toContainText('투표 중');
  await page.screenshot({ path: 'work/team-vote-rooms-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByRole('button', { name: '새 투표 열기', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'work/team-vote-rooms-mobile.png', fullPage: true });
});

test('a completed card previews plain text, copies it and downloads Markdown in its own dialog', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/preview');
  await page.getByLabel('미리보기 참가자').selectOption('jun');
  await page.getByRole('button', { name: '대시보드', exact: true }).click();
  await page.getByRole('button', { name: '채팅 닫기', exact: true }).click();
  await page.locator('.pj-open').filter({ hasText: '첫걸음' }).click();
  await page.getByRole('button', { name: /각자 생각/ }).click();
  await addProblem(page, '완성 카드: 모임/안내');
  const card = page.locator('.pad-card').filter({ hasText: '완성 카드: 모임/안내' });
  await expect(card.getByRole('button', { name: 'MD 다운로드', exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: '텍스트로 한꺼번에', exact: true }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '카드 전체 텍스트', exact: true });
  const text = dialog.getByRole('textbox', { name: '정리된 카드 텍스트', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.pad-composer')).not.toBeVisible();
  await expect(text).toHaveAttribute('readonly', '');
  const plainText = await text.inputValue();
  expect(plainText).toMatch(/^완성 카드: 모임\/안내\n/);
  expect(plainText).toContain('문제 한 문장');
  expect(plainText).not.toMatch(/^#{1,3} /m);
  // Keep the user's system clipboard untouched while checking the exact copied contents.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { (window as unknown as { copiedCardText: string }).copiedCardText = value; },
    } });
  });
  await dialog.getByRole('button', { name: '텍스트 복사', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('텍스트를 복사했어요.');
  expect(await page.evaluate(() => (window as unknown as { copiedCardText: string }).copiedCardText)).toBe(plainText);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'MD 다운로드', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('완성 카드_ 모임_안내.md');
  const content = await readFile((await download.path())!, 'utf8');
  expect(content).toContain('# 완성 카드: 모임/안내');
  expect(content).toContain('## 문제 한 문장');
  expect(content).toContain('## 경험 구체화');
  expect(content).toContain('## 문제를 나눠 보면');
  expect(content).toContain('4주 동안 어디까지 해볼까요?');
  expect(content).toContain('처음 온 사람이 모임 시작 전 대화 상대를 찾지 못해 혼자 기다립니다.');
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('button', { name: '텍스트 복사', exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'MD 다운로드', exact: true })).toBeInViewport();
  expect(await dialog.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await dialog.screenshot({ path: 'work/card-text-preview-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.pad-composer')).not.toBeVisible();
  // The same action works inside an editor without closing that editor on Escape.
  await card.click();
  const editor = page.locator('.pad-composer');
  await expect(editor).toBeVisible();
  await editor.locator('.problem-card-maker').getByRole('button', { name: '텍스트로 한꺼번에', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw new Error('Clipboard denied'); },
    } });
  });
  await dialog.getByRole('button', { name: '텍스트 복사', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('직접 복사해주세요.');
  expect(await text.evaluate((e: HTMLTextAreaElement) => e.selectionEnd - e.selectionStart)).toBe((await text.inputValue()).length);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(editor).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeVisible();
});
