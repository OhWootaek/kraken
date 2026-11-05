import type { FormEvent } from "react";
import type { Command } from "../shared/commands";
export type Action = (command: Command, after?: () => void) => Promise<boolean>;
export const submit =
  (fn: (data: FormData, form: HTMLFormElement) => void) =>
  (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fn(new FormData(event.currentTarget), event.currentTarget);
  };
