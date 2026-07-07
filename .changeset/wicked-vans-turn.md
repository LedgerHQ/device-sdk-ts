---
"@ledgerhq/device-management-kit": patch
---

Rename `BackupStorageCommand` to `BackupAppStorageCommand`, rename `InitRestoreAppStorageCommand`'s `backupLength` field to `appStorageDataLength`, and type `BackupAppStorageCommand`'s `data` response as `HexaString`.
