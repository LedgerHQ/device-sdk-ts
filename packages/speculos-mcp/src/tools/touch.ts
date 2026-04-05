import { z } from "zod";

import { waitForScreenChange } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "touch",
    {
      /**
       * Tap the Speculos touchscreen at exact x,y coordinates.
       * DEBUG ONLY — a screenshot is always taken before and after tapping to verify the screen state.
       * Never call tap twice without taking a screenshot between calls.
       * Returned screen is read after the UI settles.
       * Note: Touching an input (e.g. keyboard) will result in a timeout, as the text on the screen will be the exact same before and after; this is why we rely on screenshot-based state changes.
       */
      description:
        "Tap the Speculos touchscreen at exact x,y coordinates. DEBUG ONLY — takes a screenshot before and after tapping to verify the screen state. Never call tap twice without taking a screenshot between calls. Returned screen is read after the UI settles. Note: Touching an input (e.g. keyboard) will result in a timeout, as the text on the screen will be the exact same before and after; this is why we rely on screenshot-based state changes.",
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
