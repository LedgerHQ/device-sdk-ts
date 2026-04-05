import { z } from "zod";

import { performNavigate, waitForScreenChange } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "swipe",
    {
      description:
        "Swipe the Ledger touchscreen to navigate review screens. Returns current screen, signing status, and logs.",
      inputSchema: {
        direction: z
          .enum(["next", "previous"])
          .default("next")
          .describe("Swipe direction."),
        count: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Number of consecutive swipes."),
      },
    },
    async ({ direction, count }) => {
      for (let i = 0; i < count; i++) {
        const before = await deps.client.fetchEvents();
        await performNavigate(deps.client, direction);
        await waitForScreenChange(deps.client, before);
      }
      return toolResponse(deps);
    },
  );
}
