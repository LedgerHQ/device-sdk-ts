import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { signClause } from "./helpers";

export function register(server: McpServer): void {
  server.registerPrompt(
    "verify-clear-signing",
    {
      description:
        "Verify clear signing: sign, swipe through fields, compare against expected values, approve or reject.",
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
        expectedFields: z
          .string()
          .describe(
            'JSON mapping field names to expected values. Example: \'{"To":"0xAbC...","Amount":"1.5 ETH"}\'',
          ),
        derivationPath: z
          .string()
          .optional()
          .describe("BIP-44 derivation path. Defaults to 44'/60'/0'/0/0."),
      },
    },
    ({ rawTx, typedData, expectedFields, derivationPath }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are verifying clear signing on a Ledger device via Speculos.
Expected field values: ${expectedFields ?? "{}"}

1. Call 'read' to check the current device state before starting.
2. ${signClause({ rawTx, typedData, derivationPath })} to start the signing flow.
3. Read the screen and handle any dialogs:
   - "Maybe later" button: call 'dismiss_transaction_check'.
   - "Blind signing ahead" warning: STOP. Call 'accept_blind_signing' (rejects by default) then call 'reject'. Report to the user that the transaction cannot be clear-signed. Do NOT pass accept=true unless the user explicitly said "blind sign".
   - "Go to settings" with "Reject transaction": STOP. Call 'enable_blind_signing' (rejects by default). Report to the user that clear signing failed. Do NOT pass enable=true unless the user explicitly said "blind sign".
4. Swipe 'next' through each review screen, recording field name and displayed value.
5. Keep swiping until the screen shows "Hold to sign".
6. Compare EVERY displayed field against the expected values.
7. If ALL fields match, call 'approve'. If ANY mismatch, call 'reject' and explain.
8. Present a summary table with columns: Field | Expected | Actual | Match. Include ALL fields reviewed. Below the table, indicate the signing mode: "Clear signed" or "Blind signed".`,
          },
        },
      ],
    }),
  );
}
