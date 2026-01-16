# @ledgerhq/device-transport-kit-web-hid

## 1.2.3

### Patch Changes

- [#1214](https://github.com/LedgerHQ/device-sdk-ts/pull/1214) [`f4da0a6`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4da0a66cd530c811af595cb91ac0c11370862f0) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Move APDU exchange logging to transport layer for more accurate timing

- Updated dependencies [[`df480c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/df480c2072cdc6e9a0865bf1e92a2950be04c0a8), [`f4da0a6`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4da0a66cd530c811af595cb91ac0c11370862f0), [`52fe14e`](https://github.com/LedgerHQ/device-sdk-ts/commit/52fe14e0698ab32e84014bae4a92e5d85e961f88)]:
  - @ledgerhq/device-management-kit@1.0.0

## 1.2.2

### Patch Changes

- [#1181](https://github.com/LedgerHQ/device-sdk-ts/pull/1181) [`044b764`](https://github.com/LedgerHQ/device-sdk-ts/commit/044b764dba7d0b7e6948a8f2de0c7c5ca7373f72) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Bump patch versions to use ^ instead of \* to avoid duplication in LW and prepare a release

- [#1178](https://github.com/LedgerHQ/device-sdk-ts/pull/1178) [`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Breaking change: Replace TransportDeviceModel.blockSize by dynamic getBlockSize (where the result depends on the firmware version). This allows us to correctly handle available memory prediction for the Ledger Nano S.

- Updated dependencies [[`b550c02`](https://github.com/LedgerHQ/device-sdk-ts/commit/b550c02bff4ec5cf99d76ee362697bccedc88120)]:
  - @ledgerhq/device-management-kit@0.13.0

## 1.2.1

### Patch Changes

- [#1083](https://github.com/LedgerHQ/device-sdk-ts/pull/1083) [`8c1b367`](https://github.com/LedgerHQ/device-sdk-ts/commit/8c1b3676bb1ea782351b5e474bdc659c567321e6) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Remove duplicate logs

- Updated dependencies [[`9aea690`](https://github.com/LedgerHQ/device-sdk-ts/commit/9aea690da8dc1b51fd2827d40bbdbfb4541545bd), [`4feb921`](https://github.com/LedgerHQ/device-sdk-ts/commit/4feb9217d67f6981b3a8e58ab51526d0a961a5b1), [`1fe7a10`](https://github.com/LedgerHQ/device-sdk-ts/commit/1fe7a10f2ea93793ad9125c657ec888c04226335)]:
  - @ledgerhq/device-management-kit@0.9.2

## 1.2.0

### Minor Changes

- [#907](https://github.com/LedgerHQ/device-sdk-ts/pull/907) [`b7b5d80`](https://github.com/LedgerHQ/device-sdk-ts/commit/b7b5d80c808fbb79fc416d01e5138847844add65) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Migrate on device connection state machine

### Patch Changes

- Updated dependencies [[`62486e7`](https://github.com/LedgerHQ/device-sdk-ts/commit/62486e7c92998afd0831f19192c8a8dd1bb8d10e), [`090a3ab`](https://github.com/LedgerHQ/device-sdk-ts/commit/090a3ab350f3341b4222971a003738836e635e28), [`efac23f`](https://github.com/LedgerHQ/device-sdk-ts/commit/efac23fc8164d23d27713f30e40e575693d536d4), [`b164403`](https://github.com/LedgerHQ/device-sdk-ts/commit/b16440340617576b0fe4e0db9d8d345a7f37e5cd), [`2a047a8`](https://github.com/LedgerHQ/device-sdk-ts/commit/2a047a8c2eb23a6c3833eeb42e35a43f902f9a8a), [`40bfafc`](https://github.com/LedgerHQ/device-sdk-ts/commit/40bfafcb467723c1364b149e336bc7450d8cf376), [`0df32be`](https://github.com/LedgerHQ/device-sdk-ts/commit/0df32bef22cbfab7bfde2ee5341225b19147543f), [`d090358`](https://github.com/LedgerHQ/device-sdk-ts/commit/d0903582af8a6f0a2df35dcef7b457f3f730a0f4), [`f1c1949`](https://github.com/LedgerHQ/device-sdk-ts/commit/f1c1949d288cee1369a34978c6e13b1be99e8712), [`ccbf2ef`](https://github.com/LedgerHQ/device-sdk-ts/commit/ccbf2ef37d5d8831711f5e995d25d4697cf250ab)]:
  - @ledgerhq/device-management-kit@0.8.0

## 1.1.0

### Minor Changes

- [#697](https://github.com/LedgerHQ/device-sdk-ts/pull/697) [`6b821aa`](https://github.com/LedgerHQ/device-sdk-ts/commit/6b821aa84936472fd74c32dd226323db005f39aa) Thanks [@valpinkman](https://github.com/valpinkman)! - Rename listenToKnownDevices to listenToAvailableDevices

## 1.0.1

### Patch Changes

- [#643](https://github.com/LedgerHQ/device-sdk-ts/pull/643) [`d9ec133`](https://github.com/LedgerHQ/device-sdk-ts/commit/d9ec13318fb7288e12820e871d49df70099da6fa) Thanks [@valpinkman](https://github.com/valpinkman)! - Fix reconnection on WebHid Transport

## 1.0.0

### Major Changes

- [#640](https://github.com/LedgerHQ/device-sdk-ts/pull/640) [`4df35a8`](https://github.com/LedgerHQ/device-sdk-ts/commit/4df35a8392872eb401d81d80a335ffac77ccf895) Thanks [@valpinkman](https://github.com/valpinkman)! - 1.0.0 release

### Minor Changes

- [#559](https://github.com/LedgerHQ/device-sdk-ts/pull/559) [`a56740a`](https://github.com/LedgerHQ/device-sdk-ts/commit/a56740a608dc95ab3545d90666c71aeff2f67212) Thanks [@valpinkman](https://github.com/valpinkman)! - Extract Transports to their own module

### Patch Changes

- [#631](https://github.com/LedgerHQ/device-sdk-ts/pull/631) [`760f6e5`](https://github.com/LedgerHQ/device-sdk-ts/commit/760f6e584a700729bbee9eea6ff87aeb43c3dcf4) Thanks [@valpinkman](https://github.com/valpinkman)! - Update reconnection event to trigger error only after a specific time

- [#559](https://github.com/LedgerHQ/device-sdk-ts/pull/559) [`cc342e5`](https://github.com/LedgerHQ/device-sdk-ts/commit/cc342e5335ef1bc91b82967f6f59808796f88b36) Thanks [@valpinkman](https://github.com/valpinkman)! - Update WebHidDeviceConnection to throw an error in case of a reconnect

- Updated dependencies [[`a7984cd`](https://github.com/LedgerHQ/device-sdk-ts/commit/a7984cdcbd8e18aec614d6f07fda293971bd61eb), [`a56740a`](https://github.com/LedgerHQ/device-sdk-ts/commit/a56740a608dc95ab3545d90666c71aeff2f67212), [`1bf2166`](https://github.com/LedgerHQ/device-sdk-ts/commit/1bf2166776ed16c2adf8a4d9d796a567629f983b), [`8f6907a`](https://github.com/LedgerHQ/device-sdk-ts/commit/8f6907a9fd99546d88520f2d167485ef59f8ca2e), [`df4ef37`](https://github.com/LedgerHQ/device-sdk-ts/commit/df4ef37d39a2e214a06930b7ff3c09cf22befb7f), [`1153a78`](https://github.com/LedgerHQ/device-sdk-ts/commit/1153a78b1b56f1767dae380466a8bc7fd86fec73), [`eafad9e`](https://github.com/LedgerHQ/device-sdk-ts/commit/eafad9e1b39573ad3321413b7adaa0814245da96), [`cc342e5`](https://github.com/LedgerHQ/device-sdk-ts/commit/cc342e5335ef1bc91b82967f6f59808796f88b36), [`8799e83`](https://github.com/LedgerHQ/device-sdk-ts/commit/8799e83c92baeb5ccba53546a3d59867d3d6185c)]:
  - @ledgerhq/device-management-kit@0.6.0
