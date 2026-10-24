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
 await page.getByRole('button',{name:'프로필 편집',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'내 프로필'});
 await expect(dialog.getByRole('radio')).toHaveCount(16);
 await dialog.getByRole('radio',{name:'그라파이트',exact:true}).check();
 await expect(dialog.getByAltText('그라파이트 캐릭터 미리보기')).toHaveAttribute('src',/^https:\/\/firebasestorage.googleapis.com\/.+maker-graphite/);
 await dialog.getByRole('button',{name:'프로필 저장'}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('.hero-portrait')).toHaveAttribute('src',/maker-graphite/);
 await expect(page.locator('.sidebar-bottom .avatar img')).toHaveAttribute('src',/maker-graphite-thumb/);
 await expect(page.getByRole('button',{name:'김민지의 생각 보기'}).locator('img')).toHaveAttribute('src',/maker-graphite/);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'채팅 닫기',exact:true}).click();
 await page.getByRole('button',{name:'프로필 편집',exact:true}).click();
 await dialog.getByRole('radio',{name:'민트',exact:true}).check();
 await dialog.getByRole('button',{name:'프로필 편집 닫기'}).click();
 await expect(page.locator('.hero-portrait')).toHaveAttribute('src',/maker-graphite/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('a new nickname and an uploaded photo show up in chat and the lineup at once',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/preview');
 await page.getByRole('button',{name:'내 프로필 편집'}).click();
 const dialog=page.getByRole('dialog',{name:'내 프로필'});
 await dialog.getByLabel('닉네임').fill('이준호');
 await dialog.getByRole('button',{name:'프로필 저장'}).click();
 await expect(dialog.getByRole('alert')).toContainText('이미 다른 사람이');
 await dialog.getByLabel('닉네임').fill('민지 메이커');
 // A 1x1 PNG stands in for the member's own photo.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
 await dialog.getByLabel('내 사진 파일').setInputFiles({name:'me.png',mimeType:'image/png',buffer:png});
 await expect(dialog.getByRole('radio',{name:'내 사진'})).toBeChecked();
 await dialog.getByRole('button',{name:'프로필 저장'}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('.sidebar-bottom strong')).toHaveText('민지 메이커');
 await expect(page.locator('.sidebar-bottom .avatar img')).toHaveAttribute('src',/^blob:/);
 await page.locator('#chat-input').fill('새 닉네임으로 인사해요');
 await page.getByRole('button',{name:'메시지 보내기'}).click();
 const mine=page.locator('.chat-messages .message.mine').last();
 await expect(mine).toContainText('민지 메이커');
 await expect(mine.locator('img')).toHaveAttribute('src',/^blob:/);
 await expect(page.getByRole('button',{name:'민지 메이커의 생각 보기'})).toBeVisible();
});
