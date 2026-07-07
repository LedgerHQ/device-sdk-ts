---
"@ledgerhq/device-transport-kit-mockserver": minor
---

Support sharing a mock server session token. `mockserverTransportFactory` is now a higher-order factory `mockserverTransportFactory(mockUrl?, sessionToken?)` and the transport targets the new bearer-token mock client API (device discovery, per-device connect/APDU). Device models are built from the richer mock device metadata.
