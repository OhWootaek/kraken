import { configured, isDemo } from "../backend";
export function Landing({
  busy,
  onLogin,
}: {
  busy: boolean;
  onLogin: () => void;
}) {
  return (
    <main className="landing panel">
      <div className="login-symbol" aria-hidden="true">
        🐙
      </div>
      <h1>노터치 크라켄</h1>
      <p>게임에 참여하려면 로그인이 필요합니다.</p>
      <button
        className="primary"
        disabled={busy || !configured}
        onClick={onLogin}
      >
        {!isDemo && (
          <span className="google-symbol" aria-hidden="true">
            G
          </span>
        )}
        {isDemo ? "로컬 플레이 시작" : "Google로 로그인하기"}
      </button>
      {!configured && (
        <p className="form-error">
          출시 설정이 아직 없습니다. Firebase 웹 설정과 API 주소를 환경 변수에
          등록해 주세요.
        </p>
      )}
    </main>
  );
}
