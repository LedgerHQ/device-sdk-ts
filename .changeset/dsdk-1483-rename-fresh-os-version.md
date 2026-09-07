---
"@ledgerhq/device-contacts-kit": patch
---

Fix Rename Contact failing with a false version-requirement error. The OS
version guard now reads the firmware version freshly via `GetOsVersion` after
reaching the dashboard, instead of the device session state (whose
`firmwareVersion` is often absent when an app was open at start). A
`GetOsVersion` failure surfaces as the command error itself, not a
`ContactsVersionRequirementError`.
