import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import { commandSchema } from "../shared/commands.js";
import { DomainError } from "../shared/types.js";
import { GameService } from "./service.js";
import { firebaseAdmin, FirestoreStore } from "./store.js";
export async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 16_384)
      throw new DomainError("요청이 너무 큽니다.", 413);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new DomainError("잘못된 JSON 요청입니다.");
  }
}
export function respond(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
export function respondError(res: ServerResponse, error: unknown) {
  if (error instanceof DomainError)
    respond(res, error.status, { error: error.message });
  else if (error instanceof ZodError)
    respond(res, 400, {
      error: error.issues[0]?.message ?? "입력을 확인해 주세요.",
    });
  else {
    // Do not log tokens, requests, or private game state.
    console.error(
      "Request failed:",
      error instanceof Error ? error.name : "unknown",
    );
    respond(res, 503, {
      error:
        "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 무료 사용량 한도도 확인해 주세요.",
    });
  }
}
export async function productionHandler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  try {
    const allowed = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = req.headers.origin;
    if (!allowed.length)
      throw new DomainError("서버 Origin 설정이 필요합니다.", 503);
    if (origin && !allowed.includes(origin))
      throw new DomainError("허용되지 않은 요청 주소입니다.", 403);
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "POST")
      throw new DomainError("POST 요청만 지원합니다.", 405);
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token || token.split(".").length !== 3)
      throw new DomainError("로그인이 필요합니다.", 401);
    const { db, auth } = firebaseAdmin();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(token, true);
    } catch {
      throw new DomainError(
        "로그인이 만료되었습니다. 다시 로그인해 주세요.",
        401,
      );
    }
    if (
      decoded.firebase.sign_in_provider !== "google.com" &&
      !process.env.FIREBASE_AUTH_EMULATOR_HOST
    )
      throw new DomainError("Google 로그인을 사용해 주세요.", 403);
    const raw =
      req.body === undefined
        ? await readBody(req)
        : typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body;
    if (Buffer.byteLength(JSON.stringify(raw)) > 16_384)
      throw new DomainError("요청이 너무 큽니다.", 413);
    const command = commandSchema.parse(raw);
    if (
      command.type === "delete-account" &&
      Date.now() / 1000 - decoded.auth_time > 300
    )
      throw new DomainError("탈퇴하려면 Google로 다시 로그인해 주세요.", 401);
    const service = new GameService(new FirestoreStore(db));
    const result = await service.execute(decoded.uid, command);
    if (command.type === "delete-account") await auth.deleteUser(decoded.uid);
    respond(res, 200, result);
  } catch (error) {
    respondError(res, error);
  }
}
