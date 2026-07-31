---
"@ledgerhq/device-management-kit": minor
---

Add `RestoreAppStorageCommand` implementing the `INS_APP_STORAGE_RESTORE` APDU, and a `RestoreAppStorageTask` to restore a previously backed up application storage in chunks that fit within a single APDU.
