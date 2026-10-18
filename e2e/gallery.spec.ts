import {test,expect} from '@playwright/test';
test('leader publishes an exhibition story and everyone reads it in the gallery',async({page})=>{
 await page.goto('/preview');
 await page.getByLabel('미리보기 참가자').selectOption('jun');
 await page.getByRole('button',{name:'프로젝트 공간'}).click();
 const rail=page.getByRole('navigation',{name:'프로젝트 진행 단계'});
 await rail.getByRole('button',{name:/전시/}).click();
 await expect(page.locator('.steps-preview')).toContainText('03 · 결과');
 await page.getByRole('button',{name:/전시 카드 작성/}).click();

 const form=page.locator('#showcase-editor');
 await form.getByLabel('만든 해결책').fill('첫 주에 물어볼 사람을 바로 찾는 안내 카드');
 await form.getByLabel('시연 주소').fill('https://example.com/demo');
 await form.getByLabel('배운 점과 다음 계획').fill('작게 시작하니 피드백이 빨랐다');
 await form.getByLabel('공개할 변화 (한 줄에 하나, 최대 5개)').fill('대상을 첫 주 입사자로 좁혔다\n기능보다 질문 순서를 먼저 정했다');
 await form.getByLabel('처음 생각 카드(제목·내용)를 전시에 포함').check();
 await form.getByLabel(/진행 숫자/).check();
 await form.getByLabel('공개 상태').selectOption('published');
 await form.getByRole('button',{name:/최종 발표 페이지 편집|저장|편집/}).last().click();
 const exhibit=page.locator('.exhibit').first();
 await expect(exhibit).toContainText('팀의 지식이 사람과 함께 사라지지 않도록');
 await expect(exhibit.locator('.exhibit-journey')).toContainText('팀원');

 await page.getByLabel('미리보기 참가자').selectOption('ha');
 await page.getByRole('button',{name:'전시 갤러리'}).click();
 await expect(page.getByRole('heading',{name:'워크숍 전시 갤러리'})).toBeVisible();
 await page.getByRole('button',{name:'첫걸음 전시 보기'}).click();
 await expect(page.locator('.exhibit')).toContainText('첫 주에 물어볼 사람을 바로 찾는 안내 카드');
 await expect(page.locator('.exhibit')).toContainText('대상을 첫 주 입사자로 좁혔다');
 await expect(page.getByRole('link',{name:/시연 열기/})).toHaveAttribute('href','https://example.com/demo');
 await page.getByRole('button',{name:'갤러리로 돌아가기'}).click();
 await page.getByLabel('전시 찾기').fill('없는 프로젝트');
 await expect(page.getByText('찾는 전시가 없어요.')).toBeVisible();
});
