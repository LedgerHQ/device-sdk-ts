import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";

export default defineGuardrails({
  role: signerKit,
  extraFolders: [
    {
      path: "src/internal/app-binder/clear-sign",
      reason:
        "Clear-sign domain logic: IDL type pool, descriptors and requirements",
    },
    {
      path: "src/internal/app-binder/generic-flow-router",
      reason:
        "Picks the signing flow (basic or generic clear sign) for a transaction",
    },
  ],
});
