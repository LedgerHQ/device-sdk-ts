---
"@ledgerhq/device-management-kit": major
---

Log through `getLogger(...tags)` in every layer, and pass subscribers the tags as an array; remove `getLoggerFactory`, `TransportArgs.loggerServiceFactory`, `InternalApi.loggerFactory`, `noopLogger` and the device action logger arguments
