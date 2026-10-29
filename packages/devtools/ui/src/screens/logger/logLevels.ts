import { type LogData } from "./types";

export type Verbosity = LogData["verbosity"];

// The status tokens are dark in the light theme; the 500 primitives are the same vivid shade in both.
export const LEVEL_DOT: Record<Verbosity, string> = {
  debug: "bg-(--color-light-decorative-blue-500)",
  info: "bg-(--color-light-green-500)",
  warning: "bg-(--color-light-yellow-500)",
  error: "bg-(--color-light-red-500)",
  fatal: "bg-(--color-light-red-500)",
};

export const LEVEL_TEXT: Record<Verbosity, string> = {
  debug: "text-decorative-blue",
  info: "text-success",
  warning: "text-warning",
  error: "text-error",
  fatal: "text-error",
};
