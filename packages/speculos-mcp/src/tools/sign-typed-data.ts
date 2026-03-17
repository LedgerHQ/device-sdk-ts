import { z } from "zod";

import { waitForDeviceScreen } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
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
      const session = await deps.session.newSession(deps.baseURL);
      deps.session.startSignTypedData(
        session.signer,
        derivationPath,
        typedData,
      );

      await deps.session.waitForSigningReady();
      await waitForDeviceScreen(deps.client);
      return toolResponse(deps, { status: "signing_started" });
    },
  );
}
