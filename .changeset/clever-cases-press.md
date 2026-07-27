---
"@ledgerhq/dmk-ledger-wallet": minor
---

Add `RestoreAppsStorageDeviceAction`, restoring per-app storage backups (produced by `CreateBackupDeviceAction`) onto a device, one app at a time, gracefully skipping apps whose restore consent is rejected by the user. 
