import { randomInt, randomUUID } from "node:crypto";
import {
  requireThat,
  type CardType,
  type Game,
  type Member,
  type PublicGame,
  type Result,
  type Role,
} from "./types.js";
export type Random = (max: number) => number;
export function shuffle<T>(items: T[], random: Random = randomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function cards(hand: CardType[], random: Random) {
  return shuffle(
    hand.map((type) => ({ id: randomUUID(), type, revealed: false })),
    random,
  );
}
export function startGame(
  members: Member[],
  host: string,
  maxPlayers: number,
  random: Random = randomInt,
): Game {
  requireThat(
    members.length === maxPlayers && members.length >= 4 && members.length <= 6,
    "인원이 정원과 같아야 시작할 수 있습니다.",
  );
  requireThat(
    members.every((m) => m.uid === host || m.ready),
    "아직 준비되지 않은 플레이어가 있습니다.",
  );
  const roles = shuffle<Role>(
    [
      ...Array<Role>(members.length === 4 ? 3 : 4).fill("EXPLORER"),
      "SKELETON",
      "SKELETON",
    ],
    random,
  );
  const deck = shuffle<CardType>(
    [
      "KRAKEN",
      ...Array<CardType>(members.length).fill("TREASURE"),
      ...Array<CardType>(members.length * 4 - 1).fill("EMPTY_BOX"),
    ],
    random,
  );
  return {
    round: 1,
    turn: members[random(members.length)].uid,
    found: 0,
    total: members.length,
    revision: 0,
    revealed: [],
    nextRoundAt: null,
    nextTurn: null,
    winner: null,
    players: members.map((m, i) => {
      const hand = deck.slice(i * 5, i * 5 + 5);
      return {
        uid: m.uid,
        username: m.username,
        role: roles[i],
        hand,
        cards: cards(hand, random),
      };
    }),
  };
}
export function selectCard(
  original: Game,
  uid: string,
  target: string,
  cardId: string,
  revision: number,
  now: number,
): Game {
  const game = structuredClone(original);
  requireThat(!game.winner, "이미 종료된 게임입니다.");
  requireThat(
    game.revision === revision,
    "화면이 갱신되었습니다. 최신 상태에서 다시 선택해 주세요.",
  );
  requireThat(game.nextRoundAt === null, "다음 라운드를 준비 중입니다.");
  requireThat(game.turn === uid, "당신의 턴이 아닙니다.");
  requireThat(uid !== target, "자신의 카드는 선택할 수 없습니다.");
  const player = game.players.find((p) => p.uid === target);
  const card = player?.cards.find((c) => c.id === cardId);
  requireThat(card, "존재하지 않는 카드입니다.");
  requireThat(!card.revealed, "이미 공개된 카드입니다.");
  card.revealed = true;
  game.revealed.push(card.type);
  game.revision++;
  if (card.type === "TREASURE") game.found++;
  if (card.type === "KRAKEN") game.winner = "SKELETON";
  else if (game.found === game.total) game.winner = "EXPLORER";
  else if (game.revealed.length === game.players.length) {
    if (game.round === 4) game.winner = "SKELETON";
    else {
      game.nextRoundAt = now + 3000;
      game.nextTurn = target;
    }
  } else game.turn = target;
  return game;
}
export function advanceRound(
  original: Game,
  now: number,
  random: Random = randomInt,
): Game {
  if (
    original.nextRoundAt === null ||
    now < original.nextRoundAt ||
    original.winner
  )
    return original;
  const game = structuredClone(original);
  const deck = shuffle(
    game.players.flatMap((p) =>
      p.cards.filter((c) => !c.revealed).map((c) => c.type),
    ),
    random,
  );
  game.round++;
  const count = 6 - game.round;
  game.players.forEach((player, i) => {
    player.hand = deck.slice(i * count, (i + 1) * count);
    player.cards = cards(player.hand, random);
  });
  game.turn = game.nextTurn!;
  game.nextTurn = null;
  game.nextRoundAt = null;
  game.revealed = [];
  game.revision++;
  return game;
}
export function publicGame(game: Game): PublicGame {
  const { nextTurn: _, players, ...state } = game;
  return {
    ...state,
    players: players.map((p) => ({
      uid: p.uid,
      username: p.username,
      cards: p.cards.map((c) => ({
        id: c.id,
        revealed: c.revealed,
        type: c.revealed ? c.type : null,
      })),
    })),
  };
}
export function gameResult(game: Game): Result {
  requireThat(game.winner, "게임이 끝나지 않았습니다.");
  return {
    winner: game.winner,
    found: game.found,
    total: game.total,
    kraken: game.revealed.includes("KRAKEN"),
    players: game.players.map(({ uid, username, role }) => ({
      uid,
      username,
      role,
    })),
  };
}
