import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { productionHandler, readBody } from "../server/http.js";
function request(
  method = "POST",
  headers: Record<string, string> = {},
  body = "{}",
) {
  return Object.assign(Readable.from([body]), {
    method,
    headers,
  }) as IncomingMessage;
}
function response() {
  const result = {
    status: 0,
    body: "",
    headers: {} as Record<string, unknown>,
  };
  const res = {
    setHeader: (key: string, value: unknown) => {
      result.headers[key] = value;
    },
    writeHead: (status: number, headers?: Record<string, unknown>) => {
      result.status = status;
      Object.assign(result.headers, headers);
    },
    end: (body = "") => {
      result.body = body;
    },
  } as unknown as ServerResponse;
  return { result, res };
}
test("운영 API: Origin·메서드·인증 확인, 로컬 demo 토큰 거부", async () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://demo.web.app";
  try {
    for (const [req, expected] of [
      [request("POST", { origin: "https://evil.example" }), 403],
      [request("GET", { origin: "https://demo.web.app" }), 405],
      [request("POST", { origin: "https://demo.web.app" }), 401],
      [
        request("POST", {
          origin: "https://demo.web.app",
          authorization: "Bearer demo:fake",
        }),
        401,
      ],
      [request("OPTIONS", { origin: "https://demo.web.app" }), 204],
    ] as const) {
      const { result, res } = response();
      await productionHandler(req, res);
      assert.equal(result.status, expected);
      assert.equal(
        result.headers["Access-Control-Allow-Origin"],
        req.headers.origin === "https://demo.web.app"
          ? "https://demo.web.app"
          : undefined,
      );
      assert.ok(!result.body.includes("private_key"));
    }
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});
test("HTTP 본문: 올바른 JSON만 허용하고 16KB 초과는 차단", async () => {
  assert.deepEqual(
    await readBody(request("POST", {}, '{"type":"bootstrap"}')),
    { type: "bootstrap" },
  );
  await assert.rejects(readBody(request("POST", {}, "bad json")), {
    status: 400,
  });
  await assert.rejects(readBody(request("POST", {}, "x".repeat(16385))), {
    status: 413,
  });
});
