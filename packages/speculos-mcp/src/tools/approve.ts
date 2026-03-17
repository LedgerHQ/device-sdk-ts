import { z } from "zod";

import { approveFlow } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
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
        deps.client,
        () => deps.session.getSigningState(),
        holdSeconds,
      );
      return toolResponse(deps, { action: result.screen });
    },
  );
}
