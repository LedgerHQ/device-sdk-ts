import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { CsTesterManager } from "../cs-tester-manager";
import type { DmkSession } from "../dmk-session";
import { formatEvents } from "../screen-events";
import type { SpeculosClient } from "../speculos-client";

export type ToolDeps = {
  server: McpServer;
  client: SpeculosClient;
  baseURL: string;
  session: DmkSession;
  csTester: CsTesterManager;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function toolResponse(
  deps: ToolDeps,
  extra?: Record<string, unknown>,
) {
  const events = await deps.client.fetchEvents();
  const state = deps.session.getSigningState();
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
