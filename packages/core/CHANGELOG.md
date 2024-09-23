# @ledgerhq/device-sdk-core

## 0.4.0

### Minor Changes

- [#124](https://github.com/LedgerHQ/device-sdk-ts/pull/124) [`c6822ba`](https://github.com/LedgerHQ/device-sdk-ts/commit/c6822ba275946200333a8e64f240bf52c62e649c) Thanks [@valpinkman](https://github.com/valpinkman)! - Add new device actions to core: ListApps, GoToDashboard, GetDeviceStatus

- [#161](https://github.com/LedgerHQ/device-sdk-ts/pull/161) [`0ef0626`](https://github.com/LedgerHQ/device-sdk-ts/commit/0ef06260b4cf87c3cb41fe2819e8efd849b2f336) Thanks [@valpinkman](https://github.com/valpinkman)! - Add ManagerApi service to core

- [#111](https://github.com/LedgerHQ/device-sdk-ts/pull/111) [`f708627`](https://github.com/LedgerHQ/device-sdk-ts/commit/f708627965617b40951016448b8f90d71c19a2f8) Thanks [@valpinkman](https://github.com/valpinkman)! - Add new ListApps command to SDK core

- [#161](https://github.com/LedgerHQ/device-sdk-ts/pull/161) [`73825aa`](https://github.com/LedgerHQ/device-sdk-ts/commit/73825aaa5869c9026bd1a5a1b142a74a9484662f) Thanks [@valpinkman](https://github.com/valpinkman)! - Add ListAppsWithMetadata device action

- [#172](https://github.com/LedgerHQ/device-sdk-ts/pull/172) [`8cba13a`](https://github.com/LedgerHQ/device-sdk-ts/commit/8cba13a3fb720ecd15b2464c45be30fc9851bd0a) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Use of CommandResult return type in commands

### Patch Changes

- [#174](https://github.com/LedgerHQ/device-sdk-ts/pull/174) [`899d151`](https://github.com/LedgerHQ/device-sdk-ts/commit/899d15152c2cf67b19cb6ca83dc1fbbd0e79ae27) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Improve code visibility

- [#284](https://github.com/LedgerHQ/device-sdk-ts/pull/284) [`41892b3`](https://github.com/LedgerHQ/device-sdk-ts/commit/41892b3dbd27c71b091d4c8203286702a81f380b) Thanks [@valpinkman](https://github.com/valpinkman)! - Fix wrong dependency declaration for @statelyai/inspect (from devDeps to deps

- [#169](https://github.com/LedgerHQ/device-sdk-ts/pull/169) [`d9e0164`](https://github.com/LedgerHQ/device-sdk-ts/commit/d9e0164d69bede69269d0989c24a8631b9a0875d) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Add support of Ledger Flex

- [#121](https://github.com/LedgerHQ/device-sdk-ts/pull/121) [`3b59289`](https://github.com/LedgerHQ/device-sdk-ts/commit/3b592899168ecedfa3698041b77e09764c1cf4d7) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Device reconnection on app change

- [#156](https://github.com/LedgerHQ/device-sdk-ts/pull/156) [`a25f529`](https://github.com/LedgerHQ/device-sdk-ts/commit/a25f529ed08206d38d00026a3589bbbaa21075bc) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Added a new "generic" DeviceAction `SendCommandInAppDeviceAction`

- [#209](https://github.com/LedgerHQ/device-sdk-ts/pull/209) [`c5b5cc1`](https://github.com/LedgerHQ/device-sdk-ts/commit/c5b5cc11d0b0dfec4e1e76ecd98d4ad09a6c9d89) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add sign-personal-message user interaction

- [#186](https://github.com/LedgerHQ/device-sdk-ts/pull/186) [`5018129`](https://github.com/LedgerHQ/device-sdk-ts/commit/501812904cbb7eb519651b4c8dbb613198e1e89c) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - DSDK-420 Implement the EIP712 TypedData parser service

- [#147](https://github.com/LedgerHQ/device-sdk-ts/pull/147) [`2893f92`](https://github.com/LedgerHQ/device-sdk-ts/commit/2893f92e023741ef33e72dd5bc40e18b42052ca8) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add exports from api, add add32BitUintToData for ApduBuilder

- [#303](https://github.com/LedgerHQ/device-sdk-ts/pull/303) [`f25bb8f`](https://github.com/LedgerHQ/device-sdk-ts/commit/f25bb8feec3e733d1ebb13b2d7c7ea08e61fae3e) Thanks [@valpinkman](https://github.com/valpinkman)! - Add ListDeviceSessions use case

- [#159](https://github.com/LedgerHQ/device-sdk-ts/pull/159) [`861f9c5`](https://github.com/LedgerHQ/device-sdk-ts/commit/861f9c56b7b10034df156e369400dfd614b545f1) Thanks [@aussedatlo](https://github.com/aussedatlo)! - add HexaString to handle `0x${string}` type

## 0.3.0

### Minor Changes

- [#62](https://github.com/LedgerHQ/device-sdk-ts/pull/62) [`c1cdfcd`](https://github.com/LedgerHQ/device-sdk-ts/commit/c1cdfcd182350ce1b0c6cb1a3a7368756e07619e) Thanks [@valpinkman](https://github.com/valpinkman)! - Add SendCommand use case + GetOsVersion command

- [#74](https://github.com/LedgerHQ/device-sdk-ts/pull/74) [`8563963`](https://github.com/LedgerHQ/device-sdk-ts/commit/8563963b04a477a7728ecfca4c86274d9247b8ba) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Handle device session state

- [#78](https://github.com/LedgerHQ/device-sdk-ts/pull/78) [`8bef03f`](https://github.com/LedgerHQ/device-sdk-ts/commit/8bef03ffe3348b5f660ea3f180bf6ece93dd3f92) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Polling on connected device to get device status.

- [#72](https://github.com/LedgerHQ/device-sdk-ts/pull/72) [`5deb5a8`](https://github.com/LedgerHQ/device-sdk-ts/commit/5deb5a82779057162c37c1692319c887da72bb55) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add `GetBatteryStatus` command.

- [#82](https://github.com/LedgerHQ/device-sdk-ts/pull/82) [`f5f2ebe`](https://github.com/LedgerHQ/device-sdk-ts/commit/f5f2ebe59baf7847221bd2be32d41a10fb98c30e) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Implement Close App command.

- [#81](https://github.com/LedgerHQ/device-sdk-ts/pull/81) [`06f2f60`](https://github.com/LedgerHQ/device-sdk-ts/commit/06f2f60bf95f68c8dfb3ca047c076900f2a4c1ec) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Implement Open Application command.

- [#80](https://github.com/LedgerHQ/device-sdk-ts/pull/80) [`43e3372`](https://github.com/LedgerHQ/device-sdk-ts/commit/43e3372efa2f264677837c6bf1d045ea808b3bcf) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Handle unwanted transport disconnection

- [#73](https://github.com/LedgerHQ/device-sdk-ts/pull/73) [`0fc032a`](https://github.com/LedgerHQ/device-sdk-ts/commit/0fc032a9332a81ca25e34404be979dbcfc4086b3) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Implement GetAppAndVersion command.

- [#68](https://github.com/LedgerHQ/device-sdk-ts/pull/68) [`3bbe755`](https://github.com/LedgerHQ/device-sdk-ts/commit/3bbe755db6606c42a8fc6d845195acc0df6933be) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Handle device disconnection intent (disconnect on click, method call), clear session

### Patch Changes

- [#75](https://github.com/LedgerHQ/device-sdk-ts/pull/75) [`56cb882`](https://github.com/LedgerHQ/device-sdk-ts/commit/56cb8821f0fd38270348a732134b7755f6dfbfb3) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Naming DeviceSession

- [#79](https://github.com/LedgerHQ/device-sdk-ts/pull/79) [`44a4a68`](https://github.com/LedgerHQ/device-sdk-ts/commit/44a4a686ec640b72b5750c0ef70098ac8eaf8a98) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Add TSDoc comments for things exposed through API

- [#100](https://github.com/LedgerHQ/device-sdk-ts/pull/100) [`6b17607`](https://github.com/LedgerHQ/device-sdk-ts/commit/6b17607f9f6d51eb59d23bf1d6ba42d54e89bd05) Thanks [@valpinkman](https://github.com/valpinkman)! - Change sendCommand signature to directly return a Promise instead of a new function

- [#76](https://github.com/LedgerHQ/device-sdk-ts/pull/76) [`192c63c`](https://github.com/LedgerHQ/device-sdk-ts/commit/192c63c12bb19f8d5e2314cab00ea7fbf6c93b47) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Clean exports

- [#99](https://github.com/LedgerHQ/device-sdk-ts/pull/99) [`e3e9065`](https://github.com/LedgerHQ/device-sdk-ts/commit/e3e90655108331bccf5cd228551eb7d81f5d81a1) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Command signature: pass parameters to command constructor
