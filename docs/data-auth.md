# 데이터 모델과 권한

## 모델 기준

Firestore 문서 경로는 아래 제안을 따른다. ID는 추측 가능한 이름 대신 생성 ID를 사용한다.
공통 필드: createdAt, updatedAt, createdBy, revision, schemaVersion. 시각은 서버 기준 Timestamp, 화면은 Asia/Seoul.
기수 하위 자료의 cohortId는 경로와 일치해야 한다.
공개용 요약과 팀 내부 데이터를 같은 문서에 넣지 않는다. Firestore 문서 읽기를 필드별 마스킹처럼 취급하지 않는다.

## 사용자·기수

| 경로 | 주요 필드 | 접근 |
|---|---|---|
| users/{uid} | displayName, avatarAssetId, preferences | 본인 |
| cohorts/{c} | name, status, timezone, dates, featuredActivityId, policies | 활성 기수 구성원 |
| cohorts/{c}/members/{uid} | cohortRole, status, activeProjectId, joinedAt | 본인/기수 운영 |
| cohorts/{c}/profiles/{uid} | displayName, avatar, intro, publicProjectId | 활성 구성원 |
| cohorts/{c}/invites/{id} | tokenHash, intendedEmail, expiry, maxUses, revokedAt | 서버만 |
| cohorts/{c}/readiness/{uid} | personalChecklist, exceptions | 본인/기수 운영 |
| users/{uid}/notifications/{id} | type, targetRef, dedupeKey, readAt | 본인 |

이메일, 초대 정책, 지원 메모를 공개 profiles에 넣지 않는다. 프로필 수정은 서버가 허용된 필드만 반영한다.

## 활동·게시글·아이디어

| 경로 | 주요 필드 |
|---|---|
| cohorts/{c}/activities/{a} | title, type, instructions, questions, status, opensAt, closesAt, audience, submissionVisibility |
| cohorts/{c}/activities/{a}/submissions/{id} | authorId, projectId, body, revision, submittedAt, status |
| cohorts/{c}/posts/{id} | type, body, ownerId, scope, projectId, status, sourceRefs |
| cohorts/{c}/ideas/{id} | ownerId, title, problem, audience, context, workaround, desiredOutcome, hypothesis, scope, state, currentVersionId |
| cohorts/{c}/comments/{id} | parentType, parentId, versionId, replyToId, authorId, body, kind, resolution, linkedResultRef |
| cohorts/{c}/reactions/{id} | parentRef, actorId, kind |
| cohorts/{c}/feedEntries/{id} | sourceRef, kind, scope, projectId, ownerId, occurredAt |

게시물·아이디어는 scope=owner/project/cohort. draft는 owner만 허용한다.
comments 권한은 부모를 따른다. 고아 댓글과 다른 기수 부모를 금지한다.
feedEntries에는 비공개 본문을 복제하지 않는다. 원본 권한을 확인해 렌더링한다.
서버에서 actorId와 parentRef를 기준으로 반응 ID를 결정해 중복 반응을 막는다.

## 투표·선정·팀

| 경로 | 주요 필드 |
|---|---|
| cohorts/{c}/voteRounds/{r} | state, candidateVersionRefs, budget, allowSelfVote, opensAt, closesAt, resultsVisible |
| cohorts/{c}/voteRounds/{r}/ballots/{uid} | candidateIds, revision, submittedAt |
| cohorts/{c}/voteRounds/{r}/results/{id} | candidateId, count, computedAt |
| cohorts/{c}/selections/{id} | roundId, candidateVersionRef, outcome, reason, confirmedBy |
| cohorts/{c}/projects/{p} | name, mode, stage, leaderId, memberCount, capacity, currentBaselineId, sourceIdeaVersions |
| cohorts/{c}/projects/{p}/members/{uid} | role, status, acceptedAt |
| cohorts/{c}/projects/{p}/joinRequests/{uid} | status, message, submittedAt, resolvedAt |
| cohorts/{c}/projectDirectory/{p} | name, publicProblem, stage, approvedMemberProfiles, publicDemo, publicationRevision |

projects 문서는 팀 내부 정보다. 다른 참가자는 승인된 projectDirectory를 읽는다.
ballots는 본인 읽기+서버 쓰기. 운영자 클라이언트는 개별 투표 내역을 읽지 못한다.
선정과 프로젝트 생성은 selection ID로 멱등성을 보장한다.
팀 인원 제한과 참가자의 activeProjectId는 같은 트랜잭션에서 갱신한다.

## 문서·작업·발표

cohorts/{c}/projects/{p} 아래:
- documents/{docKey}: title, markdown, status, revision, currentVersionId.
- baselines/{id}: documentVersionRefs, confirmedBy, confirmedAt, reason.
- tasks/{id}: title, description, status, assigneeId, featureRef, sourceRef, acceptance.
- decisions/{id}: proposal, outcome, alternatives, reason, sourceRefs, confirmedBy, supersedesId.
- resources/{id}: title, sourceType, assetId/url, scope, ownerId.
- readiness/config: repositoryUrl, deployUrl, firebaseConsoleUrl, owners, items, exceptions.
- releases/{id}: demoUrl, baselineId, summary, knownIssues, publishedAt.
- feedback/{id}: authorId, scope, body, status, releaseId, appliedVersionId.
- exports/{id}: baselineId, manifest, checksum, createdBy, assetId, status.
- showcase/config: problem, solution, demoUrl, slidesUrl, retrospective, status.
- supportGrants/{uid}: scopes, expiresAt, grantedBy.
- publishedTimeline/{id}: approvedSummary, publicLinks, occurredAt, internalEventRef.

