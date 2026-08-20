---
"@ledgerhq/device-signer-kit-ethereum": patch
---

Internal: reimplement `registerLedgerAccount` on top of the generic `CallTaskInAppDeviceAction` skeleton (matching every other action in the package) instead of a hand-rolled XState machine. No behaviour change; removes the unused `RegisterLedgerAccountDAStep` / `RegisterLedgerAccountDAInternalState` exports that were never read by callers.
