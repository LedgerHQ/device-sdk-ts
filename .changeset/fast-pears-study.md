---
"@ledgerhq/device-contacts-kit": patch
---

Drop the minimum OS version check for Register External Address, Edit External Address Scope, and Edit External Address Identifier — the minimum app version check is sufficient for these app-owned operations. Rename Contact is unaffected, as it is served by the device OS and keeps its OS-only check.
