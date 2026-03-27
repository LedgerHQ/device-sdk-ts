import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { signClause } from "./helpers";

export function register(server: McpServer): void {
  server.registerPrompt(
    "sign-and-review",
    {
      description:
        "Sign and review an Ethereum transaction or EIP-712 typed data on the Ledger device.",
      argsSchema: {
        rawTx: z
          .string()
          .optional()
          .describe(
            "Hex-encoded Ethereum transaction. Provide this OR typedData.",
          ),
        typedData: z
          .string()
          .optional()
          .describe("EIP-712 typed data JSON. Provide this OR rawTx."),
        derivationPath: z
          .string()
          .optional()
          .describe("BIP-44 derivation path. Defaults to 44'/60'/0'/0/0."),
      },
    },
    ({ rawTx, typedData, derivationPath }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are reviewing a signing request on a Ledger device via Speculos.

1. Call 'read' to check the current device state before starting.
2. ${signClause({ rawTx, typedData, derivationPath })} to start the signing flow.
3. Read the screen and handle any dialogs:
   - "Maybe later" button: call 'dismiss_transaction_check'.
   - "Blind signing ahead" warning: STOP. Call 'accept_blind_signing' (rejects by default) then call 'reject'. Report to the user that the transaction cannot be clear-signed. Do NOT pass accept=true unless the user explicitly said "blind sign".
   - "Go to settings" with "Reject transaction": STOP. Call 'enable_blind_signing' (rejects by default). Report to the user that clear signing failed. Do NOT pass enable=true unless the user explicitly said "blind sign".
4. Swipe 'next' to advance through each review screen.
5. After each swipe, record the field name and value shown.
6. Keep swiping until the screen shows "Hold to sign".
7. Ask the user whether to approve or reject, then call 'approve' or 'reject'.
8. Present a summary table with columns: Field | Value. Include ALL fields reviewed. Below the table, indicate the signing mode: "Clear signed" or "Blind signed".`,
          },
        },
      ],
    }),
  );
}
