import { z } from "zod";

import { performNavigate } from "../actions";
import { DELAY } from "../constants";
import type { ToolDeps } from "./helpers";
import { sleep, toolResponse } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
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
        await performNavigate(client, direction);
        await sleep(DELAY.swipeBetween);
      }
      return toolResponse(client);
    },
  );
}
