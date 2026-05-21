---
"@ledgerhq/context-module": minor
---

Improve observability of Ethereum gated signing context loaders: `GatedSigningContextLoader` and `GatedSigningTypedDataContextLoader` now emit a `debug` log with the resulting context types whenever a load succeeds, and a `warn` log with the underlying error messages whenever the direct gated descriptor lookup fails and the proxy fallback also fails, so transient backend issues become attributable instead of being swallowed into a generic context error count.
