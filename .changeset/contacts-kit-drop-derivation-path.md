---
"@ledgerhq/device-contacts-kit": patch
---

Stop sending the DERIVATION_PATH TLV on Register Identity and Edit Contact Name. Current embedded apps reject a payload carrying it.
