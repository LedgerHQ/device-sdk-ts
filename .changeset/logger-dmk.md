---
"@ledgerhq/device-management-kit": major
---

Log through `getLogger(...tags)` in every layer, and pass subscribers the tags as an array in the now required `LogSubscriberOptions.tags`; remove `getLoggerFactory`, `TransportArgs.loggerServiceFactory`, `InternalApi.loggerFactory`, `noopLogger`, `DefaultLogTagFormatter`, `LogTagFormatter`, `LoggerPublisherService.subscribers` and the device action logger arguments; rename the `device-session` log tag to `DeviceSession`
