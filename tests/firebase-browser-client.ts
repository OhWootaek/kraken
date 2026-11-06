// Test entry only: the production Vite build includes index.html, never this page.
import "../client/backend";
import { getApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
const app = getApp();
const authHost = import.meta.env.VITE_TEST_AUTH_EMULATOR;
const firestoreHost = import.meta.env.VITE_TEST_FIRESTORE_EMULATOR;
if (
  !import.meta.env.DEV ||
  location.hostname !== "127.0.0.1" ||
  app.options.projectId !== "demo-kraken" ||
  !/^127\.0\.0\.1:\d+$/.test(authHost) ||
  !/^127\.0\.0\.1:\d+$/.test(firestoreHost)
)
  throw new Error("This entry requires local demo-kraken emulators.");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
const [host, port] = firestoreHost.split(":");
connectFirestoreEmulator(getFirestore(app), host, Number(port));
const id = new URLSearchParams(location.search).get("user")!;
if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid test identity");
const now = Math.floor(Date.now() / 1000);
const encode = (text: string) =>
  btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const token = `${encode('{"alg":"none"}')}.${encode(JSON.stringify({ sub: id, email: `${id}@example.test`, email_verified: true, iss: "https://accounts.google.com", aud: "local-test", iat: now, exp: now + 3600 }))}.`;
await signInWithCredential(auth, GoogleAuthProvider.credential(token));
await import("../client/main");
