# Ledger Bitcoin Legacy Signer Implementation

This module provides the implementation of the Ledger signer of the Device Management Kit for the apps on the legacy Bitcoin protocol (CLA `0xE0`), such as Litecoin, Dogecoin or Bitcoin Cash. Each coin is a profile of this kit: its app name and its error map.

It also exports its inversify module (`btcLegacyModuleFactory`), its tokens (`btcLegacyTypes`) and its services, for the signer kits built on the same protocol, such as `@ledgerhq/device-signer-kit-zcash`.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-bitcoin-legacy
```

## Usage

```typescript
import {
  LITECOIN_PROFILE,
  SignerBtcLegacyBuilder,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";

const signer = new SignerBtcLegacyBuilder({
  dmk,
  sessionId,
  profile: LITECOIN_PROFILE,
}).build();

const { observable, cancel } = signer.getAddress("84'/2'/0'/0/0", {
  checkOnDevice: true,
  addressFormat: "bech32",
});
```

`getAddress` options:

- `checkOnDevice`: display the address on the device for the user to verify. Defaults to `false`.
- `skipOpenApp`: do not open the app before sending the command. Defaults to `false`.
- `addressFormat`: `legacy`, `p2sh`, `bech32` or `cashaddr`. Defaults to `legacy`.

The output holds the `publicKey`, the `address` and the `chainCode`.

### Extended public key

```typescript
const { observable, cancel } = signer.getExtendedPublicKey("84'/2'/0'");
```

The legacy protocol has no command for it: the kit reads the account key and its parent's key with two get address calls, then builds the BIP32 extended key with the profile's `xpubVersion`, as Ledger Wallet does with hw-app-btc. The path needs at least two levels. The output holds the `extendedPublicKey`.

`getExtendedPublicKey` options:

- `skipOpenApp`: do not open the app before sending the commands. Defaults to `false`.

### Transaction

```typescript
const { observable, cancel } = signer.signTransaction({
  inputs: [[previousTransaction, outputIndex, null, sequence]],
  associatedKeysets: ["44'/2'/0'/0/0"],
  changePath: "44'/2'/0'/1/0",
  outputScriptHex,
  lockTime: 0,
});
```

The argument has the shape of hw-app-btc's `createPaymentTransaction` argument, with `Uint8Array`s instead of `Buffer`s:

- `inputs`: for each input, the previous transaction (`version`, `inputs`, `outputs` and `locktime`), the index of the spent output, an optional redeem script in hexadecimal, and an optional sequence (defaults to `0xffffffff`). As in hw-app-btc, the redeem script is only hashed: the signed input script holds the signature and the public key, so P2SH inputs are not supported.
- `associatedKeysets`: the derivation path of each input's key.
- `changePath`: the derivation path of the change output, if any.
- `outputScriptHex`: the serialized outputs, count included.
- `lockTime`: defaults to `0`. `sigHashType`: defaults to `SIGHASH_ALL`.
- `segwit`: the inputs spend SegWit outputs and are signed with BIP143. They are native with `"bech32"` in `additionals`, P2SH-wrapped otherwise.
- `additionals`: hw-app-btc's flags. The kit reads `"bech32"` and ignores the others.

Transactions are in the `standard` format of Litecoin (`LITECOIN_PROFILE`) and Dogecoin (`DOGECOIN_PROFILE`). The output is the signed transaction in hexadecimal.

`signTransaction` options:

- `skipOpenApp`: do not open the app before sending the commands. Defaults to `false`.

The trusted input and signing tasks are services of the module (`btcLegacyTypes.GetTrustedInputTask`, `btcLegacyTypes.SignTransactionTask`). Their format steps are hooks behind `btcLegacyTypes.TrustedInputSerializer` and `btcLegacyTypes.TransactionSerializer`, bound to the `standard` format: a kit on another format rebinds them in its container.
