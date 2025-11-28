# @ledgerhq/device-signer-kit-solana

## 1.5.0

### Minor Changes

- [#1138](https://github.com/LedgerHQ/device-sdk-ts/pull/1138) [`c79bce9`](https://github.com/LedgerHQ/device-sdk-ts/commit/c79bce92fd0832bbe405e3ef5b452efb6a448a51) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add support to LiFi in Solana signer

- [#1138](https://github.com/LedgerHQ/device-sdk-ts/pull/1138) [`29d4c1c`](https://github.com/LedgerHQ/device-sdk-ts/commit/29d4c1cafdfe3f365fe90d685bdd3a5bdf87db61) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Fix sign Transaction descriptors bug

- [#1138](https://github.com/LedgerHQ/device-sdk-ts/pull/1138) [`c723a92`](https://github.com/LedgerHQ/device-sdk-ts/commit/c723a9254ab4f243047602702e762759bc8d03c4) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Refactor ClearSignContext type and added new SolanaContextType in ContextModule

### Patch Changes

- Updated dependencies [[`c79bce9`](https://github.com/LedgerHQ/device-sdk-ts/commit/c79bce92fd0832bbe405e3ef5b452efb6a448a51), [`29d4c1c`](https://github.com/LedgerHQ/device-sdk-ts/commit/29d4c1cafdfe3f365fe90d685bdd3a5bdf87db61), [`eb243bb`](https://github.com/LedgerHQ/device-sdk-ts/commit/eb243bb343ae5f6434c0c33147f9d11b79c8c3ea), [`c723a92`](https://github.com/LedgerHQ/device-sdk-ts/commit/c723a9254ab4f243047602702e762759bc8d03c4)]:
  - @ledgerhq/context-module@1.11.0
  - @ledgerhq/device-management-kit@0.11.2

## 1.4.1

### Minor Changes

- [#1107](https://github.com/LedgerHQ/device-sdk-ts/pull/1107) [`38485bd`](https://github.com/LedgerHQ/device-sdk-ts/commit/38485bd789a0c8f9c4cecdef7fa19e963ad442f9) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add name attribute to all command objects

### Patch Changes

- [#1070](https://github.com/LedgerHQ/device-sdk-ts/pull/1070) [`2b17ba8`](https://github.com/LedgerHQ/device-sdk-ts/commit/2b17ba859b26af3dea824d7a737095f85c4a503d) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Improve tests to not depend on specific context module changes

- Updated dependencies [[`81c0d0c`](https://github.com/LedgerHQ/device-sdk-ts/commit/81c0d0c5efaad26571534f8a04621d51e49e99e4), [`38485bd`](https://github.com/LedgerHQ/device-sdk-ts/commit/38485bd789a0c8f9c4cecdef7fa19e963ad442f9)]:
  - @ledgerhq/device-management-kit@0.11.0

## 1.4.0

### Minor Changes

- [#1081](https://github.com/LedgerHQ/device-sdk-ts/pull/1081) [`b66d278`](https://github.com/LedgerHQ/device-sdk-ts/commit/b66d278a07505f5864b7f84b9440e9c3ee1f376d) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add message chunking and format to offchain message

### Patch Changes

- Updated dependencies [[`9aea690`](https://github.com/LedgerHQ/device-sdk-ts/commit/9aea690da8dc1b51fd2827d40bbdbfb4541545bd), [`c8bb7a3`](https://github.com/LedgerHQ/device-sdk-ts/commit/c8bb7a39202206bffcd82190fa9e3074e9663dde), [`1fe7a10`](https://github.com/LedgerHQ/device-sdk-ts/commit/1fe7a10f2ea93793ad9125c657ec888c04226335), [`4feb921`](https://github.com/LedgerHQ/device-sdk-ts/commit/4feb9217d67f6981b3a8e58ab51526d0a961a5b1), [`1fe7a10`](https://github.com/LedgerHQ/device-sdk-ts/commit/1fe7a10f2ea93793ad9125c657ec888c04226335)]:
  - @ledgerhq/device-management-kit@0.9.2
  - @ledgerhq/context-module@1.9.0

## 1.3.0

### Minor Changes

- [#1039](https://github.com/LedgerHQ/device-sdk-ts/pull/1039) [`792f0e4`](https://github.com/LedgerHQ/device-sdk-ts/commit/792f0e48f292b3f912acf483d79ed38b4cbe7019) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Polished transaction inspector and transaction options

- [#1018](https://github.com/LedgerHQ/device-sdk-ts/pull/1018) [`3af58c6`](https://github.com/LedgerHQ/device-sdk-ts/commit/3af58c62cc82e37a41b6325bd7fca8aaa0a8ac5a) Thanks [@ofreyssinet-ledger](https://github.com/ofreyssinet-ledger)! - Fix cert address on solana signTransaction

- [#1039](https://github.com/LedgerHQ/device-sdk-ts/pull/1039) [`946b59f`](https://github.com/LedgerHQ/device-sdk-ts/commit/946b59fc1c98d597c45ef834cd0d0723c6b4ca60) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add OCM envelope support in sign message

### Patch Changes

- [#1011](https://github.com/LedgerHQ/device-sdk-ts/pull/1011) [`a995e7f`](https://github.com/LedgerHQ/device-sdk-ts/commit/a995e7fb79bc086593c8ecdb60b0e9792c6f3329) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Change context module mock in test file

## 1.2.0

### Minor Changes

- [#962](https://github.com/LedgerHQ/device-sdk-ts/pull/962) [`b0dab28`](https://github.com/LedgerHQ/device-sdk-ts/commit/b0dab28c33481ea25ff9363ee4173c15c1217cb8) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Fix error 6A81 in signOffChainMsg

- [#879](https://github.com/LedgerHQ/device-sdk-ts/pull/879) [`f4d73bf`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4d73bf3dd94327fa5d8469cd7a981a7595bc0ca) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add Solana SPL support

- [#909](https://github.com/LedgerHQ/device-sdk-ts/pull/909) [`4c1b20a`](https://github.com/LedgerHQ/device-sdk-ts/commit/4c1b20a89a23c8bb0bb683bf475f0a3b1a78c226) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add GenerateTransactionDeviceAction

- [#911](https://github.com/LedgerHQ/device-sdk-ts/pull/911) [`5cd464c`](https://github.com/LedgerHQ/device-sdk-ts/commit/5cd464c3a5c897c3a3a6000c1d8d5cbae6562e45) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Polish TransactionInspector

### Patch Changes

- Updated dependencies [[`a3ba9e5`](https://github.com/LedgerHQ/device-sdk-ts/commit/a3ba9e5b40a437669b32a00bc6150231c04381c3), [`62486e7`](https://github.com/LedgerHQ/device-sdk-ts/commit/62486e7c92998afd0831f19192c8a8dd1bb8d10e), [`23f08d8`](https://github.com/LedgerHQ/device-sdk-ts/commit/23f08d8e4947d34ce839238628590b0431b07b5e), [`090a3ab`](https://github.com/LedgerHQ/device-sdk-ts/commit/090a3ab350f3341b4222971a003738836e635e28), [`efac23f`](https://github.com/LedgerHQ/device-sdk-ts/commit/efac23fc8164d23d27713f30e40e575693d536d4), [`f4d73bf`](https://github.com/LedgerHQ/device-sdk-ts/commit/f4d73bf3dd94327fa5d8469cd7a981a7595bc0ca), [`5c1178c`](https://github.com/LedgerHQ/device-sdk-ts/commit/5c1178cb1e191d1c98bea352879da01e11762612), [`b164403`](https://github.com/LedgerHQ/device-sdk-ts/commit/b16440340617576b0fe4e0db9d8d345a7f37e5cd), [`2a047a8`](https://github.com/LedgerHQ/device-sdk-ts/commit/2a047a8c2eb23a6c3833eeb42e35a43f902f9a8a), [`40bfafc`](https://github.com/LedgerHQ/device-sdk-ts/commit/40bfafcb467723c1364b149e336bc7450d8cf376), [`0df32be`](https://github.com/LedgerHQ/device-sdk-ts/commit/0df32bef22cbfab7bfde2ee5341225b19147543f), [`d090358`](https://github.com/LedgerHQ/device-sdk-ts/commit/d0903582af8a6f0a2df35dcef7b457f3f730a0f4), [`265e902`](https://github.com/LedgerHQ/device-sdk-ts/commit/265e902f22cb647a2dd5ea2e5b789480afd2bd17), [`f1c1949`](https://github.com/LedgerHQ/device-sdk-ts/commit/f1c1949d288cee1369a34978c6e13b1be99e8712), [`ccbf2ef`](https://github.com/LedgerHQ/device-sdk-ts/commit/ccbf2ef37d5d8831711f5e995d25d4697cf250ab)]:
  - @ledgerhq/context-module@2.0.0
  - @ledgerhq/device-management-kit@0.8.0
  - @ledgerhq/signer-utils@2.0.0

## 1.1.1

### Patch Changes

- [#649](https://github.com/LedgerHQ/device-sdk-ts/pull/649) [`1364525`](https://github.com/LedgerHQ/device-sdk-ts/commit/1364525e1092b69700e83819d00df1222dc32dc1) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Factorize device actions calling a task in an app

- [#663](https://github.com/LedgerHQ/device-sdk-ts/pull/663) [`5c4a2d6`](https://github.com/LedgerHQ/device-sdk-ts/commit/5c4a2d624a4196f62051514ec211dca4c618023e) Thanks [@jiyuzhuang](https://github.com/jiyuzhuang)! - Add sendApdu in internal API interface

- [#828](https://github.com/LedgerHQ/device-sdk-ts/pull/828) [`f7e2ad2`](https://github.com/LedgerHQ/device-sdk-ts/commit/f7e2ad2ea1267ab0d868a0c353e21832b0c659f4) Thanks [@paoun-ledger](https://github.com/paoun-ledger)! - Allow to skip opening the application

- [#700](https://github.com/LedgerHQ/device-sdk-ts/pull/700) [`61b17b3`](https://github.com/LedgerHQ/device-sdk-ts/commit/61b17b3df1946b0f3f9370d7bacc243fdfd7880c) Thanks [@valpinkman](https://github.com/valpinkman)! - Update internalApi interface

## 1.1.0

### Patch Changes

- [#626](https://github.com/LedgerHQ/device-sdk-ts/pull/626) [`22d1ec0`](https://github.com/LedgerHQ/device-sdk-ts/commit/22d1ec0298a51aab4ee1e5de14e4d87f00cdc04d) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Improve error handling

- [#627](https://github.com/LedgerHQ/device-sdk-ts/pull/627) [`dc52c78`](https://github.com/LedgerHQ/device-sdk-ts/commit/dc52c78231d9bd51f5549d51df84731df216e79e) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Polish readme

- [#540](https://github.com/LedgerHQ/device-sdk-ts/pull/540) [`8ca777b`](https://github.com/LedgerHQ/device-sdk-ts/commit/8ca777b1ccc835d4922efcbaeff0d32882914eb2) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Remove debug logs

- Updated dependencies [[`a7984cd`](https://github.com/LedgerHQ/device-sdk-ts/commit/a7984cdcbd8e18aec614d6f07fda293971bd61eb), [`a00e30c`](https://github.com/LedgerHQ/device-sdk-ts/commit/a00e30cc1559d364a4654668a6492945de1163f5), [`a56740a`](https://github.com/LedgerHQ/device-sdk-ts/commit/a56740a608dc95ab3545d90666c71aeff2f67212), [`1bf2166`](https://github.com/LedgerHQ/device-sdk-ts/commit/1bf2166776ed16c2adf8a4d9d796a567629f983b), [`8f6907a`](https://github.com/LedgerHQ/device-sdk-ts/commit/8f6907a9fd99546d88520f2d167485ef59f8ca2e), [`df4ef37`](https://github.com/LedgerHQ/device-sdk-ts/commit/df4ef37d39a2e214a06930b7ff3c09cf22befb7f), [`1153a78`](https://github.com/LedgerHQ/device-sdk-ts/commit/1153a78b1b56f1767dae380466a8bc7fd86fec73), [`eafad9e`](https://github.com/LedgerHQ/device-sdk-ts/commit/eafad9e1b39573ad3321413b7adaa0814245da96), [`cc342e5`](https://github.com/LedgerHQ/device-sdk-ts/commit/cc342e5335ef1bc91b82967f6f59808796f88b36), [`8799e83`](https://github.com/LedgerHQ/device-sdk-ts/commit/8799e83c92baeb5ccba53546a3d59867d3d6185c)]:
  - @ledgerhq/device-management-kit@0.6.0
  - @ledgerhq/signer-utils@1.0.3

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @ledgerhq/device-management-kit@0.5.1
  - @ledgerhq/signer-utils@1.0.2

## 1.0.0

### Minor Changes

- [#441](https://github.com/LedgerHQ/device-sdk-ts/pull/441) [`7dc299f`](https://github.com/LedgerHQ/device-sdk-ts/commit/7dc299ffff00e970ca2934fb4e69687c5a7de5ae) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add GetPubKey command

- [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40) Thanks [@valpinkman](https://github.com/valpinkman)! - Add solana getAppConfiguration use case

- [#442](https://github.com/LedgerHQ/device-sdk-ts/pull/442) [`85c3d9a`](https://github.com/LedgerHQ/device-sdk-ts/commit/85c3d9a29ba5332247477ce1f7460f4db96688ac) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add DefaultSignerSolana and SolanaAppBinder

- [#451](https://github.com/LedgerHQ/device-sdk-ts/pull/451) [`c11b4b8`](https://github.com/LedgerHQ/device-sdk-ts/commit/c11b4b8cc793f2af70dde4eb0265939e758d0271) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add GetAddressUseCase

- [#489](https://github.com/LedgerHQ/device-sdk-ts/pull/489) [`d9b50a2`](https://github.com/LedgerHQ/device-sdk-ts/commit/d9b50a28e406046d60ccda9c0ae1f217ce7892a1) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add SignTransaction usecase

- [#439](https://github.com/LedgerHQ/device-sdk-ts/pull/439) [`ec81d50`](https://github.com/LedgerHQ/device-sdk-ts/commit/ec81d50bb671ad2616ff3c6e32fe7cecc6c2c988) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add SignerSolana interface and models

### Patch Changes

- [#460](https://github.com/LedgerHQ/device-sdk-ts/pull/460) [`6acddca`](https://github.com/LedgerHQ/device-sdk-ts/commit/6acddca516f1fe3d0b95c31b717e9f59b29e762e) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Rename keyring to signer

- [#449](https://github.com/LedgerHQ/device-sdk-ts/pull/449) [`a598a71`](https://github.com/LedgerHQ/device-sdk-ts/commit/a598a71fc5cc1c5850672632cd95733130cec5db) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Added getAppConfigurationCommand in solana-signer

- [#459](https://github.com/LedgerHQ/device-sdk-ts/pull/459) [`35706ec`](https://github.com/LedgerHQ/device-sdk-ts/commit/35706ec654f8cb6ad3ae5b765c065da9bd074f50) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Add solana SignDataTask and utils

- [#495](https://github.com/LedgerHQ/device-sdk-ts/pull/495) [`3557142`](https://github.com/LedgerHQ/device-sdk-ts/commit/3557142c6e5ebebd8643b93c118bc6591e28154f) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Added custom Solana errors

- [#453](https://github.com/LedgerHQ/device-sdk-ts/pull/453) [`a23980f`](https://github.com/LedgerHQ/device-sdk-ts/commit/a23980f8746f7a804b59e0122b5e92ebf0336ef1) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add SignTransaction Command

- [#460](https://github.com/LedgerHQ/device-sdk-ts/pull/460) [`a99fe1b`](https://github.com/LedgerHQ/device-sdk-ts/commit/a99fe1bfd362b6b5f9e8ee2489d285766e06272a) Thanks [@jdabbech-ledger](https://github.com/jdabbech-ledger)! - Rename SDK to DMK

- [#500](https://github.com/LedgerHQ/device-sdk-ts/pull/500) [`4995a57`](https://github.com/LedgerHQ/device-sdk-ts/commit/4995a57598f6e599d548dc657ebc5ee8c74a320b) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Update documentation

- [#455](https://github.com/LedgerHQ/device-sdk-ts/pull/455) [`6394fc9`](https://github.com/LedgerHQ/device-sdk-ts/commit/6394fc9f502fd2f292b5e9c75605b835dd399b26) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Added SignOffChainMsg

- [#467](https://github.com/LedgerHQ/device-sdk-ts/pull/467) [`925cb91`](https://github.com/LedgerHQ/device-sdk-ts/commit/925cb911297c85ac56d45cdbe0cd4f7e72c2234d) Thanks [@fAnselmi-Ledger](https://github.com/fAnselmi-Ledger)! - Added Solana SignMessageUseCase

- Updated dependencies [[`d6273ed`](https://github.com/LedgerHQ/device-sdk-ts/commit/d6273ed00b61d273ebc42bd5dfa16ce4c5641af5), [`123bec8`](https://github.com/LedgerHQ/device-sdk-ts/commit/123bec87ebd6c23922138c44a397bc72919d88e5), [`64e8886`](https://github.com/LedgerHQ/device-sdk-ts/commit/64e88863fd93c7140c32be5c91fde231293be7be), [`a99fe1b`](https://github.com/LedgerHQ/device-sdk-ts/commit/a99fe1bfd362b6b5f9e8ee2489d285766e06272a), [`55d62f2`](https://github.com/LedgerHQ/device-sdk-ts/commit/55d62f2dfe9cd979c99fbc8f8aeed7909c653807), [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40), [`afaeb64`](https://github.com/LedgerHQ/device-sdk-ts/commit/afaeb64c1fd2643d74ea8a2cc541c450d78c470c), [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40), [`9c2daf9`](https://github.com/LedgerHQ/device-sdk-ts/commit/9c2daf90391d5219cfa0f98e500a6f2e1295b454), [`5085f6d`](https://github.com/LedgerHQ/device-sdk-ts/commit/5085f6dd397b5800849e34f593e71fd9c61c0e40), [`629900d`](https://github.com/LedgerHQ/device-sdk-ts/commit/629900d681acdc4398445d4167a70811d041dad4), [`bd19f5c`](https://github.com/LedgerHQ/device-sdk-ts/commit/bd19f5c27f5a74dc9d58bd25fb021a260ff5e602)]:
  - @ledgerhq/device-management-kit@0.4.1
  - @ledgerhq/signer-utils@1.0.1
