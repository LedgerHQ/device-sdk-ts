import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { register as signAndReview } from "./sign-and-review";
import { register as verifyClearSigning } from "./verify-clear-signing";

const allPrompts: Array<(server: McpServer) => void> = [
  signAndReview,
  verifyClearSigning,
];

export function registerPrompts(server: McpServer): void {
  for (const register of allPrompts) {
    register(server);
  }
}
