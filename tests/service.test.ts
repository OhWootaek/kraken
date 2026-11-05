import { test } from "node:test";
import assert from "node:assert/strict";
import { GameService, memoryView } from "../server/service.js";
import { MemoryStore } from "../server/store.js";
import type { Profile, Room, Secret } from "../shared/types.js";
async function setup(count = 4, password = "") {
  let now = 100_000;
  const store = new MemoryStore();
  const service = new GameService(store, () => now);
  for (let i = 0; i < count; i++)
    await service.execute(`u${i}`, { type: "profile", username: `동료${i}` });
  const { code } = (await service.execute("u0", {
    type: "create",
    title: "항해",
    maxPlayers: count,
    password,
  })) as { code: string };
  for (let i = 1; i < count; i++)
    await service.execute(`u${i}`, { type: "join", code, password });
  const room = () => store.data.get(`rooms/${code}`) as Room;
  const secret = () => store.data.get(`secrets/${code}`) as Secret;
  return {
    store,
    service,
    code,
    room,
    secret,
    tick: (delta: number) => {
      now += delta;
    },
  };
}
test("닉네임 유일성과 같은 이름 저장, 변경 후 기존 이름 해제", async () => {
  const service = new GameService(new MemoryStore());
  await service.execute("a", { type: "profile", username: "선장" });
  await assert.rejects(
    service.execute("b", { type: "profile", username: "선장" }),
  );
  await service.execute("a", { type: "profile", username: "선장" });
  await service.execute("a", { type: "profile", username: "새선장" });
  await assert.doesNotReject(
    service.execute("b", { type: "profile", username: "선장" }),
  );
});
test("한 명 한 방, 정원, 비밀번호 해시와 입장 검증", async () => {
  const s = await setup(4, "secret");
  await s.service.execute("u3", { type: "leave" });
  await assert.rejects(
    s.service.execute("u3", { type: "join", code: s.code, password: "wrong" }),
  );
  assert.notEqual(s.secret().passwordHash, "secret");
  await s.service.execute("u3", {
    type: "join",
    code: s.code,
    password: "secret",
  });
  await s.service.execute("extra", { type: "profile", username: "추가" });
  await assert.rejects(
    s.service.execute("extra", {
      type: "join",
      code: s.code,
      password: "secret",
    }),
  );
  await assert.rejects(
    s.service.execute("u1", {
      type: "create",
      title: "둘째방",
      maxPlayers: 4,
      password: "",
    }),
  );
});
test("동시 준비와 정원·시작 권한, 준비된 유저 강퇴 금지", async () => {
  const s = await setup();
  await assert.rejects(
    s.service.execute("u1", { type: "start", code: s.code }),
  );
  await assert.rejects(
    s.service.execute("u1", { type: "capacity", code: s.code, maxPlayers: 5 }),
  );
  await assert.rejects(
    s.service.execute("u0", { type: "start", code: s.code }),
  );
  await Promise.all(
    [1, 2, 3].map((i) =>
      s.service.execute(`u${i}`, { type: "ready", code: s.code }),
    ),
  );
  assert.ok(s.room().members.every((m) => m.ready));
  await assert.rejects(
    s.service.execute("u0", { type: "kick", code: s.code, target: "u1" }),
  );
  await s.service.execute("u0", { type: "start", code: s.code });
  await assert.rejects(
    s.service.execute("u0", { type: "start", code: s.code }),
  );
  await assert.rejects(
    s.service.execute("u1", { type: "ready", code: s.code }),
  );
});
test("강퇴 시 참여 정보 해제, 방장 퇴장 시 가장 먼저 입장한 유저에게 위임", async () => {
  const s = await setup();
  await s.service.execute("u0", { type: "kick", code: s.code, target: "u3" });
  assert.equal((s.store.data.get("users/u3") as Profile).roomCode, null);
  await s.service.execute("u0", { type: "leave" });
  assert.equal(s.room().host, "u1");
  assert.equal(s.room().members[0].ready, true);
});
test("비참가자는 채팅·준비·카드 요청 불가, 발신자 위조 불가", async () => {
  const s = await setup();
  await s.service.execute("outsider", { type: "profile", username: "외부" });
  for (const type of ["chat", "ready", "advance"] as const)
    await assert.rejects(
      s.service.execute(
        "outsider",
        type === "chat"
          ? { type, code: s.code, text: "attack" }
          : { type, code: s.code },
      ),
    );
  await s.service.execute("u1", {
    type: "chat",
    code: s.code,
    text: "<img src=x onerror=alert(1)>",
  });
  assert.equal(s.room().chat[0].username, "동료1");
  await assert.rejects(
    s.service.execute("u1", { type: "chat", code: s.code, text: "spam" }),
  );
});
test("채팅은 40개만 저장하고 빈 방 삭제 시 함께 정리", async () => {
  const s = await setup();
  for (let i = 0; i < 45; i++) {
    s.tick(1000);
    await s.service.execute("u1", {
      type: "chat",
      code: s.code,
      text: `메시지${i}`,
    });
  }
  assert.equal(s.room().chat.length, 40);
  assert.equal(s.room().chat[0].text, "메시지5");
  for (let i = 0; i < 4; i++)
    await s.service.execute(`u${i}`, { type: "leave" });
  assert.equal(s.room(), undefined);
  assert.equal(s.secret(), undefined);
  assert.equal(
    [...s.store.data.keys()].filter((k) => k.startsWith(`rooms/${s.code}`))
      .length,
    0,
  );
});
test("게임 상태·개인 손패는 새 서비스 인스턴스로도 복원; 동시 중복 선택은 한 번만 적용", async () => {
  const s = await setup();
  for (let i = 1; i < 4; i++)
    await s.service.execute(`u${i}`, { type: "ready", code: s.code });
  await s.service.execute("u0", { type: "start", code: s.code });
  const resumed = new GameService(s.store, () => 100_000);
  const game = s.secret().game!;
  const target = game.players.find(
    (p) => p.uid !== game.turn && p.cards.some((c) => c.type === "EMPTY_BOX"),
  )!;
  const card = target.cards.find((c) => c.type === "EMPTY_BOX")!;
  const request = {
    type: "select" as const,
    code: s.code,
    target: target.uid,
    card: card.id,
    revision: game.revision,
  };
  const results = await Promise.allSettled([
    resumed.execute(game.turn, request),
    resumed.execute(game.turn, request),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const view = memoryView(s.store, "u1");
  assert.ok(view.privatePlayer);
  assert.equal(view.room?.game?.revision, 1);
  assert.equal("role" in view.room!.game!.players[0], false);
});
test("결과 시 서버 원본·개인 손패·채팅 삭제, 10초 후 결과·참여 정보 삭제", async () => {
  const s = await setup();
  for (let i = 1; i < 4; i++)
    await s.service.execute(`u${i}`, { type: "ready", code: s.code });
  await s.service.execute("u0", { type: "start", code: s.code });
  const game = s.secret().game!;
  const krakenPlayer = game.players.find((p) =>
    p.cards.some((c) => c.type === "KRAKEN"),
  )!;
  // Arrange a legitimate current player other than the kraken owner.
  game.turn = game.players.find((p) => p.uid !== krakenPlayer.uid)!.uid;
  const card = krakenPlayer.cards.find((c) => c.type === "KRAKEN")!;
  await s.service.execute(game.turn, {
    type: "select",
    code: s.code,
    target: krakenPlayer.uid,
    card: card.id,
    revision: game.revision,
  });
  assert.equal(s.room().status, "FINISHED");
  assert.ok(s.room().result);
  assert.equal(s.secret(), undefined);
  assert.equal(s.room().chat.length, 0);
  assert.equal(
    [...s.store.data.keys()].filter((k) => k.includes("/players/")).length,
    0,
  );
  s.tick(10_001);
  await s.service.execute("u0", { type: "bootstrap" });
  assert.equal(s.room(), undefined);
  for (let i = 0; i < 4; i++)
    assert.equal((s.store.data.get(`users/u${i}`) as Profile).roomCode, null);
});
test("회원 탈퇴 시 닉네임과 참여 정보 제거; 만료 방은 수동 정리", async () => {
  const s = await setup();
  await s.service.execute("u1", { type: "delete-account" });
  assert.equal(s.store.data.has("users/u1"), false);
  assert.equal(
    [...s.store.data].some(
      ([path, data]) =>
        path.startsWith("names/") && (data as { uid: string }).uid === "u1",
    ),
    false,
  );
  assert.ok(!s.room().members.some((m) => m.uid === "u1"));
  s.tick(24 * 60 * 60 * 1000 + 1);
  await s.service.cleanup();
  assert.equal(s.room(), undefined);
});

async function finished(count = 4) {
  const s = await setup(count);
  for (let i = 1; i < count; i++)
    await s.service.execute(`u${i}`, { type: "ready", code: s.code });
  await s.service.execute("u0", { type: "start", code: s.code });
  const game = s.secret().game!;
  const target = game.players.find((p) =>
    p.cards.some((c) => c.type === "KRAKEN"),
  )!;
  game.turn = game.players.find((p) => p.uid !== target.uid)!.uid;
  await s.service.execute(game.turn, {
    type: "select",
    code: s.code,
    target: target.uid,
    card: target.cards.find((c) => c.type === "KRAKEN")!.id,
    revision: game.revision,
  });
  return s;
}

test("재경기: 종료 전·비참가자·마감 후 신청 차단", async () => {
  const waiting = await setup();
  await assert.rejects(
    waiting.service.execute("u0", { type: "rematch", code: waiting.code }),
  );
  const s = await finished();
  await s.service.execute("outsider", { type: "profile", username: "외부인" });
  await assert.rejects(
    s.service.execute("outsider", { type: "rematch", code: s.code }),
    { status: 403 },
  );
  s.tick(10_000);
  await assert.rejects(
    s.service.execute("u0", { type: "rematch", code: s.code }),
    { status: 404 },
  );
});

test("재경기: 한 명부터 새 공개 대기방 생성, 미신청자는 로비, 기존 방장 미참가 시 권한 배정", async () => {
  const s = await finished();
  await s.service.execute("u2", { type: "rematch", code: s.code });
  await s.service.execute("u2", { type: "rematch", code: s.code });
  assert.deepEqual(s.room().rematch, ["u2"]);
  assert.equal(
    [...s.store.data.keys()].filter((p) => /^rooms\/\d{4}$/.test(p)).length,
    1,
  );
  s.tick(10_001);
  await s.service.execute("u0", { type: "bootstrap" });
  const code = (s.store.data.get("users/u2") as Profile).roomCode!;
  assert.notEqual(code, s.code);
  const next = s.store.data.get(`rooms/${code}`) as Room;
  assert.equal(next.host, "u2");
  assert.equal(next.maxPlayers, 4);
  assert.equal(next.locked, false);
  assert.equal(next.status, "WAITING");
  assert.deepEqual(
    next.members.map((m) => m.uid),
    ["u2"],
  );
  assert.equal(next.result, null);
  assert.deepEqual(next.chat, []);
  for (const uid of ["u0", "u1", "u3"])
    assert.equal((s.store.data.get(`users/${uid}`) as Profile).roomCode, null);
  await assert.rejects(s.service.execute("u2", { type: "start", code }));
  assert.equal(s.room(), undefined);
  assert.equal(s.secret(), undefined);
});

for (const count of [4, 5, 6])
  test(`재경기 ${count}인: 동시 신청·동시 정리에도 새 방 하나, 방장 유지·준비 초기화`, async () => {
    const s = await finished(count);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        s.service.execute(`u${i}`, { type: "rematch", code: s.code }),
      ),
    );
    s.tick(10_001);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        s.service.execute(`u${i}`, { type: "bootstrap" }),
      ),
    );
    const codes = new Set(
      Array.from(
        { length: count },
        (_, i) => (s.store.data.get(`users/u${i}`) as Profile).roomCode,
      ),
    );
    assert.equal(codes.size, 1);
    const code = [...codes][0]!;
    assert.notEqual(code, s.code);
    const next = s.store.data.get(`rooms/${code}`) as Room;
    assert.equal(next.host, "u0");
    assert.equal(next.maxPlayers, count);
    assert.equal(next.members.length, count);
    assert.deepEqual(
      next.members.filter((m) => m.ready).map((m) => m.uid),
      ["u0"],
    );
    assert.equal(
      [...s.store.data.keys()].filter((p) => /^rooms\/\d{4}$/.test(p)).length,
      1,
    );
    await assert.rejects(s.service.execute("u0", { type: "start", code }));
    for (let i = 1; i < count; i++)
      await s.service.execute(`u${i}`, { type: "ready", code });
    await s.service.execute("u0", { type: "start", code });
    assert.equal((s.store.data.get(`rooms/${code}`) as Room).game!.round, 1);
  });

test("재경기: 신청 후 나가거나 탈퇴한 사용자는 이동 대상에서 제외", async () => {
  const s = await finished();
  for (const uid of ["u0", "u1", "u2"])
    await s.service.execute(uid, { type: "rematch", code: s.code });
  await s.service.execute("u0", { type: "leave" });
  await s.service.execute("u1", { type: "delete-account" });
  s.tick(10_001);
  await s.service.execute("u2", { type: "bootstrap" });
  const next = memoryView(s.store, "u2").room!;
  assert.deepEqual(
    next.members.map((m) => m.uid),
    ["u2"],
  );
  assert.equal(next.host, "u2");
  assert.equal(s.store.data.has("users/u1"), false);
});
