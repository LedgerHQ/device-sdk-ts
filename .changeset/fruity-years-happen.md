---
"@ledgerhq/device-management-kit": minor
---

Add `setFirmwareDistributionSalt` and `getFirmwareDistributionSalt` to set the firmware distribution salt at runtime. When the salt changes, the open device sessions forget their cached firmware update context, so the next device action fetches the latest firmware again with the new salt.
