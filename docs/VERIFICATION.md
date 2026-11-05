# 구현·검증 기록

검증일: 2026-11-05 (Asia/Seoul)

## 현재 상태

로컬 전환 구현을 완료했다. Firebase 웹 앱/사이트/서울 기본 DB와 보안 규칙까지 설정했다. Vercel API와 Hosting 콘텐츠를 배포했고 공개 API의 인증·CORS 검사를 통과했다. 실제 Google 로그인·방 생성·동일 계정 두 탭 채팅/설정 동기화·새로고침 복원도 확인했다. 서로 다른 4~6계정의 운영 전체 게임·탈퇴·네트워크 지연/무료 한도 검증은 미완료다. 기능 동등성의 비교 기준은 MIGRATION.md의 기존 Java 코드 기반 계약이다. 공개 출시 완료 또는 운영에서의 완전한 동등성을 선언하지 않는다.

## 실행한 검증

| 명령/검증                               | 결과                                              | 범위                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                              | 22개 통과                                         | 4/5/6인 덱·역할, 카드 비밀 보호, 턴·버전·3초 전환·모든 승패, 닉네임·방·준비·강퇴·위임·채팅, 종료 데이터 삭제, HTTP 입력·Origin·demo 토큰 차단                           |
| `npm run check`                         | 통과                                              | 화면·공유 타입·서버·테스트 TypeScript 검사                                                                                                                              |
| `npm run build`                         | 통과                                              | 운영 정적 빌드 및 타입 검사                                                                                                                                             |
| API esbuild 번들                        | 통과                                              | Vercel 진입점과 서버 모듈의 ESM/Node 번들 구성 확인(실제 Vercel 배포 아님)                                                                                              |
| `npm run test:firebase`                 | 7개 통과(상위 1 + 하위 6)                         | demo-kraken Firestore Emulator에서 실제 운영 저장소의 닉네임 경합·마지막 자리 동시 입장·카드 중복 선택, Rules의 개인 손패/비밀 접근 차단, 마지막 퇴장 후 하위 문서 삭제 |
| `npm run test:browser`                  | 4인 통과                                          | 독립 Chromium 컨텍스트에서 가입·방 생성/검색/입장·채팅/XSS·준비·시작·카드 진행·새로고침 복원·결과·10초 후 복귀                                                          |
| `KRAKEN_PLAYERS=5 npm run test:browser` | 5인 통과                                          | 동일 흐름                                                                                                                                                               |
| `KRAKEN_PLAYERS=6 npm run test:browser` | 6인 통과                                          | 동일 흐름                                                                                                                                                               |
| 모바일                                  | 390×844에서 가로 넘침 없음, 이미지 확인           | 카드·상태·채팅 레이아웃. 원본 스타일 복원 후 모바일 하단 참여자/채팅/컨트롤 패널을 검증                                                                                 |
| 최종 SDK 갱신 후 재검증                 | 단위/API 22개, Firestore 7개, 4인 브라우저 재통과 | Firebase 13.2 / Admin 14.5 / gRPC 보안 패치 적용 후                                                                                                                     |
| `git diff --check`                      | 통과                                              | 공백 오류 없음                                                                                                                                                          |

테스트 환경은 macOS arm64, Node.js 26.0.0, Chromium headless다. Firestore Emulator에는 임시 디렉터리의 Java 21 JRE를 사용했다. Firebase CLI의 일부 개발 의존성은 Node 20/22/24를 선언하므로 개발·출시는 Node 22 또는 24를 권장한다. 실제 Firebase 프로젝트에 테스트 데이터를 쓰지 않았고 Cloud Billing을 연결하지 않았다.

브라우저 테스트 산출물은 `.gitignore`에 포함된 `test-results/`에 저장한다. `landing.png`, `lobby.png`, `waiting-room.png`, `game.png`, `mobile-game.png`, `result.png`로 화면을 확인할 수 있다. 랜덤 배정으로 전체 게임을 플레이하는 브라우저 검사와 별개로 세 가지 종료 조건은 규칙 테스트에서 각각 고정 사례로 검증한다.

## 남은 제한과 출시 조건

