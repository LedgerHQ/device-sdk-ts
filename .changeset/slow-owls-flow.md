---
"@ledgerhq/device-management-kit": patch
---

Introduce `DmkResult` as a generic base result abstraction and move task-specific firmware metadata errors out of `CommandResult`.

Code that constructs `CommandResultFactory` with `InvalidGetFirmwareMetadataResponseError` will now fail at the type level. Non-command flows should use `DmkResultFactory` instead.
