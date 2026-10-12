# 구현 아키텍처

## 기술 경계

Next.js + TypeScript 웹 앱을 Vercel에 배포한다.
Firebase Auth는 Google 로그인, Firestore는 문서와 채팅, Storage는 첨부 파일에 사용한다.
핵심 쓰기는 인증된 서버 API에서 수행한다. 서버의 Firebase Admin 접근은 Rules와 별개이므로 서비스 레벨 권한 검사를 공통 모듈로 강제한다.
정확한 버전은 구현 착수 시 공식 문서와 런타임 호환성으로 확정한다.

## 권장 코드 구조

- app/: 경로, 화면, API 진입점.
- components/: UI와 접근성 컴포넌트.
- features/: activity, idea, feed, chat, project, vote, history.
- server/auth/: 토큰 검증과 권한.
- server/commands/: 상태 변경 유스케이스.
- server/queries/: 범위가 명확한 조회.
- server/ai/: 공급자 어댑터와 작업 상태.
- domain/: 상태, 검증 스키마, 순수 정책.
- firebase/: Rules, indexes, emulator 설정.
- tests/: 권한, 상태 전환, 핵심 E2E.

UI 안에 선정/투표/권한 규칙을 중복 구현하지 않는다.

## 요청 계약

명령 공통 입력: idempotencyKey, expectedRevision(수정 시), payload.
사용자/기수 권한은 서버가 인증 맥락에서 도출한다.
응답: ok, resultRef, revision, correlationId.
오류: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, INVALID_TRANSITION, VALIDATION_ERROR, CLOSED, RATE_LIMITED.
접근 불가 자료는 존재 여부가 민감하면 NOT_FOUND로 통일한다.

## 핵심 명령

| 명령 | 핵심 검증과 결과 |
|---|---|
| acceptInvite | 대상/만료/사용 횟수 확인, 기수 멤버 생성 |
| publishPost / publishIdea | 작성자, 범위, 첨부 접근 확인, 버전/피드 참조 |
| transitionActivity | 운영 권한, 상태, 이유 |
| freezeCandidates | 후보 버전 고정, 라운드 설정 잠금 |
| submitBallot | 활성 구성원, 서버 마감, 예산/중복/후보 유효성 |
| closeVote | 마감 확정, 집계/상태 기록 |
| confirmSelection | 운영 권한, 결과/이유, 후보 상태 갱신 |
| createProjectFromSelection | 중복 방지, 원본 버전 연결 |
| approveJoinRequest | 정원, 활성 프로젝트 수, 신청자 동의 |
| saveDocumentDraft | revision 충돌 검사, 초안 저장 |
| confirmBaseline | 리더 권한, 선택 문서 revision 일치, 버전 묶음 |
| confirmDecision | 제안과 확정 구분, 원본 접근과 상태 확인 |
| sendMessage | 채널 멤버십, 크기/빈도, 중복 메시지 ID |
| applyAIProposal | 검토자, 원본/대상 revision, 범위 확대 확인 |
| publishTimeline | 내부 정보 제거한 검토 요약 생성 |
| createExport | 베이스라인·자료 권한 확인, 불변 manifest |
| redactContent | 제한된 정정 권한, 파생 자료 추적 처리 |

명령 경로는 POST /api/c/:cohortId/commands/:command 형태 또는 동등한 서버 함수로 구현 가능하다. 구체 API는 한 방식으로 통일하고 임의 엔드포인트를 중복 추가하지 않는다.

## 트랜잭션과 재시도

상태 변경+현재 버전 참조+사건+멱등성 결과를 가능한 같은 트랜잭션에 넣는다.
팀 승인에서는 프로젝트 인원과 참가자의 활성 프로젝트를 함께 검사/수정한다.
투표 수정은 사용자별 ballot 하나를 덮어 쓰되 revision을 확인한다. 마감 시각은 클라이언트 시간을 사용하지 않는다.
집계 중에는 라운드를 closed로 확정해 새 투표를 막고, 집계 완료 상태를 따로 표시한다.
외부 AI 호출·메일·파일 업로드는 트랜잭션 내부에서 실행하지 않는다.
큰 작업은 청크와 작업 상태로 나누고 실패 복구가 가능하게 한다.

## 조회와 실시간

현재 열린 채팅 최신 50건, 피드 최신 20건을 기본으로 조회하고 과거는 cursor 페이지를 사용한다.
최근 메시지 sentAt+문서 ID로 안정적인 정렬을 적용한다.
채팅창을 닫거나 기수를 바꾸면 리스너를 해제한다.
개인 대시보드가 모든 프로젝트 채널을 구독하지 않는다.
필요 색인 후보: posts(scope, projectId, updatedAt), ideas(state, updatedAt), events(projectId, occurredAt), tasks(status, assigneeId), notifications(readAt, createdAt).
실제 쿼리를 기준으로 indexes 파일을 작성하고 Emulator/개발 환경에서 검증한다.

## 오프라인과 충돌

첫 버전의 명령은 온라인 연결을 요구한다. 투표와 단계 전환을 몰래 오프라인 큐에 저장하지 않는다.
작성 중 텍스트는 메모리에서 유지하고 제한된 로컬 임시 저장은 사용자에게 알린다. 로그아웃/기수 전환 시 민감 캐시 정리.
409 충돌은 최신 서버 데이터와 내 입력을 비교하는 UI로 복구한다.
파일 업로드 완료 전에는 첨부가 게시된 것으로 처리하지 않는다.

## AI 작업 실행

job: queued/running/review_ready/applied/partially_applied/failed/cancelled.
짧은 요청은 제한 시간 내 서버 처리, 긴 작업은 명시적인 지속 작업 시스템/공급자 job으로 분리한다.
서버 응답 후 메모리에서 계속 실행되는 작업을 신뢰하지 않는다.
공급자가 미정이면 adapter 인터페이스와 수동 정리 경로만 제공하고 가짜 AI 성공 결과를 만들지 않는다.

## 관측과 운영

로그에는 correlationId, 명령, 결과 코드, 지연 시간만 기본 저장한다.
원문/토큰/키를 로깅하지 않는다. 오류 추적 도구 도입 시 동일 마스킹 적용.
읽기량·저장량·AI 사용량을 운영용으로 집계한다. 금액/서비스 제한은 실제 프로젝트 설정에서 확인한다.
지원 없는 기능의 버튼은 작동하는 척하지 않고 비활성 이유를 표시한다.

## 공식 기술 근거

- [Firestore 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions): 원자적 변경과 재시도를 고려한다.
- [Firestore 권한 조건](https://firebase.google.com/docs/firestore/security/rules-conditions): 인증·권한 검증과 서버 접근의 차이를 확인한다.
- [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin): 실제 도메인과 로그인 흐름을 검증한다.
- [Vercel 환경 변수](https://vercel.com/docs/environment-variables): 환경별 설정을 분리한다.

문서 참조 확인일: 2026-10-12. 구현 시 최신 콘솔/SDK 조건을 다시 확인한다.
