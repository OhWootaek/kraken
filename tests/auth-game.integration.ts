import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithCredential,
  reauthenticateWithCredential,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  onSnapshot,
  terminate,
  disableNetwork,
  enableNetwork,
  type Firestore,
} from "firebase/firestore";
import { deleteApp as deleteAdminApp } from "firebase-admin/app";
import { productionHandler } from "../server/http.js";
import { firebaseAdmin } from "../server/store.js";
import type { Command } from "../shared/commands.js";
import type { Room, Secret } from "../shared/types.js";

const projectId = "demo-kraken";
if (
  process.env.GCLOUD_PROJECT !== projectId ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith("127.0.0.1:") ||
  !process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:")
)
  throw new Error(
    "This test requires local Auth + Firestore emulators and demo-kraken.",
  );

// Unsigned identity-provider fixtures are accepted ONLY by the local Auth emulator.
function jwt(payload: Record<string, unknown>) {
  return `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.`;
}
function googleCredential(id: string) {
  return GoogleAuthProvider.credential(
    jwt({
      sub: id,
      email: `${id}@example.test`,
      email_verified: true,
      iss: "https://accounts.google.com",
      aud: "local-emulator-only",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
}

test("Auth + Firestore + 운영 HTTP: 4/5/6인 전체 게임과 재인증·탈퇴", async (t) => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "http://127.0.0.1";
  const server = createServer((req, res) => {
    void productionHandler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/command`;
  const { db, auth } = firebaseAdmin();
  const clients: { app: FirebaseApp; db: Firestore; user: User; id: string }[] =
    [];
  async function client(id: string) {
    const app = initializeApp({ projectId, apiKey: "fake-emulator-key" }, id);
    const clientAuth = getAuth(app);
    connectAuthEmulator(
      clientAuth,
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,
      { disableWarnings: true },
    );
    const firestore = getFirestore(app);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    connectFirestoreEmulator(firestore, host, Number(port));
    const { user } = await signInWithCredential(
      clientAuth,
      googleCredential(id),
    );
    const c = { app, db: firestore, user, id };
    clients.push(c);
    assert.equal(
      (await auth.verifyIdToken(await user.getIdToken())).firebase
        .sign_in_provider,
      "google.com",
    );
    return c;
  }
  async function command(
    user: User,
    body: Command,
    expected = 200,
    token?: string,
  ) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? (await user.getIdToken())}`,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(
      response.status,
      expected,
      JSON.stringify({ type: body.type, result }),
    );
    return result;
  }
  function observe(
    firestore: Firestore,
    code: string,
    matches: (room: Room) => boolean,
  ) {
    let stop = () => {};
    let timer: ReturnType<typeof setTimeout>;
    const promise = new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => {
        stop();
        reject(new Error("Snapshot timed out"));
      }, 10000);
      stop = onSnapshot(
        doc(firestore, "rooms", code),
        (snapshot) => {
          if (snapshot.exists() && matches(snapshot.data() as Room)) {
            clearTimeout(timer);
            stop();
            resolve();
          }
        },
        (error) => {
          clearTimeout(timer);
          stop();
          reject(error);
        },
      );
    });
    return {
      promise,
      stop: () => {
        clearTimeout(timer);
        stop();
      },
    };
  }
  try {
    for (const count of [4, 5, 6])
      await t.test(
        `${count}인: 독립 인증·채팅 구독·손패 격리·모든 라운드·결과 정리`,
        async () => {
          const players = await Promise.all(
            Array.from({ length: count }, (_, i) =>
              client(`game${count}p${i}`),
            ),
          );
          for (const p of players)
            await command(p.user, { type: "profile", username: p.id });
          const { code } = await command(players[0].user, {
            type: "create",
            title: `${count}인 통합 검증`,
            maxPlayers: count,
            password: "",
          });
          for (const p of players.slice(1))
            await command(p.user, { type: "join", code, password: "" });
          await getDoc(doc(players[1].db, "rooms", code));
          await disableNetwork(players[1].db);
          const incoming = observe(players[1].db, code, (r) =>
            r.chat.some((m) => m.text === "실시간 통합 검증"),
          );
          try {
            await command(players[0].user, {
              type: "chat",
              code,
              text: "실시간 통합 검증",
            });
            await enableNetwork(players[1].db);
            await incoming.promise;
          } finally {
            incoming.stop();
          }
          for (const p of players.slice(1))
            await command(p.user, { type: "ready", code });
          await command(players[0].user, { type: "start", code });
          for (const p of players) {
            const own = await getDoc(
              doc(p.db, "rooms", code, "players", p.user.uid),
            );
            assert.equal(own.data()!.hand.length, 5);
            const other = players.find((q) => q !== p)!;
            await assert.rejects(
              getDoc(doc(p.db, "rooms", code, "players", other.user.uid)),
              { code: "permission-denied" },
            );
            await assert.rejects(getDoc(doc(p.db, "secrets", code)), {
              code: "permission-denied",
            });
          }
          let selections = 0;
          const rounds = new Set<number>();
          // Prefer empty cards, then treasures, using server-only test inspection to avoid Kraken.
          while (true) {
            const room = (await db.doc(`rooms/${code}`).get()).data() as Room;
            if (room.status === "FINISHED") {
              assert.equal(room.result!.winner, "SKELETON");
              break;
            }
            assert.ok(++selections < 40);
            const game = (
              (await db.doc(`secrets/${code}`).get()).data() as Secret
            ).game!;
            rounds.add(game.round);
            if (game.nextRoundAt) {
              const delay = Math.max(0, game.nextRoundAt - Date.now()) + 30;
              await new Promise((resolve) => setTimeout(resolve, delay));
              await command(players[0].user, { type: "advance", code });
              continue;
            }
            const candidates = game.players
              .filter((p) => p.uid !== game.turn)
              .flatMap((p) =>
                p.cards
                  .filter((c) => !c.revealed)
                  .map((card) => ({ target: p, card })),
              );
            const choice =
              candidates.find(({ card }) => card.type === "EMPTY_BOX") ??
              candidates.find(({ card }) => card.type === "TREASURE");
            assert.ok(choice, "A non-Kraken card must remain selectable");
            const { target, card } = choice;
            const actor = players.find((p) => p.user.uid === game.turn)!;
            await command(actor.user, {
              type: "select",
              code,
              target: target.uid,
              card: card.id,
              revision: game.revision,
            });
            const publicRoom = (
              await getDoc(doc(players[0].db, "rooms", code))
            ).data() as Room;
            for (const p of publicRoom.game?.players ?? [])
              for (const c of p.cards)
                if (!c.revealed) assert.equal(c.type, null);
          }
          assert.deepEqual([...rounds], [1, 2, 3, 4]);
          assert.equal((await db.doc(`secrets/${code}`).get()).exists, false);
          assert.equal(
            (await db.collection(`rooms/${code}/players`).get()).size,
            0,
          );
          assert.deepEqual(
            (await db.doc(`rooms/${code}`).get()).data()!.chat,
            [],
          );
          await Promise.all(
            players
              .slice(1)
              .map((p) => command(p.user, { type: "rematch", code })),
          );
          await command(players[1].user, { type: "rematch", code });
          assert.equal(
            (await db.doc(`rooms/${code}`).get()).data()!.rematch.length,
            count - 1,
          );
          await new Promise((resolve) => setTimeout(resolve, 10030));
          await Promise.all(
            players.map((p) => command(p.user, { type: "bootstrap" })),
          );
          assert.equal((await db.doc(`rooms/${code}`).get()).exists, false);
          assert.equal(
            (await db.doc(`users/${players[0].user.uid}`).get()).data()!
              .roomCode,
            null,
          );
          const nextCodes = await Promise.all(
            players
              .slice(1)
              .map(
                async (p) =>
                  (await db.doc(`users/${p.user.uid}`).get()).data()!.roomCode,
              ),
          );
          assert.equal(new Set(nextCodes).size, 1);
          const nextCode = nextCodes[0];
          assert.notEqual(nextCode, code);
          const next = (await db.doc(`rooms/${nextCode}`).get()).data() as Room;
          assert.equal(next.status, "WAITING");
          assert.equal(next.members.length, count - 1);
          assert.equal(next.maxPlayers, Math.max(4, count - 1));
          assert.ok(next.members.some((m) => m.uid === next.host));
          assert.notEqual(next.host, players[0].user.uid);
          assert.equal(
            (
              await db
                .collection("rooms")
                .where("title", "==", `${count}인 통합 검증`)
                .get()
            ).size,
            1,
          );
          for (const p of players.slice(1))
            await command(p.user, { type: "leave" });
          assert.equal((await db.doc(`rooms/${nextCode}`).get()).exists, false);
        },
      );
    await t.test(
      "5분 지난 인증은 탈퇴 차단, 재인증 후 Auth·프로필·닉네임·빈 방 삭제와 기존 토큰 차단",
      async () => {
        const p = await client("delete-test");
        await command(p.user, { type: "profile", username: p.id });
        const { code } = await command(p.user, {
          type: "create",
          title: "탈퇴 정리",
          maxPlayers: 4,
          password: "",
        });
        const original = await p.user.getIdToken();
        const claims = JSON.parse(
          Buffer.from(original.split(".")[1], "base64url").toString(),
        );
        const stale = jwt({
          ...claims,
          auth_time: Math.floor(Date.now() / 1000) - 360,
        });
        await command(p.user, { type: "delete-account" }, 401, stale);
        assert.ok(await auth.getUser(p.user.uid));
        assert.equal((await db.doc(`users/${p.user.uid}`).get()).exists, true);
        await reauthenticateWithCredential(p.user, googleCredential(p.id));
        const fresh = await p.user.getIdToken(true);
        assert.ok(
          (await auth.verifyIdToken(fresh)).auth_time >=
            Math.floor(Date.now() / 1000) - 5,
        );
        await command(p.user, { type: "delete-account" }, 200, fresh);
        await assert.rejects(auth.getUser(p.user.uid), {
          code: "auth/user-not-found",
        });
        assert.equal((await db.doc(`users/${p.user.uid}`).get()).exists, false);
        const claimId = createHash("sha256").update(p.id).digest("hex");
        assert.equal((await db.doc(`names/${claimId}`).get()).exists, false);
        assert.equal((await db.doc(`rooms/${code}`).get()).exists, false);
        assert.equal((await db.doc(`secrets/${code}`).get()).exists, false);
        await command(p.user, { type: "bootstrap" }, 401, fresh);
      },
    );
  } finally {
    for (const c of clients) {
      await terminate(c.db);
      await deleteApp(c.app);
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.terminate();
    await deleteAdminApp(auth.app);
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});
