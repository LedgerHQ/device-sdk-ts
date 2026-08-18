# @ledgerhq/dmk-ledger-wallet

## 0.4.0

### Minor Changes

- [#1627](https://github.com/LedgerHQ/device-sdk-ts/pull/1627) [`221cb79`](https://github.com/LedgerHQ/device-sdk-ts/commit/221cb79340eee27b0364e27db2b80e7dfef1b163) Thanks [@benruseau](https://github.com/benruseau)! - Add `RestoreAppsStorageDeviceAction`, restoring per-app storage backups (produced by `CreateBackupDeviceAction`) onto a device, one app at a time, gracefully skipping apps whose restore consent is rejected by the user.

- [#1707](https://github.com/LedgerHQ/device-sdk-ts/pull/1707) [`64db15b`](https://github.com/LedgerHQ/device-sdk-ts/commit/64db15b31aca763b9c2f3d44acc5ba2012a03be6) Thanks [@benruseau](https://github.com/benruseau)! - Adds ResolveOsUpdatePathDeviceAction

- [#1598](https://github.com/LedgerHQ/device-sdk-ts/pull/1598) [`575457e`](https://github.com/LedgerHQ/device-sdk-ts/commit/575457e53cfd6d59e6a273b897d4262b18d1611b) Thanks [@benruseau](https://github.com/benruseau)! - Complete OS update backup creation by collecting language, app storage, and custom lock screen data after ensuring the device is on the dashboard. The device action now returns the generated `Backup` directly instead of saving it internally.

- [#1727](https://github.com/LedgerHQ/device-sdk-ts/pull/1727) [`79c2060`](https://github.com/LedgerHQ/device-sdk-ts/commit/79c2060dd9ddf9872a73c24518a7875bf03a3f61) Thanks [@benruseau](https://github.com/benruseau)! - Add `FlashMcuDeviceAction`.

- [#1634](https://github.com/LedgerHQ/device-sdk-ts/pull/1634) [`911eb1d`](https://github.com/LedgerHQ/device-sdk-ts/commit/911eb1d9945aecd1b0f323a802ad0585e36f8da4) Thanks [@benruseau](https://github.com/benruseau)! - Add `RestoreBackupDeviceAction` to restore a backup previously produced by `CreateBackupDeviceAction`: requests master consent, reinstalls the language pack, apps and their storage, and re-uploads the custom lock screen.

- [#1721](https://github.com/LedgerHQ/device-sdk-ts/pull/1721) [`3f2f0cd`](https://github.com/LedgerHQ/device-sdk-ts/commit/3f2f0cddb28cd4b5fb142e27e983ac59110e17f1) Thanks [@benruseau](https://github.com/benruseau)! - Add `InstallOsUpdateDeviceAction`, installing a single OS update on the device

- [#1622](https://github.com/LedgerHQ/device-sdk-ts/pull/1622) [`72eb0a4`](https://github.com/LedgerHQ/device-sdk-ts/commit/72eb0a484a43ad9195afe059b406d6941aeb8c10) Thanks [@benruseau](https://github.com/benruseau)! - Add OS update backup/restore commands and tasks (`BackupAppStorageCommand`, `GetAppStorageInfoCommand`, `CommitRestoreAppStorageCommand`, `InitRestoreAppStorageCommand`, `RequestMasterConsentCommand`, `RestoreAppStorageCommand`, `BackupAppStorageTask`, `RestoreAppStorageTask`), moved here from `@ledgerhq/device-management-kit`.

- [#1684](https://github.com/LedgerHQ/device-sdk-ts/pull/1684) [`e54d63b`](https://github.com/LedgerHQ/device-sdk-ts/commit/e54d63b3aec00dbdff97c0aaa983025d21d8cc81) Thanks [@benruseau](https://github.com/benruseau)! - Add `CleanDeviceDeviceAction`, uninstalling all installed apps, deleting the installed language pack, and removing the custom lock screen in a single flow.

### Patch Changes

- [#1613](https://github.com/LedgerHQ/device-sdk-ts/pull/1613) [`95e2ce0`](https://github.com/LedgerHQ/device-sdk-ts/commit/95e2ce06155042764ee2ea8a8a0a9edab4366da5) Thanks [@benruseau](https://github.com/benruseau)! - Update usage of `BackupStorageCommand` following its rename to `BackupAppStorageCommand` in `@ledgerhq/device-management-kit`.

- Updated dependencies [[`f5b3738`](https://github.com/LedgerHQ/device-sdk-ts/commit/f5b3738b3ffca4d6ced75497f50b494777a9c073), [`e946c4f`](https://github.com/LedgerHQ/device-sdk-ts/commit/e946c4fddcc770b32f9cf95a84cf7047bf14a06f), [`72eb0a4`](https://github.com/LedgerHQ/device-sdk-ts/commit/72eb0a484a43ad9195afe059b406d6941aeb8c10), [`911eb1d`](https://github.com/LedgerHQ/device-sdk-ts/commit/911eb1d9945aecd1b0f323a802ad0585e36f8da4), [`79c2060`](https://github.com/LedgerHQ/device-sdk-ts/commit/79c2060dd9ddf9872a73c24518a7875bf03a3f61), [`9552e82`](https://github.com/LedgerHQ/device-sdk-ts/commit/9552e829121e9d428c49084136744152c08c0b1c), [`3c071ba`](https://github.com/LedgerHQ/device-sdk-ts/commit/3c071ba2023b1f35e8dc28e4e9d46a46c582b568), [`57ddf0b`](https://github.com/LedgerHQ/device-sdk-ts/commit/57ddf0ba8ac2503f92d1bfb9c8f936a7a402da4a), [`fadb5c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/fadb5c24d1bb7ce588f2d26d6fbc5692f5b29e95), [`575457e`](https://github.com/LedgerHQ/device-sdk-ts/commit/575457e53cfd6d59e6a273b897d4262b18d1611b), [`37ba2fd`](https://github.com/LedgerHQ/device-sdk-ts/commit/37ba2fd5583ab6477442627f182c2d493858a3b0), [`221cb79`](https://github.com/LedgerHQ/device-sdk-ts/commit/221cb79340eee27b0364e27db2b80e7dfef1b163), [`3f2f0cd`](https://github.com/LedgerHQ/device-sdk-ts/commit/3f2f0cddb28cd4b5fb142e27e983ac59110e17f1), [`c7ce54e`](https://github.com/LedgerHQ/device-sdk-ts/commit/c7ce54e5658266d0c1c3d3d76a820f82b6cdcd0a), [`95e2ce0`](https://github.com/LedgerHQ/device-sdk-ts/commit/95e2ce06155042764ee2ea8a8a0a9edab4366da5), [`bbab1db`](https://github.com/LedgerHQ/device-sdk-ts/commit/bbab1dbb4704f89506d0780d2ce0a044992a31d6)]:
  - @ledgerhq/device-management-kit@1.8.0

## 0.3.0

### Minor Changes

- [#1411](https://github.com/LedgerHQ/device-sdk-ts/pull/1411) [`36105c4`](https://github.com/LedgerHQ/device-sdk-ts/commit/36105c4b319e9be5983958bed4031efdddefca01) Thanks [@benruseau](https://github.com/benruseau)! - Add backup device action

### Patch Changes

- Updated dependencies [[`d26b6c4`](https://github.com/LedgerHQ/device-sdk-ts/commit/d26b6c4717eff4d1c9b4e0c7d197b438e15c010b)]:
  - @ledgerhq/device-management-kit@1.5.1

## 0.2.0

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
