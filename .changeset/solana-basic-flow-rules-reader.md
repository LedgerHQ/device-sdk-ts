---
"@ledgerhq/context-module": minor
---

Add `getSolanaBasicFlowRules` to read the Solana basic-flow routing rules from the CAL `signing_route` tags, and cache `solana_programs` lookups briefly so a sign doesn't fetch the same program twice.
