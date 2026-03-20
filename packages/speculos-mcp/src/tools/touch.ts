import { z } from "zod";

import { waitForScreenChange } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "touch",
    {
      description:
        "Tap the Speculos touchscreen at exact x,y coordinates. DEBUG ONLY — use after a screenshot to validate coordinates visually. Returned screen is read after the UI settles.",
      inputSchema: {
        x: z.number().int().describe("X coordinate (pixels from left)."),
        y: z.number().int().describe("Y coordinate (pixels from top)."),
        delay: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Optional hold duration in milliseconds."),
      },
    },
    async ({ x, y, delay }) => {
      const before = await deps.client.fetchEvents();
      await deps.client.tap(x, y, delay != null ? { delay } : undefined);
      await waitForScreenChange(deps.client, before);
      return toolResponse(deps, { action: "tap", x, y });
    },
  );
}
