import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  getDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import type { Command } from "../shared/commands";
import type { Profile, Room, PrivatePlayer, View } from "../shared/types";
export const isDemo =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEMO !== "false";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured =
  isDemo ||
  (Object.values(config).every(Boolean) && !!import.meta.env.VITE_API_BASE_URL);
const app = !isDemo && configured ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
export type Identity = { uid: string };
let demo: Identity | null =
  isDemo && localStorage.getItem("kraken-demo-uid")
    ? { uid: localStorage.getItem("kraken-demo-uid")! }
    : null;
const authListeners = new Set<(user: Identity | null) => void>();
export function watchAuth(callback: (user: Identity | null) => void) {
  if (auth) return onAuthStateChanged(auth, callback);
  authListeners.add(callback);
  callback(demo);
  return () => {
    authListeners.delete(callback);
  };
}
export async function login() {
  if (auth) {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return;
  }
  if (!isDemo) throw new Error("Firebase 환경 변수를 설정해 주세요.");
  demo = { uid: crypto.randomUUID() };
  localStorage.setItem("kraken-demo-uid", demo.uid);
  authListeners.forEach((fn) => fn(demo));
}
export async function logout() {
  if (auth) await signOut(auth);
  else {
    demo = null;
    localStorage.removeItem("kraken-demo-uid");
    authListeners.forEach((fn) => fn(null));
  }
}
export async function reauthenticate() {
  if (auth) {
    const { reauthenticateWithPopup } = await import("firebase/auth");
    await reauthenticateWithPopup(
      auth.currentUser as User,
      new GoogleAuthProvider(),
    );
  }
}
async function token() {
  if (isDemo && demo) return `demo:${demo.uid}`;
  if (auth?.currentUser) return auth.currentUser.getIdToken();
  throw new Error("로그인이 필요합니다.");
}
export async function command<T = Record<string, unknown>>(
  body: Command,
): Promise<T> {
  const response = await fetch(
    `${isDemo ? "" : import.meta.env.VITE_API_BASE_URL}/api/command`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.ok)
    throw new Error(result.error || "요청을 처리하지 못했습니다.");
  return result as T;
}
export function watchView(
  uid: string,
  callback: (view: View) => void,
  onError: (error: Error) => void,
): () => void {
  if (isDemo) {
    const stream = new EventSource(
      `/api/events?token=${encodeURIComponent(`demo:${uid}`)}`,
    );
    stream.onmessage = (event) => callback(JSON.parse(event.data));
    stream.onerror = () =>
      onError(
        new Error("실시간 연결이 끊겼습니다. 연결을 다시 시도하고 있습니다."),
      );
    return () => stream.close();
  }
  if (!db) return () => {};
  const firestore = db;
  let state: View = {
    profile: null,
    room: null,
    privatePlayer: null,
    lobby: [],
    serverNow: Date.now(),
  };
  let activeCode: string | null | undefined;
  let stops: Unsubscribe[] = [];
  let active = true;
  const emit = () => {
    if (active) callback({ ...state });
  };
  const failure = () =>
    active &&
    onError(
      new Error(
        "실시간 데이터를 읽지 못했습니다. 연결·권한·무료 사용량 한도를 확인해 주세요.",
      ),
    );
  const roomFailure = (code: string) => async () => {
    if (!active || activeCode !== code) return;
    // A kick/finish atomically removes access. Do not present that normal transition as an outage.
    try {
      const profile = await getDoc(doc(firestore, "users", uid));
      if (!active || activeCode !== code || profile.data()?.roomCode !== code)
        return;
    } catch {
      /* Report genuine permission/network failures below. */
    }
    failure();
  };
  const stopUser = onSnapshot(
    doc(firestore, "users", uid),
    (snapshot) => {
      state.profile = snapshot.exists()
        ? (snapshot.data() as Profile)
        : { username: null, roomCode: null, lastChatAt: 0 };
      const code = state.profile.roomCode;
      if (activeCode !== code) {
        activeCode = code;
        stops.forEach((stop) => stop());
        stops = [];
        state.room = null;
        state.privatePlayer = null;
        state.lobby = [];
        if (code) {
          stops.push(
            onSnapshot(
              doc(firestore, "rooms", code),
              (s) => {
                if (activeCode !== code) return;
                state.room = s.exists() ? (s.data() as Room) : null;
                emit();
              },
              roomFailure(code),
            ),
          );
          stops.push(
            onSnapshot(
              doc(firestore, "rooms", code, "players", uid),
              (s) => {
                if (activeCode !== code) return;
                state.privatePlayer = s.exists()
                  ? (s.data() as PrivatePlayer)
                  : null;
                emit();
              },
              roomFailure(code),
            ),
          );
        } else {
          stops.push(
            onSnapshot(
              query(
                collection(firestore, "rooms"),
                where("status", "==", "WAITING"),
                limit(50),
              ),
              (s) => {
                state.lobby = s.docs.map((d) => d.data() as Room);
                emit();
              },
              failure,
            ),
          );
        }
      }
      emit();
    },
    failure,
  );
  return () => {
    active = false;
    stopUser();
    stops.forEach((stop) => stop());
  };
}