1. Google OAuth 제공업체 활성화와 승인 도메인 저장은 확인했다. 실제 Google 로그인과 운영 API의 ID 토큰·DB 접근은 방 생성/채팅/설정 변경으로 확인했다. 재인증 후 Firebase Auth 계정 삭제는 아직 검증하지 않았다. 4/5/6인 전체 게임의 자동화 흐름은 로컬 인증·SSE 어댑터를 사용한다. Firestore 저장소/Rules는 에뮬레이터에서 별도로 검증했으며 실제 웹 구독·Google 로그인 통합 검증을 대체하지 않는다.
2. Firebase Hosting과 Vercel의 실제 배포·설정 값·서울 리전·Origin은 배포 후 확인해야 한다. 실제 트래픽에서의 CPU, 호출 수, Firestore 읽기·쓰기량은 아직 측정하지 않았다.
3. 무료 한도를 넘으면 중단을 수용한다. Spark/Hobby를 유지하는 조건이며 무료 무제한·무중단 보장은 아니다. 계정 설정 확인은 RELEASE.md를 따른다.
4. 3초 전환은 서버 저장 기한을 기준으로 접속 중 클라이언트가 요청하며 서버 트랜잭션이 판정한다. 전원 탭이 멈추면 다음 요청에서 진행된다. 종료 후 10초 정리 역시 요청 시 수행되며 상주 유료 스케줄러는 없다. 자동 전환 요청 실패는 최대 3회까지만 재시도한다.
5. 명시적 게임 도중 퇴장은 기존처럼 해당 플레이어의 턴에서 게임을 멈추게 할 수 있다. 연결 끊김만으로 자동 퇴장/방장 교체하는 기능은 기존에도 없으므로 추가하지 않았다.
6. 사용자 결정에 따라 RDS 기존 사용자 데이터는 이전하지 않고 새로 시작한다. 기존 사용자는 Google 로그인 후 닉네임을 새로 등록한다. Java 소스와 기존 화면은 비교 기준으로 보존했다.
7. **의존성 경고:** `npm audit --omit=dev --audit-level=high`는 종료 코드 0이며 높음/치명적 경고는 없다. 중간 등급 4건(`@google-cloud/firestore-api` → `google-gax` → `rimraf`/`glob`/`minimatch`)이 남아 있다. 호환 패치인 `npm audit fix`를 실행해도 남는 상위 의존성 제약이다. 개발 CLI까지 포함하면 중간 등급 경고 13건이 보고된다. 무리한 강제 다운그레이드는 하지 않았고, 실제 출시 전 상위 패키지 패치 여부를 다시 확인한다. gRPC 취약점은 같은 1.x의 패치된 버전으로 override하여 에뮬레이터 회귀 검증을 완료했다.
8. 빌드는 초기 JS 약 620KB(압축 약 191KB)의 청크 크기 권고를 출력한다. 오류는 아니지만 실제 Hosting 전송량과 느린 네트워크에서 확인할 사항이다.

## 기존 Spring Boot 디자인 복원

사용자 요청에 따라 원본 `templates/login.html`, `lobby.html`, `game-room.html`과 `img.png`, `img_1.png`, `img_2.png`를 비교해 화면을 맞췄다.

- 로그인: 중앙 흰색 카드, 문어 아이콘, 파란 Google 로그인 버튼.
- 로비: 중앙 흰색 컨테이너, 환영 문구·마이페이지·로그아웃, 방 목록 표, 생성 버튼과 모달, 코드 검색.
- 게임방: 데스크톱 350px 왼쪽 사이드바의 참여자·채팅·컨트롤, 오른쪽 대기실/게임 정보·세로 플레이어 카드 목록.
- 카드: 회색 뒷면, 보물 노랑·크라켄 보라·빈 상자 회색, 현재 턴 노란 강조.
- 모바일: 참여자/채팅/컨트롤 하단 탭과 하단 패널. 채팅·준비·방장 설정에 기존 API를 그대로 사용한다.
- 게임 규칙·서버·DB 보관 정책은 이번 디자인 변경에서 수정하지 않았다.

이번 변경 후 `npm run build`, `npm test` 22개, 4인 및 6인 브라우저 흐름을 재검증했다. 모바일 참여자 패널·채팅 송신/상대 수신·컨트롤 패널도 브라우저에서 확인했다. 스크린샷은 `test-results/`에 갱신했다. 5인 및 Firestore 테스트의 기존 검증 기록과 운영 계정 미연결 제한은 위 표/출시 조건을 따른다.

