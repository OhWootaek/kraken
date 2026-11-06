import type { FirestoreSettings } from "firebase/firestore";

type BrowserInfo = Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">;

export function firestoreBrowserSettings(
  browser: BrowserInfo | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
): FirestoreSettings & { useFetchStreams?: boolean } {
  if (!browser) return {};
  const ios =
    /iPhone|iPad|iPod/i.test(browser.userAgent) ||
    (browser.platform === "MacIntel" && browser.maxTouchPoints > 1);
  const safari =
    /Safari/i.test(browser.userAgent) &&
    !/Chrome|Chromium|Android|Edg|OPR/i.test(browser.userAgent);
  // WebKit can buffer Firestore streaming responses until a later keep-alive.
  // https://github.com/firebase/firebase-js-sdk/issues/9789
  // useFetchStreams is supported by the installed SDK but absent from its public type.
  return ios || safari
    ? { experimentalForceLongPolling: true, useFetchStreams: false }
    : {};
}
