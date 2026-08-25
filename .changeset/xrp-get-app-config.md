---
"@ledgerhq/device-signer-kit-xrp": minor
---

Implement the XRP `getAppConfig` flow. `GetAppConfigCommand` now builds the real `E0 06 00 00` APDU and parses the device response (`[flags, major, minor, patch]`) into `{ version: "major.minor.patch" }`, skipping the RFU flags byte. Adds the XRP application status words (`XRP_APP_ERRORS`, `XrpAppCommandError`) and the XRP APDU header constants, and fixes the app name used to open the application (`XRP`).
