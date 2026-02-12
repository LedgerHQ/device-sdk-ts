# @ledgerhq/dmk-ledger-wallet

## 1.0.0

### Minor Changes

- [#1262](https://github.com/LedgerHQ/device-sdk-ts/pull/1262) [`447f6d1`](https://github.com/LedgerHQ/device-sdk-ts/commit/447f6d14f615aaa123500da21c6812fbe68e4e7f) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Implement utils for Custom Lock Screen

- [#1263](https://github.com/LedgerHQ/device-sdk-ts/pull/1263) [`f6ed8e9`](https://github.com/LedgerHQ/device-sdk-ts/commit/f6ed8e90341c8063eb3ae14274d85d0fe827c366) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - New package for Ledger Wallet device actions

  This package provides advanced device actions specifically designed for Ledger Wallet applications. It extends the capabilities of `@ledgerhq/device-management-kit` with specialized functionality that is only needed by Ledger Wallet products.

- [#1262](https://github.com/LedgerHQ/device-sdk-ts/pull/1262) [`b63acfa`](https://github.com/LedgerHQ/device-sdk-ts/commit/b63acfad259df50e824b8eab08d305eed1b0f888) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Implement Custom Lock Screen device actions

- [#1262](https://github.com/LedgerHQ/device-sdk-ts/pull/1262) [`0031856`](https://github.com/LedgerHQ/device-sdk-ts/commit/0031856a68ad10a461bbefe43d134a897c736ef2) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Add Custom Lock Screen device actions and image processing utilities

  **Device Actions:**

  - `UploadCustomLockScreenDeviceAction`: Upload custom lock screen images to device
  - `DownloadCustomLockScreenDeviceAction`: Download current lock screen image from device
  - `RemoveCustomLockScreenDeviceAction`: Remove custom lock screen from device

  **Image Processing Utilities:**

  - Fitting algorithms (cover) for Stax and Flex screen dimensions
  - Grayscale dithering (Floyd-Steinberg, Atkinson, Reduced Atkinson)
  - Device-specific encoding/decoding for Stax and Flex screens

- [#1268](https://github.com/LedgerHQ/device-sdk-ts/pull/1268) [`f4aa45f`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4aa45fd5b2d582b7c76fa69862f88f473dc26f7) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Add BackgroundImage commands for custom lock screen management

  New commands: CreateBackgroundImageCommand, UploadBackgroundImageChunkCommand, CommitBackgroundImageCommand, GetBackgroundImageHashCommand, FetchBackgroundImageChunkCommand, DeleteBackgroundImageCommand

### Patch Changes

- Updated dependencies [[`974e0f8`](https://github.com/LedgerHQ/device-sdk-ts/commit/974e0f8789d711e3be8966d4b19f3128bf70bb28), [`974e0f8`](https://github.com/LedgerHQ/device-sdk-ts/commit/974e0f8789d711e3be8966d4b19f3128bf70bb28), [`c97b5c0`](https://github.com/LedgerHQ/device-sdk-ts/commit/c97b5c08f7d096e8c2a1c1ec8140fe47379d6289), [`b63acfa`](https://github.com/LedgerHQ/device-sdk-ts/commit/b63acfad259df50e824b8eab08d305eed1b0f888), [`0031856`](https://github.com/LedgerHQ/device-sdk-ts/commit/0031856a68ad10a461bbefe43d134a897c736ef2), [`80f7372`](https://github.com/LedgerHQ/device-sdk-ts/commit/80f737276d5e9a3cda58e548f454fa2114384efd), [`974e0f8`](https://github.com/LedgerHQ/device-sdk-ts/commit/974e0f8789d711e3be8966d4b19f3128bf70bb28)]:
  - @ledgerhq/device-management-kit@1.1.0
