import {test,expect} from '@playwright/test';

test('login initializes Firebase Auth without a component-registration error',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.getByRole('button',{name:/Google로 시작하기/})).toBeEnabled();
 await expect(page.getByRole('heading',{name:'반가워요, 메이커!'})).toBeVisible();
 await expect(page.getByText('처음 로그인하면 참가자로 자동 가입됩니다.',{exact:false})).toBeVisible();
 expect(errors).toEqual([]);
});

test('16 Firebase characters can be previewed, saved, and cancelled on mobile',async({page})=>{
 await page.goto('/preview');
 await page.getByRole('button',{name:'캐릭터 변경',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'나를 표현하는 캐릭터'});
 await expect(dialog.getByRole('radio')).toHaveCount(16);
 await dialog.getByRole('radio',{name:'그라파이트',exact:true}).check();
 await expect(dialog.getByAltText('그라파이트 캐릭터 미리보기')).toHaveAttribute('src',/^https:\/\/firebasestorage.googleapis.com\/.+maker-graphite/);
 await dialog.getByRole('button',{name:'이 캐릭터로 저장'}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('.hero-portrait')).toHaveAttribute('src',/maker-graphite/);
 await expect(page.locator('.sidebar-bottom .avatar img')).toHaveAttribute('src',/maker-graphite-thumb/);
 await expect(page.getByRole('button',{name:'김민지의 생각 보기'}).locator('img')).toHaveAttribute('src',/maker-graphite/);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'채팅 닫기',exact:true}).click();
 await page.getByRole('button',{name:'캐릭터 변경',exact:true}).click();
 await dialog.getByRole('radio',{name:'민트',exact:true}).check();
 await dialog.getByRole('button',{name:'캐릭터 선택 닫기'}).click();
 await expect(page.locator('.hero-portrait')).toHaveAttribute('src',/maker-graphite/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
