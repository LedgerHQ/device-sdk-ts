---
"@ledgerhq/dmk-ledger-wallet": minor
---

Restore backup DA completes with an out of memory status when the app storage restore (0x6733) or the custom lock screen upload (0x5102) runs out of memory. The restore apps storage DA output is now `{ appsStorageResults, isOutOfMemory }` and lists every app with storage, apps not restored being reported with `restoredAppStorage: false`
