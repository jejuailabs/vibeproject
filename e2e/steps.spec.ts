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
