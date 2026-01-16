# @ledgerhq/device-transport-kit-web-ble

## 1.3.2

### Patch Changes

- [#1212](https://github.com/LedgerHQ/device-sdk-ts/pull/1212) [`df480c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/df480c2072cdc6e9a0865bf1e92a2950be04c0a8) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Add second set of Bluetooth identifiers for Nano Gen5

- [#1214](https://github.com/LedgerHQ/device-sdk-ts/pull/1214) [`f4da0a6`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4da0a66cd530c811af595cb91ac0c11370862f0) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Move APDU exchange logging to transport layer for more accurate timing

- Updated dependencies [[`df480c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/df480c2072cdc6e9a0865bf1e92a2950be04c0a8), [`f4da0a6`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4da0a66cd530c811af595cb91ac0c11370862f0), [`52fe14e`](https://github.com/LedgerHQ/device-sdk-ts/commit/52fe14e0698ab32e84014bae4a92e5d85e961f88)]:
  - @ledgerhq/device-management-kit@1.0.0

## 1.3.1

### Patch Changes

- [#1178](https://github.com/LedgerHQ/device-sdk-ts/pull/1178) [`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Breaking change: Replace TransportDeviceModel.blockSize by dynamic getBlockSize (where the result depends on the firmware version). This allows us to correctly handle available memory prediction for the Ledger Nano S.

- Updated dependencies [[`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120)]:
  - @ledgerhq/device-management-kit@0.13.0

## 1.3.0

### Minor Changes

- [#1116](https://github.com/LedgerHQ/device-sdk-ts/pull/1116) [`81c0d0c`](https://github.com/LedgerHQ/device-sdk-ts/commit/81c0d0c5efaad26571534f8a04621d51e49e99e4) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Use BLE advertised name as connected device name

### Patch Changes

- Updated dependencies [[`81c0d0c`](https://github.com/LedgerHQ/device-sdk-ts/commit/81c0d0c5efaad26571534f8a04621d51e49e99e4), [`38485bd`](https://github.com/LedgerHQ/device-sdk-ts/commit/38485bd789a0c8f9c4cecdef7fa19e963ad442f9)]:
  - @ledgerhq/device-management-kit@0.11.0

## 1.2.0

### Minor Changes

- [#1005](https://github.com/LedgerHQ/device-sdk-ts/pull/1005) [`bc3fdfe`](https://github.com/LedgerHQ/device-sdk-ts/commit/bc3fdfea78ec8576ab37816d64e064ac87b06bc2) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Implement DeviceConnectionStateMachine in webBLE

### Patch Changes

- Updated dependencies [[`a6a6e31`](https://github.com/LedgerHQ/device-sdk-ts/commit/a6a6e316705cd8754474991a8f0753064ba66bd9), [`4337fdd`](https://github.com/LedgerHQ/device-sdk-ts/commit/4337fdd960531554935daf8c5c4f84d8f4973f7d), [`b1d8e58`](https://github.com/LedgerHQ/device-sdk-ts/commit/b1d8e58de5f513bad5eb8eb8f804fc2cbeeb4c17), [`0cd8a18`](https://github.com/LedgerHQ/device-sdk-ts/commit/0cd8a18fa676a7d8e6ed950fd3a12c43f6532402)]:
  - @ledgerhq/device-management-kit@0.9.0

## 1.1.0

### Minor Changes

- [#697](https://github.com/LedgerHQ/device-sdk-ts/pull/697) [`6b821aa`](https://github.com/LedgerHQ/device-sdk-ts/commit/6b821aa84936472fd74c32dd226323db005f39aa) Thanks [@valpinkman](https://github.com/valpinkman)! - Rename listenToKnownDevices to listenToAvailableDevices

## 1.0.0

### Major Changes

- [#640](https://github.com/LedgerHQ/device-sdk-ts/pull/640) [`4df35a8`](https://github.com/LedgerHQ/device-sdk-ts/commit/4df35a8392872eb401d81d80a335ffac77ccf895) Thanks [@valpinkman](https://github.com/valpinkman)! - 1.0.0 release

### Minor Changes

- [#559](https://github.com/LedgerHQ/device-sdk-ts/pull/559) [`a56740a`](https://github.com/LedgerHQ/device-sdk-ts/commit/a56740a608dc95ab3545d90666c71aeff2f67212) Thanks [@valpinkman](https://github.com/valpinkman)! - Extract Transports to their own module

### Patch Changes

- [#637](https://github.com/LedgerHQ/device-sdk-ts/pull/637) [`8161b27`](https://github.com/LedgerHQ/device-sdk-ts/commit/8161b271888bb3a50aa396eafe620d034a5a9e7d) Thanks [@valpinkman](https://github.com/valpinkman)! - Fix Chrome windows ble connect

- Updated dependencies [[`a7984cd`](https://github.com/LedgerHQ/device-sdk-ts/commit/a7984cdcbd8e18aec614d6f07fda293971bd61eb), [`a56740a`](https://github.com/LedgerHQ/device-sdk-ts/commit/a56740a608dc95ab3545d90666c71aeff2f67212), [`1bf2166`](https://github.com/LedgerHQ/device-sdk-ts/commit/1bf2166776ed16c2adf8a4d9d796a567629f983b), [`8f6907a`](https://github.com/LedgerHQ/device-sdk-ts/commit/8f6907a9fd99546d88520f2d167485ef59f8ca2e), [`df4ef37`](https://github.com/LedgerHQ/device-sdk-ts/commit/df4ef37d39a2e214a06930b7ff3c09cf22befb7f), [`1153a78`](https://github.com/LedgerHQ/device-sdk-ts/commit/1153a78b1b56f1767dae380466a8bc7fd86fec73), [`eafad9e`](https://github.com/LedgerHQ/device-sdk-ts/commit/eafad9e1b39573ad3321413b7adaa0814245da96), [`cc342e5`](https://github.com/LedgerHQ/device-sdk-ts/commit/cc342e5335ef1bc91b82967f6f59808796f88b36), [`8799e83`](https://github.com/LedgerHQ/device-sdk-ts/commit/8799e83c92baeb5ccba53546a3d59867d3d6185c)]:
  - @ledgerhq/device-management-kit@0.6.0