## Firebase 프로젝트 초기 설정

- `apps:create WEB DBG`: ACTIVE 웹 앱 등록 후 SDK 설정 조회 성공.
- `hosting:sites:create dbg`: 타 프로젝트가 예약한 이름으로 거절됨. 사용자 선택 후 `dbg-kraken` 사이트 생성과 목록 재조회 성공.
- `firestore:databases:get '(default)'`: 서울 `asia-northeast3`, FIRESTORE_NATIVE, STANDARD, `freeTier: true`, PITR 비활성화 확인.
- `deploy --only firestore:rules,firestore:indexes`: 규칙 컴파일·배포와 인덱스 배포 성공. Hosting 콘텐츠나 Vercel API는 아직 공개하지 않음.
- `.env.production.local`의 공개 SDK 설정이 Git에서 제외되는지 확인. 초기에는 API URL과 서버 서비스 계정이 미설정이었으며, 아래 운영 배포 단계에서 연결했다.
- 브라우저에서 Firebase Spark와 Vercel Hobby 상태 확인. Google 제공업체는 사용자 승인 후 저장했으며 API에서 `enabled: true`를 재확인했다. 새 사이트의 `dbg-kraken.web.app`, `dbg-kraken.firebaseapp.com` 승인 도메인 추가 후 재조회도 통과했다. 실제 Google 로그인 통합 검증은 배포 후 수행한다.

## Vercel API 배포 준비

- 사용자 승인 후 Vercel CLI 로그인 성공. `dbg-kraken` 프로젝트 생성·연결 후 조회 성공.
- 소유 계정 API 조회 결과 `billing.plan: hobby`, `billing.status: active` 확인. 유료 업그레이드나 결제 설정을 변경하지 않았다.
- Firebase `dbg-api` 전용 계정과 Firestore 데이터/사용자 조회·삭제 권한을 생성하고 IAM 정책 재조회로 확인했다.
- Vercel Production에 프로젝트 ID·서버 계정 이메일·허용 Origin 세 값 등록 성공. 비밀키 생성·전송은 자동 승인 검토가 명시적 동의를 요구하여 일시 차단했다. 이후 사용자 동의를 받아 키를 생성해 Vercel Production Secret에 직접 등록했다. 비밀키 파일은 만들지 않았다.
- `.vercel/` Git 제외, `.env`/`.env.*`의 Vercel 업로드 제외, `.env.example`의 Git 추적 가능 상태 확인. Vercel CLI가 추가한 중복 ignore 패턴은 제거했다.
- 단위/API 테스트 22개 재통과. 이후 운영 배포와 검증 결과는 아래와 같다.

## 운영 배포 및 공개 API 검증

