# 원본·버전·변경 이력

## 기록의 세 층

1. 작업 초안: 자동/수동 저장 가능한 현재 작업본. revision으로 동시 수정 확인.
2. 확정 버전: 중요한 시점의 전체 내용 스냅샷. 생성 후 일반 편집 불가.
3. 활동 사건: 누가 언제 무엇을 했는지에 대한 append-only 사건.

사건만 저장하고 과거 내용을 복원할 수 없게 만들지 않는다. 모든 키 입력을 주요 버전으로 저장하지도 않는다.

## 버전 생성 시점

아이디어 첫 공유, 투표 후보 확정, 선정 시점, 프로젝트 최초 문제 정의, 기획 베이스라인 확정, 대상/범위의 중요한 변경, 최종 발표 확정.
선정 시 내용이 바뀌지 않았다면 후보 버전을 참조하며 불필요한 동일 스냅샷 복제를 피한다.
일반 글의 오타 수정과 채팅 편집은 revision 이력이며 성장 타임라인의 기본 항목이 아니다.

## 버전 필드

versionId, entityType, entityId, versionNumber, schemaVersion, snapshot, previousVersionId, reason, sourceRefs, createdBy, createdAt.
snapshot에는 당시 내용과 구조를 보존한다. 근거를 가리키는 sourceRefs만 저장하고 원본을 무조건 복제하지 않는다.
versionNumber는 엔티티 내 순서이며 ID는 불변 식별자다.
displayLabel은 'V1 · 최초 문제 제안'처럼 사람이 읽는 제목이다.

## 사건 필드

eventId, cohortId, projectId(optional), type, actorId, occurredAt, entityRef, fromState, toState, versionId, reason, sourceRefs, correlationId.
서버에서 생성한다. 클라이언트가 사건 작성자/시각/유형을 임의 지정할 수 없다.
재시도는 같은 correlationId/idempotencyKey로 중복 사건 생성을 막는다.
사건 수정 대신 정정 사건을 추가한다.

## 관계 유형

originated_from: 생각/아이디어가 시작된 자료.
selected_from: 프로젝트의 선정된 아이디어 버전.
derived_from: 재개·분리·후속 프로젝트.
merged_from: 여러 원본에서 출발한 프로젝트.
responds_to: 질문/피드백에 대한 반영.
implements: 배포가 구현한 기획 베이스라인.
supersedes: 앞선 결정/버전을 대체하는 기록.

단순 ID 목록만 보여주지 않고 관계 의미와 시점을 표시한다. 연결 시 같은 기수인지, 대상 존재/접근 권한을 확인한다.

## 대표 사건

idea.published, idea.candidate_frozen, vote.closed, selection.confirmed, idea.closed_unselected, idea.reopened,
project.created, membership.changed, decision.confirmed, document.baselined, scope.changed,
release.created, feedback.applied, project.completed, content.redacted.

## 프로젝트 이력

선정 원본은 독립 보존하고 프로젝트가 현재 문제/해결 방향을 따로 발전시킨다.
선정 원본을 수정해 프로젝트의 변경을 표현하지 않는다.
여러 원본을 선택해도 각 작성자와 버전이 추적 가능해야 한다.
과거 기획 복원은 해당 스냅샷에서 새 초안/버전을 만들고 복원 이유를 남긴다.

## 베이스라인

베이스라인은 문서별 확정 versionId의 묶음이다.
예: product V2 + features V3 + screens V2 + design V1 + data-auth V2 + setup-deploy V1.
한 번 확정된 묶음은 불변이다. 내보내기와 배포 기록은 baselineId를 참조한다.
일부 문서만 변경되어도 새 베이스라인을 만들어 문서 간 조합을 명시한다.
팀원이 동시에 문서를 수정하면 요청에 포함된 각 revision과 서버 값을 비교하고 차이가 있으면 확정을 거절한다.

## 타임라인 공개

팀 내부 전체 이력과 기수 공개 성장 이력을 분리한다.
공개 타임라인은 리더가 선택한 사건에 대한 검토된 summary와 허용된 공개 링크로 구성한다.
기수 참가자가 권한 없는 원본의 제목/발언자/내용을 추측할 수 없도록 원본 참조를 숨긴다.
권한이 있는 팀원에게만 상세 근거를 제공한다.
원문 공개 범위 축소/삭제 시 관련 공개 요약도 재검토 표시 또는 숨김 처리한다.

## 삭제·정정

'이력 보존'은 무제한 보관이나 개인정보 삭제 금지를 뜻하지 않는다.
일반 운영에서는 soft-delete/tombstone으로 연결성을 유지한다.
민감 정보가 잘못 입력되었거나 삭제 의무가 있는 경우 권한 있는 정정 절차가 본문·버전·파일·색인·파생 요약을 제거/비식별화한다. 사건에는 본문 없이 정정 사실만 남긴다.
백업과 내보낸 파일의 보관/삭제 범위는 운영 정책에 명시한다.


## 2026-10-17 문제정의 과정 추가

[생각 구체화·문제정의](problem-definition.md)의 다섯 질문, 초안 버전, 통제범위, 선정 준비 및 공개 범위를 적용한다. Idea.refinement와 이력 snapshot.refinement가 같은 카드의 발전 과정을 담는다. 신규 투표는 준비된 문제정의를 고정하며, 선정한 문장이 프로젝트 기획의 출발점이 된다.
