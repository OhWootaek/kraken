import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createServer as createViteServer } from "vite";
import { deleteApp } from "firebase-admin/app";
import { productionHandler } from "../server/http.js";
import { firebaseAdmin } from "../server/store.js";
if (
  process.env.GCLOUD_PROJECT !== "demo-kraken" ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith("127.0.0.1:") ||
  !process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:")
)
  throw new Error(
    "Run against local demo-kraken Auth + Firestore emulators only.",
  );
const origin = "http://127.0.0.1:5174";
process.env.ALLOWED_ORIGINS = origin;
const requests: Promise<void>[] = [];
const api = createServer((req, res) => {
  const request = productionHandler(req, res);
  requests.push(request);
  void request.catch(() => {}); // Report failures after all requests drain below.
});
await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
const address = api.address();
assert.ok(address && typeof address !== "string");
Object.assign(process.env, {
  VITE_LOCAL_DEMO: "false",
  VITE_FIREBASE_API_KEY: "fake-emulator-key",
  VITE_FIREBASE_PROJECT_ID: "demo-kraken",
  VITE_FIREBASE_APP_ID: "demo-browser",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-kraken.firebaseapp.com",
  VITE_API_BASE_URL: `http://127.0.0.1:${address.port}`,
  VITE_TEST_AUTH_EMULATOR: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  VITE_TEST_FIRESTORE_EMULATOR: process.env.FIRESTORE_EMULATOR_HOST,
});
const vite = await createViteServer({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
try {
  await vite.listen();
  for (const engine of ["chromium", "webkit"]) {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/browser-check.ts"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          KRAKEN_BROWSER: engine,
          KRAKEN_PLAYERS: "4",
          KRAKEN_REMATCH: "1",
          KRAKEN_TEST_URL: `${origin}/tests/firebase-browser.html`,
        },
      },
    );
    const result = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    assert.equal(result, 0, `${engine} Firebase browser check`);
  }
} finally {
  await vite.close();
  await new Promise<void>((resolve) => api.close(() => resolve()));
  const completed = await Promise.allSettled(requests);
  const { db, auth } = firebaseAdmin();
  await db.terminate();
  await deleteApp(auth.app);
  assert.equal(completed.filter((r) => r.status === "rejected").length, 0);
}
