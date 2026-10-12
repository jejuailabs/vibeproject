import {test,expect} from '@playwright/test';
test('Google-only enrollment has no code form and still rejects unauthenticated enrollment',async({page,request})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:/Google로 시작하기/})).toBeVisible();
 await expect(page.getByRole('textbox')).toHaveCount(0);
 expect((await request.post('/api/enroll')).status()).toBe(401);
 await page.goto('/preview?view=workshop&tab=admin');
 await expect(page.getByRole('heading',{name:'참가자 가입·권한'})).toBeVisible();
 await expect(page.getByText('Google 계정으로 로그인하면 참가자로 자동 가입됩니다.',{exact:false})).toBeVisible();
 await expect(page.getByText('Google 계정 초대 등록',{exact:true})).toHaveCount(0);
});
