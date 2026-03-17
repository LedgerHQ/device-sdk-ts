import { z } from "zod";

import { waitForDeviceScreen } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "sign_transaction",
    {
      description:
        "Start signing a raw Ethereum transaction (RLP-encoded hex). " +
        "Use this for ETH transfers, contract calls, and any RLP-serialized transaction. " +
        "Do NOT use this for EIP-712 typed data — use 'sign_typed_data' instead.",
      inputSchema: {
        rawTx: z
          .string()
          .describe("Hex-encoded RLP-serialized Ethereum transaction."),
        derivationPath: z
          .string()
          .default("44'/60'/0'/0/0")
          .describe("BIP-44 derivation path."),
      },
    },
    async ({ rawTx, derivationPath }) => {
      const session = await deps.session.newSession(deps.baseURL);
      deps.session.startSignTransaction(session.signer, derivationPath, rawTx);

      await deps.session.waitForSigningReady();
      await waitForDeviceScreen(deps.client);
      return toolResponse(deps, { status: "signing_started" });
    },
  );
}
