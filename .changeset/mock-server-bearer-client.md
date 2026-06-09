---
"@ledgerhq/device-mockserver-client": minor
---

Adopt the bearer-token mock server contract (ADR 002 Solution 3 / ADR 003). `MockClient` now accepts an optional session token (or self-provisions one via `/auth`), authenticates every request with `Authorization: Bearer`, and exposes the session/device/mock/APDU resources as REST methods (`listDevices`, `connect(deviceId)`, `sendApdu(deviceId, apdu)`, `addMock`, `clearMocks`, ...).
