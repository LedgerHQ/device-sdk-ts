---
"@ledgerhq/device-signer-kit-solana": minor
---

Split the generic clear-sign phase into FINALIZE + PROMPT and split the terminal sign into two machines. `ProvisionGenericClearSignDeviceAction` now streams descriptors then runs the new `FINALIZE GENERIC CLEAR SIGNING` (0x0C) command to validate session completeness (no UI), resolving to `"prepared"`/`"degraded"`. A new `SignGenericClearSignDeviceAction` owns `PROMPT UI DISPLAY` + blockhash refresh + `SIGN MESSAGE DELAYED`; on a non-cancel prompt failure it degrades and the parent falls back to the legacy `SignBasicClearSignDeviceAction`. Both terminal machines share the new `RefreshBlockhashDeviceAction` child (best-effort fetch + patch). The internal `SigningOperationsDeviceAction` and its `alreadyArmed` input were removed.
