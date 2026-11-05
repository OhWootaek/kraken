import { useState, type RefObject } from "react";
import type { Room, PrivatePlayer } from "../../shared/types";
import { cardNames, cardIcons, roleName } from "../presentation";
import { submit, type Action } from "../forms";
export function GameRoom({
  room,
  uid,
  privatePlayer,
  now,
  offset,
  busy,
  act,
  onLeave,
  onNotice,
  chatEnd,
}: {
  room: Room;
  uid: string;
  privatePlayer: PrivatePlayer | null;
  now: number;
  offset: number;
  busy: boolean;
  act: Action;
  onLeave: () => void;
  onNotice: (notice: string) => void;
  chatEnd: RefObject<HTMLDivElement | null>;
}) {
  const [mobileTab, setMobileTab] = useState<
    "players" | "chat" | "controls" | null
  >(null);
  const waiting = room.status === "WAITING";
  const host = room.host === uid;
  const me = room.members.find((member) => member.uid === uid);
  const game = room.game;
  const myTurn = game?.turn === uid;
  return (
    <main className="room-page">
      {mobileTab && (
        <button
          className="sheet-overlay"
          aria-label="패널 닫기"
          onClick={() => setMobileTab(null)}
        />
      )}
      <aside
        className={`room-sidebar ${mobileTab ? "mobile-open" : ""}`}
        aria-label="게임방 사이드바"
      >
        <button
          className="sheet-close"
          aria-label="패널 닫기"
          onClick={() => setMobileTab(null)}
        >
          ×
        </button>
        <section
          className={`sidebar-block participants ${mobileTab === "players" ? "tab-open" : ""}`}
        >
          <h2>참여자 목록</h2>
          <p className="participant-count">
            인원: {room.members.length} / {room.maxPlayers}
          </p>
          <ul className="participant-list">
            {room.members.map((member) => (
              <li
                className={`member-seat ${member.uid === game?.turn ? "my-turn" : ""}`}
                key={member.uid}
              >
                <div className={member.ready && waiting ? "ready-name" : ""}>
                  <span className={member.uid === uid ? "my-name" : ""}>
                    {waiting && member.uid === room.host ? "[방장] " : ""}
                    {member.username}
                    {member.uid === uid ? " (You)" : ""}
                  </span>
                  {waiting ? (
                    <span
                      className={`ready-badge ${member.ready ? "ready" : ""}`}
                    >
                      {member.ready ? "Ready" : "Waiting"}
                    </span>
                  ) : (
                    member.uid === game?.turn && (
                      <span className="turn-badge">Turn</span>
                    )
                  )}
                </div>
                {waiting && host && member.uid !== uid && (
                  <button
                    className="kick-button"
                    disabled={busy || member.ready}
                    title={
                      member.ready
                        ? "준비 완료 상태인 유저는 강퇴할 수 없습니다."
                        : "플레이어 강퇴"
                    }
                    onClick={() => {
                      if (confirm(`${member.username}님을 강퇴할까요?`))
                        void act({
                          type: "kick",
                          code: room.code,
                          target: member.uid,
                        });
                    }}
                  >
                    강퇴
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section
          className={`sidebar-block chat-panel ${mobileTab === "chat" ? "tab-open" : ""}`}
        >
          <h2>채팅</h2>
          <div
            className="chat-messages"
            role="log"
            aria-label="채팅 메시지"
            aria-live="polite"
          >
            {room.chat.map((message) => (
              <p className="chat-message" key={message.id}>
                <strong>{message.username}: </strong>
                <span>{message.text}</span>
              </p>
            ))}
            <div ref={chatEnd} />
          </div>
          <form
            className="chat-form"
            onSubmit={submit(async (data, form) => {
              if (
                await act({
                  type: "chat",
                  code: room.code,
                  text: String(data.get("message")),
                })
              )
                form.reset();
            })}
          >
            <input
              name="message"
              aria-label="채팅 입력"
              placeholder="메시지 입력..."
              maxLength={300}
              required
              autoComplete="off"
            />
            <button
              aria-label="메시지 보내기"
              className="primary"
              disabled={busy}
            >
              전송
            </button>
          </form>
        </section>
        <section
          className={`sidebar-block room-controls ${mobileTab === "controls" ? "tab-open" : ""}`}
        >
          <h2>방 컨트롤</h2>
          <div className="control-buttons">
            {waiting && !host && (
              <button
                className="ready-button"
                disabled={busy}
                onClick={() => void act({ type: "ready", code: room.code })}
              >
                {me?.ready ? "준비 취소" : "준비 완료"}
              </button>
            )}
            <button className="secondary" disabled={busy} onClick={onLeave}>
              로비로 나가기
            </button>
          </div>
          {waiting && host && (
            <div className="host-controls">
              <h3>방장 설정</h3>
              <label>
                최대 인원:
                <select
                  aria-label="방 정원"
                  value={room.maxPlayers}
                  disabled={busy}
                  onChange={(event) =>
                    void act({
                      type: "capacity",
                      code: room.code,
                      maxPlayers: Number(event.target.value),
                    })
                  }
                >
                  {[4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}명
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  room.members.length !== room.maxPlayers ||
                  room.members.some(
                    (member) => member.uid !== uid && !member.ready,
                  )
                }
                onClick={() => void act({ type: "start", code: room.code })}
              >
                게임 시작
              </button>
            </div>
          )}
        </section>
      </aside>
      <section className="main-game">
        <h1>{waiting ? "게임 대기실" : "게임 진행 중"}</h1>
        <p className="room-code">
          방 코드:{" "}
          <button
            title="방 코드 복사"
            onClick={() =>
              navigator.clipboard
                ?.writeText(room.code)
                .then(() => onNotice("방 코드를 복사했습니다."))
                .catch(() => onNotice(`방 코드: ${room.code}`))
            }
          >
            <strong>{room.code}</strong>
          </button>
        </p>
        {waiting ? (
          <p className="waiting-message">
            모두 준비가 완료되면 방장이 게임을 시작합니다.
          </p>
        ) : (
          game && (
            <>
              <section className="game-info panel">
                <div>
                  <h3>게임 정보</h3>
                  <p>라운드: {game.round} / 4</p>
                  <p>
                    찾은 보물: {game.found} / {game.total}
                  </p>
                </div>
                <div className="private-hand">
                  <h3>나의 정보</h3>
                  <p>
                    역할:{" "}
                    <span
                      className={`role ${privatePlayer?.role.toLowerCase()}`}
                    >
                      {privatePlayer ? roleName(privatePlayer.role) : "확인 중"}
                    </span>
                  </p>
                  <p>
                    손패:{" "}
                    {privatePlayer?.round === game.round
                      ? privatePlayer.hand.map((type, index) => (
                          <span
                            className={`hand-card ${type.toLowerCase()}`}
                            key={index}
                          >
                            {index > 0 ? ", " : ""}
                            {cardNames[type]}
                          </span>
                        ))
                      : "확인 중"}
                  </p>
                </div>
              </section>
              <p className={`turn-status ${myTurn ? "my-turn-text" : ""}`}>
                {game.nextRoundAt
                  ? `라운드 종료. ${Math.max(0, Math.ceil((game.nextRoundAt - now - offset) / 1000))}초 후 다음 라운드를 준비합니다...`
                  : myTurn
                    ? "당신의 턴입니다. 다른 플레이어의 카드를 선택하세요."
                    : "다른 플레이어의 턴을 기다리는 중..."}
              </p>
              <section className="revealed-pile">
                <h3>공개된 카드 더미 ({game.revealed.length}장)</h3>
                <div className="cards">
                  {game.revealed.length ? (
                    game.revealed.map((type, index) => (
                      <div
                        className={`game-card revealed ${type.toLowerCase()}`}
                        key={index}
                        title={cardNames[type]}
                      >
                        {cardIcons[type]}
                      </div>
                    ))
                  ) : (
                    <p className="muted">아직 공개된 카드가 없습니다.</p>
                  )}
                </div>
              </section>
              <div className="table-players">
                {game.players.map((player) => (
                  <section
                    className={`player-board panel ${player.uid === game.turn ? "current-turn" : ""}`}
                    key={player.uid}
                  >
                    <div className="player-heading">
                      <strong>
                        {player.username}
                        {player.uid === uid ? " (나)" : ""}
                      </strong>
                      <span>
                        ({player.cards.filter((card) => !card.revealed).length}{" "}
                        cards)
                        {!room.members.some(
                          (member) => member.uid === player.uid,
                        )
                          ? " · 퇴장함"
                          : ""}
                      </span>
                    </div>
                    <div className="cards">
                      {player.cards.map((card, index) => (
                        <button
                          className={`game-card ${card.revealed ? `revealed ${card.type?.toLowerCase()}` : "card-back"} ${player.uid === uid ? "my-card" : ""}`}
                          key={card.id}
                          aria-label={`${player.username} 카드 ${index + 1}${card.type ? ` ${cardNames[card.type]}` : ""}`}
                          disabled={
                            busy ||
                            card.revealed ||
                            player.uid === uid ||
                            !myTurn ||
                            !!game.nextRoundAt
                          }
                          onClick={() =>
                            void act({
                              type: "select",
                              code: room.code,
                              target: player.uid,
                              card: card.id,
                              revision: game.revision,
                            })
                          }
                        >
                          {card.type ? (
                            <span>{cardIcons[card.type]}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )
        )}
      </section>
      <nav className="mobile-room-nav" aria-label="게임 화면 이동">
        <button
          aria-expanded={mobileTab === "players"}
          onClick={() =>
            setMobileTab(mobileTab === "players" ? null : "players")
          }
        >
          <span aria-hidden="true">♙</span>참여자
        </button>
        <button
          aria-expanded={mobileTab === "chat"}
          onClick={() => setMobileTab(mobileTab === "chat" ? null : "chat")}
        >
          <span aria-hidden="true">☏</span>채팅
        </button>
        <button
          aria-expanded={mobileTab === "controls"}
          onClick={() =>
            setMobileTab(mobileTab === "controls" ? null : "controls")
          }
        >
          <span aria-hidden="true">⚙</span>컨트롤
        </button>
      </nav>
    </main>
  );
}
