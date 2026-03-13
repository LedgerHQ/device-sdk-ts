import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getLastSigningState } from "../dmk-session";
import { formatEvents } from "../screen-events";
import type { SpeculosClient } from "../speculos-client";

export type ToolDeps = {
  server: McpServer;
  client: SpeculosClient;
  baseURL: string;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function toolResponse(
  client: SpeculosClient,
  extra?: Record<string, unknown>,
) {
  const events = await client.fetchEvents();
  const state = getLastSigningState();
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            screen: formatEvents(events),
            signing_status: state.status === "idle" ? null : state,
            ...extra,
          },
          null,
          2,
        ),
      },
    ],
  };
}
