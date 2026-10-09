---
"@ledgerhq/device-transport-kit-speculos": minor
---

Add a `bearerToken` option to `SpeculosTransport`, `speculosTransportFactory` and `HttpSpeculosDatasource`, sent as `Authorization: Bearer <token>` with every request (APDU, availability check, event stream), e.g. to authenticate a protected Speculinho session.
