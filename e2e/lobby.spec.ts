import {test,expect} from '@playwright/test';
test('leader opens a password project and another member joins it alongside an existing project',async({page})=>{
 await page.goto('/preview');
 await page.getByRole('button',{name:'프로젝트',exact:true}).click();
 await expect(page.getByRole('heading',{name:'프로젝트 만들기 · 참여하기'})).toBeVisible();
 await page.getByPlaceholder('예: 우리 동네 모임 길잡이').fill('동네 모임 길잡이');
 await page.getByPlaceholder('어떤 불편을 함께 다뤄보고 싶은지 적어주세요').fill('처음 온 사람이 어색하지 않게');
 await page.locator('.lobby-policies label').filter({hasText:'비밀번호'}).click();
 await page.locator('.lobby-password input').fill('abcd1234');
 await page.getByRole('button',{name:'프로젝트 만들기'}).last().click();
 await expect(page.getByRole('heading',{name:'우리의 프로젝트'})).toBeVisible();

 await page.getByLabel('미리보기 참가자').selectOption('jun');
 await page.getByRole('button',{name:'프로젝트',exact:true}).click();
 await page.getByRole('tab',{name:/프로젝트 참여하기/}).click();
 const row=page.locator('.lobby-row').filter({hasText:'동네 모임 길잡이'});
 await expect(row).toContainText('비밀번호');
 await row.getByLabel('동네 모임 길잡이 참여 비밀번호').fill('wrong');
 await row.getByRole('button',{name:'참여'}).click();
 await expect(page.locator('.error-banner')).toContainText('비밀번호가 맞지 않습니다');
 await row.getByLabel('동네 모임 길잡이 참여 비밀번호').fill('abcd1234');
 await row.getByRole('button',{name:'참여'}).click();
 await expect(page.getByRole('heading',{name:'우리의 프로젝트'})).toBeVisible();

 await page.getByRole('button',{name:'프로젝트',exact:true}).click();
 await expect(page.locator('.lobby-card')).toHaveCount(2);
 await expect(page.locator('.lobby-card.current')).toContainText('동네 모임 길잡이');
 await page.locator('.lobby-card').filter({hasText:'첫걸음'}).getByRole('button').click();
 await page.getByRole('button',{name:'프로젝트',exact:true}).click();
 await expect(page.locator('.lobby-card.current')).toContainText('첫걸음');
 await expect(page.getByText('첫걸음 초대하기')).toBeVisible();
});
test('lobby fits a phone screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/preview');
 await page.getByRole('button',{name:'메뉴 열기'}).click();
 await page.getByRole('button',{name:'프로젝트',exact:true}).click();
 await page.getByRole('tab',{name:/프로젝트 참여하기/}).click();
 await expect(page.locator('.lobby-row').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});