- API: `https://dbg-kraken.vercel.app/api/command`. 운영 배포 `dpl_AnkgqP9c5wunC61rgJNdNWWVyvkG`가 READY로 완료됐다. 런타임 오류 로그에서 실행 리전 `icn1`을 확인했다. 빌드 머신 위치 `iad1`은 함수 실행 리전과 별개다.
- 최초 배포는 `jwks-rsa`가 ESM 전용 `jose`를 require하면서 함수 시작에 실패했다. `node --no-experimental-require-module`로 동일 오류를 재현했고, [Vercel 공식 안내](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration#experimental-nodejs-require-of-es-module)에 따라 Production `NODE_OPTIONS=--experimental-require-module`을 등록한 뒤 재배포했다. 패키지 다운그레이드나 인증 검증 우회는 하지 않았다.
- 공개 API 직접 요청 5개 통과: 허용 Origin OPTIONS 204/CORS 헤더, 토큰 없음 401, 잘못된 토큰 401, 외부 Origin 403, GET 405. 이는 실제 로그인 사용자와 DB 트랜잭션의 통합 검증을 대신하지 않는다.
- 운영 Firebase SDK/API 주소를 포함한 `npm run build` 통과. 실제 운영 빌드의 JS는 약 799KB/gzip 244KB이며 번들 크기 및 같은 Firebase Auth 모듈의 정적/동적 import 경고가 있다. 기능 오류로 보고되지는 않았다.
- `firebase deploy --only hosting:dbg`: `https://dbg-kraken.web.app`에 정적 파일 3개 배포 성공. Chrome에서 게임 제목과 Google 로그인 버튼 렌더링 및 실제 Google 계정 선택 창 진입을 확인했다. 여러 계정이 표시되어 사용자의 계정 선택·최초 로그인·닉네임 등록을 기다린다. `test-results/production-landing.jpg`에 화면을 저장했다.
- Cloud Billing API 재조회: `billingEnabled: false`, 결제 계정 미연결. Vercel은 활성 Hobby로 확인했으며 유료 전환·유료 리소스 추가를 하지 않았다.
- Hosting HTTP 200, 보안 헤더, 배포된 JS와 로컬 빌드의 SHA-256 일치 및 운영 API 주소 포함을 확인했다. 실제 Firestore REST의 비로그인 `secrets` 문서 읽기도 403으로 차단됐다.

## 실제 로그인 이후 운영 검증

- 사용자가 Google 로그인과 닉네임 등록을 완료한 후 실제 운영 로비와 Firestore 구독 연결 상태를 확인했다. 계정·닉네임 변경이나 탈퇴는 실행하지 않았다.
- 검증용 대기방을 생성해 참가자/방장/방 코드를 확인했다. 다른 탭에서도 동일 계정의 방이 복원됐다. 이는 서로 다른 사용자 2명의 검증은 아니다.
- 첫 탭에서 채팅 전송 후 다른 탭에서 수신, 다른 탭에서 응답 후 이미 열린 첫 탭에 새로고침 없이 반영되는 것을 확인했다. 방 정원을 6명에서 4명으로 변경한 값도 다른 탭에 반영됐다.
- 첫 탭 새로고침 후 로그인·방 참여·정원 4명·채팅 두 개가 복원됐다. `test-results/production-chat-restored.jpg`에 저장했다. 정원 미달에서 게임 시작 버튼이 비활성화되는 것도 확인했다.
- 브라우저의 방 나가기 확인 창을 자동화하는 과정에서 도구 연결이 멈췄다. UI 나가기 완료로 기록하지 않는다. 검증용 탭을 닫고 기존 Firebase CLI 인증으로 같은 `GameService`의 `leave` 명령을 호출해 정리했다. 방 제목·WAITING 상태·참가자 1명·정확한 검증 메시지 두 개를 확인한 뒤 실행했다.
- 정리 후 방/서버 비밀 문서 부재와 프로필의 `roomCode: null`, 닉네임 보존을 확인했다. 새 Chrome 탭에서도 빈 로비와 기존 닉네임을 확인했다. 검증용 방·채팅 기록을 남기지 않았다.
- 서로 다른 실제 Google 계정 4/5/6인의 준비·카드 선택·승패·개인 손패 격리는 운영에서 아직 검증하지 않았다. 기존 로컬/에뮬레이터 통과 기록과 구분한다.

## 추가 통합 검증: Auth·Firestore·운영 HTTP (2026-11-05)

사용자가 별도 Google 테스트 계정이 없다고 알려 에뮬레이터 진행을 승인했다. `0517qw@gmail.com` 등 실제 운영 계정의 탈퇴나 운영 데이터 변경은 실행하지 않았다.

- 추가 파일: `tests/auth-game.integration.ts`, 재현 명령: `npm run test:integration`. 로컬 Auth/Firestore 에뮬레이터 주소와 `GCLOUD_PROJECT=demo-kraken`을 모두 확인한 후 실행한다.
- 결과: 상위 테스트 1개 + 하위 4개, 총 **5개 통과**, 약 67초, 종료 코드 0. TypeScript 검사도 통과했다.
- 4·5·6인 각각 독립된 Firebase 앱/Auth 세션을 만들고 Google 제공업체 모의 로그인으로 운영 `productionHandler`의 HTTP 엔드포인트에 요청했다. 서비스 함수를 직접 호출해 인증을 생략하지 않았다.
- 각 정원에서 가입·방 생성·입장·준비·시작·Firestore 채팅 구독·본인 5장 손패 조회와 타인 손패/서버 비밀 읽기 차단을 검증했다. 미공개 카드 종류가 공개 문서에 포함되지 않는 것도 검사했다.
- 서버 전용 상태를 테스트에서만 읽어 크라켄을 피하는 카드를 선택했다. 각 게임은 실제 3초 라운드 전환을 기다려 1~4라운드를 진행하고 스켈레톤 승리로 종료했다. 보물 완수/크라켄 승리는 기존 규칙 테스트 범위이며 이번 통합 게임은 라운드 소진 경로를 검증한다.
- 종료 직후 개인 손패·서버 비밀·채팅 삭제, 10초 경과 후 bootstrap에 의한 방 삭제와 전원 참여 참조 해제를 확인했다.
- 탈퇴 테스트는 별도 모의 사용자만 사용했다. 에뮬레이터 전용 무서명 토큰의 `auth_time`을 6분 전으로 설정해 401과 데이터 보존을 확인했다. Firebase SDK의 `reauthenticateWithCredential` 후 새 토큰으로 탈퇴하여 Auth 사용자·프로필·닉네임 예약·빈 방·서버 비밀 삭제, 기존 토큰의 401을 확인했다. 운영에서 무서명 토큰을 사용하지 않는다.
- 한계: 실제 Google 동의/팝업 재인증과 운영 IAM은 이 에뮬레이터가 재현하지 않는다. [Firebase Auth 에뮬레이터 문서](https://firebase.google.com/docs/emulator-suite/connect_auth)의 범위를 따른다. 실제 운영의 서로 다른 4~6 Google 계정 게임 및 탈퇴 검증으로 기록하지 않는다.
- GitHub는 읽기 전용 `git ls-remote origin HEAD`로 확인했다. 원격 HEAD는 `fa2b4f7e2442f8a4ea27ec01f5bd0eddcd56e31f`이며 현재 전환 구현은 로컬 미커밋/미푸시 상태다. 이번 요청에서는 소스를 푸시하거나 운영을 재배포하지 않았다.

## 재경기 및 후속 운영 점검 (2026-11-05)

- 기능 계약은 REMATCH.md에 기록했다. 단위/API **28개**, Auth·Firestore·운영 HTTP 통합 **5개**, 로컬 브라우저 **4/5/6인 재경기** 및 최종 6인 모바일 스타일 재검증이 통과했다. 운영 빌드/타입 검사도 통과했다.
- 통합 검사는 Firestore SDK `disableNetwork` 후 다른 사용자 채팅을 전송하고 `enableNetwork` 후 구독 수신을 확인했다. 이는 실제 모바일 통신사 장애 검증은 아니다.
- 운영 닉네임 `attack`을 임시 이름으로 변경한 뒤 원래 이름으로 복원했다. 로그아웃 후 Google 계정 선택 단계의 자동화 연결이 지연되어 사용자가 직접 재로그인을 완료했다. 새 Chrome 탭에서 기존 닉네임과 로비·실시간 연결을 확인했다. `production-account-restored.jpg`에 저장했다. 실사용 계정은 탈퇴하지 않았다.
- 재경기 UI 산출물: `test-results/result-rematch.png`, `mobile-result-rematch.png`, `rematch-waiting.png`. 390×844 화면의 가로 넘침이 없고 기존 파란 버튼 스타일과 44px 이상 터치 높이를 적용했다.
- 운영 Firestore 집계 조회: users 1개, names 1개, rooms 0개, secrets 0개. 최근 24시간 Monitoring 지표 합계 읽기 75회, 쓰기 15회. 조회 이후 요청 및 모니터링 집계 지연은 반영되지 않을 수 있다. 문서 내용이나 비밀키는 출력하지 않았다.
- Vercel CLI billing usage는 Hobby의 비용 데이터를 반환하지 않았다. 이를 사용량/비용 0으로 해석하지 않았다. 브라우저 Usage의 Last 30 Days 화면에서 Function Invocations 30, CDN Requests 45, Fast Data Transfer 891.11kB, Fluid Active CPU 3s, Deployment Storage 1.27MB를 확인했다. 플랜은 Hobby이며 유료 기능·구독을 추가하지 않았다.
- 재경기 기능은 운영의 여러 실제 Google 계정으로 플레이한 검증이 아니며, 운영 API와 정적 화면 배포는 아래 배포 기록을 따른다.
