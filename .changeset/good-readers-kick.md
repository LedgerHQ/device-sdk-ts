---
"@ledgerhq/device-management-kit": major
---

Remove request `signal` support and the now-unused `isAbort` error field from `DmkNetworkClient`, implement portable timeout handling with `AbortController`, and remove Node `url` usage from secure-channel WebSocket URL formatting.
