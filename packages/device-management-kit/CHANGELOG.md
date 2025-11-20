# @ledgerhq/device-management-kit

## 0.11.2

### Patch Changes

- [`a13cc47`](https://github.com/LedgerHQ/device-sdk-ts/commit/a13cc4777591253171e8e8299e6134df86eb3387) Thanks [@aussedatlo](https://github.com/aussedatlo)! - fake changeset

## 0.11.1

### Patch Changes

- [#1119](https://github.com/LedgerHQ/device-sdk-ts/pull/1119) [`0e4ae29`](https://github.com/LedgerHQ/device-sdk-ts/commit/0e4ae2941f93448d8d1439f9d26166ffa5633a54) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Clean up all device sessions of the same device when device disconnected

## 0.11.0

### Minor Changes

- [#1116](https://github.com/LedgerHQ/device-sdk-ts/pull/1116) [`81c0d0c`](https://github.com/LedgerHQ/device-sdk-ts/commit/81c0d0c5efaad26571534f8a04621d51e49e99e4) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Use BLE advertised name as connected device name

- [#1107](https://github.com/LedgerHQ/device-sdk-ts/pull/1107) [`38485bd`](https://github.com/LedgerHQ/device-sdk-ts/commit/38485bd789a0c8f9c4cecdef7fa19e963ad442f9) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add name attribute to all command objects and add logs in send command

## 0.10.0

### Minor Changes

- [#1094](https://github.com/LedgerHQ/device-sdk-ts/pull/1094) [`5fdf5c9`](https://github.com/LedgerHQ/device-sdk-ts/commit/5fdf5c9fcb52c249fecf35bea8db2b451ac3e3fa) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add InvalidGetFirmwareMetadataResponseError

- [#1104](https://github.com/LedgerHQ/device-sdk-ts/pull/1104) [`ebd44c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/ebd44c2690ec578410f69b148179268eeb34db65) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add reconnect use case

## 0.9.2

### Patch Changes

- [#1083](https://github.com/LedgerHQ/device-sdk-ts/pull/1083) [`9aea690`](https://github.com/LedgerHQ/device-sdk-ts/commit/9aea690da8dc1b51fd2827d40bbdbfb4541545bd) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Don't console log data if undefined

- [#1083](https://github.com/LedgerHQ/device-sdk-ts/pull/1083) [`4feb921`](https://github.com/LedgerHQ/device-sdk-ts/commit/4feb9217d67f6981b3a8e58ab51526d0a961a5b1) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add logs in device session sendApdu command

- [#1079](https://github.com/LedgerHQ/device-sdk-ts/pull/1079) [`1fe7a10`](https://github.com/LedgerHQ/device-sdk-ts/commit/1fe7a10f2ea93793ad9125c657ec888c04226335) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add verify safe address user interaction

## 0.9.1

### Patch Changes

- [#1040](https://github.com/LedgerHQ/device-sdk-ts/pull/1040) [`b0ea450`](https://github.com/LedgerHQ/device-sdk-ts/commit/b0ea45093703aa9f62b032092884f06f376fe325) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - GetDeviceStatus should not depend on the refresher

## 0.9.0

### Minor Changes

- [#1014](https://github.com/LedgerHQ/device-sdk-ts/pull/1014) [`4337fdd`](https://github.com/LedgerHQ/device-sdk-ts/commit/4337fdd960531554935daf8c5c4f84d8f4973f7d) Thanks [@valpinkman](https://github.com/valpinkman)! - New api on DeviceManagementKit to check if the transports support the running environment

### Patch Changes

- [#966](https://github.com/LedgerHQ/device-sdk-ts/pull/966) [`a6a6e31`](https://github.com/LedgerHQ/device-sdk-ts/commit/a6a6e316705cd8754474991a8f0753064ba66bd9) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Use final BLE ids for Apex

- [#979](https://github.com/LedgerHQ/device-sdk-ts/pull/979) [`b1d8e58`](https://github.com/LedgerHQ/device-sdk-ts/commit/b1d8e58de5f513bad5eb8eb8f804fc2cbeeb4c17) Thanks [@thesan](https://github.com/thesan)! - Enable no device authentication

- [#1017](https://github.com/LedgerHQ/device-sdk-ts/pull/1017) [`0cd8a18`](https://github.com/LedgerHQ/device-sdk-ts/commit/0cd8a18fa676a7d8e6ed950fd3a12c43f6532402) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Modify Apex id to match backend

## 0.8.0

### Minor Changes

- [#949](https://github.com/LedgerHQ/device-sdk-ts/pull/949) [`090a3ab`](https://github.com/LedgerHQ/device-sdk-ts/commit/090a3ab350f3341b4222971a003738836e635e28) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Fix transport framer when payload size fits exactly a frame

- [#937](https://github.com/LedgerHQ/device-sdk-ts/pull/937) [`efac23f`](https://github.com/LedgerHQ/device-sdk-ts/commit/efac23fc8164d23d27713f30e40e575693d536d4) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Fix current app detection for old firmwares

- [#907](https://github.com/LedgerHQ/device-sdk-ts/pull/907) [`2a047a8`](https://github.com/LedgerHQ/device-sdk-ts/commit/2a047a8c2eb23a6c3833eeb42e35a43f902f9a8a) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Adapt DeviceConnectionStateMachine to IO revamp OS

### Patch Changes

- [#869](https://github.com/LedgerHQ/device-sdk-ts/pull/869) [`62486e7`](https://github.com/LedgerHQ/device-sdk-ts/commit/62486e7c92998afd0831f19192c8a8dd1bb8d10e) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Should throw an error when app minVersion is not found in catalog

- [#883](https://github.com/LedgerHQ/device-sdk-ts/pull/883) [`b164403`](https://github.com/LedgerHQ/device-sdk-ts/commit/b16440340617576b0fe4e0db9d8d345a7f37e5cd) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Improve SecureChannel errors management and typing

- [#855](https://github.com/LedgerHQ/device-sdk-ts/pull/855) [`40bfafc`](https://github.com/LedgerHQ/device-sdk-ts/commit/40bfafcb467723c1364b149e336bc7450d8cf376) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Add new error class SendApduEmptyResponseError

- [#928](https://github.com/LedgerHQ/device-sdk-ts/pull/928) [`0df32be`](https://github.com/LedgerHQ/device-sdk-ts/commit/0df32bef22cbfab7bfde2ee5341225b19147543f) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Support Apex device (BLE identifiers of early OS)

- [#882](https://github.com/LedgerHQ/device-sdk-ts/pull/882) [`d090358`](https://github.com/LedgerHQ/device-sdk-ts/commit/d0903582af8a6f0a2df35dcef7b457f3f730a0f4) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Allow to send an apdu with expected disconnection

- [#884](https://github.com/LedgerHQ/device-sdk-ts/pull/884) [`f1c1949`](https://github.com/LedgerHQ/device-sdk-ts/commit/f1c1949d288cee1369a34978c6e13b1be99e8712) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Add unit tests for DeviceConnection state machine

- [#890](https://github.com/LedgerHQ/device-sdk-ts/pull/890) [`ccbf2ef`](https://github.com/LedgerHQ/device-sdk-ts/commit/ccbf2ef37d5d8831711f5e995d25d4697cf250ab) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Handle transport disconnection during successful OpenApp

## 0.7.0

### Minor Changes

- [#765](https://github.com/LedgerHQ/device-sdk-ts/pull/765) [`44bb707`](https://github.com/LedgerHQ/device-sdk-ts/commit/44bb70728a15512ce08b3ec237c99ace74e0b0c4) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add set provider feature

- [#781](https://github.com/LedgerHQ/device-sdk-ts/pull/781) [`c7dc5c6`](https://github.com/LedgerHQ/device-sdk-ts/commit/c7dc5c63cfdd8f2bc429a694c8664de746a5fc30) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Implement InstallOrUpdateApplications device action

- [#775](https://github.com/LedgerHQ/device-sdk-ts/pull/775) [`4d969db`](https://github.com/LedgerHQ/device-sdk-ts/commit/4d969dbef608cc131bdbf4e06edd381f5c3dd591) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Implement GetDeviceMetadata device action

- [#788](https://github.com/LedgerHQ/device-sdk-ts/pull/788) [`212ce15`](https://github.com/LedgerHQ/device-sdk-ts/commit/212ce15c4d996576d32a302d843e821396a8ff2c) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Implement OpenAppWithDependencies device action

- [#760](https://github.com/LedgerHQ/device-sdk-ts/pull/760) [`5927cce`](https://github.com/LedgerHQ/device-sdk-ts/commit/5927ccedb34f930103d6d46651abe28c3eeb35c3) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add documentation for secure channel device actions

### Patch Changes

- [#818](https://github.com/LedgerHQ/device-sdk-ts/pull/818) [`f0fea54`](https://github.com/LedgerHQ/device-sdk-ts/commit/f0fea54800fd17ed9fb4bd8c24703a6f543ea669) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Make OpeningConnectionError extendable

- [#800](https://github.com/LedgerHQ/device-sdk-ts/pull/800) [`34f8afb`](https://github.com/LedgerHQ/device-sdk-ts/commit/34f8afb5060dafde21dc42d9bc86d4571543ea77) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Don't rely on refresher in GetDeviceStatus device action

- [#808](https://github.com/LedgerHQ/device-sdk-ts/pull/808) [`b1f9e00`](https://github.com/LedgerHQ/device-sdk-ts/commit/b1f9e00de477c5a390da6211ac15647bcbbcde4f) Thanks [@valpinkman](https://github.com/valpinkman)! - SendCommand now accepts an abortTimeout

- [#666](https://github.com/LedgerHQ/device-sdk-ts/pull/666) [`7b6c72d`](https://github.com/LedgerHQ/device-sdk-ts/commit/7b6c72df76ee2cf4dd90057c5270834f4aa177b6) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Add DeviceConnectionStateMachine

- [#777](https://github.com/LedgerHQ/device-sdk-ts/pull/777) [`ccfc20f`](https://github.com/LedgerHQ/device-sdk-ts/commit/ccfc20f8f8d831b1ad9f756c682775f0f7da7130) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add getProvider method to DMK

- [#795](https://github.com/LedgerHQ/device-sdk-ts/pull/795) [`8a9cde5`](https://github.com/LedgerHQ/device-sdk-ts/commit/8a9cde5304edcda0ca1e06452d743f642affb54c) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Allow to use discover apis without param

- [#819](https://github.com/LedgerHQ/device-sdk-ts/pull/819) [`d268b91`](https://github.com/LedgerHQ/device-sdk-ts/commit/d268b91ab063b58ab6c9497c14e05197f24a045f) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Update the device session state when refresher is disabled

- [#805](https://github.com/LedgerHQ/device-sdk-ts/pull/805) [`c3c1f6b`](https://github.com/LedgerHQ/device-sdk-ts/commit/c3c1f6b0f264cd48ea0259a7b6e79c4a6597a87d) Thanks [@valpinkman](https://github.com/valpinkman)! - Fixed the Transport.stopDiscovering type to allow for async functions

## 0.6.5

### Minor Changes

- [#709](https://github.com/LedgerHQ/device-sdk-ts/pull/709) [`e3d6744`](https://github.com/LedgerHQ/device-sdk-ts/commit/e3d6744336d45840a9715e48c319cdf4ce77bb4f) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add ListInstalledApps device action

- [#737](https://github.com/LedgerHQ/device-sdk-ts/pull/737) [`d93a602`](https://github.com/LedgerHQ/device-sdk-ts/commit/d93a602d1ee161d6d8da4e0e40690a4273a813e0) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add install and uninstall app device actions

- [#746](https://github.com/LedgerHQ/device-sdk-ts/pull/746) [`29242d5`](https://github.com/LedgerHQ/device-sdk-ts/commit/29242d51c79d9043c3a6160d897b4938f044b7c4) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add config options for device session refresher and refactored DeviceSession

### Patch Changes

- [#755](https://github.com/LedgerHQ/device-sdk-ts/pull/755) [`da9d303`](https://github.com/LedgerHQ/device-sdk-ts/commit/da9d303e53790159e6d22f3f366f71314eef5752) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add unit tests for genuine check and list installed apps device actions.

## 0.6.4

### Patch Changes

- [#738](https://github.com/LedgerHQ/device-sdk-ts/pull/738) [`ce144ac`](https://github.com/LedgerHQ/device-sdk-ts/commit/ce144ac42f307d3d6d65813cd27326da8fc5b7fe) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Ensure device session is ready after device connection

## 0.6.3

### Patch Changes

- [#732](https://github.com/LedgerHQ/device-sdk-ts/pull/732) [`4c42b21`](https://github.com/LedgerHQ/device-sdk-ts/commit/4c42b214e90096d86883c6faedca02d0ee0b6c64) Thanks [@valpinkman](https://github.com/valpinkman)! - Fix condition in DeviceSession to handle locked device

## 0.6.2

### Minor Changes

- [#708](https://github.com/LedgerHQ/device-sdk-ts/pull/708) [`06084eb`](https://github.com/LedgerHQ/device-sdk-ts/commit/06084ebebda43b039ad591607634474bc345a09c) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add GetAppList HTTP request in manager API

- [#697](https://github.com/LedgerHQ/device-sdk-ts/pull/697) [`6b821aa`](https://github.com/LedgerHQ/device-sdk-ts/commit/6b821aa84936472fd74c32dd226323db005f39aa) Thanks [@valpinkman](https://github.com/valpinkman)! - Rename listenToKnownDevices to listenToavailableDevices and add rssi field in DiscoveredDevice

- [#685](https://github.com/LedgerHQ/device-sdk-ts/pull/685) [`814d452`](https://github.com/LedgerHQ/device-sdk-ts/commit/814d452170395337554d27ba9aaa84f96f9bee6f) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add genuine check device action

- [#700](https://github.com/LedgerHQ/device-sdk-ts/pull/700) [`61b17b3`](https://github.com/LedgerHQ/device-sdk-ts/commit/61b17b3df1946b0f3f9370d7bacc243fdfd7880c) Thanks [@valpinkman](https://github.com/valpinkman)! - Update refresher handling and update dmk api

### Patch Changes

- [#701](https://github.com/LedgerHQ/device-sdk-ts/pull/701) [`7bbba9f`](https://github.com/LedgerHQ/device-sdk-ts/commit/7bbba9fe7112e351654765e67dbfc4d082711b0c) Thanks [@valpinkman](https://github.com/valpinkman)! - Update listenToAvailableDevices to accept a transport identifier to scope its discovering process

## 0.6.1

### Patch Changes

- [#675](https://github.com/LedgerHQ/device-sdk-ts/pull/675) [`90e20e7`](https://github.com/LedgerHQ/device-sdk-ts/commit/90e20e74422b1c178cf82c459ad32e2bff6221da) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Use unknown type for HexaString typeguard

- [#663](https://github.com/LedgerHQ/device-sdk-ts/pull/663) [`5c4a2d6`](https://github.com/LedgerHQ/device-sdk-ts/commit/5c4a2d624a4196f62051514ec211dca4c618023e) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add sendApdu in internal API interface

- [#645](https://github.com/LedgerHQ/device-sdk-ts/pull/645) [`3c202be`](https://github.com/LedgerHQ/device-sdk-ts/commit/3c202be9cbd5e85eefbe4298d0f66adc8d239f8f) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add LoadCertificateCommand

- [#680](https://github.com/LedgerHQ/device-sdk-ts/pull/680) [`060fe45`](https://github.com/LedgerHQ/device-sdk-ts/commit/060fe45e60fd58b792f3cc1c9c4313415ef729ee) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Move statelyai/inspect to devDependencies

- [#657](https://github.com/LedgerHQ/device-sdk-ts/pull/657) [`2f952cc`](https://github.com/LedgerHQ/device-sdk-ts/commit/2f952cc68ab37b49a04d1219f90b0e60d4fd0726) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Separate WebSocket connections from manager API

- [#649](https://github.com/LedgerHQ/device-sdk-ts/pull/649) [`1364525`](https://github.com/LedgerHQ/device-sdk-ts/commit/1364525e1092b69700e83819d00df1222dc32dc1) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Factorize device actions calling a task in an app

## 0.6.0

### Minor Changes

- [#559](https://github.com/LedgerHQ/device-sdk-ts/pull/559) [`a56740a`](https://github.com/LedgerHQ/device-sdk-ts/commit/a56740a608dc95ab3545d90666c71aeff2f67212) Thanks [@valpinkman](https://github.com/valpinkman)! - Extract Transports to their own module

- [#548](https://github.com/LedgerHQ/device-sdk-ts/pull/548) [`8f6907a`](https://github.com/LedgerHQ/device-sdk-ts/commit/8f6907a9fd99546d88520f2d167485ef59f8ca2e) Thanks [@valpinkman](https://github.com/valpinkman)! - Add new toggle for the device session refresher

- [#608](https://github.com/LedgerHQ/device-sdk-ts/pull/608) [`1153a78`](https://github.com/LedgerHQ/device-sdk-ts/commit/1153a78b1b56f1767dae380466a8bc7fd86fec73) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add WebSocket data source

### Patch Changes

- [#581](https://github.com/LedgerHQ/device-sdk-ts/pull/581) [`a7984cd`](https://github.com/LedgerHQ/device-sdk-ts/commit/a7984cdcbd8e18aec614d6f07fda293971bd61eb) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Fix CommandUtils static calls

- [#574](https://github.com/LedgerHQ/device-sdk-ts/pull/574) [`1bf2166`](https://github.com/LedgerHQ/device-sdk-ts/commit/1bf2166776ed16c2adf8a4d9d796a567629f983b) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Get manager API service from internal API

- [#581](https://github.com/LedgerHQ/device-sdk-ts/pull/581) [`df4ef37`](https://github.com/LedgerHQ/device-sdk-ts/commit/df4ef37d39a2e214a06930b7ff3c09cf22befb7f) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Expose CommandSuccessResult

- [#469](https://github.com/LedgerHQ/device-sdk-ts/pull/469) [`eafad9e`](https://github.com/LedgerHQ/device-sdk-ts/commit/eafad9e1b39573ad3321413b7adaa0814245da96) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Add manager api calls for secure channel

- [#559](https://github.com/LedgerHQ/device-sdk-ts/pull/559) [`cc342e5`](https://github.com/LedgerHQ/device-sdk-ts/commit/cc342e5335ef1bc91b82967f6f59808796f88b36) Thanks [@valpinkman](https://github.com/valpinkman)! - Update DeviceSession to change the state of the device in case of an error

- [#621](https://github.com/LedgerHQ/device-sdk-ts/pull/621) [`8799e83`](https://github.com/LedgerHQ/device-sdk-ts/commit/8799e83c92baeb5ccba53546a3d59867d3d6185c) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add a list of compatible apps for OpenAppDA and SendCommandInAppDA

## 0.5.1

### Patch Changes

- Updated dependencies [[`649bd73`](https://github.com/LedgerHQ/device-sdk-ts/commit/649bd73c85c461c5e226a1ff15cd3087ff1387c9)]:
  - @ledgerhq/device-transport-kit-mock-client@1.1.0

## 0.5.0

### Minor Changes

- [#221](https://github.com/LedgerHQ/device-sdk-ts/pull/221) [`55d62f2`](https://github.com/LedgerHQ/device-sdk-ts/commit/55d62f2dfe9cd979c99fbc8f8aeed7909c653807) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Add BLE support

### Patch Changes

- [#438](https://github.com/LedgerHQ/device-sdk-ts/pull/438) [`d6273ed`](https://github.com/LedgerHQ/device-sdk-ts/commit/d6273ed00b61d273ebc42bd5dfa16ce4c5641af5) Thanks [@valpinkman](https://github.com/valpinkman)! - Update license to Apache-2.0

- [#321](https://github.com/LedgerHQ/device-sdk-ts/pull/321) [`123bec8`](https://github.com/LedgerHQ/device-sdk-ts/commit/123bec87ebd6c23922138c44a397bc72919d88e5) Thanks [@valpinkman](https://github.com/valpinkman)! - Use esbuild to build libraries

- [#477](https://github.com/LedgerHQ/device-sdk-ts/pull/477) [`64e8886`](https://github.com/LedgerHQ/device-sdk-ts/commit/64e88863fd93c7140c32be5c91fde231293be7be) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Replace ListDeviceSessionsUseCase with ListConnectedDevicesUseCase

- [#460](https://github.com/LedgerHQ/device-sdk-ts/pull/460) [`a99fe1b`](https://github.com/LedgerHQ/device-sdk-ts/commit/a99fe1bfd362b6b5f9e8ee2489d285766e06272a) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Rename SDK to DMK

- [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40) Thanks [@valpinkman](https://github.com/valpinkman)! - Implement basic Flipper client for the Ledger Device Management Kit

- [#487](https://github.com/LedgerHQ/device-sdk-ts/pull/487) [`afaeb64`](https://github.com/LedgerHQ/device-sdk-ts/commit/afaeb64c1fd2643d74ea8a2cc541c450d78c470c) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Add support for nanoS

- [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40) Thanks [@valpinkman](https://github.com/valpinkman)! - Add mockserver integration with transport

- [#452](https://github.com/LedgerHQ/device-sdk-ts/pull/452) [`9c2daf9`](https://github.com/LedgerHQ/device-sdk-ts/commit/9c2daf90391d5219cfa0f98e500a6f2e1295b454) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Use type keyword when importing type

- [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40) Thanks [@valpinkman](https://github.com/valpinkman)! - Add unlock timeout input in open app device action

- [#357](https://github.com/LedgerHQ/device-sdk-ts/pull/357) [`629900d`](https://github.com/LedgerHQ/device-sdk-ts/commit/629900d681acdc4398445d4167a70811d041dad4) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - WebHid: Rework reconnection logic & fix sendApdu to wait in case of disconnection

- [#392](https://github.com/LedgerHQ/device-sdk-ts/pull/392) [`bd19f5c`](https://github.com/LedgerHQ/device-sdk-ts/commit/bd19f5c27f5a74dc9d58bd25fb021a260ff5e602) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - New use case listenToKnownDevices

- Updated dependencies [[`d6273ed`](https://github.com/LedgerHQ/device-sdk-ts/commit/d6273ed00b61d273ebc42bd5dfa16ce4c5641af5), [`a99fe1b`](https://github.com/LedgerHQ/device-sdk-ts/commit/a99fe1bfd362b6b5f9e8ee2489d285766e06272a), [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40)]:
  - @ledgerhq/device-transport-kit-mock-client@1.0.1

## 0.4.0

### Minor Changes

- [#124](https://github.com/LedgerHQ/device-sdk-ts/pull/124) [`c6822ba`](https://github.com/LedgerHQ/device-sdk-ts/commit/c6822ba275946200333a8e64f240bf52c62e649c) Thanks [@valpinkman](https://github.com/valpinkman)! - Add new device actions to core: ListApps, GoToDashboard, GetDeviceStatus

- [#161](https://github.com/LedgerHQ/device-sdk-ts/pull/161) [`0ef0626`](https://github.com/LedgerHQ/device-sdk-ts/commit/0ef06260b4cf87c3cb41fe2819e8efd849b2f336) Thanks [@valpinkman](https://github.com/valpinkman)! - Add ManagerApi service to core

- [#111](https://github.com/LedgerHQ/device-sdk-ts/pull/111) [`f708627`](https://github.com/LedgerHQ/device-sdk-ts/commit/f708627965617b40951016448b8f90d71c19a2f8) Thanks [@valpinkman](https://github.com/valpinkman)! - Add new ListApps command to SDK core

- [#161](https://github.com/LedgerHQ/device-sdk-ts/pull/161) [`73825aa`](https://github.com/LedgerHQ/device-sdk-ts/commit/73825aaa5869c9026bd1a5a1b142a74a9484662f) Thanks [@valpinkman](https://github.com/valpinkman)! - Add ListAppsWithMetadata device action

- [#172](https://github.com/LedgerHQ/device-sdk-ts/pull/172) [`8cba13a`](https://github.com/LedgerHQ/device-sdk-ts/commit/8cba13a3fb720ecd15b2464c45be30fc9851bd0a) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Use of CommandResult return type in commands

### Patch Changes

- [#174](https://github.com/LedgerHQ/device-sdk-ts/pull/174) [`899d151`](https://github.com/LedgerHQ/device-sdk-ts/commit/899d15152c2cf67b19cb6ca83dc1fbbd0e79ae27) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Improve code visibility

- [#348](https://github.com/LedgerHQ/device-sdk-ts/pull/348) [`af2f0e6`](https://github.com/LedgerHQ/device-sdk-ts/commit/af2f0e61f370fd4728ebec2daa60599997859f05) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Update session state after opening app successfully

- [#379](https://github.com/LedgerHQ/device-sdk-ts/pull/379) [`ea615d7`](https://github.com/LedgerHQ/device-sdk-ts/commit/ea615d7e75667cab30a3107bf9032edae48867fa) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Add possibility to export logs to JSON

- [#284](https://github.com/LedgerHQ/device-sdk-ts/pull/284) [`41892b3`](https://github.com/LedgerHQ/device-sdk-ts/commit/41892b3dbd27c71b091d4c8203286702a81f380b) Thanks [@valpinkman](https://github.com/valpinkman)! - Fix wrong dependency declaration for @statelyai/inspect (from devDeps to deps

- [`5e224ba`](https://github.com/LedgerHQ/device-sdk-ts/commit/5e224ba475f7fefa8df14d0aad325bc9f9636f57) Thanks [@valpinkman](https://github.com/valpinkman)! - Rename packages

- [#169](https://github.com/LedgerHQ/device-sdk-ts/pull/169) [`d9e0164`](https://github.com/LedgerHQ/device-sdk-ts/commit/d9e0164d69bede69269d0989c24a8631b9a0875d) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Add support of Ledger Flex

- [#121](https://github.com/LedgerHQ/device-sdk-ts/pull/121) [`3b59289`](https://github.com/LedgerHQ/device-sdk-ts/commit/3b592899168ecedfa3698041b77e09764c1cf4d7) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Device reconnection on app change

- [#156](https://github.com/LedgerHQ/device-sdk-ts/pull/156) [`a25f529`](https://github.com/LedgerHQ/device-sdk-ts/commit/a25f529ed08206d38d00026a3589bbbaa21075bc) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Added a new "generic" DeviceAction `SendCommandInAppDeviceAction`

- [#209](https://github.com/LedgerHQ/device-sdk-ts/pull/209) [`c5b5cc1`](https://github.com/LedgerHQ/device-sdk-ts/commit/c5b5cc11d0b0dfec4e1e76ecd98d4ad09a6c9d89) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add sign-personal-message user interaction

- [#186](https://github.com/LedgerHQ/device-sdk-ts/pull/186) [`5018129`](https://github.com/LedgerHQ/device-sdk-ts/commit/501812904cbb7eb519651b4c8dbb613198e1e89c) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - DSDK-420 Implement the EIP712 TypedData parser service

- [#353](https://github.com/LedgerHQ/device-sdk-ts/pull/353) [`6884d4c`](https://github.com/LedgerHQ/device-sdk-ts/commit/6884d4cce615f32b128c672bfefa74d249d5ca48) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - WebUsbHidTransport: recognition of devices in bootloader mode

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
