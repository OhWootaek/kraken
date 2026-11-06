import { test } from "node:test";
import assert from "node:assert/strict";
import { firestoreBrowserSettings } from "../client/firestore-transport.js";

for (const [name, userAgent, platform, maxTouchPoints, compatible] of [
  [
    "iPhone Safari",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 Version/26.4 Mobile/15E148 Safari/604.1",
    "iPhone",
    5,
    true,
  ],
  [
    "iPhone Chrome",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/149.0 Mobile/15E148 Safari/604.1",
    "iPhone",
    5,
    true,
  ],
  [
    "iPad desktop mode",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/26.4 Safari/605.1.15",
    "MacIntel",
    5,
    true,
  ],
  [
    "macOS Safari",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/26.4 Safari/605.1.15",
    "MacIntel",
    0,
    true,
  ],
  [
    "macOS Chrome",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 Chrome/149.0 Safari/537.36",
    "MacIntel",
    0,
    false,
  ],
  [
    "Android Chrome",
    "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/149.0 Mobile Safari/537.36",
    "Linux armv8l",
    5,
    false,
  ],
  [
    "Firefox",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0",
    "Win32",
    0,
    false,
  ],
] as const)
  test(`Firestore transport: ${name}`, () => {
    assert.deepEqual(
      firestoreBrowserSettings({ userAgent, platform, maxTouchPoints }),
      compatible
        ? { experimentalForceLongPolling: true, useFetchStreams: false }
        : {},
    );
  });
test("Firestore transport: 브라우저 정보가 없으면 기본 설정", () => {
  assert.deepEqual(
    firestoreBrowserSettings({
      userAgent: "",
      platform: "",
      maxTouchPoints: 0,
    }),
    {},
  );
});
