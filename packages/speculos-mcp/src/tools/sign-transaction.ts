import { z } from "zod";

import { waitForDeviceScreen } from "../actions";
import {
  newSession,
  startSignTransaction,
  waitForSigningReady,
} from "../dmk-session";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client, baseURL }: ToolDeps): void {
  server.registerTool(
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
      const session = await newSession(baseURL);
      startSignTransaction(session.signer, derivationPath, rawTx);

      await waitForSigningReady();
      await waitForDeviceScreen(client);
      return toolResponse(client, { status: "signing_started" });
    },
  );
}
