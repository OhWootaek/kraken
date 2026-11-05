import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceRound,
  gameResult,
  publicGame,
  selectCard,
  startGame,
} from "../shared/game.js";
import { commandSchema } from "../shared/commands.js";
import type { CardType, Game, Member } from "../shared/types.js";
const members = (n = 4): Member[] =>
  Array.from({ length: n }, (_, i) => ({
    uid: `p${i}`,
    username: `탐험가${i}`,
    ready: true,
    joinedAt: i,
  }));
const deterministic = (max: number) => max - 1;
function fixture(): Game {
  const game = startGame(members(), "p0", 4, deterministic);
  game.turn = "p0";
  return game;
}
function addCard(game: Game, type: CardType, target = "p1") {
  const player = game.players.find((p) => p.uid === target)!;
  player.cards = [{ id: "test-card", type, revealed: false }];
  return player.cards[0].id;
}
for (const n of [4, 5, 6])
  test(`${n}인: 덱·손패·역할·공개 정보`, () => {
    for (let run = 0; run < 30; run++) {
      const game = startGame(members(n), "p0", n);
      const deck = game.players.flatMap((p) => p.cards);
      assert.equal(deck.length, n * 5);
      assert.equal(deck.filter((c) => c.type === "KRAKEN").length, 1);
      assert.equal(deck.filter((c) => c.type === "TREASURE").length, n);
      const skeletons = game.players.filter(
        (p) => p.role === "SKELETON",
      ).length;
      assert.ok(n === 6 ? skeletons === 2 : skeletons === 1 || skeletons === 2);
      assert.equal(new Set(deck.map((c) => c.id)).size, deck.length);
      assert.ok(game.players.every((p) => p.hand.length === 5));
      const publicState = publicGame(game);
      assert.ok(
        publicState.players.every(
          (p) =>
            !("role" in p) &&
            !("hand" in p) &&
            p.cards.every((c) => c.type === null),
        ),
      );
    }
  });
test("정원과 준비 상태를 모두 확인한다", () => {
  assert.throws(() => startGame(members(3), "p0", 4));
  const players = members();
  players[1].ready = false;
  assert.throws(() => startGame(players, "p0", 4));
  players[1].ready = true;
  players[0].ready = false;
  assert.doesNotThrow(() => startGame(players, "p0", 4));
});
test("자기 카드·잘못된 턴·없는 카드·오래된 버전은 거부한다", () => {
  const game = fixture();
  assert.throws(() =>
    selectCard(game, "p0", "p0", game.players[0].cards[0].id, 0, 100),
  );
  assert.throws(() =>
    selectCard(game, "p1", "p2", game.players[2].cards[0].id, 0, 100),
  );
  assert.throws(() => selectCard(game, "p0", "p1", "missing", 0, 100));
  assert.throws(() =>
    selectCard(game, "p0", "p1", game.players[1].cards[0].id, 99, 100),
  );
});
test("선택된 카드 주인에게 턴이 넘어가며 원본은 수정하지 않는다", () => {
  const original = fixture();
  const card = addCard(original, "EMPTY_BOX");
  const next = selectCard(original, "p0", "p1", card, 0, 100);
  assert.equal(next.turn, "p1");
  assert.equal(next.revision, 1);
  assert.equal(original.revision, 0);
  assert.equal(original.players[1].cards[0].revealed, false);
  assert.equal(publicGame(next).players[1].cards[0].type, "EMPTY_BOX");
  next.turn = "p0";
  assert.throws(() => selectCard(next, "p0", "p1", card, 1, 100));
});
test("크라켄 발견 시 스켈레톤 승리와 전체 역할 공개", () => {
  const game = fixture();
  const id = addCard(game, "KRAKEN");
  const next = selectCard(game, "p0", "p1", id, 0, 100);
  assert.equal(next.winner, "SKELETON");
  const result = gameResult(next);
  assert.equal(result.kraken, true);
  assert.equal(result.players.length, 4);
});
test("마지막 보물 발견 시 탐험대 승리", () => {
  const game = fixture();
  game.found = game.total - 1;
  const next = selectCard(game, "p0", "p1", addCard(game, "TREASURE"), 0, 100);
  assert.equal(next.winner, "EXPLORER");
  assert.equal(next.found, next.total);
});
test("4라운드 N번째 카드까지 보물을 못 찾으면 스켈레톤 승리", () => {
  const game = fixture();
  game.round = 4;
  game.revealed = ["EMPTY_BOX", "EMPTY_BOX", "EMPTY_BOX"];
  const next = selectCard(game, "p0", "p1", addCard(game, "EMPTY_BOX"), 0, 100);
  assert.equal(next.winner, "SKELETON");
});
test("3초 동안 선택 금지, 시간 도달 후 남은 카드만 재배분, 5→4→3→2장", () => {
  let game = fixture();
  // Select only safe cards; alternate owners exactly as the existing game does.
  for (let round = 1; round <= 3; round++) {
    for (let i = 0; i < 4; i++) {
      const target = game.players.find(
        (p) =>
          p.uid !== game.turn &&
          p.cards.some((c) => !c.revealed && c.type === "EMPTY_BOX"),
      )!;
      const card = target.cards.find(
        (c) => !c.revealed && c.type === "EMPTY_BOX",
      )!;
      game = selectCard(
        game,
        game.turn,
        target.uid,
        card.id,
        game.revision,
        1000,
      );
    }
    assert.equal(game.nextRoundAt, 4000);
    assert.equal(advanceRound(game, 3999), game);
    assert.throws(() =>
      selectCard(game, game.turn, "p1", "any", game.revision, 2000),
    );
    const expectedTurn = game.nextTurn;
    const remaining = game.players
      .flatMap((p) => p.cards.filter((c) => !c.revealed).map((c) => c.type))
      .sort();
    game = advanceRound(game, 4000, deterministic);
    assert.equal(game.round, round + 1);
    assert.equal(game.turn, expectedTurn);
    assert.ok(game.players.every((p) => p.hand.length === 5 - round));
    assert.deepEqual(
      game.players.flatMap((p) => p.cards.map((c) => c.type)).sort(),
      remaining,
    );
    assert.equal(game.revealed.length, 0);
    assert.equal(advanceRound(game, 5000), game);
  }
});
test("채팅·방 코드·정원·입력 크기를 검증한다", () => {
  assert.equal(
    commandSchema.safeParse({ type: "chat", code: "1234", text: "안녕" })
      .success,
    true,
  );
  for (const bad of [
    { type: "chat", code: "1234", text: "x".repeat(301) },
    { type: "chat", code: "1234", text: "   " },
    { type: "create", title: "room", password: "", maxPlayers: 7 },
    { type: "search", code: "../secrets" },
    { type: "profile", username: "x".repeat(256) },
  ])
    assert.equal(commandSchema.safeParse(bad).success, false);
});
