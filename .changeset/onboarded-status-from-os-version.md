---
"@ledgerhq/device-management-kit": minor
---

Detect onboarded device status from `GetOsVersionCommand` (`secureElementFlags.isOnboarded`) in `GetDeviceStatusDeviceAction`. The action now returns `Left(DeviceNotOnboardedError)` for unseeded devices instead of a stubbed `true`. `OpenAppDeviceAction` no longer runs a separate stubbed onboarding check and inherits the real one from its child machine. On success in a ready state, `firmwareVersion` (with `metadata`) and `isSecureConnectionAllowed` are persisted in the session state so consumers can read onboarding without an extra command.
