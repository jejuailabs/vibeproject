import {test,expect} from '@playwright/test';
test('first screen lets a participant write a card, discuss and keep its history',async({page})=>{
 await page.goto('/preview');
 const board=page.getByRole('region',{name:'단계별 활동 보드'});
 await expect(board.getByRole('heading',{name:'어떤 순간이 불편했나요?'})).toBeVisible();
 await expect(board.getByLabel('무슨 일이었나요?')).toBeVisible();
 const firstInput=await board.getByLabel('무슨 일이었나요?').boundingBox();
 expect(firstInput!.y).toBeLessThan(650);
 await board.getByLabel('무슨 일이었나요?').fill('첫 모임에서 대화 상대를 찾기 어려워요');
 await board.getByLabel('언제, 누구에게, 무엇이 불편했나요?').fill('신규 참가자가 첫 10분 동안 혼자 기다립니다.');
 await board.getByRole('button',{name:'카드 올리기',exact:true}).click();
 await expect(board.getByRole('status')).toContainText('카드를 남겼어요');
 await board.getByRole('button',{name:/첫 모임에서 대화 상대를/}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('의견 남기기',{exact:true}).fill('관심사가 같은 사람을 연결하면 어떨까요?');
 await dialog.getByRole('button',{name:'의견 남기기',exact:true}).click();
 await expect(dialog.getByText('관심사가 같은 사람을 연결하면 어떨까요?')).toBeVisible();
 await dialog.getByRole('button',{name:'생각 다듬기'}).click();
 await page.getByRole('dialog').getByLabel('무엇 때문에 생각이 바뀌었나요?').fill('관심사를 기준으로 문제를 구체화');
 await page.getByRole('dialog').getByRole('button',{name:'변경 기록하기'}).click();
 await board.getByRole('button',{name:/첫 모임에서 대화 상대를/}).click();
 await page.getByRole('dialog').getByText('이 생각의 전체 변화 이력').click();
 await expect(page.getByRole('dialog').getByText('관심사를 기준으로 문제를 구체화')).toBeVisible();
});
test('stage cards open the chosen document and teamless users get a clear next action',async({page})=>{
 await page.goto('/preview');
 await page.getByRole('navigation',{name:'프로젝트 진행 단계'}).getByRole('button',{name:/만들고 고치기/}).click();
 await expect(page.getByRole('heading',{name:'먼저 프로젝트를 선택해주세요.'})).toBeVisible();
 await page.getByLabel('미리보기 참가자').selectOption('jun');
 await page.getByRole('navigation',{name:'프로젝트 진행 단계'}).getByRole('button',{name:/만들고 고치기/}).click();
 await page.getByRole('button',{name:/디자인 정의.*어떤 화면을/}).click();
 await expect(page.getByRole('textbox',{name:'Markdown 문서'})).toBeVisible();
 await expect(page.locator('.wk-document-editor summary').first()).toContainText('디자인 정의');
 await page.getByRole('button',{name:/단계별 활동 보드로/}).click();
 await expect(page.getByRole('region',{name:'단계별 활동 보드'})).toBeVisible();
 expect(new URL(page.url()).searchParams.has('view')).toBe(false);
});
test('mobile board fits and private preview cards stay with their author',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/preview');
 await page.getByLabel('무슨 일이었나요?').fill('나만 보는 기록');
 await page.getByLabel('언제, 누구에게, 무엇이 불편했나요?').fill('아직 공개하고 싶지 않은 생각입니다.');
 await page.getByLabel('아직은 나만 볼게요').check();
 await page.getByRole('button',{name:'카드 올리기',exact:true}).click();
 await expect(page.getByRole('button',{name:/나만 보는 기록/})).toBeVisible();
 await page.getByLabel('미리보기 참가자').selectOption('jun');
 await expect(page.getByRole('button',{name:/나만 보는 기록/})).toHaveCount(0);
 for(const name of ['생각 꺼내기','함께할 문제 고르기','만들고 고치기','결과 나누기']){
  await page.getByRole('navigation',{name:'프로젝트 진행 단계'}).getByRole('button',{name:new RegExp(name)}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }
});

test('stage actions open the actual release and showcase forms',async({page})=>{
 await page.goto('/preview');
 await page.getByLabel('미리보기 참가자').selectOption('jun');
 const steps=page.getByRole('navigation',{name:'프로젝트 진행 단계'});
 await steps.getByRole('button',{name:/만들고 고치기/}).click();
 await page.getByRole('button',{name:'배포 기록 남기기',exact:true}).click();
 await expect(page.locator('#project-release')).toHaveAttribute('open','');
 await expect(page.locator('#project-release input').first()).toBeInViewport();
 await page.getByRole('button',{name:/단계별 활동 보드로/}).click();
 await steps.getByRole('button',{name:/결과 나누기/}).click();
 await page.getByRole('button',{name:'발표 카드 작성하기',exact:true}).click();
 await expect(page.locator('#showcase-editor')).toHaveAttribute('open','');
 await expect(page.locator('#showcase-editor textarea').first()).toBeInViewport();
});
