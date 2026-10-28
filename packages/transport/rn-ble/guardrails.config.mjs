import { defineGuardrails, transport } from "@ledgerhq/ldmk-tool/guardrails";

export default defineGuardrails({
  role: transport.webFamily,
  extraFolders: [
    {
      path: "src/api/permissions",
      reason: "Android BLE permission handling",
    },
  ],
});
