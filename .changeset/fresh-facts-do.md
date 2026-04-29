---
"@ledgerhq/context-module": patch
---

Add a default network client factory so context-module data sources used outside of dependency injection keep the same headers without requiring callers to provide a client.
