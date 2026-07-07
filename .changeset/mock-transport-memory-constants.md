---
"@ledgerhq/device-transport-kit-mockserver": patch
---

Report real per-model memory constants (memory size and block size) for mock devices instead of hardcoded values. Previously every mock device advertised a 320 KB memory with 32-byte blocks, which made memory-aware device actions (e.g. Install or update applications / Open app with dependencies, via `PredictOutOfMemoryTask`) wrongly report `OutOfMemoryDAError` even on an empty device.
