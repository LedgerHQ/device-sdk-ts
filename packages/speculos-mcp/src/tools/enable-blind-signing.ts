import { z } from "zod";

import { enableBlindSigning } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
    "enable_blind_signing",
    {
      description:
        'Handle the "blind signing not enabled" blocking screen that appears when the Ethereum app has blind signing disabled. ' +
        'Call this when the screen shows "Go to settings" and "Reject transaction". ' +
        "By default rejects the transaction. Only pass enable=true if the user explicitly requested blind signing.",
      inputSchema: {
        enable: z
          .boolean()
          .default(false)
          .describe(
            'If true, navigates to settings and enables blind signing. If false, taps "Reject transaction". Defaults to false.',
          ),
      },
    },
    async ({ enable }) => {
      const result = await enableBlindSigning(client, enable);
      return toolResponse(client, { success: result.success });
    },
  );
}
