import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";

export default defineGuardrails({
  role: signerKit,
  extraFolders: [
    {
      path: "src/internal/data-store",
      reason:
        "Bitcoin domain: stores the data the device asks for during a signing flow",
    },
    {
      path: "src/internal/merkle-tree",
      reason:
        "Bitcoin domain: Merkle trees and maps used by the Bitcoin app protocol",
    },
    {
      path: "src/internal/psbt",
      reason: "Bitcoin domain: PSBT model and serializers",
    },
    {
      path: "src/internal/wallet",
      reason: "Bitcoin domain: wallet policies, their builders and serializers",
    },
  ],
});
