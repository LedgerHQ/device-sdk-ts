# @ledgerhq/device-transport-kit-react-native-hid

## 2.0.0

### Patch Changes

- [#1181](https://github.com/LedgerHQ/device-sdk-ts/pull/1181) [`044b764`](https://github.com/LedgerHQ/device-sdk-ts/commit/044b764dba7d0b7e6948a8f2de0c7c5ca7373f72) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Bump patch versions to use ^ instead of \* to avoid duplication in LW and prepare a release

- [#1178](https://github.com/LedgerHQ/device-sdk-ts/pull/1178) [`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Breaking change: Replace TransportDeviceModel.blockSize by dynamic getBlockSize (where the result depends on the firmware version). This allows us to correctly handle available memory prediction for the Ledger Nano S.

- Updated dependencies [[`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120)]:
  - @ledgerhq/device-management-kit@0.13.0

## 1.0.1

### Patch Changes

- [#1092](https://github.com/LedgerHQ/device-sdk-ts/pull/1092) [`563b05a`](https://github.com/LedgerHQ/device-sdk-ts/commit/563b05a3083f1733af01a8715fbfbda48c4b82a1) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Fix scanning & connection issues

- Updated dependencies [[`5fdf5c9`](https://github.com/LedgerHQ/device-sdk-ts/commit/5fdf5c9fcb52c249fecf35bea8db2b451ac3e3fa), [`ebd44c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/ebd44c2690ec578410f69b148179268eeb34db65)]:
  - @ledgerhq/device-management-kit@0.10.0

## 1.0.0

### Patch Changes

- [#795](https://github.com/LedgerHQ/device-sdk-ts/pull/795) [`8a9cde5`](https://github.com/LedgerHQ/device-sdk-ts/commit/8a9cde5304edcda0ca1e06452d743f642affb54c) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Fix android module name for RN 0.75

- [#855](https://github.com/LedgerHQ/device-sdk-ts/pull/855) [`40bfafc`](https://github.com/LedgerHQ/device-sdk-ts/commit/40bfafcb467723c1364b149e336bc7450d8cf376) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Handle abortTimeout parameter and handle empty responses from device

- [#870](https://github.com/LedgerHQ/device-sdk-ts/pull/870) [`4bb815d`](https://github.com/LedgerHQ/device-sdk-ts/commit/4bb815d6ac1fd2b0bdd2b45ad01a0f741da38c6b) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Improve sendApdu performance by keeping USB connection open, and fix error remapping

- [#818](https://github.com/LedgerHQ/device-sdk-ts/pull/818) [`f0fea54`](https://github.com/LedgerHQ/device-sdk-ts/commit/f0fea54800fd17ed9fb4bd8c24703a6f543ea669) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Fix scanning & connection issues on rn-ble transport

- [#662](https://github.com/LedgerHQ/device-sdk-ts/pull/662) [`f1e8dea`](https://github.com/LedgerHQ/device-sdk-ts/commit/f1e8dea6bfe70b6347ecc44cc4aa3ce6315fe686) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Implement React Native HID transport

- Updated dependencies [[`a6a6e31`](https://github.com/LedgerHQ/device-sdk-ts/commit/a6a6e316705cd8754474991a8f0753064ba66bd9), [`4337fdd`](https://github.com/LedgerHQ/device-sdk-ts/commit/4337fdd960531554935daf8c5c4f84d8f4973f7d), [`b1d8e58`](https://github.com/LedgerHQ/device-sdk-ts/commit/b1d8e58de5f513bad5eb8eb8f804fc2cbeeb4c17), [`0cd8a18`](https://github.com/LedgerHQ/device-sdk-ts/commit/0cd8a18fa676a7d8e6ed950fd3a12c43f6532402)]:
  - @ledgerhq/device-management-kit@0.9.0
