import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  command,
  isDemo,
  login,
  logout,
  reauthenticate,
  watchAuth,
  watchView,
  type Identity,
} from "./backend";
import type { Command } from "../shared/commands";
import type { View } from "../shared/types";
import { submit } from "./forms";
import { Landing } from "./screens/Landing";
import { Lobby } from "./screens/Lobby";
import { GameRoom } from "./screens/GameRoom";
import { ResultScreen } from "./screens/Result";
import "./style.css";
const initial: View = {
  profile: null,
  room: null,
  privatePlayer: null,
  lobby: [],
  serverNow: Date.now(),
};
function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState(false);
  const [join, setJoin] = useState<{
    code: string;
    title: string;
    locked: boolean;
  } | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const activeRoomRef = useRef<string | null>(null);
  const lastRoomStatus = useRef<string | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const { profile, room } = view;
  const uid = identity?.uid ?? "";
  useEffect(
    () =>
      watchAuth((user) => {
        setIdentity(user);
        setAuthReady(true);
        setView(initial);
        setConnected(false);
        activeRoomRef.current = null;
        lastRoomStatus.current = undefined;
      }),
    [],
  );
  useEffect(() => {
    if (!identity) return;
    command<{ serverNow: number }>({ type: "bootstrap" })
      .then((v) => setOffset(v.serverNow - Date.now()))
      .catch((e) => setError(e.message));
    return watchView(
      identity.uid,
      (next) => {
        if (
          activeRoomRef.current &&
          !next.profile?.roomCode &&
          lastRoomStatus.current !== "FINISHED"
        )
          setNotice("방 참여가 종료되어 로비로 이동했습니다.");
        activeRoomRef.current = next.profile?.roomCode ?? null;
        if (next.room) lastRoomStatus.current = next.room.status;
        setView(next);
        setConnected(true);
      },
      (e) => {
        setError(e.message);
        setConnected(false);
      },
    );
  }, [identity?.uid]);
  useEffect(() => {
    if (!room?.game?.nextRoundAt && !room?.resultUntil) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [room?.game?.nextRoundAt, room?.resultUntil]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [room?.chat.length, room?.chat.at(-1)?.id]);
  useEffect(() => {
    const due =
      room?.status === "FINISHED" ? room.resultUntil : room?.game?.nextRoundAt;
    if (!due || !room) return;
    let stopped = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = async () => {
      try {
        await command(
          room.status === "FINISHED"
            ? { type: "bootstrap" }
            : { type: "advance", code: room.code },
        );
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          if (++attempts < 3) timer = setTimeout(advance, 3000);
        }
      }
    };
    timer = setTimeout(advance, Math.max(0, due - (Date.now() + offset)) + 100);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [room?.code, room?.game?.nextRoundAt, room?.resultUntil, offset]);
  const act = async (body: Command, after?: () => void) => {
    setBusy(true);
    setError("");
    try {
      await command(body);
      after?.();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const authAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch {
      setError("로그인 창이 닫혔거나 인증에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const search = async (code: string) => {
    setBusy(true);
    setError("");
    try {
      const found = await command<{
        code: string;
        title: string;
        locked: boolean;
        status: string;
      }>({ type: "search", code });
      if (found.status !== "WAITING")
        setNotice("검색한 방은 이미 게임 중이거나 종료되었습니다.");
      else setJoin(found);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const leave = () => {
    if (
      confirm(
        room?.status === "PLAYING"
          ? "진행 중인 방에서 나가면 다시 입장할 수 없고 게임이 멈출 수 있습니다. 나가시겠습니까?"
          : "방에서 나가시겠습니까?",
      )
    )
      void act({ type: "leave" });
  };
  if (!authReady)
    return <div className="loading">화면을 불러오고 있습니다…</div>;
  return (
    <div
      className={`app ${!identity || !profile?.username ? "auth-screen" : room?.status === "FINISHED" ? "result-active" : room ? "game-active" : "lobby-active"}`}
    >
      <header className="site-header">
        <a className="brand" href="/" aria-label="노터치 크라켄 홈">
          <h1>🐙 게임 로비</h1>
        </a>
        <nav>
          {identity && (
            <>
              <span className={`connection ${connected ? "online" : ""}`}>
                {connected ? "실시간 연결" : "연결 중"}
              </span>
              <p className="welcome">
                환영합니다, <strong>{profile?.username}</strong>님!
              </p>
              <div className="account-links">
                <button
                  className="text-button"
                  onClick={() => setAccount(true)}
                >
                  마이페이지
                </button>
                <span> | </span>
                <button
                  className="text-button"
                  onClick={() => void authAction(logout)}
                >
                  로그아웃
                </button>
              </div>
            </>
          )}
        </nav>
      </header>
      {isDemo && (
        <div className="demo-banner">
          로컬 미리보기 · 외부 계정이나 DB 없이 실행 중 · 서버 재시작 시 데이터
          초기화
        </div>
      )}
      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <button aria-label="오류 닫기" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="알림 닫기" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {!identity ? (
        <Landing busy={busy} onLogin={() => void authAction(login)} />
      ) : !profile ? (
        <main className="loading">플레이어 정보를 불러오는 중…</main>
      ) : !profile.username ? (
        <main className="onboarding panel">
          <div className="login-symbol" aria-hidden="true">
            🐙
          </div>
          <h1>환영합니다!</h1>
          <p className="muted">게임에서 사용할 고유 닉네임을 설정해 주세요.</p>
          <form
            onSubmit={submit(
              (data) =>
                void act({
                  type: "profile",
                  username: String(data.get("username")),
                }),
            )}
          >
            <label>
              닉네임
              <input
                name="username"
                required
                maxLength={255}
                autoComplete="nickname"
                placeholder="닉네임"
                autoFocus
              />
            </label>
            <button className="primary" disabled={busy}>
              로비 입장 <span>→</span>
            </button>
          </form>
        </main>
      ) : profile.roomCode && !room ? (
        <main className="loading">
          방에 다시 연결하고 있습니다…{" "}
          <button onClick={() => void act({ type: "bootstrap" })}>
            다시 확인
          </button>
        </main>
      ) : room?.status === "FINISHED" && room.result ? (
        <ResultScreen
          result={room.result}
          until={room.resultUntil}
          uid={uid}
          now={now}
          offset={offset}
          code={room.code}
          rematch={room.rematch ?? []}
          busy={busy}
          act={act}
        />
      ) : !room ? (
        <Lobby
          rooms={view.lobby}
          now={now}
          busy={busy}
          act={act}
          onJoin={setJoin}
          onSearch={search}
        />
      ) : (
        <GameRoom
          room={room}
          uid={uid}
          privatePlayer={view.privatePlayer}
          now={now}
          offset={offset}
          busy={busy}
          act={act}
          onLeave={leave}
          onNotice={setNotice}
          chatEnd={chatEnd}
        />
      )}
      {join && (
        <div className="modal-backdrop">
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="방 입장"
          >
            <button
              className="modal-close"
              aria-label="닫기"
              onClick={() => setJoin(null)}
            >
              ×
            </button>
            <p className="muted">방 코드: {join.code}</p>
            <h2>{join.title}</h2>
            <form
              onSubmit={submit(
                (data) =>
                  void act(
                    {
                      type: "join",
                      code: join.code,
                      password: String(data.get("password") ?? ""),
                    },
                    () => setJoin(null),
                  ),
              )}
            >
              {join.locked ? (
                <label>
                  비밀번호
                  <input
                    name="password"
                    type="password"
                    autoFocus
                    required
                    maxLength={64}
                    autoComplete="current-password"
                  />
                </label>
              ) : (
                <p className="muted">이 게임방에 입장하시겠습니까?</p>
              )}
              <button className="primary" disabled={busy}>
                입장하기 <span>→</span>
              </button>
            </form>
          </section>
        </div>
      )}
      {account && identity && (
        <div className="modal-backdrop">
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="마이페이지"
          >
            <button
              className="modal-close"
              aria-label="닫기"
              onClick={() => setAccount(false)}
            >
              ×
            </button>
            <h2>마이페이지</h2>
            <form
              onSubmit={submit(
                (data) =>
                  void act(
                    { type: "profile", username: String(data.get("username")) },
                    () => setAccount(false),
                  ),
              )}
            >
              <label>
                닉네임
                <input
                  name="username"
                  defaultValue={profile?.username ?? ""}
                  required
                  maxLength={255}
                />
              </label>
              <button className="primary" disabled={busy}>
                닉네임 저장
              </button>
            </form>
            <div className="account-danger">
              <p>회원 탈퇴 시 닉네임과 참여 정보가 삭제됩니다.</p>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      "정말 탈퇴하시겠습니까? 계정을 복구할 수 없습니다.",
                    )
                  )
                    return;
                  try {
                    setBusy(true);
                    await reauthenticate();
                    if (await act({ type: "delete-account" })) {
                      await logout();
                      setAccount(false);
                    }
                  } catch {
                    setError("탈퇴를 위한 재인증에 실패했습니다.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                회원 탈퇴
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
