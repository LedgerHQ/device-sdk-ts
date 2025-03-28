import { type GetAppAndVersionResponse } from "@api/index";

export const isGetAppAndVersionResponse = (
  response: unknown,
): response is GetAppAndVersionResponse => {
  if (typeof response !== "object" || response === null) return false;
  const rec = response as Record<string, unknown>;
  return typeof rec["name"] === "string" && typeof rec["version"] === "string";
};
