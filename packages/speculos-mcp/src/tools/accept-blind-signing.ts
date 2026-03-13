import { z } from "zod";

import { handleBlindSigningWarning } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
    "accept_blind_signing",
    {
      description:
        'Handle the "Blind signing ahead" warning that appears when a transaction or typed data is not recognized for clear signing. ' +
        "By default rejects (Back to safety). Only pass accept=true if the user explicitly requested blind signing.",
      inputSchema: {
        accept: z
          .boolean()
          .default(false)
          .describe(
            'If true, taps "Accept risk and continue". If false, taps "Back to safety". Defaults to false.',
          ),
      },
    },
    async ({ accept }) => {
      const events = await client.fetchEvents();
      const result = await handleBlindSigningWarning(client, events, accept);
      return toolResponse(client, {
        dismissed: result.dismissed,
        accepted: result.accepted,
      });
    },
  );
}
