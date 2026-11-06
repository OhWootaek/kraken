import { chromium, webkit, expect, type Request } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const count = Number(process.env.KRAKEN_PLAYERS ?? 4);
if (![4, 5, 6].includes(count))
  throw new Error("KRAKEN_PLAYERS must be 4, 5, or 6");
const firebaseTest = !!process.env.KRAKEN_TEST_URL;
const engine = process.env.KRAKEN_BROWSER === "webkit" ? webkit : chromium;
const browser = await engine.launch({ headless: true });
const browserRun = Date.now();
const testUrl = (i: number) =>
  firebaseTest
    ? `${process.env.KRAKEN_TEST_URL}?user=${engine.name()}-${browserRun}-${i}`
    : "http://127.0.0.1:5173";
const transportModes: string[] = [];
const contexts = await Promise.all(
  Array.from({ length: count }, () =>
    browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  ),
);
const pages = await Promise.all(contexts.map((c) => c.newPage()));
const errors: string[] = [];
const activeChannels = new Map(pages.map((page) => [page, new Set<string>()]));
const reloadChannels = new Set<string>();
let cancelledReloadChannels = 0;
for (const page of pages) {
  page.on("pageerror", (error) => {
    // WebKit reports cancelled emulator XHRs as page errors during navigation.
    // Match only a pre-reload channel from the page we intentionally reload.
    const cancelled =
      firebaseTest &&
      engine.name() === "webkit" &&
      page === pages[2] &&
      error.message.includes(
        `${process.env.FIRESTORE_EMULATOR_HOST}/google.firestore.v1.Firestore/Listen/channel?`,
      ) &&
      error.message.endsWith("due to access control checks.") &&
      [...reloadChannels].find((sid) =>
        error.message.includes(`SID=${encodeURIComponent(sid)}`),
      );
    if (cancelled) {
      reloadChannels.delete(cancelled);
      cancelledReloadChannels++;
      return;
    }
    errors.push(`page ${pages.indexOf(page)}: ${error.message}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/Listen/channel"))
      activeChannels.get(page)!.add(request.url());
    if (url.pathname.includes("/Listen/channel") && url.searchParams.has("CI"))
      transportModes.push(url.searchParams.get("CI")!);
  });
  const completed = (request: Request) => {
    activeChannels.get(page)!.delete(request.url());
  };
  page.on("requestfinished", completed);
  page.on("requestfailed", completed);
}
const suffix = String(Date.now()).slice(-6);
const names = Array.from({ length: count }, (_, i) => i).map(
  (i) => `항해자${count}_${suffix}_${i}`,
);
await mkdir("test-results", { recursive: true });
try {
  if (!firebaseTest) {
    await pages[0].goto(testUrl(0));
    await pages[0].screenshot({
      path: "test-results/landing.png",
      fullPage: true,
    });
  }
  await Promise.all(
    pages.map(async (page, i) => {
      await page.goto(testUrl(i));
      if (!firebaseTest)
        await page.getByRole("button", { name: "로컬 플레이 시작" }).click();
      await page.getByLabel("닉네임", { exact: true }).fill(names[i]);
      await page.getByRole("button", { name: "로비 입장" }).click();
      await expect(
        page.getByRole("heading", { name: /게임 로비/ }),
      ).toBeVisible();
    }),
  );
  await pages[0].screenshot({ path: "test-results/lobby.png", fullPage: true });
  await pages[0].getByRole("button", { name: "게임방 생성" }).click();
  await expect(
    pages[0].getByRole("dialog", { name: "새 게임방 만들기" }),
  ).toBeVisible();
  await pages[0].getByLabel("방 제목:").fill("안개 속 보물 탐험");
  await pages[0].getByLabel("최대 인원:").selectOption(String(count));
  await pages[0].getByRole("button", { name: "생성하기" }).click();
  const codeText = await pages[0].locator(".room-code strong").textContent();
  expect(codeText).toMatch(/^\d{4}$/);
  for (let i = 1; i < count; i++) {
    await pages[i].getByLabel("방 코드", { exact: true }).fill(codeText!);
    await pages[i].getByRole("button", { name: "검색", exact: true }).click();
    await pages[i].getByRole("button", { name: "입장하기" }).click();
    await expect(
      pages[i].getByRole("heading", { name: "게임 대기실" }),
    ).toBeVisible();
  }
  await expect(pages[0].locator(".member-seat:not(.vacant)")).toHaveCount(
    count,
  );
  await pages[1]
    .getByLabel("채팅 입력")
    .fill("<img src=x onerror=alert(1)> 함께 떠나요!");
  await pages[1].getByRole("button", { name: "메시지 보내기" }).click();
  await expect(
    pages[0].getByText("<img src=x onerror=alert(1)> 함께 떠나요!", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await pages[0].locator('img[src="x"]').count()).toBe(0);
  await pages[0].screenshot({
    path: "test-results/waiting-room.png",
    fullPage: true,
  });
  for (let i = 1; i < count; i++)
    await pages[i]
      .getByRole("button", { name: "준비 완료", exact: true })
      .click();
  await expect(
    pages[0].getByRole("button", { name: "게임 시작" }),
  ).toBeEnabled();
  await pages[0].getByRole("button", { name: "게임 시작" }).click();
  await Promise.all(
    pages.map((p) => expect(p.locator(".private-hand")).toBeVisible()),
  );
  if (firebaseTest)
    for (const page of pages)
      await expect(page.locator(".private-hand")).not.toContainText("확인 중");
  await expect(pages[0].locator(".player-board")).toHaveCount(count);
  for (const url of activeChannels.get(pages[2])!) {
    const sid = new URL(url).searchParams.get("SID");
    if (sid) reloadChannels.add(sid);
  }
  await pages[2].reload();
  await expect(pages[2].locator(".player-board")).toHaveCount(count);
  await pages[0].screenshot({ path: "test-results/game.png", fullPage: true });
  await pages[3].setViewportSize({ width: 390, height: 844 });
  expect(
    await pages[3].evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await pages[3].screenshot({
    path: "test-results/mobile-game.png",
    fullPage: true,
  });
  await pages[3].getByRole("button", { name: "참여자", exact: true }).click();
  await expect(
    pages[3].getByRole("heading", { name: "참여자 목록" }),
  ).toBeVisible();
  await expect(pages[3].locator(".participant-list .member-seat")).toHaveCount(
    count,
  );
  await pages[3].getByRole("button", { name: "채팅", exact: true }).click();
  await expect(pages[3].getByLabel("채팅 입력")).toBeVisible();
  await pages[3].getByLabel("채팅 입력").fill("모바일에서도 채팅됩니다.");
  await pages[3].getByRole("button", { name: "메시지 보내기" }).click();
  await expect(
    pages[0].getByText("모바일에서도 채팅됩니다.", { exact: true }),
  ).toBeVisible();
  await pages[3].screenshot({
    path: "test-results/mobile-chat.png",
    fullPage: true,
  });
  await pages[3].getByRole("button", { name: "컨트롤", exact: true }).click();
  await expect(
    pages[3].getByRole("button", { name: "로비로 나가기" }),
  ).toBeVisible();
  await pages[3].getByRole("button", { name: "컨트롤", exact: true }).click();
  for (let turn = 0; turn < 24; turn++) {
    if (await pages[0].locator(".result-screen").count()) break;
    const turnName = (
      await pages[0]
        .locator(".player-board.current-turn .player-heading strong")
        .innerText()
    ).replace(" (나)", "");
    const playerIndex = names.indexOf(turnName);
    expect(playerIndex).toBeGreaterThanOrEqual(0);
    const page = pages[playerIndex];
    await expect(
      page.locator("button.game-card:not([disabled])").first(),
    ).toBeVisible({ timeout: 8000 });
    await page.locator("button.game-card:not([disabled])").first().click();
    await expect(async () => {
      const result = await pages[0].locator(".result-screen").count();
      const latest = (
        await pages[0]
          .locator(".player-board.current-turn .player-heading strong")
          .allTextContents()
      )[0];
      expect(
        result > 0 || latest?.replace(" (나)", "") !== turnName,
      ).toBeTruthy();
    }).toPass({ timeout: 8000 });
  }
  await Promise.all(
    pages.map((p) => expect(p.locator(".result-screen")).toBeVisible()),
  );
  await pages[0].screenshot({
    path: "test-results/result.png",
    fullPage: true,
  });
  if (process.env.KRAKEN_REMATCH === "1") {
    for (const page of pages.slice(1)) {
      await page
        .getByRole("button", { name: "한번 더하기", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "재참가 신청 완료" }),
      ).toBeDisabled();
    }
    await pages[1].screenshot({
      path: "test-results/result-rematch.png",
      fullPage: true,
    });
    expect(
      await pages[3].evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await pages[3].screenshot({
      path: "test-results/mobile-result-rematch.png",
      fullPage: true,
    });
    await expect(
      pages[0].getByRole("heading", { name: /게임 로비/ }),
    ).toBeVisible({ timeout: 15000 });
    for (const page of pages.slice(1))
      await expect(
        page.getByRole("heading", { name: "게임 대기실", exact: true }),
      ).toBeVisible({ timeout: 15000 });
    const nextCode = await pages[1].locator(".room-code strong").textContent();
    expect(nextCode).not.toBe(codeText);
    for (const page of pages.slice(1))
      expect(await page.locator(".room-code strong").textContent()).toBe(
        nextCode,
      );
    await expect(pages[1].locator(".member-seat:not(.vacant)")).toHaveCount(
      count - 1,
    );
    await expect(pages[1].locator(".participant-list")).not.toContainText(
      names[0],
    );
    await pages[1].screenshot({
      path: "test-results/rematch-waiting.png",
      fullPage: true,
    });
  } else {
    await Promise.all(
      pages.map((p) =>
        expect(p.getByRole("heading", { name: /게임 로비/ })).toBeVisible({
          timeout: 15_000,
        }),
      ),
    );
  }
  if (firebaseTest && engine.name() === "webkit") {
    expect(transportModes).toContain("1");
    expect(transportModes).not.toContain("0");
  }
  if (firebaseTest)
    for (const page of pages)
      await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
  if (cancelledReloadChannels)
    console.log(
      `WebKit cancelled pre-reload emulator channels: ${cancelledReloadChannels}`,
    );
  console.log(
    `Browser check passed: ${engine.name()}, ${firebaseTest ? "Firebase Auth/Firestore + production HTTP" : "local demo"}, ${count} users, room search/join, chat/XSS, readiness, game, reconnect, mobile, result, ${process.env.KRAKEN_REMATCH === "1" ? "rematch regrouping/host reassignment" : "automatic lobby return"}.`,
  );
} catch (error) {
  if (errors.length) console.error("Browser page errors:", errors);
  for (let i = 0; i < pages.length; i++)
    await pages[i]
      .screenshot({ path: `test-results/failure-${i}.png`, fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
