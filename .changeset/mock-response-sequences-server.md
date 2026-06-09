---
"@ledgerhq/device-mock-server": minor
---

Mocks can now hold an ordered list of responses that are served one per matching APDU, looping back to the start once exhausted. This enables stateful scenarios such as returning an error only on the Nth matching APDU. A mock's sequence restarts when it is edited or cleared.
