import { z } from "zod";

import { handleTransactionCheckOptIn } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
    "dismiss_transaction_check",
    {
      description:
        'Dismiss the "Enable transaction check?" opt-in dialog that may appear after starting a signing flow. Call this when the screen shows a "Maybe later" button.',
      inputSchema: {
        enable: z
          .boolean()
          .default(false)
          .describe(
            'If true, taps "Yes, enable" instead of "Maybe later". Defaults to false.',
          ),
      },
    },
    async ({ enable }) => {
      const events = await client.fetchEvents();
      const result = await handleTransactionCheckOptIn(client, events, enable);
      return toolResponse(client, { dismissed: result.dismissed });
    },
  );
}
