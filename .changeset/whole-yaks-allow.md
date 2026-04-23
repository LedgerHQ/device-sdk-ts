---
"@ledgerhq/context-module": minor
---

Split trusted metadata service errors for account ownership into `verification_failed` (HTTP 4xx) vs `service_unavailable` (network / 5xx / malformed), exposed via the new `AccountOwnershipError` class. Backend error message is now forwarded verbatim instead of swallowed.
