---
"@ledgerhq/device-transport-kit-mockserver": patch
---

Hold back a device that arrives in the same discovery poll as another one leaving, so a same-tick swap (e.g. importing a session that replaces a device) is observed as a removal followed by an addition instead of a no-op.
