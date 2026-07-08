---
"@ledgerhq/device-management-kit": patch
---

Remove OS update backup/restore commands and tasks (`BackupAppStorageCommand`, `GetAppStorageInfoCommand`, `CommitRestoreAppStorageCommand`, `InitRestoreAppStorageCommand`, `RequestMasterConsentCommand`, `RestoreAppStorageCommand`, `BackupAppStorageTask`, `RestoreAppStorageTask`) from the public API. This code was unused and has moved to `@ledgerhq/dmk-ledger-wallet`.
