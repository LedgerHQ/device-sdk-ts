---
"@ledgerhq/context-module": minor
---

Add a `SOLANA_BASIC_FLOW_RULE` context type and its loader to read the Solana basic-flow routing rules from the CAL `signing_route` tags, and cache `solana_programs` lookups briefly so a sign doesn't fetch the same program twice.
