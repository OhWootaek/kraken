import type { Result } from "../../shared/types";
import { roleName } from "../presentation";
import type { Action } from "../forms";
export function ResultScreen({
  result,
  until,
  uid,
  now,
  offset,
  code,
  rematch,
  busy,
  act,
}: {
  result: Result;
  until: number | null;
  uid: string;
  now: number;
  offset: number;
  code: string;
  rematch: string[];
  busy: boolean;
  act: Action;
}) {
  const remaining = Math.max(
    0,
    Math.ceil(((until ?? 0) - now - offset) / 1000),
  );
  const joined = rematch.includes(uid);
  return (
    <main className="result-screen panel">
      <h2>게임 종료!</h2>
      <div className="result-symbol">
        {result.winner === "EXPLORER" ? "💰" : "🐙"}
      </div>
      <h1>{roleName(result.winner)} 승리</h1>
      <p>
        발견한 보물{" "}
        <strong>
          {result.found} / {result.total}
        </strong>{" "}
        · 크라켄 {result.kraken ? "발견" : "미발견"}
      </p>
      <div className="result-players">
        {result.players.map((p) => (
          <div key={p.uid}>
            <span>
              {p.username}
              {p.uid === uid ? " (나)" : ""}
            </span>
            <span className={`role ${p.role.toLowerCase()}`}>
              {roleName(p.role)}
            </span>
          </div>
        ))}
      </div>
      <button
        className="primary result-rematch"
        disabled={busy || joined || remaining === 0}
        onClick={() => void act({ type: "rematch", code })}
      >
        {joined ? "재참가 신청 완료" : "한번 더하기"}
      </button>
      <p>
        재참가 {rematch.length}명 · {remaining}초 후 접수 마감
      </p>
      <p className="muted">
        {joined
          ? "신청한 사람들과 새 대기방으로 이동합니다. 4명 이상 모여 준비하면 시작할 수 있습니다."
          : "다시 하려면 마감 전에 신청해 주세요. 신청하지 않으면 로비로 돌아갑니다."}
      </p>
      <p className="muted">
        새 방은 추가 참가자를 받을 수 있는 공개 대기방입니다.
      </p>
    </main>
  );
}
