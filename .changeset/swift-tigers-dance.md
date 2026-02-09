---
"@ledgerhq/dmk-ledger-wallet": minor
---

Add Custom Lock Screen device actions and image processing utilities

**Device Actions:**

- `UploadCustomLockScreenDeviceAction`: Upload custom lock screen images to device
- `DownloadCustomLockScreenDeviceAction`: Download current lock screen image from device
- `RemoveCustomLockScreenDeviceAction`: Remove custom lock screen from device

**Image Processing Utilities:**

- Fitting algorithms (cover) for Stax and Flex screen dimensions
- Grayscale dithering (Floyd-Steinberg, Atkinson, Reduced Atkinson)
- Device-specific encoding/decoding for Stax and Flex screens
