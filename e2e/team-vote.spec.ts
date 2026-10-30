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

  const roomIds: string[] = [];
  const rememberRoom = async () => {
    const rooms = page.locator('.vote-card[data-vote-id]');
    await expect(rooms).toHaveCount(roomIds.length + 1);
    const ids = await rooms.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-vote-id')!));
    roomIds.push(ids.find((id) => !roomIds.includes(id))!);
  };
  const room = (n: number) => page.locator(`.vote-card[data-vote-id="${roomIds[n - 1]}"]`);
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
  await rememberRoom();
  await room(1).getByRole('button', { name: '투표하러 가기' }).click();
  await firstCard().getByRole('button', { name: '투표', exact: true }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 1/1');
  await page.getByRole('button', { name: '투표 목록', exact: true }).click();
  // The opener sees the live dashboard: votes cast, people who voted, a countdown and share bars.
  await room(1).getByRole('button', { name: '대시보드', exact: true }).click();
  const dash = page.getByRole('dialog', { name: '투표 대시보드', exact: true });
  await expect(dash.locator('.vote-dash-stat').nth(0)).toContainText('1/2표');
  await expect(dash.locator('.vote-dash-stat').nth(1)).toContainText('1/2명');
  await expect(dash.getByRole('timer')).toContainText(/0?9:\d\d|10:00/);
  await expect(dash.locator('.vote-dash-bars li').first()).toContainText('100%');
  await page.screenshot({ path: 'work/team-vote-dashboard-desktop.png' });
  await dash.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(dash).not.toBeVisible();

  await page.getByRole('button', { name: '새 투표 열기', exact: true }).click();
  await picker.getByLabel('새 투표의 한 사람당 투표 수').selectOption('2');
  await picker.getByRole('button', { name: '2장으로 투표 시작', exact: true }).click();
  await rememberRoom();
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
  // A closed vote's dashboard becomes the result report, which prints on its own as a PDF.
  await room(1).getByRole('button', { name: '대시보드', exact: true }).click();
  await expect(dash.getByRole('heading', { name: /투표 결과$/ })).toBeVisible();
  await expect(dash.locator('.vote-dash-clock.win')).toContainText('첫 모임의 대화');
  await expect(dash.locator('.vote-dash-bars li').first()).toContainText('TOP 5');
  await expect(dash.locator('.vote-dash-stat').nth(1)).toContainText('기권 1명');
  await page.screenshot({ path: 'work/team-vote-report-desktop.png' });
  await page.evaluate(() => { window.print = () => { (window as unknown as { printed: string }).printed = (document.querySelector('body > .vote-print') as HTMLElement | null)?.innerText || ''; }; });
  await dash.getByRole('button', { name: 'PDF로 저장', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: string }).printed)).toContain('투표 결과');
  await expect(page.locator('body > .vote-print')).toHaveCount(0);  await dash.getByRole('button', { name: '닫기', exact: true }).click();
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
  await rememberRoom();
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

