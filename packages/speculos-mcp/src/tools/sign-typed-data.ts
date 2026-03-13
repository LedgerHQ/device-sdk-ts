import { z } from "zod";

import { waitForDeviceScreen } from "../actions";
import {
  newSession,
  startSignTypedData,
  waitForSigningReady,
} from "../dmk-session";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client, baseURL }: ToolDeps): void {
  server.registerTool(
    "sign_typed_data",
    {
      description:
        "Start signing EIP-712 typed data (JSON with types, primaryType, domain, message). " +
        "Use this ONLY for structured EIP-712 data. " +
        "Do NOT use this for raw transactions — use 'sign_transaction' instead.",
      inputSchema: {
        typedData: z
          .string()
          .describe(
            "JSON string of the EIP-712 typed data object (types, primaryType, domain, message).",
          ),
        derivationPath: z
          .string()
          .default("44'/60'/0'/0/0")
          .describe("BIP-44 derivation path."),
      },
    },
    async ({ typedData, derivationPath }) => {
      const session = await newSession(baseURL);
      startSignTypedData(session.signer, derivationPath, typedData);

      await waitForSigningReady();
      await waitForDeviceScreen(client);
      return toolResponse(client, { status: "signing_started" });
    },
  );
}
