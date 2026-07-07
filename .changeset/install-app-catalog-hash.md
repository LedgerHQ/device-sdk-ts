---
"@ledgerhq/device-mockserver-client": minor
---

Expose installable-app metadata on the device model. `DeviceApp` now carries an optional `hash`, and `DeviceConfig` accepts a `catalog` of `CatalogApp` entries used by the mock server to resolve an install hash to its app.
