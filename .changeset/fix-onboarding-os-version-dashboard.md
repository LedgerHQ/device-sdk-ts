---
"@ledgerhq/device-management-kit": patch
---

Fix `GetDeviceStatusDeviceAction` breaking when connecting while a non-BOLOS app is open. The OS version (used to read the onboarding flag) can only be fetched on the dashboard, so the current app is now determined first and `GetOsVersionCommand` is only sent when the device is on the dashboard (BOLOS). A device running an application is considered onboarded without reading the OS version.
