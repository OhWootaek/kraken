export type CardType = "KRAKEN" | "TREASURE" | "EMPTY_BOX";
export type Role = "EXPLORER" | "SKELETON";
export interface Member {
  uid: string;
  username: string;
  ready: boolean;
  joinedAt: number;
}
export interface Card {
  id: string;
  type: CardType;
  revealed: boolean;
}
export interface Player {
  uid: string;
  username: string;
  role: Role;
  hand: CardType[];
  cards: Card[];
}
export interface Game {
  round: number;
  turn: string;
  found: number;
  total: number;
  revealed: CardType[];
  revision: number;
  nextRoundAt: number | null;
  nextTurn: string | null;
  players: Player[];
  winner: Role | null;
}
export interface PublicGame extends Omit<Game, "players" | "nextTurn"> {
  players: {
    uid: string;
    username: string;
    cards: { id: string; type: CardType | null; revealed: boolean }[];
  }[];
}
export interface PrivatePlayer {
  role: Role;
  hand: CardType[];
  round: number;
}
export interface Result {
  winner: Role;
  found: number;
  total: number;
  kraken: boolean;
  players: { uid: string; username: string; role: Role }[];
}
export interface Chat {
  id: string;
  uid: string;
  username: string;
  text: string;
  at: number;
}
export interface Room {
  code: string;
  title: string;
  maxPlayers: number;
  host: string;
  locked: boolean;
  status: "WAITING" | "PLAYING" | "FINISHED";
  members: Member[];
  game: PublicGame | null;
  result: Result | null;
  chat: Chat[];
  updatedAt: number;
  expiresAt: number;
  resultUntil: number | null;
  rematch?: string[];
}
export interface Secret {
  passwordHash: string | null;
  game: Game | null;
}
export interface Profile {
  username: string | null;
  roomCode: string | null;
  lastChatAt: number;
}
export interface View {
  profile: Profile | null;
  room: Room | null;
  privatePlayer: PrivatePlayer | null;
  lobby: Room[];
  serverNow: number;
}
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireThat(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
