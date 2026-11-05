import { GameService } from "../server/service.js";
import { firebaseAdmin, FirestoreStore } from "../server/store.js";
const service = new GameService(new FirestoreStore(firebaseAdmin().db));
await service.cleanup();
console.log(
  "Expired rooms cleaned (up to 5 per run). No scheduled paid services used.",
);
