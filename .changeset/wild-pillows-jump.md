---
"@ledgerhq/device-management-kit": patch
---

Fix the device session refresher polling interval being applied at twice the configured value. The validated polling interval was multiplied by 2 before being passed to the timer, so a configured interval of 1000ms actually polled every 2000ms (and NANO_S devices every 4000ms). The interval is now used as-is, while the NANO_S minimum interval remains handled in `getValidPollingInterval`.
