import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { Room } from "../shared/types.js";
export interface Transaction {
  get<T>(path: string): Promise<T | null>;
  set(path: string, value: unknown): void;
  delete(path: string): void;
}
export interface Store {
  run<T>(operation: (tx: Transaction) => Promise<T>): Promise<T>;
  expired(now: number): Promise<Room[]>;
}
export class MemoryStore implements Store {
  data = new Map<string, unknown>();
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      const draft = structuredClone(this.data);
      const value = await operation({
        get: async <V>(path: string) => (draft.get(path) as V) ?? null,
        set: (path, value) => {
          draft.set(path, structuredClone(value));
        },
        delete: (path) => {
          draft.delete(path);
        },
      });
      this.data = draft;
      return value;
    });
    this.tail = result.catch(() => {});
    return result;
  }
  async expired(now: number) {
    return [...this.data]
      .filter(
        ([p, v]) => /^rooms\/[^/]+$/.test(p) && (v as Room).expiresAt <= now,
      )
      .slice(0, 5)
      .map(([, v]) => v as Room);
  }
}
export function firebaseAdmin() {
  if (!getApps().length) {
    if (process.env.FIRESTORE_EMULATOR_HOST)
      initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-kraken" });
    else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n",
      );
      if (!projectId || !clientEmail || !privateKey)
        throw new Error("Firebase 서버 환경 변수가 필요합니다.");
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
  }
  return { db: getFirestore(), auth: getAuth() };
}
export class FirestoreStore implements Store {
  constructor(private db: Firestore) {}
  run<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.runTransaction(async (tx) => {
      const pending = new Map<string, unknown>();
      const cache = new Map<string, unknown>();
      const result = await operation({
        get: async <V>(path: string) => {
          if (pending.has(path)) return pending.get(path) as V | null;
          if (!cache.has(path))
            cache.set(path, (await tx.get(this.db.doc(path))).data() ?? null);
          return structuredClone(cache.get(path)) as V | null;
        },
        set: (path, value) => {
          pending.set(path, structuredClone(value));
        },
        delete: (path) => {
          pending.set(path, null);
        },
      });
      // Buffer writes until every read finishes; Firestore rejects reads after writes.
      for (const [path, value] of pending) {
        if (value === null) tx.delete(this.db.doc(path));
        else tx.set(this.db.doc(path), value as Record<string, unknown>);
      }
      return result;
    });
  }
  async expired(now: number) {
    const docs = await this.db
      .collection("rooms")
      .where("expiresAt", "<=", now)
      .limit(5)
      .get();
    return docs.docs.map((d) => d.data() as Room);
  }
}