test('after a vote closes, the leader keeps the top cards as final teams and members join them', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/preview');
  await page.getByLabel('미리보기 참가자').selectOption('jun');
  await page.getByRole('button', { name: '대시보드', exact: true }).click();
  await page.getByRole('button', { name: '채팅 닫기', exact: true }).click();
  await page.locator('.pj-open').filter({ hasText: '첫걸음' }).click();
  await page.getByRole('button', { name: /각자 생각/ }).click();
  await addProblem(page, '준의 모임 문제');
  await page.getByLabel('미리보기 참가자').selectOption('seo');
  await addProblem(page, '서의 안내 문제');
  await page.getByLabel('미리보기 참가자').selectOption('jun');
  await page.getByRole('navigation', { name: '단계 이동' }).getByRole('button', { name: /최종 아이디어·투표/ }).click();

  const room = page.locator('.vote-card[data-vote-id]');
  await page.getByRole('button', { name: '새 투표 열기', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '투표 후보 고르기', exact: true });
  await picker.getByLabel('새 투표의 투표 시간').selectOption('0');
  await picker.getByRole('button', { name: '2장으로 투표 시작', exact: true }).click();
  await room.getByRole('button', { name: '투표하러 가기' }).click();
  await page.locator('.vote-tile').filter({ has: page.getByRole('heading', { name: /준의 모임 문제/ }) }).getByRole('button', { name: '투표', exact: true }).click();
  await expect(page.locator('.pj-vote')).toContainText('내가 고른 카드 1/1');
  await page.getByRole('button', { name: '투표 목록', exact: true }).click();
  await room.getByRole('button', { name: '대시보드', exact: true }).click();
  const dash = page.getByRole('dialog', { name: '투표 대시보드', exact: true });
  page.once('dialog', (d) => d.accept());
  await dash.getByRole('button', { name: '투표 종료', exact: true }).click();
  await expect(dash.getByRole('heading', { name: /투표 결과$/ })).toBeVisible();
  await dash.getByRole('button', { name: '닫기', exact: true }).click();

  // The leader keeps the 1st card as the final team; no team-or-solo vote is offered any more.
  await expect(room.getByRole('button', { name: /팀·개별/ })).toHaveCount(0);
  await room.getByRole('button', { name: '배정하기', exact: true }).click();
  const final = page.getByRole('dialog', { name: '배정하기', exact: true });
  await expect(final.getByLabel('몇 등 아이디어까지')).toHaveValue('1');
  await expect(final.locator('.final-list li')).toHaveCount(1);
  await final.getByLabel('아이디어 하나당 최대 인원').fill('3');
  await final.getByRole('button', { name: '아이디어 1개로 배정 시작', exact: true }).click();
  const board = page.getByRole('dialog', { name: '선정 프로젝트', exact: true });
  const cardOf = (title: RegExp) => board.locator('.join-card').filter({ has: page.getByRole('heading', { name: title }) });
  await expect(board.locator('.join-card')).toHaveCount(1);
  await expect(board.locator('.join-tag')).toHaveCount(0);
  await expect(board).not.toContainText('1등');
  // A QR code on the board links straight back to it.
  await board.getByRole('button', { name: 'QR 코드로 참여', exact: true }).click();
  await expect(board.getByLabel('이 참여 화면으로 바로 오는 QR 코드')).toBeVisible();
  await expect(board.getByLabel('참여 화면 링크')).toHaveValue(/[?&]vote=[^&]+.*&board=joinboard-/);
  await page.screenshot({ path: 'work/team-vote-join-qr.png' });
  await board.getByRole('button', { name: '닫기', exact: true }).click();

  // A member joins the team; the list shows how many are in and who.
  await page.getByLabel('미리보기 참가자').selectOption('seo');
  await room.getByRole('button', { name: /이 팀으로 들어가기 · 0명 참여/ }).click();
  await cardOf(/준의 모임 문제/).getByRole('button', { name: '이 팀으로 들어가기', exact: true }).click();
  await expect(cardOf(/준의 모임 문제/)).toContainText('1/3명');
  await expect(cardOf(/준의 모임 문제/).getByRole('button', { name: '들어감 · 나가기', exact: true })).toBeVisible();
  await board.getByRole('button', { name: '닫기', exact: true }).click();

  await page.getByLabel('미리보기 참가자').selectOption('jun');
  await room.getByRole('button', { name: /이 팀으로 들어가기 · 1명 참여/ }).click();
  await cardOf(/준의 모임 문제/).getByRole('button', { name: '이 팀으로 들어가기', exact: true }).click();
  await expect(cardOf(/준의 모임 문제/)).toContainText('2/3명');
  await page.screenshot({ path: 'work/team-vote-join-board.png' });
  page.once('dialog', (d) => d.accept());
  await board.getByRole('button', { name: '참가 받기 종료 · 프로젝트 만들기', exact: true }).click();
  await expect(board.getByRole('heading', { name: '프로젝트 배정 결과', exact: true })).toBeVisible();
  await expect(cardOf(/준의 모임 문제/)).toContainText('내 프로젝트');
  await board.getByRole('button', { name: '닫기', exact: true }).click();

  // Everyone sees the final assignment.
  await page.getByLabel('미리보기 참가자').selectOption('seo');
  await room.getByRole('button', { name: '배정 결과', exact: true }).click();
  await expect(cardOf(/준의 모임 문제/)).toContainText('내 프로젝트');
  await expect(cardOf(/준의 모임 문제/)).toContainText('2/3명');
  await expect(room.getByRole('button', { name: '배정 되돌리기' })).toHaveCount(0);
  await board.getByRole('button', { name: '닫기', exact: true }).click();

  // The leader undoes the assignment and is back at "배정하기".
  await page.getByLabel('미리보기 참가자').selectOption('jun');
  page.once('dialog', (d) => d.accept());
  await room.getByRole('button', { name: '배정 되돌리기', exact: true }).click();
  await expect(room.getByRole('button', { name: '배정하기', exact: true })).toBeVisible();
  await expect(room.getByRole('button', { name: '배정 결과', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'work/team-vote-reverted.png' });
});

test('the leader checks which newly finished cards join an open vote, newest edits first', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/preview');
  await page.getByLabel('미리보기 참가자').selectOption('jun');
  await page.getByRole('button', { name: '대시보드', exact: true }).click();
  await page.getByRole('button', { name: '채팅 닫기', exact: true }).click();
  await page.locator('.pj-open').filter({ hasText: '첫걸음' }).click();
  await page.getByRole('button', { name: /각자 생각/ }).click();
  await addProblem(page, '처음 카드');
  const toVote = () => page.getByRole('navigation', { name: '단계 이동' }).getByRole('button', { name: /최종 아이디어·투표/ }).click();
  await toVote();
  await page.getByRole('button', { name: '새 투표 열기', exact: true }).click();
  await page.getByRole('dialog', { name: '투표 후보 고르기', exact: true }).getByRole('button', { name: '1장으로 투표 시작', exact: true }).click();
  await addProblem(page, '두 번째 카드');
  await addProblem(page, '세 번째 카드');
  await toVote();
  const room = page.locator('.vote-card[data-vote-id]');
  await room.getByRole('button', { name: '투표하러 가기' }).click();
  await page.getByRole('button', { name: '새로 완성된 카드 2개 후보에 추가' }).click();
  const add = page.getByRole('dialog', { name: '후보 카드 추가', exact: true });
  const boxes = add.getByRole('checkbox');
  await expect(boxes).toHaveCount(3);
  // Newest edits first; the current candidate stays checked and locked, new cards start unchecked.
  await expect(add.locator('.vote-picker-list li').first()).toContainText('세 번째 카드');
  await expect(add.getByRole('checkbox', { name: /처음 카드/ })).toBeChecked();
  await expect(add.getByRole('checkbox', { name: /처음 카드/ })).toBeDisabled();
  await expect(add.getByRole('checkbox', { name: /두 번째 카드/ })).not.toBeChecked();
  await expect(add.getByRole('button', { name: '0장 후보에 추가', exact: true })).toBeDisabled();
  await add.getByRole('checkbox', { name: /세 번째 카드/ }).check();
  await add.getByRole('button', { name: '1장 후보에 추가', exact: true }).click();
  await expect(add).not.toBeVisible();
  await expect(page.locator('.vote-tile')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '새로 완성된 카드 1개 후보에 추가' })).toBeVisible();
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
