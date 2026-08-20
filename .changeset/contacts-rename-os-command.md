---
"@ledgerhq/device-management-kit": minor
---

Dispatch the Contacts rename (Edit Contact Name) as the blockchain-agnostic OS command `E0 2E` instead of the deprecated in-app `B0 10 02` path. The rename now runs on the dashboard: a new `CallTaskOnDashboardDeviceAction` closes any running app (via `GoToDashboard`) before sending the command, and `ContactsService.renameContact` uses it. The command is chunk-framed like the other address-book ops (2-byte BE length prefix) and returns the rotated `hmac_name`. Verified on-device (Ledger Flex, BOLOS 1.7.0-rc2).
