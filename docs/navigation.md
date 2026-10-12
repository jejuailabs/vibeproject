# 공간과 내비게이션

## 공통 구조

상단: 기수 선택 / 전체 공간 / 내 공간 / 프로젝트 선택 / 알림 / 프로필.
왼쪽: 선택한 공간의 메뉴.
중앙: 상태 요약과 피드 또는 상세 작업.
오른쪽: 선택적으로 여는 채팅/도움 패널.

로그인 기본 진입은 현재 기수의 내 대시보드다. 활동/메시지 직접 링크로 진입하면 인증 후 요청 경로로 복귀한다. 기수 미가입자는 Google 로그인 시 참가자로 자동 가입된다. 프로젝트 미정 참가자에게 빈 팀 대시보드를 강제하지 않는다.

## 메뉴와 경로

경로의 :cohortId, :projectId 등은 실제 식별자로 치환한다.

| 범위 | 메뉴 | 경로 |
|---|---|---|
| 공통 | 로그인 | /login |
| 개인 | 대시보드 | /c/:cohortId/me |
| 개인 | 내 아이디어 | /c/:cohortId/me/ideas |
| 개인 | 준비 체크리스트 | /c/:cohortId/me/readiness |
| 개인 | 알림 | /c/:cohortId/me/notifications |
| 전체 | 대시보드 | /c/:cohortId |
| 전체 | 활동/일정 | /c/:cohortId/activities |
| 전체 | 활동 상세 | /c/:cohortId/activities/:activityId |
| 전체 | 아이디어 보드 | /c/:cohortId/ideas |
| 전체 | 아이디어 상세 | /c/:cohortId/ideas/:ideaId |
| 전체 | 투표 | /c/:cohortId/votes/:roundId |
| 전체 | 프로젝트 목록 | /c/:cohortId/projects |
| 전체 | 결과 전시 | /c/:cohortId/showcase |
| 프로젝트 | 대시보드 | /c/:cohortId/p/:projectId |
| 프로젝트 | 문제/목표 | /c/:cohortId/p/:projectId/overview |
| 프로젝트 | 기획/문서 | /c/:cohortId/p/:projectId/docs |
| 프로젝트 | 자료/회의 | /c/:cohortId/p/:projectId/resources |
| 프로젝트 | 개발/작업 | /c/:cohortId/p/:projectId/work |
| 프로젝트 | 피드백 | /c/:cohortId/p/:projectId/feedback |
| 프로젝트 | 성장 이력 | /c/:cohortId/p/:projectId/history |
| 프로젝트 | 발표/데모 | /c/:cohortId/p/:projectId/showcase |
| 소통 | 전체/팀 채팅 | /c/:cohortId/chat/:channelId |
| 운영 | 기수 관리 | /c/:cohortId/manage |
| 운영 | 현장 공유 화면 | /c/:cohortId/present/:activityId |

## 대시보드별 우선순위

내 공간: 현재 활동 → 다음 행동 → 나의 준비/프로젝트 → 내 피드와 관련 소식.
프로젝트: 목표/단계 → 팀원 카드 → 막힌 점/결정 필요 → 팀 피드.
전체: 현재 활동/공지 → 프로젝트 또는 참가자 카드 → 기수 피드.

팀장과 일반 팀원은 같은 프로젝트 경로를 사용하며 관리 가능한 행동만 다르다. 역할마다 별도 대시보드 앱을 복제하지 않는다.

## 직접 이동

알림은 댓글/메시지/문서의 해당 항목으로 이동한다.
카드에서 원본·프로젝트·이력으로 직접 이동한다.
피드 필터/정렬은 URL 검색 매개변수로 유지하며 브라우저 뒤로 가기를 지원한다.
권한 없는 링크는 내용이나 제목을 노출하지 않는 접근 안내를 제공한다.

## 모바일

하단 주요 이동: 홈 / 활동 / 피드 / 채팅 / 더보기.
팀/전체 전환은 화면 상단의 명확한 공간 선택기로 유지한다.
채팅은 전체 화면, 문서와 채팅 동시 3열 배치를 강제하지 않는다.
글 작성 중 공간 이동은 임시 저장 여부를 표시한다. 다른 공간으로 이동했다고 작성 중 글의 공개 범위를 자동 변경하지 않는다.

## 전체 관점의 사람/팀 보기

관리자 전체 대시보드에는 팀별/참가자별 보기 전환과 단계/도움 요청 필터가 있다.
팀 카드 또는 캐릭터 카드를 누르면 공개 범위 내 요약으로 이동한다.
참가자는 다른 사람의 공개 활동을 볼 수 있지만 관리자용 준비 지연·지원 메모는 보지 못한다.
