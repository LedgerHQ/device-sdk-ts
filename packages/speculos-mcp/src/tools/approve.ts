import { z } from "zod";

import { approveFlow } from "../actions";
import { getLastSigningState } from "../dmk-session";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
    "approve",
    {
      description:
        "Long-press 'Hold to sign' to approve. IRREVERSIBLE — produces a cryptographic signature.",
      inputSchema: {
        holdSeconds: z
          .number()
          .default(10)
          .describe("Hold duration in seconds."),
      },
    },
    async ({ holdSeconds }) => {
      const result = await approveFlow(
        client,
        getLastSigningState,
        holdSeconds,
      );
      return toolResponse(client, { action: result.screen });
    },
  );
}
