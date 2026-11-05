import { useState } from "react";
import type { Room } from "../../shared/types";
import { submit, type Action } from "../forms";
export type JoinRoom = { code: string; title: string; locked: boolean };
export function Lobby({
  rooms,
  now,
  busy,
  act,
  onJoin,
  onSearch,
}: {
  rooms: Room[];
  now: number;
  busy: boolean;
  act: Action;
  onJoin: (room: JoinRoom) => void;
  onSearch: (code: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const waitingRooms = rooms.filter((room) => room.expiresAt > now);
  return (
    <main className="lobby page">
      <div className="lobby-toolbar">
        <button className="primary" onClick={() => setCreating(true)}>
          게임방 생성
        </button>
        <form
          className="search-form"
          onSubmit={submit((data) => onSearch(String(data.get("code"))))}
        >
          <input
            name="code"
            aria-label="방 코드"
            placeholder="4자리 코드로 검색"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            inputMode="numeric"
          />
          <button className="secondary" disabled={busy}>
            검색
          </button>
        </form>
      </div>
      <h2>대기중인 게임방</h2>
      <div className="room-table-wrap">
        <table className="room-table">
          <thead>
            <tr>
              <th>방 제목</th>
              <th>방장</th>
              <th>인원</th>
              <th>상태</th>
              <th>입장</th>
            </tr>
          </thead>
          <tbody>
            {waitingRooms.map((room) => (
              <tr key={room.code}>
                <td>{room.title}</td>
                <td>
                  {
                    room.members.find((member) => member.uid === room.host)
                      ?.username
                  }
                </td>
                <td className="nowrap">
                  {room.members.length} / {room.maxPlayers}
                </td>
                <td className={room.locked ? "locked-label" : "public-label"}>
                  {room.locked ? "비공개방" : "공개방"}
                </td>
                <td>
                  <button
                    className="primary join-button"
                    disabled={busy || room.members.length >= room.maxPlayers}
                    onClick={() => onJoin(room)}
                  >
                    입장
                  </button>
                </td>
              </tr>
            ))}
            {!waitingRooms.length && (
              <tr>
                <td className="empty-state" colSpan={5}>
                  대기중인 게임방이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {creating && (
        <div className="modal-backdrop">
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="새 게임방 만들기"
          >
            <button
              className="modal-close"
              aria-label="닫기"
              onClick={() => setCreating(false)}
            >
              ×
            </button>
            <h2>새 게임방 만들기</h2>
            <form
              onSubmit={submit(async (data) => {
                const created = await act({
                  type: "create",
                  title: String(data.get("title")),
                  maxPlayers: Number(data.get("maxPlayers")),
                  password: String(data.get("password")),
                });
                if (created) setCreating(false);
              })}
            >
              <label>
                방 제목:
                <input name="title" required maxLength={50} autoFocus />
              </label>
              <label>
                최대 인원:
                <select name="maxPlayers" defaultValue="6">
                  {[4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}명
                    </option>
                  ))}
                </select>
              </label>
              <label>
                비밀번호 (비공개 시 입력):
                <input
                  name="password"
                  type="password"
                  maxLength={64}
                  placeholder="공개방은 비워두세요"
                  autoComplete="new-password"
                />
              </label>
              <button className="primary" disabled={busy}>
                생성하기
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
