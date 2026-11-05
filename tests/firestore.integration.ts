import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { deleteApp } from "firebase-admin/app";
import { GameService } from "../server/service.js";
import { firebaseAdmin, FirestoreStore } from "../server/store.js";
import type { Secret } from "../shared/types.js";
const projectId = "demo-kraken";
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error(
    "Run with npm run test:firebase; never use a real project for this test.",
  );
test("Firestore: 운영 트랜잭션·닉네임 경합·정원·권한 규칙·개인정보·정리", async (t) => {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
  const { db } = firebaseAdmin();
  const service = new GameService(new FirestoreStore(db));
  try {
    await env.clearFirestore();
    await t.test("동일 닉네임 동시 등록은 한 명만 성공", async () => {
      const results = await Promise.allSettled(
        ["a", "b"].map((uid) =>
          service.execute(uid, { type: "profile", username: "동일이름" }),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    });
    for (const uid of ["host", "p1", "p2", "p3", "extra"])
      await service.execute(uid, { type: "profile", username: uid });
    const { code } = (await service.execute("host", {
      type: "create",
      title: "에뮬레이터 항해",
      maxPlayers: 4,
      password: "",
    })) as { code: string };
    for (const uid of ["p1", "p2"])
      await service.execute(uid, { type: "join", code, password: "" });
    await t.test(
      "마지막 한 자리에 두 명이 동시 입장해도 정원을 넘지 않음",
      async () => {
        const results = await Promise.allSettled(
          ["p3", "extra"].map((uid) =>
            service.execute(uid, { type: "join", code, password: "" }),
          ),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          (await db.doc(`rooms/${code}`).get()).data()!.members.length,
          4,
        );
      },
    );
    const hostDb = env.authenticatedContext("host").firestore();
    const outsider = env.authenticatedContext("outsider").firestore();
    const anon = env.unauthenticatedContext().firestore();
    await t.test(
      "대기방 쿼리 허용, 미인증·서버 비밀·다른 사용자·직접 쓰기 차단",
      async () => {
        await assertSucceeds(
          getDocs(
            query(
              collection(outsider, "rooms"),
              where("status", "==", "WAITING"),
              limit(50),
            ),
          ),
        );
        await assertFails(getDoc(doc(anon, "rooms", code)));
        await assertFails(getDoc(doc(hostDb, "secrets", code)));
        await assertFails(getDoc(doc(outsider, "users", "host")));
        await assertFails(
          setDoc(doc(hostDb, "rooms", code), { status: "FINISHED" }),
        );
        await assertFails(
          setDoc(doc(hostDb, "users", "host"), { username: "forged" }),
        );
        await assertFails(getDocs(collection(hostDb, "names")));
      },
    );
    const members = (await db.doc(`rooms/${code}`).get()).data()!.members as {
      uid: string;
    }[];
    for (const member of members.filter((m) => m.uid !== "host"))
      await service.execute(member.uid, { type: "ready", code });
    await service.execute("host", { type: "start", code });
    await t.test(
      "본인 역할·손패만 읽고, 비참가자는 진행 중 방도 읽지 못함",
      async () => {
        await assertSucceeds(
          getDoc(doc(hostDb, "rooms", code, "players", "host")),
        );
        await assertFails(getDoc(doc(hostDb, "rooms", code, "players", "p1")));
        await assertFails(getDoc(doc(outsider, "rooms", code)));
        await assertSucceeds(getDoc(doc(hostDb, "rooms", code)));
      },
    );
    const game = ((await db.doc(`secrets/${code}`).get()).data() as Secret)
      .game!;
    const target = game.players.find(
      (p) => p.uid !== game.turn && p.cards.some((c) => c.type === "EMPTY_BOX"),
    )!;
    const card = target.cards.find((c) => c.type === "EMPTY_BOX")!;
    await t.test("실제 Firestore 동시 카드 요청은 한 번만 반영", async () => {
      const request = {
        type: "select" as const,
        code,
        target: target.uid,
        card: card.id,
        revision: game.revision,
      };
      const results = await Promise.allSettled([
        service.execute(game.turn, request),
        service.execute(game.turn, request),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (await db.doc(`rooms/${code}`).get()).data()!.game.revision,
        1,
      );
    });
    await t.test(
      "최종 퇴장 후 방·비밀·하위 손패·사용자 참여 참조 정리",
      async () => {
        for (const member of members)
          await service.execute(member.uid, { type: "leave" });
        assert.equal((await db.doc(`rooms/${code}`).get()).exists, false);
        assert.equal((await db.doc(`secrets/${code}`).get()).exists, false);
        assert.equal(
          (await db.collection(`rooms/${code}/players`).get()).size,
          0,
        );
        for (const member of members)
          assert.equal(
            (await db.doc(`users/${member.uid}`).get()).data()!.roomCode,
            null,
          );
      },
    );
  } finally {
    await env.cleanup();
    await db.terminate();
    await deleteApp(firebaseAdmin().auth.app);
  }
});
