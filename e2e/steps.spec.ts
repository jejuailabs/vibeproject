import {test,expect} from '@playwright/test';
test('team members move freely through steps, post to the team wall and the leader confirms a problem',async({page})=>{
 await page.goto('/preview');
 await page.getByLabel('미리보기 참가자').selectOption('seo');
 await page.getByRole('button',{name:'프로젝트 공간'}).click();
 const rail=page.getByRole('navigation',{name:'프로젝트 진행 단계'});
 await expect(rail.getByRole('button',{name:/각자 생각/})).toContainText('1/2명');
 await rail.getByRole('button',{name:/전시/}).click();
 await expect(page.getByRole('heading',{name:'처음 생각에서 결과까지 보여줘요'})).toBeVisible();
 await rail.getByRole('button',{name:/각자 생각/}).click();
 await page.getByLabel('무슨 일이었나요?').fill('신규 입사자가 물어볼 사람을 몰라요');
 await page.getByLabel('언제, 누구에게, 무엇이 불편했나요?').fill('입사 첫 주에 혼자 검색만 했어요.');
 await page.getByRole('button',{name:'팀 벽에 올리기'}).click();
 await expect(page.getByRole('heading',{name:'그 경험을 다섯 질문으로 풀어요'})).toBeVisible();
 await expect(rail.getByRole('button',{name:/각자 생각/})).toContainText('2/2명');
 await rail.getByRole('button',{name:/각자 생각/}).click();
 await expect(page.locator('.steps-card').filter({hasText:'입사 첫 주에 혼자 검색만 했어요.'})).toBeVisible();

 await rail.getByRole('button',{name:/문제 확정/}).click();
 await expect(page.getByText('리더가 하나를 확정합니다')).toBeVisible();
 await expect(page.getByRole('button',{name:/이 문제로 확정/})).toHaveCount(0);

 await page.getByLabel('미리보기 참가자').selectOption('jun');
 await rail.getByRole('button',{name:/기획/}).click();
 await page.locator('.steps-doc').first().click();
 await expect(page.locator('#project-docs')).toBeVisible();
});
test('step rail scrolls inside itself on a phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/preview');
 await page.getByLabel('미리보기 참가자').selectOption('jun');
 await page.getByRole('button',{name:'프로젝트 공간'}).click();
 await expect(page.locator('.steps-rail')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});
test('team chat carries the current step and the history groups records by step',async({page})=>{
 await page.goto('/preview');
 await page.getByLabel('미리보기 참가자').selectOption('jun');
 await page.getByRole('button',{name:'프로젝트 공간'}).click();
 const rail=page.getByRole('navigation',{name:'프로젝트 진행 단계'});
 await rail.getByRole('button',{name:/문제정의/}).click();
 const panel=page.locator('.chat-panel');
 if(!await panel.isVisible())await page.getByRole('button',{name:'채팅 열기 또는 닫기'}).click();
 await panel.getByRole('button',{name:'팀 대화'}).click();
 await expect(panel.getByLabel('지금 작업 중인 단계')).toHaveValue('definition');
 await panel.locator('#chat-input').fill('문제 문장 같이 봐요');
 await panel.locator('.chat-compose button[type=submit]').click();
 await expect(panel.locator('.message').filter({hasText:'문제 문장 같이 봐요'}).locator('.message-step')).toHaveText('문제정의');
 await rail.getByRole('button',{name:/이력/}).click();
 const group=page.locator('.timeline-group').filter({has:page.getByRole('heading',{name:/문제정의/})});
 await expect(group).toContainText('문제 문장 같이 봐요');
 await page.getByRole('group',{name:'기록 종류'}).getByRole('button',{name:'카드 저장'}).click();
 await expect(page.locator('.timeline-entry').filter({hasText:'문제 문장 같이 봐요'})).toHaveCount(0);
 await page.getByRole('button',{name:'단계로 돌아가기'}).click();
 await expect(page.getByRole('heading',{name:'문제를 한 문장으로 정리해요'})).toBeVisible();
});
