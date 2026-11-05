import { createServer, type ServerResponse } from "node:http";
import { commandSchema } from "../shared/commands.js";
import { DomainError } from "../shared/types.js";
import { readBody, respond, respondError } from "./http.js";
import { GameService, memoryView } from "./service.js";
import { MemoryStore } from "./store.js";
const store = new MemoryStore();
const service = new GameService(store);
const listeners = new Map<ServerResponse, string>();
function publish() {
  for (const [res, uid] of listeners)
    res.write(`data: ${JSON.stringify(memoryView(store, uid))}\n\n`);
}
createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://127.0.0.1:3001");
    const token =
      req.headers.authorization?.replace(/^Bearer /, "") ??
      url.searchParams.get("token");
    if (!token || !/^demo:[a-zA-Z0-9-]{1,64}$/.test(token))
      throw new DomainError("로컬 세션이 필요합니다.", 401);
    const uid = token.slice(5);
    if (url.pathname === "/api/events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      listeners.set(res, uid);
      res.write(`data: ${JSON.stringify(memoryView(store, uid))}\n\n`);
      const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 25000);
      req.on("close", () => {
        listeners.delete(res);
        clearInterval(keepAlive);
      });
      return;
    }
    if (url.pathname !== "/api/command" || req.method !== "POST")
      throw new DomainError("경로를 찾을 수 없습니다.", 404);
    const command = commandSchema.parse(await readBody(req));
    const result = await service.execute(uid, command);
    respond(res, 200, result);
    publish();
  } catch (error) {
    respondError(res, error);
  }
}).listen(3001, "127.0.0.1", () =>
  console.log(
    "Local API: http://127.0.0.1:3001 (memory only; not a production server)",
  ),
);
