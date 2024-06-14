# @ledgerhq/device-sdk-core

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
