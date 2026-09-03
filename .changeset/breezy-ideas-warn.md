---
"@ledgerhq/device-transport-kit-mockserver": patch
---

Keep polling for available devices after a failed request. A `catchError` on the outer pipeline replaced the poll timer along with the failed request, so one unreachable moment ended discovery for the rest of the subscription and a device added later was never found.
