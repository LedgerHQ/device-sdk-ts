---
"@ledgerhq/device-transport-kit-speculos": patch
---

Clear the disconnect-polling interval when a Speculos device disconnects normally. The stray 2s timer kept the Node event loop alive, so a CLI consumer never exited.
