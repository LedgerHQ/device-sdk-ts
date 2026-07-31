# @ledgerhq/device-transport-kit-mockserver

## 1.1.0

### Minor Changes

- [#1553](https://github.com/LedgerHQ/device-sdk-ts/pull/1553) [`8a98d91`](https://github.com/LedgerHQ/device-sdk-ts/commit/8a98d91a165060ad196916acc6d1cfc224bb0250) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Support sharing a mock server session token. `mockserverTransportFactory` is now a higher-order factory `mockserverTransportFactory(mockUrl?, sessionToken?)` and the transport targets the new bearer-token mock client API (device discovery, per-device connect/APDU). Device models are built from the richer mock device metadata.

### Patch Changes

- [#1590](https://github.com/LedgerHQ/device-sdk-ts/pull/1590) [`decc0c4`](https://github.com/LedgerHQ/device-sdk-ts/commit/decc0c4791dd6af58f87f2c61e0fa8095c6aa75f) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Report real per-model memory constants (memory size and block size) for mock devices instead of hardcoded values. Previously every mock device advertised a 320 KB memory with 32-byte blocks, which made memory-aware device actions (e.g. Install or update applications / Open app with dependencies, via `PredictOutOfMemoryTask`) wrongly report `OutOfMemoryDAError` even on an empty device.

## 1.0.2

### Patch Changes

- [#1214](https://github.com/LedgerHQ/device-sdk-ts/pull/1214) [`f4da0a6`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4da0a66cd530c811af595cb91ac0c11370862f0) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Move APDU exchange logging to transport layer for more accurate timing

- Updated dependencies [[`df480c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/df480c2072cdc6e9a0865bf1e92a2950be04c0a8), [`f4da0a6`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4da0a66cd530c811af595cb91ac0c11370862f0), [`52fe14e`](https://github.com/LedgerHQ/device-sdk-ts/commit/52fe14e0698ab32e84014bae4a92e5d85e961f88)]:
  - @ledgerhq/device-management-kit@1.0.0

## 1.0.1

### Patch Changes

- [#1178](https://github.com/LedgerHQ/device-sdk-ts/pull/1178) [`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Breaking change: Replace TransportDeviceModel.blockSize by dynamic getBlockSize (where the result depends on the firmware version). This allows us to correctly handle available memory prediction for the Ledger Nano S.

- Updated dependencies [[`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120)]:
  - @ledgerhq/device-management-kit@0.13.0

## 1.0.0

### Minor Changes

- [#474](https://github.com/LedgerHQ/device-sdk-ts/pull/474) [`3cdf201`](https://github.com/LedgerHQ/device-sdk-ts/commit/3cdf2012117fdb1916be43f42869d6d75bee584f) Thanks [@valpinkman](https://github.com/valpinkman)! - Extract Transports to their own module

- [#697](https://github.com/LedgerHQ/device-sdk-ts/pull/697) [`6b821aa`](https://github.com/LedgerHQ/device-sdk-ts/commit/6b821aa84936472fd74c32dd226323db005f39aa) Thanks [@valpinkman](https://github.com/valpinkman)! - Rename listenToKnownDevices to listenToAvailableDevices

### Patch Changes

- Updated dependencies [[`f0fea54`](https://github.com/LedgerHQ/device-sdk-ts/commit/f0fea54800fd17ed9fb4bd8c24703a6f543ea669), [`34f8afb`](https://github.com/LedgerHQ/device-sdk-ts/commit/34f8afb5060dafde21dc42d9bc86d4571543ea77), [`b1f9e00`](https://github.com/LedgerHQ/device-sdk-ts/commit/b1f9e00de477c5a390da6211ac15647bcbbcde4f), [`7b6c72d`](https://github.com/LedgerHQ/device-sdk-ts/commit/7b6c72df76ee2cf4dd90057c5270834f4aa177b6), [`44bb707`](https://github.com/LedgerHQ/device-sdk-ts/commit/44bb70728a15512ce08b3ec237c99ace74e0b0c4), [`ccfc20f`](https://github.com/LedgerHQ/device-sdk-ts/commit/ccfc20f8f8d831b1ad9f756c682775f0f7da7130), [`8a9cde5`](https://github.com/LedgerHQ/device-sdk-ts/commit/8a9cde5304edcda0ca1e06452d743f642affb54c), [`c7dc5c6`](https://github.com/LedgerHQ/device-sdk-ts/commit/c7dc5c63cfdd8f2bc429a694c8664de746a5fc30), [`4d969db`](https://github.com/LedgerHQ/device-sdk-ts/commit/4d969dbef608cc131bdbf4e06edd381f5c3dd591), [`212ce15`](https://github.com/LedgerHQ/device-sdk-ts/commit/212ce15c4d996576d32a302d843e821396a8ff2c), [`5927cce`](https://github.com/LedgerHQ/device-sdk-ts/commit/5927ccedb34f930103d6d46651abe28c3eeb35c3), [`d268b91`](https://github.com/LedgerHQ/device-sdk-ts/commit/d268b91ab063b58ab6c9497c14e05197f24a045f), [`c3c1f6b`](https://github.com/LedgerHQ/device-sdk-ts/commit/c3c1f6b0f264cd48ea0259a7b6e79c4a6597a87d)]:
  - @ledgerhq/device-management-kit@0.7.0
