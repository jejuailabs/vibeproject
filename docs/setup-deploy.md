# 환경 준비와 배포

## 두 종류의 환경

1. VibeCoding2 플랫폼 개발/운영 환경.
2. 참가자가 각자 또는 팀으로 만드는 서비스 환경.

플랫폼에서는 참가자 서비스의 URL·소유자·준비 상태만 관리한다. 서비스 계정 키·비밀번호·인증 토큰 입력란은 만들지 않는다.

## 플랫폼 저장소

GitHub 저장소를 만들고 루트 main.md와 docs를 개발 코드와 함께 관리한다.
이 문서 묶음만으로 GitHub 저장소/Firebase/Vercel 프로젝트가 생성된 상태는 아니다.
코드 초기화 때 README 실행 안내, .gitignore, .env.example, 패키지 잠금 파일을 추가한다.
.env.example에는 변수 이름과 설명만 넣고 실제 키는 넣지 않는다.

## 런타임 기준

Next.js/TypeScript와 Vercel이 지원하는 Node LTS의 호환성을 확인해 선택한다.
패키지 매니저는 한 종류를 정해 잠금 파일을 통일한다.
정확한 버전과 실행 명령은 실제 초기화 결과를 문서에 추가한다. 아직 없는 npm 스크립트를 이미 존재한다고 가정하지 않는다.

## Firebase 준비

- 개발/운영 프로젝트를 분리한다.
- 프로젝트 리전과 서비스 사용 조건을 운영 환경에 맞춰 확인한다.
- Authentication의 Google 공급자를 활성화하고 허용 도메인을 설정한다.
- Firestore/Storage를 구성하고 기본 거부 Rules를 적용한다.
- 서비스 계정은 서버에서만 사용한다.
- 첫 기수 관리자 부여는 서버 관리 스크립트 또는 통제된 초기화 절차로 한다.
- 누구나 첫 로그인에서 관리자가 되는 코드는 금지한다.
- Storage/AI 등 유료 조건은 실제 콘솔에서 확인한다.

Google 웹 인증 구현은 [공식 안내](https://firebase.google.com/docs/auth/web/google-signin)를 기준으로 검증한다.
Firestore Rules와 서버 권한 검증을 함께 구현한다. [권한 조건](https://firebase.google.com/docs/firestore/security/rules-conditions)을 참고한다.

## 환경 변수 목록 제안

| 범위 | 변수 | 용도 |
|---|---|---|
| 공개 설정 | NEXT_PUBLIC_FIREBASE_API_KEY | Firebase 웹 설정 |
| 공개 설정 | NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | 로그인 도메인 |
| 공개 설정 | NEXT_PUBLIC_FIREBASE_PROJECT_ID | 연결 프로젝트 |
| 공개 설정 | NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | 저장소 |
| 공개 설정 | NEXT_PUBLIC_FIREBASE_APP_ID | 웹 앱 식별 |
| 서버 | FIREBASE_PROJECT_ID | Admin 대상 |
| 서버 | FIREBASE_CLIENT_EMAIL | 서비스 계정 |
| 서버 | FIREBASE_PRIVATE_KEY | 서비스 계정 비밀 값 |
| 서버 | APP_BASE_URL | 서비스 기준 주소 |
| 서버 | AI_PROVIDER / AI_MODEL | 공급자 확정 후 사용 |
| 서버 | AI_API_KEY | 공급자 비밀 값 |
| 기능 | AI_ENABLED | 기본 false |
| 로컬 | Emulator 연결 설정 | 개발 환경에만 |

공개 Firebase 설정은 권한 통제가 아니다. 실제 데이터 보호는 Rules와 서버 권한에 의존한다.
private key는 빌드 출력/브라우저 번들에 포함하지 않는다.
다른 인증 방식을 채택하면 서버 변수 구성을 갱신한다.

## Vercel

GitHub 저장소 연결, 빌드 명령 확인, Development/Preview/Production 환경 변수를 구분한다.
Preview는 개발용 Firebase를 사용한다. 운영 데이터에 연결된 무분별한 미리보기를 만들지 않는다.
Google 로그인을 검증할 안정적인 개발/스테이징 도메인을 정한다.
배포 후 허용 도메인, 콜백 동작, API 토큰 검증, Storage 접근을 실제 확인한다.
환경 변수 동작은 [Vercel 공식 문서](https://vercel.com/docs/environment-variables)를 기준으로 한다.

## 로컬 개발

Firebase Emulator에서 Auth/Firestore/Storage와 Rules를 검증한다.
현실 데이터 대신 가상 참가자·가상 대화로 시드한다.
일반 참가자 2명, 다른 팀 참가자, 팀장, 관리자, 미가입 계정을 준비한다.
실제 서비스 자격 증명 없이도 mock 또는 Emulator로 기본 UI를 실행할 수 있게 한다. mock은 명시한다.

## 참가자 개인 체크리스트

Google/GitHub/Vercel/Firebase 가입, 선택한 코딩 도구 설치, 필요한 런타임/Git 설치, 프로젝트 폴더, 로그인 확인.
체크 항목에는 담당자/확인 시각/도움 요청/예외 이유를 둔다.
사용할 코딩 에이전트가 정해지기 전 제품별 설치 명령을 고정하지 않는다.

## 참가자 프로젝트 체크리스트

GitHub 저장소/소유자, Vercel 연결/배포 URL, Firebase 프로젝트/담당자, Google 로그인, 데이터 접근 규칙, 환경 변수 설정, 첫 배포 확인.
팀원별로 같은 프로젝트를 중복 생성하지 않는다.
Google 로그인이 불필요하다고 바꾸는 경우 원래 공통 기준과의 변경 이유를 기획에 기록한다.

## 운영 배포 확인

인증 → 가입 → 글 작성 → 댓글 → 채팅 → 투표 → 팀 → 문서 → 데모의 흐름을 실제 배포에서 점검한다.
백업 주기/보관/복구 절차를 정하고 복구 연습을 한다.
프리뷰를 통한 확인과 실제 운영 반영은 구분한다.
현재 문서 작성 작업은 배포·결제·외부 계정 생성까지 수행하지 않는다.
