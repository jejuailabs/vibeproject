import type { DocKey } from "./model";
export const templates: Record<DocKey, string> = {
  product:
    "# 문제와 사용자\n\n## 해결하려는 문제\n누가, 어떤 상황에서, 어떤 불편을 겪나요?\n\n## 현재 해결 방식\n\n## 목표 사용자\n\n## 성공 기준\n측정 가능한 변화는 무엇인가요?\n",
  features:
    "# 기능과 범위\n\n## 꼭 필요한 기능\n- 사용자가 할 수 있는 일과 결과\n\n## 이번에는 제외할 기능\n\n## 예외와 오류\n\n## 우선순위\n",
  screens:
    "# 화면과 사용자 흐름\n\n## 시작 화면\n\n## 핵심 작업 순서\n1.\n2.\n3.\n\n## 빈 상태·오류·로딩\n\n## 모바일\n",
  design:
    "# 디자인 정의\n\n## 참고 디자인\n링크와 참고할 요소를 적어주세요.\n\n## 분위기와 색상\n\n## 글꼴·간격·레이아웃\n\n## 컴포넌트\n\n## 이미지\nFirebase Storage 경로, 대체 텍스트, 용도\n\n## 접근성\n",
  "data-auth":
    "# 데이터와 권한\n\n## Firebase 데이터 구조\n\n## Google 로그인\n\n## 사용자·관리자 권한\n\n## 공개 범위\n\n## 파일 보관과 삭제\n",
  "setup-deploy":
    "# 개발 환경과 배포\n\n## 로컬 실행\n\n## GitHub 저장소\n\n## Firebase 설정\n\n## Vercel 연결\n\n## 환경변수 이름\n실제 비밀키는 문서나 Git에 쓰지 않습니다.\n\n## 배포 확인\n",
  acceptance:
    "# 완료 기준\n\n## 핵심 사용자 시나리오\n- [ ] Google 로그인 후 핵심 작업을 완료할 수 있다.\n- [ ] 데이터가 새로고침 후에도 유지된다.\n- [ ] 다른 사람의 비공개 자료에 접근할 수 없다.\n- [ ] 모바일에서 핵심 기능을 사용할 수 있다.\n\n## 시연 순서\n\n## 알려진 제약\n",
};
