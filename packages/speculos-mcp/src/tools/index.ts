import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { SpeculosClient } from "../speculos-client";
import { register as acceptBlindSigning } from "./accept-blind-signing";
import { register as approve } from "./approve";
import { register as dismissTransactionCheck } from "./dismiss-transaction-check";
import { register as enableBlindSigning } from "./enable-blind-signing";
import { register as getLogs } from "./get-logs";
import type { ToolDeps } from "./helpers";
import { register as read } from "./read";
import { register as reject } from "./reject";
import { register as screenshot } from "./screenshot";
import { register as signTransaction } from "./sign-transaction";
import { register as signTypedData } from "./sign-typed-data";
import { register as speculosStatus } from "./speculos-status";
import { register as startSpeculos } from "./start-speculos";
import { register as stopSpeculos } from "./stop-speculos";
import { register as swipe } from "./swipe";

const allTools: Array<(deps: ToolDeps) => void> = [
  signTransaction,
  signTypedData,
  swipe,
  read,
  approve,
  reject,
  dismissTransactionCheck,
  acceptBlindSigning,
  screenshot,
  enableBlindSigning,
  startSpeculos,
  stopSpeculos,
  speculosStatus,
  getLogs,
];

export function registerTools(
  server: McpServer,
  client: SpeculosClient,
  baseURL: string,
): void {
  const deps: ToolDeps = { server, client, baseURL };
  for (const register of allTools) {
    register(deps);
  }
}
