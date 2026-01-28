---
"@ledgerhq/device-management-kit": patch
---

Return null on DevicePinger.ping() error to avoid unhandled promise rejection in RxJS subscription
