# 출시 절차: Firebase Spark + Vercel Hobby

## 출시 원칙

사용자가 승인한 비용 상한은 0원이다. Cloud Billing 연결, Blaze/Pro 전환, Pro 체험, 유료 도메인·Marketplace 구매를 하지 않는다. 무료 한도 소진 시 장애 안내와 서비스 중단을 수용한다. 결제 카드·비밀키를 채팅·Git에 공유하지 않는다.

2026-11-05 확인한 정책:

- [Firebase 요금제](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans): Spark는 결제 계정 없이 사용하며, Cloud Billing을 연결하면 Blaze로 자동 전환된다.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby): 개인·비상업 용도. 기본 사용량 초과 시 자동 과금 대신 제한된다.
- [Firebase Hosting](https://firebase.google.com/docs/hosting): 무료 web.app/firebaseapp.com 주소와 HTTPS 제공.

무료 정책은 바뀔 수 있으므로 실제 출시 시 다시 확인한다. 계정 설정은 코드로 증명할 수 없으므로 배포 담당자가 확인해야 한다.

## 확정된 출시 결정 (2026-11-05)

- Firebase 프로젝트: `board-game-kraken` / `894297269744`. 콘솔에서 Spark 무료 요금제를 확인했고 CLI 로그인을 완료했다.
- 웹 앱: **DBG**, 앱 ID `1:894297269744:web:fc0a616d09cad151b4a935`를 등록했다. 게임 화면 이름은 노터치 크라켄을 유지한다.
- 무료 사이트: `dbg.web.app`은 타 프로젝트가 사용 중이어서 생성하지 못했다. 사용자가 선택한 **`dbg-kraken.web.app`**을 생성·확인했다. `.firebaserc`의 `dbg` 대상이 해당 사이트를 가리킨다. Hosting 콘텐츠를 배포하고 실제 로그인 화면을 확인했다.
- DB: `(default)` 하나, 서울 `asia-northeast3`, Native/Standard, `freeTier: true`, PITR 비활성화를 CLI 조회로 확인했다. 보안 규칙과 인덱스 적용을 완료했다. 백업 스케줄·TTL·유료 기능·Cloud Billing을 추가하지 않았다.
- 운영 웹 설정: Firebase SDK 구성을 `.env.production.local`에 저장했고 Git 제외를 확인했다. API 주소 `https://dbg-kraken.vercel.app`을 연결해 운영 빌드·Hosting 배포를 완료했다. 서버 비밀키는 사용자 명시적 동의 후 Vercel Production Secret으로 등록했다.
- Google 로그인: 사용자 승인에 따라 공개 이름 DBG와 지원 이메일을 저장하고 활성화했다. API 재조회로 `google.com`의 `enabled: true`를 확인했다. `dbg-kraken.web.app`과 `dbg-kraken.firebaseapp.com`을 승인 도메인에 추가하고 재조회했다. 사용자가 계정 선택·최초 로그인·닉네임 등록을 완료했다. 실제 로비, 방 생성, 두 탭 채팅/설정 동기화, 새로고침 복원을 확인했다.
- Vercel: 사용자 로그인 승인 후 `dbg-kraken` 프로젝트를 생성하고 로컬 저장소에 연결했다. 소유 계정 `0517qw-1901s-projects`의 `billing.plan: hobby`, `billing.status: active`를 API로 확인했다. 운영 API를 배포하고 공개 주소의 인증·CORS·메서드 제한 검사를 통과했다.
- 배포 인증: GitHub CLI 로그인은 유효하다. Vercel CLI 로그인은 사용자의 기기 승인으로 완료했다.
- 서버 계정: `dbg-api@board-game-kraken.iam.gserviceaccount.com`을 생성했다. `roles/datastore.user`와 프로젝트 사용자 지정 역할 `dbgAuthUserAccess`(`firebaseauth.users.get`, `firebaseauth.users.delete`)만 부여하고 IAM 정책을 재조회했다. 기존 관리 계정의 권한은 변경하지 않았다.
- 서버 일반 설정: Vercel Production에 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `ALLOWED_ORIGINS`를 등록했다. 이 세 값에는 비밀키가 포함되지 않는다.
- 서버 비밀키: 사용자의 명시적 동의 후 생성해 Vercel Production Secret `FIREBASE_PRIVATE_KEY`로 등록했다. 키는 메모리와 stdin으로만 전달했으며 채팅·Git·로컬 파일에 저장하지 않았다. 키 이름 등 비밀이 아닌 관리 메타데이터만 Git 제외된 `.vercel/`에 기록했다.
- 데이터: 기존 RDS 사용자·방·게임 기록을 이전하지 않고 새로 시작한다. 기존 사용자는 Google 로그인 후 닉네임을 새로 등록한다. 기존 AWS/RDS를 조회·수정·삭제하지 않았다.

## 실제 출시를 위해 아직 필요한 것

현재는 로컬 구현과 에뮬레이터 검증까지 마친 상태다. 사용자가 Firebase 프로젝트와 Vercel 계정 생성을 완료했다. Firebase 웹 앱·CLI 인증·무료 Hosting 사이트·DB 보안 규칙 설정까지 완료했다. Google 제공업체와 승인 도메인 설정도 완료했다. Vercel API와 Hosting 콘텐츠를 배포했다. 실제 Google 로그인·방 생성·동일 계정 두 탭의 채팅/설정 동기화·재접속 복원까지 검증했다. 서로 다른 4~6계정의 운영 전체 게임, 재인증·탈퇴와 소스 커밋·푸시는 남아 있다.

| 준비 항목            | 필요한 내용                                                                                                    | 현재 상태                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Firebase 프로젝트    | Spark, Cloud Billing 미연결, 웹 앱 등록, Firestore Standard, Google 로그인, 일반 Hosting                       | DB/웹 앱/Google 설정 완료                     |
| 무료 사이트 이름     | `프로젝트ID.web.app` 또는 Hosting 사이트 ID. 별도 유료 도메인은 필요 없음                                      | dbg-kraken.web.app 배포 완료                  |
| Vercel 계정·프로젝트 | 개인 Hobby, 저장소 연결, 유료 체험/구독 미사용                                                                 | Hobby 확인, 운영 API 배포 완료                |
| 새 코드 반영         | 현재 로컬 변경을 검토하고 GitHub에 커밋·푸시                                                                   | 아직 푸시하지 않음                            |
| 서버 인증 정보       | Firebase 서비스 계정과 API의 Firestore/Auth 권한. 비밀키는 Vercel 환경 변수에만 입력                           | 전용 계정·권한·Production Secret 등록 완료    |
| 공개 웹 설정         | Firebase 웹 구성 값, Vercel API 주소, 허용 Origin, Google 승인 도메인·지원 이메일·외부 사용자 로그인 상태 확인 | 웹 SDK·승인 도메인·API 연결·Hosting 배포 완료 |
| 운영 통합 검증       | 실제 Google 로그인·재접속·닉네임 변경·탈퇴, 기기별 4/5/6인 채팅·게임, 카드 정보 접근 제어                      | 배포 후 필요                                  |
| 무료 사용량 확인     | 실제 Firestore 읽기/쓰기·용량, Vercel 호출/CPU 한도 확인. 한도 소진 시 중단 수용                               | 배포 후 필요                                  |
| 기존 데이터          | 기존 RDS 사용자를 이전하지 않고 새 계정·닉네임으로 시작                                                        | 새로 시작 — RDS 이전 없음                     |
| 출시 전 경고 검토    | VERIFICATION.md의 전이 의존성 중간 등급 경고와 기존 게임 중 퇴장 제약 검토                                     | 남아 있음                                     |

프로젝트 ID, 무료 사이트 이름, 데이터 이전 여부는 공유해도 되지만 서비스 계정 비밀키·비밀번호·로그인 토큰을 채팅이나 Git에 올리지 않는다. 기존 AWS 과금 리소스는 새 배포 확인 후 별도로 정리하며 자동 삭제하지 않는다.

## 1. 로컬 개발

Node.js 22.12 이상과 npm을 준비한다(검증 환경은 Node 26).

```bash
npm ci
npm run dev
```

http://127.0.0.1:5173 에 접속한다. 별도 설정 없이는 개발 모드에서만 로컬 데모 인증·메모리 저장소가 켜진다. 브라우저 컨텍스트마다 사용자가 다르다. 시크릿 창 하나를 공유한 탭은 같은 사용자이므로 테스트에는 서로 다른 브라우저 프로필을 쓴다.

- 로컬 API: 127.0.0.1:3001, SSE 실시간 전달. 재시작하면 데이터 초기화.
- 운영 API: Firebase ID 토큰만 허용. demo 토큰 수용 코드 없음.
- 운영 빌드: Firebase 설정이 없으면 로그인 비활성화·설정 안내. 데모를 외부에 공개하지 않는다.

```bash
npm test
npm run build
# npm run dev가 실행 중인 별도 터미널에서:
npx playwright install chromium
npm run test:browser

# Java 21 이상을 PATH에 준비한 다음 로컬 보안 규칙/트랜잭션 검사:
npm run test:firebase
npm run test:integration
```

## 2. Firebase 프로젝트 생성 — Spark 유지

1. 생성한 프로젝트의 프로젝트 ID를 확인한다. Analytics는 이 프로젝트에 필요하지 않으므로 새로 연결하지 않는다.
2. Usage and billing에서 Spark와 Cloud Billing 미연결 상태를 확인한다.
3. **웹 앱 등록 전에 일반 Hosting의 기본 사이트 생성 여부를 확인한다.** 2026-10-15 이후 프로젝트 생성만으로 기본 Hosting 사이트가 자동 생성되지 않는다. 기본 사이트는 프로젝트 ID를 사용하며, DBG 전용 추가 사이트 ID `dbg`는 전역 사용 가능 여부를 확인한 후 결정한다. [기본 사이트 정책](https://firebase.google.com/docs/hosting/default-site), [추가 사이트 ID](https://firebase.google.com/docs/hosting/multisites).
4. 웹 앱을 DBG 이름으로 등록하고 Firebase 구성 값을 확보한다. 웹 구성 API 키는 공개 식별자이고 서버 비밀키와 다르다.
5. Authentication → Google 제공자 활성화. 실제 Hosting 주소를 승인 도메인으로 등록. localhost는 실제 Firebase를 이용한 로컬 통합 검증이 필요할 때만 허용한다.
6. Firestore Standard/Native 데이터베이스 생성. 한국 사용자 기준 `asia-northeast3`(서울)를 권장한다. API는 `vercel.json`에서 `icn1`(서울)로 지정해 DB와 가깝게 둔다. 생성 후 DB 리전 변경은 어렵다. [Firebase 위치](https://firebase.google.com/docs/firestore/locations), [Vercel 리전](https://vercel.com/docs/regions).
7. 확정된 Hosting 사이트 ID와 실제 무료 주소를 기록하고 Google 승인 도메인과 API Origin에 반영한다. App Hosting이나 Cloud Functions는 활성화하지 않는다.

Firebase CLI는 npm 의존성으로 설치되어 있다. 먼저 프로젝트 폴더의 터미널에서 `npx firebase login`으로 본인의 Google 계정을 연결한다. 로그인 승인 화면은 사용자가 직접 완료한다. 아래 배포 명령은 인증과 웹 앱/DB 설정이 준비된 다음 실행한다.

```bash
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project board-game-kraken
```

Rules는 브라우저 쓰기를 전부 차단한다. 본인 프로필·자신의 손패, 참여 방, 로비 대기방만 읽는다. 서버 비밀과 닉네임 중복 방지 문서는 읽기 금지다. 카드 원본을 공개 문서에 넣지 않는다.

## 3. API 인증 정보

Firebase 프로젝트 서비스 계정의 서버 자격 증명을 준비한다. Firestore 트랜잭션과 Firebase Authentication 사용자 조회/삭제에 필요한 권한만 부여한다. 서비스 계정 private key는 Vercel 서버 환경 변수로만 입력한다. 로컬 파일을 만들었다면 Git 외부에 보관하고 공개·폐기 시 키를 회전한다.

현재 전용 계정은 Firestore 데이터용 `roles/datastore.user`와 사용자 조회·삭제 두 권한만 포함한 `projects/board-game-kraken/roles/dbgAuthUserAccess`를 사용한다. [Authentication API 권한](https://docs.cloud.google.com/identity-platform/docs/access-control)을 기준으로 토큰 폐기 확인과 본인 탈퇴 처리를 허용하며 인증 제공업체 설정 변경 권한은 부여하지 않았다.

Vercel 프로젝트(반드시 Hobby)에 다음 서버 환경 변수를 입력한다.

| 변수                  | 값                                                              |
| --------------------- | --------------------------------------------------------------- |
| FIREBASE_PROJECT_ID   | Firebase 프로젝트 ID                                            |
| FIREBASE_CLIENT_EMAIL | 서비스 계정 이메일                                              |
| FIREBASE_PRIVATE_KEY  | 서비스 계정 private key. 줄바꿈 또는 `\n` 지원                  |
| ALLOWED_ORIGINS       | `https://dbg-kraken.web.app,https://dbg-kraken.firebaseapp.com` |

API 엔드포인트는 `https://API이름.vercel.app/api/command`다. 모든 명령은 Google 로그인 ID 토큰을 Authorization Bearer로 전달한다. Origin 허용은 인증의 대체가 아니다.

## 4. Vercel API 배포

Firebase Admin 14의 `jwks-rsa` → `jose` 의존성은 `require(ESM)`을 사용한다. Vercel은 이를 기본 비활성화하므로 Production 환경 변수 `NODE_OPTIONS=--experimental-require-module`이 필요하다. [Vercel 공식 설정](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration#experimental-nodejs-require-of-es-module)을 적용했다. 설정 없이 첫 배포는 `ERR_REQUIRE_ESM`으로 실패했으며, 로컬 재현과 설정 적용 후 운영 재배포 검증을 완료했다. 설정 변경 후에는 반드시 다시 배포한다.

CLI를 사용할 경우 `npx vercel login`에서 본인 Hobby 계정 연결을 직접 승인한다. `.vercel/`은 Git에서 제외하며 `.vercelignore`로 로컬 환경 파일과 테스트 산출물이 배포 업로드에 포함되지 않게 한다. 서버 비밀키는 로컬 웹 빌드 환경 파일에 추가하지 않는다.

저장소를 개인 Hobby 프로젝트로 연결하고 Framework Preset은 Other, 저장소 루트 디렉터리를 사용한다. `vercel.json`의 빌드·함수 설정을 적용한다. Production 환경 변수 추가 후 배포한다. Pro 체험이나 카드 등록을 유도하는 기능을 선택하지 않는다.

이 저장소는 API와 정적 프런트엔드를 함께 빌드하지만, 사용자용 대표 주소는 Firebase다. Vercel 정적 출력은 Firebase 클라이언트 환경 변수를 넣지 않으면 설정 안내 화면만 표시한다. Vercel API에는 VITE_ 환경 변수나 비밀키를 번들에 넣을 이유가 없다.

## 5. Firebase 화면 빌드·배포

`.env.production.local`에 다음 웹 환경 변수를 입력한다(`.gitignore` 제외 대상).

```properties
VITE_LOCAL_DEMO=false
VITE_FIREBASE_API_KEY=Firebase웹API키
VITE_FIREBASE_AUTH_DOMAIN=board-game-kraken.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=board-game-kraken
VITE_FIREBASE_APP_ID=Firebase웹앱ID
VITE_API_BASE_URL=https://API이름.vercel.app
```

```bash
npm run build
npx firebase deploy --only hosting:dbg --project board-game-kraken
```

이 절차는 정적 Hosting만 배포한다. Firebase `init` 시 Functions/App Hosting을 추가하지 않는다. 별도 도메인은 구매하지 않는다.

## 6. 필수 출시 검증

추가 검증으로 `npm run test:integration`의 Auth·Firestore 에뮬레이터 + 운영 HTTP 경로 5개를 통과했다. 4/5/6인 4라운드 게임·개인 손패 접근 제한·종료 정리 및 오래된 인증의 탈퇴 차단·SDK 재인증 후 삭제를 포함한다. 실제 Google 팝업·운영 IAM 검증을 대체하지 않으며 운영 계정은 삭제하지 않았다. 자세한 범위는 VERIFICATION.md를 따른다.

- [ ] Spark, Cloud Billing 미연결, Hobby, 유료 구독·도메인·통합 없음
- [x] 실제 Google 로그인 → 최초 닉네임 등록 → 새로고침 후 복원
- [ ] 실제 재로그인·닉네임 변경·재인증·탈퇴
- [ ] 새 사용자 4/5/6명 각각의 기기·프로필에서 채팅·준비·카드가 동기화됨
- [ ] 상대 손패·secrets/names 문서의 직접 읽기와 모든 직접 쓰기가 차단됨
- [ ] 두 명 동시 입장 시 정원을 넘지 않고, 같은 카드 중복 요청은 한 번만 성공
- [ ] 3초 후 라운드 전환, 모든 승리 조건, 10초 후 결과 정리
- [ ] 새로고침·네트워크 복구·모바일 사용성 확인
- [ ] 실제 Firestore 읽기/쓰기·저장량과 Vercel CPU/호출 사용량 확인
- [ ] 무료 한도 오류가 사용자에게 표시되고 무한 재시도로 사용량을 소모하지 않음

## 7. 데이터 보관과 운영

`docs/MIGRATION.md`의 최소 저장 정책을 따른다. 최근 채팅 40개만 현재 방 문서에 두고, 전적·매 턴 로그·클라이언트 분석·프로필 이미지·이메일 사본은 저장하지 않는다. 방의 복잡한 중첩 필드는 인덱싱에서 제외한다.

게임 종료 시 secret과 개인 손패를 즉시 삭제하고 10초 후 결과를 정리한다. 24시간 실제 활동이 없는 방도 정리 대상이다. 유료 TTL, Cloud Scheduler, 상주 cron은 사용하지 않는다. 로비 진입/방 생성 API에서 만료방을 최대 5개씩 기회적으로 정리하며, 필요 시 서버 환경 변수를 설정한 터미널에서 `npm run cleanup`을 반복 실행한다. 전원이 떠난 동안 데이터가 무조건 즉시 삭제되는 구조는 아니다.

화면의 이벤트 구독은 방/로비 이동 및 로그아웃 시 해제한다. 매초 DB heartbeat나 전역 상태 폴링은 하지 않는다. 라운드 경계에서만 전환 요청을 보낸다. 모든 탭이 중지된 동안에는 다음 접속/요청 시 만료/기한을 확인한다.

무료 한도에 걸리면 유료 전환으로 자동 복구하지 않는다. 오류·사용량을 확인하고 무료 한도 복구를 기다린다. Firebase/Vercel 서버 인증 키를 교체할 때만 서버 배포를 갱신한다.

## 기존 AWS 데이터와 롤백

사용자가 기존 RDS 사용자를 이전하지 않고 새로 시작하기로 확정했다. 사용자·방·게임 데이터를 가져오는 작업은 하지 않는다. 새 서비스의 모든 사용자는 Google 로그인 후 닉네임을 등록한다. 기존 AWS/RDS 삭제도 실행하지 않는다.

새 기능 검증을 마치기 전에는 기존 Java 코드를 제거하지 않는다. Firebase Hosting은 이전 배포로 롤백할 수 있고, API는 Vercel의 이전 배포를 사용할 수 있다. 데이터 구조가 바뀌는 후속 릴리스는 별도 호환성 검토가 필요하다. 새 배포가 검증된 후 기존 AWS의 RDS/EC2/볼륨/스냅샷/주소 등 과금 리소스를 담당자가 확인·정리한다.
