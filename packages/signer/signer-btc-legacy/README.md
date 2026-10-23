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
