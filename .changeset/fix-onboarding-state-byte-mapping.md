---
"@ledgerhq/device-management-kit": patch
---

Fix off-by-one in the SE flags onboarding state byte mapping: `0x00` now correctly maps to `OnboardingState.WelcomeScreen1` instead of `OnboardingState.Unknown`. Add missing `OnboardingState.Pin` at `0x06`.
