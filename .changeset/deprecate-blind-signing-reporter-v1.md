---
"@ledgerhq/context-module": minor
---

Deprecate the v1 blind signing reporter and turn it into a no-op: `setBlindSigningReporter`, the `customBlindSigningReporter` option, `ContextModule.report`, `DefaultBlindSigningReporter` and `HttpBlindSigningReporterDatasource` are kept for compatibility but send nothing, and the v1 implementation is removed. Use `setSignReporter` instead. The v1 API will be removed in the next major.
