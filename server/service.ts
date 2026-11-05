import { createHash, randomInt, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import type { Command } from "../shared/commands.js";
import {
  advanceRound,
  gameResult,
  publicGame,
  startGame,
  selectCard,
} from "../shared/game.js";
import {
  requireThat,
  type Game,
  type Profile,
  type Room,
  type Secret,
  type PrivatePlayer,
  type View,
} from "../shared/types.js";
import type { MemoryStore, Store, Transaction } from "./store.js";
const DAY = 24 * 60 * 60 * 1000;
const profilePath = (uid: string) => `users/${uid}`;
const namePath = (name: string) =>
  `names/${createHash("sha256").update(name).digest("hex")}`;
const privatePath = (code: string, uid: string) =>
  `rooms/${code}/players/${uid}`;
const emptyProfile = (): Profile => ({
  username: null,
  roomCode: null,
  lastChatAt: 0,
});
export class GameService {
  constructor(
    public store: Store,
    private clock = Date.now,
  ) {}
  private touch(room: Room) {
    room.updatedAt = this.clock();
    room.expiresAt = room.updatedAt + DAY;
  }
  private async newCode(tx: Transaction) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = String(randomInt(1000, 10000));
      if (!(await tx.get(`rooms/${code}`))) return code;
    }
    requireThat(false, "방 코드를 생성하지 못했습니다. 다시 시도해 주세요.");
  }
  private async finishRoom(tx: Transaction, room: Room) {
    if (room.status === "FINISHED" && room.rematch?.length) {
      const participants: { uid: string; profile: Profile }[] = [];
      for (const uid of room.rematch) {
        const profile = await tx.get<Profile>(profilePath(uid));
        if (profile?.username && profile.roomCode === room.code)
          participants.push({ uid, profile });
      }
      if (participants.length) {
        const code = await this.newCode(tx);
        const host = participants.some((p) => p.uid === room.host)
          ? room.host
          : participants[randomInt(participants.length)].uid;
        const next: Room = {
          code,
          title: room.title,
          maxPlayers: Math.max(4, participants.length),
          host,
          locked: false,
          status: "WAITING",
          members: participants.map(({ uid, profile }) => ({
            uid,
            username: profile.username!,
            ready: uid === host,
            joinedAt: this.clock(),
          })),
          game: null,
          result: null,
          chat: [],
          resultUntil: null,
          updatedAt: this.clock(),
          expiresAt: this.clock() + DAY,
        };
        tx.set(`rooms/${code}`, next);
        tx.set(`secrets/${code}`, {
          passwordHash: null,
          game: null,
        } satisfies Secret);
        for (const { uid, profile } of participants)
          tx.set(profilePath(uid), { ...profile, roomCode: code });
      }
    }
    await this.purge(tx, room);
  }
  private async purge(tx: Transaction, room: Room) {
    const users = new Set([
      ...room.members.map((m) => m.uid),
      ...(room.game?.players.map((p) => p.uid) ?? []),
      ...(room.result?.players.map((p) => p.uid) ?? []),
    ]);
    for (const uid of users) {
      const user = await tx.get<Profile>(profilePath(uid));
      if (user?.roomCode === room.code)
        tx.set(profilePath(uid), { ...user, roomCode: null });
      tx.delete(privatePath(room.code, uid));
    }
    tx.delete(`secrets/${room.code}`);
    tx.delete(`rooms/${room.code}`);
  }
  async cleanup() {
    for (const candidate of await this.store.expired(this.clock())) {
      await this.store.run(async (tx) => {
        const room = await tx.get<Room>(`rooms/${candidate.code}`);
        if (room && room.expiresAt <= this.clock())
          await this.finishRoom(tx, room);
      });
    }
  }
  private async leave(tx: Transaction, uid: string, user: Profile) {
    if (!user.roomCode) return;
    const room = await tx.get<Room>(`rooms/${user.roomCode}`);
    tx.set(profilePath(uid), { ...user, roomCode: null });
    if (!room) return;
    if (room.status === "FINISHED") return; // Keep result visible to other participants for its full 10 seconds.
    room.members = room.members.filter((m) => m.uid !== uid);
    tx.delete(privatePath(room.code, uid));
    if (!room.members.length) {
      await this.purge(tx, room);
      return;
    }
    if (room.host === uid) {
      room.host = room.members[0].uid;
      room.members[0].ready = true;
    }
    this.touch(room);
    tx.set(`rooms/${room.code}`, room);
  }
  private async saveGame(
    tx: Transaction,
    room: Room,
    secret: Secret,
    game: Game,
    deal: boolean,
  ) {
    room.game = publicGame(game);
    if (game.winner) {
      room.status = "FINISHED";
      room.result = gameResult(game);
      room.game = null;
      room.resultUntil = this.clock() + 10_000;
      room.rematch = [];
      room.expiresAt = room.resultUntil;
      room.chat = [];
      tx.delete(`secrets/${room.code}`);
      for (const p of game.players) tx.delete(privatePath(room.code, p.uid));
    } else {
      secret.game = game;
      tx.set(`secrets/${room.code}`, secret);
      if (deal)
        for (const p of game.players) {
          if (room.members.some((m) => m.uid === p.uid))
            tx.set(privatePath(room.code, p.uid), {
              role: p.role,
              hand: p.hand,
              round: game.round,
            } satisfies PrivatePlayer);
        }
      this.touch(room);
    }
    tx.set(`rooms/${room.code}`, room);
  }
  async execute(uid: string, command: Command): Promise<unknown> {
    if (command.type === "bootstrap" || command.type === "create")
      await this.cleanup();
    // Expensive password work happens outside a retried Firestore transaction.
    const passwordHash =
      command.type === "create" && command.password
        ? await hash(command.password, 10)
        : null;
    return this.store.run(async (tx) => {
      const user = (await tx.get<Profile>(profilePath(uid))) ?? emptyProfile();
      if (command.type === "bootstrap") {
        if (user.roomCode) {
          const current = await tx.get<Room>(`rooms/${user.roomCode}`);
          if (!current || current.expiresAt <= this.clock()) {
            if (current) {
              await this.finishRoom(tx, current);
              return {
                profile: await tx.get<Profile>(profilePath(uid)),
                serverNow: this.clock(),
              };
            }
            user.roomCode = null;
            tx.set(profilePath(uid), user);
          }
        }
        return { profile: user, serverNow: this.clock() };
      }
      if (command.type === "profile") {
        const claimed = await tx.get<{ uid: string }>(
          namePath(command.username),
        );
        requireThat(
          !claimed || claimed.uid === uid,
          "이미 사용 중인 닉네임입니다.",
        );
        if (user.username && user.username !== command.username)
          tx.delete(namePath(user.username));
        tx.set(namePath(command.username), { uid });
        user.username = command.username;
        tx.set(profilePath(uid), user);
        if (user.roomCode) {
          const room = await tx.get<Room>(`rooms/${user.roomCode}`);
          if (room) {
            room.members.forEach((m) => {
              if (m.uid === uid) m.username = command.username;
            });
            const secret = await tx.get<Secret>(`secrets/${room.code}`);
            if (secret?.game) {
              secret.game.players.forEach((p) => {
                if (p.uid === uid) p.username = command.username;
              });
              room.game = publicGame(secret.game);
              tx.set(`secrets/${room.code}`, secret);
            }
            if (room.result)
              room.result.players.forEach((p) => {
                if (p.uid === uid) p.username = command.username;
              });
            tx.set(`rooms/${room.code}`, room);
          }
        }
        return { profile: user };
      }
      if (command.type === "delete-account") {
        await this.leave(tx, uid, user);
        if (user.username) tx.delete(namePath(user.username));
        tx.delete(profilePath(uid));
        return {};
      }
      requireThat(user.username, "먼저 닉네임을 등록해 주세요.");
      if (command.type === "leave") {
        await this.leave(tx, uid, user);
        return {};
      }
      if (command.type === "create") {
        requireThat(
          !user.roomCode,
          "이미 참여 중인 방이 있습니다. 먼저 나가 주세요.",
        );
        const code = await this.newCode(tx);
        const room: Room = {
          code,
          title: command.title,
          maxPlayers: command.maxPlayers,
          host: uid,
          locked: !!passwordHash,
          status: "WAITING",
          members: [
            {
              uid,
              username: user.username,
              ready: true,
              joinedAt: this.clock(),
            },
          ],
          game: null,
          result: null,
          chat: [],
          updatedAt: this.clock(),
          expiresAt: this.clock() + DAY,
          resultUntil: null,
        };
        tx.set(`rooms/${code}`, room);
        tx.set(`secrets/${code}`, {
          passwordHash,
          game: null,
        } satisfies Secret);
        tx.set(profilePath(uid), { ...user, roomCode: code });
        return { code };
      }
      const room = await tx.get<Room>(`rooms/${command.code}`);
      requireThat(
        room && room.expiresAt > this.clock(),
        "존재하지 않거나 만료된 방입니다.",
        404,
      );
      if (command.type === "search") {
        return {
          code: room.code,
          title: room.title,
          locked: room.locked,
          status: room.status,
          maxPlayers: room.maxPlayers,
          count: room.members.length,
        };
      }
      const secret = await tx.get<Secret>(`secrets/${room.code}`);
      if (command.type === "join") {
        if (user.roomCode === room.code) return { code: room.code };
        requireThat(!user.roomCode, "이미 참여 중인 방이 있습니다.");
        requireThat(
          room.status === "WAITING",
          "이미 시작했거나 종료된 방입니다.",
        );
        requireThat(room.members.length < room.maxPlayers, "방이 꽉 찼습니다.");
        requireThat(
          secret &&
            (!secret.passwordHash ||
              (await compare(command.password, secret.passwordHash))),
          "비밀번호가 일치하지 않습니다.",
        );
        room.members.push({
          uid,
          username: user.username,
          ready: false,
          joinedAt: this.clock(),
        });
        tx.set(profilePath(uid), { ...user, roomCode: room.code });
      } else {
        const member = room.members.find((m) => m.uid === uid);
        requireThat(
          member && user.roomCode === room.code,
          "이 방의 참여자가 아닙니다.",
          403,
        );
        if (command.type === "rematch") {
          requireThat(
            room.status === "FINISHED",
            "게임 종료 후에만 다시 참가할 수 있습니다.",
          );
          room.rematch = [...new Set([...(room.rematch ?? []), uid])];
          tx.set(`rooms/${room.code}`, room);
          return {};
        }
        if (command.type === "advance") {
          if (room.status === "FINISHED") return {};
          if (secret?.game) {
            const next = advanceRound(secret.game, this.clock());
            if (next !== secret.game)
              await this.saveGame(tx, room, secret, next, true);
          }
          return { serverNow: this.clock() };
        }
        if (command.type === "chat") {
          requireThat(room.status !== "FINISHED", "이미 종료된 방입니다.");
          requireThat(
            this.clock() - user.lastChatAt >= 750,
            "메시지를 너무 빠르게 보내고 있습니다.",
          );
          room.chat = [
            ...room.chat,
            {
              id: randomUUID(),
              uid,
              username: user.username,
              text: command.text,
              at: this.clock(),
            },
          ].slice(-40);
          tx.set(profilePath(uid), { ...user, lastChatAt: this.clock() });
        } else if (command.type === "select") {
          requireThat(
            room.status === "PLAYING" && secret?.game,
            "게임이 진행 중이 아닙니다.",
          );
          const next = selectCard(
            secret.game,
            uid,
            command.target,
            command.card,
            command.revision,
            this.clock(),
          );
          await this.saveGame(tx, room, secret, next, false);
          return {};
        } else {
          requireThat(
            room.status === "WAITING",
            "대기 중인 방에서만 사용할 수 있습니다.",
          );
          if (command.type === "ready") {
            if (room.host !== uid) member.ready = !member.ready;
          } else {
            requireThat(room.host === uid, "방장만 사용할 수 있습니다.", 403);
            if (command.type === "capacity") {
              requireThat(
                command.maxPlayers >= room.members.length,
                "현재 인원보다 적게 설정할 수 없습니다.",
              );
              room.maxPlayers = command.maxPlayers;
            } else if (command.type === "kick") {
              const target = room.members.find((m) => m.uid === command.target);
              requireThat(
                target && target.uid !== uid,
                "강퇴할 수 없는 대상입니다.",
              );
              requireThat(
                !target.ready,
                "준비 완료 상태인 플레이어는 강퇴할 수 없습니다.",
              );
              const targetUser = await tx.get<Profile>(profilePath(target.uid));
              if (targetUser?.roomCode === room.code)
                tx.set(profilePath(target.uid), {
                  ...targetUser,
                  roomCode: null,
                });
              room.members = room.members.filter((m) => m.uid !== target.uid);
            } else if (command.type === "start") {
              requireThat(secret, "방 정보가 없습니다.");
              const game = startGame(room.members, uid, room.maxPlayers);
              room.status = "PLAYING";
              await this.saveGame(tx, room, secret, game, true);
              return {};
            }
          }
        }
      }
      this.touch(room);
      tx.set(`rooms/${room.code}`, room);
      return { code: room.code };
    });
  }
}
export function memoryView(store: MemoryStore, uid: string): View {
  const profile = store.data.get(profilePath(uid)) as Profile | undefined;
  const room = profile?.roomCode
    ? (store.data.get(`rooms/${profile.roomCode}`) as Room | undefined)
    : null;
  return {
    profile: profile ?? emptyProfile(),
    room: room ?? null,
    privatePlayer: room
      ? ((store.data.get(privatePath(room.code, uid)) as PrivatePlayer) ?? null)
      : null,
    lobby: [...store.data]
      .filter(
        ([p, v]) =>
          /^rooms\/[^/]+$/.test(p) && (v as Room).status === "WAITING",
      )
      .slice(0, 50)
      .map(([, v]) => v as Room),
    serverNow: Date.now(),
  };
}
