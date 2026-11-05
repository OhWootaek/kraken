import { z } from "zod";
const code = z.string().regex(/^\d{4}$/, "방 코드는 숫자 4자리입니다.");
const nickname = z.string().trim().min(1).max(255);
const password = z.string().max(64);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("profile"), username: nickname }),
  z.object({ type: z.literal("delete-account") }),
  z.object({
    type: z.literal("create"),
    title: z.string().trim().min(1).max(50),
    maxPlayers: z.number().int().min(4).max(6),
    password,
  }),
  z.object({ type: z.literal("join"), code, password }),
  z.object({ type: z.literal("search"), code }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("ready"), code }),
  z.object({
    type: z.literal("chat"),
    code,
    text: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("kick"),
    code,
    target: z.string().min(1).max(128),
  }),
  z.object({
    type: z.literal("capacity"),
    code,
    maxPlayers: z.number().int().min(4).max(6),
  }),
  z.object({ type: z.literal("start"), code }),
  z.object({
    type: z.literal("select"),
    code,
    target: z.string().min(1).max(128),
    card: z.string().min(1).max(64),
    revision: z.number().int().min(0),
  }),
  z.object({ type: z.literal("advance"), code }),
  z.object({ type: z.literal("rematch"), code }),
  z.object({ type: z.literal("bootstrap") }),
]);
export type Command = z.infer<typeof commandSchema>;