projectDirectory와 publishedTimeline만 기본적으로 기수 열람 가능하다. 내부 eventRef는 공개 응답에서 제거한다.
공개 피드백은 scope=cohort인 별도 문서만 제공하고 내부 피드백을 섞지 않는다.

## 이력·원본·AI·채팅

| 경로 | 주요 필드 |
|---|---|
| cohorts/{c}/versions/{id} | entityRef, versionNumber, snapshot, previousVersionId, reason, sourceRefs, ownerId/projectId, scope |
| cohorts/{c}/events/{id} | type, actorId, entityRef, versionId, fromState, toState, reason, correlationId, scope |
| cohorts/{c}/sources/{id} | ownerId, projectId, scope, type, text/assetId, revision, status |
| cohorts/{c}/aiJobs/{id} | sourceRef, sourceRevision, requestedBy, scope, projectId, status, providerJobId, usage |
| cohorts/{c}/aiJobs/{id}/proposals/{id} | type, targetRef, expectedRevision, suggestedContent, evidence, status, resultRef |
| cohorts/{c}/channels/{ch} | type, projectId, title |
| cohorts/{c}/channels/{ch}/messages/{m} | authorId, body, replyToId, attachments, revision, sentAt, editedAt, deletedAt |
| users/{uid}/channelReads/{ch} | cohortId, lastReadAt, muted |
| cohorts/{c}/assets/{id} | storagePath, ownerId, projectId, scope, contentType, size, status |
| cohorts/{c}/idempotency/{key} | actorId, command, requestHash, resultRef, status |

반복 배열을 문서에 무한히 누적하지 않는다. 댓글/메시지/버전/사건은 별도 문서로 페이지 조회한다.
AI job의 권한은 원본과 같거나 더 좁게 유지한다. 결과 승격은 별도 명령이다.

## 역할과 권한

| 행동 | 참가자 | 리더 | 퍼실리테이터/기수 관리자 |
|---|---|---|---|
| 본인 초안 읽기/편집 | 본인 | 본인 | 자동 권한 없음 |
| 기수 공개 자료 보기/댓글 | 가능 | 가능 | 가능 |
| 팀 자료/채팅 읽기 | 활성 팀원 | 해당 팀 | 명시 supportGrant 필요 |
| 팀 기획 초안 편집 | 팀원 | 가능 | 편집 지원 권한 필요 |
| 기획/범위 결정 확정 | solo 본인 | 해당 팀 | 명시 지원 권한 필요 |
| 활동 운영 | 불가 | 불가 | 가능 |
| 투표 집계 확인 | 공개 시점 이후 | 동일 | 집계 관리 |
| 최종 선정 | 불가 | 불가 | 기수 관리자 |
| 팀 구성 승인 | 불가 | 해당 팀 | 기수 관리자 |
| 기수 역할 부여 | 불가 | 불가 | 기수 관리자, 제한 정책 |
| 원본 녹취록 열람 | 원본 ACL | 원본 ACL | 자동 권한 없음 |

cohortRole=participant/facilitator/admin. projectRole=member/leader.
서버 platform admin 권한은 일반 프런트엔드 역할과 분리하며 운영 데이터 접근은 사유가 있는 지원 절차로 제한한다.
supportGrant는 프로젝트에 한정하고 만료/회수를 지원한다. 다른 프로젝트로 전파되지 않는다.

## 인증·접근 구현 규칙

Google 로그인으로 신원을 확인한 뒤 진행 중인 기수에 참가자로 자동 가입한다. 운영 권한은 별도 관리자 설정으로만 부여한다.
ID 토큰을 서버가 검증하고 매 명령마다 현재 기수/프로젝트 멤버십을 확인한다.
역할을 클라이언트 입력이나 URL로 신뢰하지 않는다.
일반 Google 로그인만으로 참가자 자동 가입한다. 서버는 Google 공급자·검증된 이메일·유효한 ID 토큰을 확인하고 기본 권한을 participant로 지정한다. 기존 운영 권한과 참여 중지 상태는 유지한다.
Firestore/Storage Rules는 기본 거부, 필요한 읽기만 명시 허용한다. 핵심 쓰기는 서버 명령만 허용한다.
Admin SDK는 Security Rules를 우회하므로 서버 명령의 권한 검증이 별도로 필수다.
클라이언트 쿼리는 규칙을 충족하는 범위로 구성한다. 규칙이 결과에서 비공개 문서를 자동 제거한다고 가정하지 않는다.

## 파일 정책

Storage 경로: cohorts/{c}/assets/{assetId}/original.
메타데이터와 실제 권한을 함께 검증한다. 비공개 파일에 영구 공개 다운로드 URL을 배포하지 않는다.
접근 확인된 서버 다운로드 또는 적절한 인증 다운로드 경로를 사용한다.
MIME/확장자/크기 검사, 허용 목록, HTML/SVG 실행 차단, Markdown 정화.
원본 파일/버전/내보내기는 같은 공개 범위 정책과 보관 정책을 적용한다.
