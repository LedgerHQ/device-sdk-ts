---
"@ledgerhq/speculos-device-controller": patch
---

Use per-device coordinates for the blind signing toggle tap (`enableBlindSigningSettings`). The previous hardcoded `(88%, 51%)` was calibrated for Stax and landed on the wrong row on Flex/Apex.
