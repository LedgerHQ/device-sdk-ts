---
"@ledgerhq/device-management-kit": patch
---

Expose `SeedWordCount` as named numeric values (`12`, `18`, `24`) on `GetOsVersionCommand` seed word information. The public type remains the union `12 | 18 | 24` (const object, not a numeric enum). Reserved encodings remain `undefined`.
