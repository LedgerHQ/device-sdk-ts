---
"@ledgerhq/device-mockserver-client": minor
---

Support ordered response sequences on mocks. A `Mock` now exposes `responses: string[]` (instead of a single `response`), and `MockConfig` accepts either an ordered `responses` list or the single-response `response` shorthand.
