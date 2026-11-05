import type { CardType } from "../shared/types";
export const cardNames: Record<CardType, string> = {
  KRAKEN: "크라켄",
  TREASURE: "보물",
  EMPTY_BOX: "빈 상자",
};
export const cardIcons: Record<CardType, string> = {
  KRAKEN: "🐙",
  TREASURE: "💰",
  EMPTY_BOX: "📦",
};
export const roleName = (role: string) =>
  role === "EXPLORER" ? "탐험대" : "스켈레톤";
