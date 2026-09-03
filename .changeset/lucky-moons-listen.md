---
"@ledgerhq/device-transport-kit-mockserver": patch
---

Report a disconnect when a connected device leaves the mock server. The device was only discovered to be gone when an APDU sent to it failed, so a device deleted or disconnected through the API left a session that still claimed to be connected.
