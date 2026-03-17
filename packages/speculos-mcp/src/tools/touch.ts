import { z } from "zod";

import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "touch",
    {
      description:
        "Tap the Speculos touchscreen at exact x,y coordinates. DEBUG ONLY — use after a screenshot to validate coordinates visually.",
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
      await deps.client.tap(x, y, delay != null ? { delay } : undefined);
      return toolResponse(deps, { action: "tap", x, y });
    },
  );
}
