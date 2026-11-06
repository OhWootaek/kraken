# DBG · 노터치 크라켄

정체를 숨긴 탐험대와 스켈레톤이 보물과 크라켄을 찾는 **4~6인 실시간 웹 보드게임**입니다.

기존 Spring Boot 게임의 기능을 유지하면서 **Firebase Spark + Vercel Hobby**로 전환하는 구현입니다. 계정·배포 정보 없이 실행할 수 있는 로컬 데모를 포함합니다. 운영 화면은 [DBG](https://dbg-kraken.web.app), 게임 API는 `https://dbg-kraken.vercel.app/api/command`에 배포했습니다. API 인증·CORS와 실제 Google 로그인·방 생성·두 탭 간 실시간 채팅/설정 동기화·재접속 복원을 검증했습니다. 독립 모의 사용자로 Auth·Firestore·운영 HTTP를 연결한 4/5/6인 전체 게임 및 재인증·탈퇴 통합 검증도 통과했습니다. 실제 운영의 다계정 전체 게임·탈퇴 검증과는 구분합니다. Firebase Cloud Billing 미연결과 Vercel Hobby 활성 상태를 확인했습니다.

## 실행

Node.js 22.12 이상(권장 22 또는 24)과 npm이 필요합니다.

```bash
npm ci
npm run dev
```

[로컬 화면](http://127.0.0.1:5173)에 접속한 뒤 **로컬 플레이 시작** → 닉네임 등록으로 입장합니다. 서로 다른 브라우저 프로필에서 4~6명이 접속하면 채팅·준비·카드 진행을 함께 확인할 수 있습니다.

- 개발 환경 기본값은 메모리 저장소입니다. 외부 계정이나 과금 서비스에 연결하지 않습니다.
- 로컬 API는 `127.0.0.1:3001`, 화면은 `127.0.0.1:5173`에서 실행됩니다.
- 서버를 재시작하면 로컬 데이터가 초기화됩니다. 같은 브라우저 탭들은 같은 사용자입니다.
- 운영 API는 로컬 데모 인증을 허용하지 않습니다.

## 유지하는 기능

- Google 로그인, 최초 닉네임 등록·중복 검사, 닉네임 변경, 회원 탈퇴
- 공개·비밀번호 방 생성, 4자리 방 코드 검색, 정원 4~6명
- 참여자·준비 상태·채팅 실시간 동기화, 방장 위임·강퇴·정원 변경
- 정원 일치 및 방장 외 전원 준비 후 게임 시작
- 기존 역할·덱 배정, 자신의 역할/손패만 확인, 타인 카드 공개, 턴 이동
- 5→4→3→2장 재분배와 3초 라운드 전환, 기존 승패 조건
- 결과·전체 역할 공개, 새로고침 후 현재 방 복원
- [한번 더하기](docs/REMATCH.md): 종료 후 10초간 신청한 사람들만 새 대기방으로 이동. 미신청자는 로비 복귀, 기존 방장 미참가 시 새 방장 배정

게임 규칙의 세부 기준과 기존 Java 코드 위치는 [전환 설계](docs/MIGRATION.md)에 기록했습니다. 기존 구현의 제약과 출시 전 확인할 차이도 함께 명시했습니다.

## 구성

| 영역       | 구현                                                          |
| ---------- | ------------------------------------------------------------- |
| 화면       | React, TypeScript, Vite, 기존 Spring Boot 스타일의 반응형 CSS |
| 로그인     | 운영 Firebase Authentication / 개발 전용 로컬 세션            |
| 게임 서버  | Vercel Node.js Functions, 입력·인증·권한 검증                 |
| 데이터     | 운영 Firestore 트랜잭션 / 개발 메모리 트랜잭션                |
| 실시간     | 운영 Firestore 구독 / 개발 SSE                                |
| 주소·HTTPS | Firebase Hosting의 무료 `web.app` 주소                        |

```text
client/
  screens/         # 로그인·로비·대기실/게임·결과 화면
  backend.ts       # 인증·API·실시간 구독
  main.tsx         # 세션·화면 연결 및 타이머
shared/
  game.ts          # 화면/DB와 독립적인 서버 게임 규칙
  commands.ts      # 명령 입력 검증
  types.ts         # 공개/개인/서버 데이터 타입
server/
  service.ts       # 계정·방·게임 서비스, 데이터 보관·정리
  store.ts         # Firestore/메모리 저장소
  http.ts          # 운영 인증·Origin·HTTP 처리
  local.ts         # 개발 전용 서버
api/command.ts     # Vercel 진입점
firestore.rules    # 클라이언트 접근 제어
src/               # 비교 기준으로 유지한 기존 Java 구현
```

## 최소 데이터 보관

- 이메일·사진·로그인 이력은 DB에 중복 저장하지 않습니다.
- 닉네임과 중복 방지용 참조, 현재 참여 방, 현재 게임에 필요한 상태만 저장합니다.
- 채팅은 방마다 최근 **40개·메시지당 300자**만 보관합니다. 별도 채팅 이력·전적·턴 로그·분석 기록을 만들지 않습니다.
- 비밀번호 해시와 카드 위치는 서버 전용 문서, 본인 역할·손패는 개인 문서로 분리합니다.
- 종료 시 비밀 게임 원본·개인 손패를 삭제하고, 결과는 10초 후 정리합니다. 빈 방도 삭제합니다.
- 활동 없는 방은 24시간 후 정리 대상입니다. 유료 스케줄러/TTL 대신 요청 시 소량 정리와 수동 정리 명령을 사용합니다. 접속이 전혀 없으면 다음 정리 시점까지 데이터가 남을 수 있습니다.

## 검증

```bash
npm test             # 게임 규칙·서비스 회귀 테스트
npm run check        # TypeScript 검사
npm run build        # 타입 검사 + 운영용 정적 빌드

# 로컬 개발 서버가 실행 중일 때:
npx playwright install chromium webkit
npm run test:browser
KRAKEN_PLAYERS=5 npm run test:browser
KRAKEN_PLAYERS=6 npm run test:browser
KRAKEN_REMATCH=1 KRAKEN_PLAYERS=6 npm run test:browser

# Java 21 이상 필요. 실제 계정이 아닌 demo-kraken 에뮬레이터만 사용:
npm run test:firebase
npm run test:integration  # Auth + Firestore + 운영 HTTP의 4/5/6인·재인증·탈퇴
npm run test:browser:firebase # 실제 React/Firebase 구독으로 Chromium·WebKit 검사
```

검증 결과와 남은 출시 조건은 [검증 기록](docs/VERIFICATION.md)을 확인하세요.

## 출시와 비용

[출시 절차](docs/RELEASE.md)에 Firebase 생성, 환경 변수, 보안 규칙, Vercel API와 Firebase Hosting 배포 순서를 정리했습니다. `.env.example`은 설정 형식만 제공합니다.

**Spark + Cloud Billing 미연결 / Hobby + 유료 구독·구매 없음**을 유지합니다. 한도 초과 시 추가 과금 대신 서비스 제한을 수용합니다. 무료 무제한·무중단을 보장하지 않으며, 배포 전에 실제 계정 요금제와 최신 정책을 확인해야 합니다.

기존 RDS 사용자는 이전하지 않고 새로 시작합니다. 모든 사용자는 Google 로그인 후 닉네임을 새로 등록합니다. 이전 서버의 AWS 과금 리소스도 자동 삭제하지 않습니다.

전환 전 Java 환경은 [Spring Boot 참고 문서](docs/SPRING_BOOT.md)에 보존했습니다.
