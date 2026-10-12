# Vibe — 바이브코딩 워크숍

Next.js + Firebase + Google 로그인. GitHub 저장소에서 Vercel로 배포하는 구조입니다.

## 현재 구현

개인/전체/프로젝트 관점의 대시보드, 생각 작성과 공개 범위, 댓글, 전체/팀 채팅, 관리자 직접 선정·종료, 프로젝트 생성, 이전 내용과 변경 이유를 보존하는 이력.
실제 모드는 Firebase 인증과 서버 권한 검사를 사용합니다. /preview는 가상 데이터로 동작하는 별도 메모리 샘플이며 새로고침 시 초기화됩니다.

## 실행

1. Node 24.12 이상과 npm을 준비합니다.
2. npm install
3. .env.example을 참고해 .env.local을 설정합니다.
4. npm run dev
5. http://localhost:3000 또는 /preview

로컬 서비스 계정 파일은 GOOGLE_APPLICATION_CREDENTIALS로 참조합니다. 키 파일을 저장소로 복사하지 않습니다.
Vercel에서는 서버 전용 FIREBASE_SERVICE_ACCOUNT_JSON 환경 변수와 NEXT_PUBLIC_FIREBASE_* 설정을 등록합니다.
Google 공급자와 로컬/배포 도메인을 Firebase Authentication에서 허용해야 합니다.

## 첫 관리자

BOOTSTRAP_ADMIN_EMAIL에 명시한 계정에만 초기 관리자 권한을 예약합니다. 일반 참가자는 이 과정 없이 Google 로그인으로 가입합니다.
npm run bootstrap:admin
이미 존재하는 기수·활동은 덮어쓰지 않습니다. 첫 로그인 사용자가 자동 관리자가 되지 않습니다.

## 검증

npm run typecheck
npm test
npm run build

## 운영 범위

투표 라운드, 팀 참여 신청, 파일 업로드, 기획 문서/ZIP 내보내기, 녹취록 검토, 발표 관리를 제공합니다. 자동 AI 분석은 운영 공급자 설정이 필요합니다.
채팅은 20초 주기로 갱신되며 답글·멘션·읽음·대화의 아이디어 전환을 지원합니다.
Google 로그인만으로 참가자 자동 가입됩니다. 초대 코드나 이메일 사전 등록은 필요하지 않습니다. 기존 관리자 권한은 유지되며 운영 화면에서 참가자 권한을 관리합니다.
권한은 서버에서 검사하며 원격 Firebase 규칙은 유지합니다. /cohorts는 기존 기본 거부 규칙으로 보호됩니다. 로컬 rules 파일은 참조용이며 firebase.json에서 배포 대상으로 등록하지 않았습니다.

전체 요구: [main.md](main.md). 현재 범위: [개발 현황](docs/implementation-status.md).
