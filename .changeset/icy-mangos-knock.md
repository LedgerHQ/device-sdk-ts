---
"@ledgerhq/device-management-kit": patch
---

Expose parsed endorsement, seed word, and onboarding information from the secure element flags returned by `GetOsVersionCommand`. Onboarding status is mapped to the `OnboardingState` string enum (`0x01`–`0x10`); unmapped bytes including `0x00` become `OnboardingState.Unknown`.
