---
"@ledgerhq/context-module": minor
---

Add SignReporter module with v2 blind-sign API support. Moves BlindSigningModelId to shared/model/, extends BlindSignReason with UNRECOGNIZED_PROGRAM, and introduces signReport?() on ContextModule posting a three-layer payload to /v2/blind-signing-events.
