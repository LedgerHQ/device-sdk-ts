import { rejectFlow } from "../actions";
import { getLastSigningState } from "../dmk-session";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
    "reject",
    {
      description:
        "Reject the current transaction. DESTRUCTIVE — cancels the signing flow.",
    },
    async () => {
      const result = await rejectFlow(client, getLastSigningState);
      return toolResponse(client, { action: result.screen });
    },
  );
}
