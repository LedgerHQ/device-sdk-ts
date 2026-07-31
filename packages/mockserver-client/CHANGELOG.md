# @ledgerhq/device-transport-kit-mock-client

## 1.2.0

### Minor Changes

- [#1590](https://github.com/LedgerHQ/device-sdk-ts/pull/1590) [`4720647`](https://github.com/LedgerHQ/device-sdk-ts/commit/4720647322df385f9b84f52a97ccb57f35b4a6c7) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Expose installable-app metadata on the device model. `DeviceApp` now carries an optional `hash`, and `DeviceConfig` accepts a `catalog` of `CatalogApp` entries used by the mock server to resolve an install hash to its app.

- [#1553](https://github.com/LedgerHQ/device-sdk-ts/pull/1553) [`3bc2530`](https://github.com/LedgerHQ/device-sdk-ts/commit/3bc2530fbb238424c3b92a3a489d82564cf04b05) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Support ordered response sequences on mocks. A `Mock` now exposes `responses: string[]` (instead of a single `response`), and `MockConfig` accepts either an ordered `responses` list or the single-response `response` shorthand.

## 1.1.0

### Minor Changes

- [`649bd73`](https://github.com/LedgerHQ/device-sdk-ts/commit/649bd73c85c461c5e226a1ff15cd3087ff1387c9) Thanks [@valpinkman](https://github.com/valpinkman)! - Remove private from package.json so DMK can dpend on it

## 1.0.1

### Patch Changes

- [#438](https://github.com/LedgerHQ/device-sdk-ts/pull/438) [`d6273ed`](https://github.com/LedgerHQ/device-sdk-ts/commit/d6273ed00b61d273ebc42bd5dfa16ce4c5641af5) Thanks [@valpinkman](https://github.com/valpinkman)! - Update license to Apache-2.0

- [#460](https://github.com/LedgerHQ/device-sdk-ts/pull/460) [`a99fe1b`](https://github.com/LedgerHQ/device-sdk-ts/commit/a99fe1bfd362b6b5f9e8ee2489d285766e06272a) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Rename SDK to DMK

- [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40) Thanks [@valpinkman](https://github.com/valpinkman)! - Add mockserver integration with transport
