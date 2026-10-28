import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";

export default defineGuardrails({
  role: signerKit,
  extraFolders: [
    {
      path: "src/api/profiles",
      reason:
        "Public per-coin profiles (Dogecoin, Litecoin) for the legacy Bitcoin app",
    },
  ],
});
