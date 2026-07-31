# Signer hyperliquid

This package provides a signer implementation for hyperliquid.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-hyperliquid
```

## Usage

```typescript
import { SignerHyperliquidBuilder } from "@ledgerhq/device-signer-kit-hyperliquid";

const signer = new SignerHyperliquidBuilder({ dmk, sessionId }).build();

// Sign transaction
const signature = await signer.signActions({
  derivationPath: "m/44'/0'/0'/0/0",
  certificate,
  signedMetadata,
  actions,
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
```

## Manual test through sample app

Three kind of values are required:

- certificate: which is the perps' provider own certificate
- signedMetadata: extra order info to complete the info to display, signed by the provider
- actions

The [specification](https://ledgerhq.atlassian.net/wiki/spaces/BI/pages/6753845341/HyperLiquid+-+AppDevice) for the format used for all three information gives more details.

### Simple order

```json
[
  {
    "type": "order",
    "orders": [
      {
        "a": 1,
        "b": true,
        "p": "1978.8",
        "s": "0.5154",
        "r": false,
        "t": { "limit": { "tif": "Ioc" } }
      }
    ],
    "grouping": "na",
    "builder": { "b": "0xc0708cdd6cd166d51da264e3f49a0422be26e35b", "f": 100 },
    "nonce": 1772440978177
  }
]
```

### Order with a builder fee

```json
[
  {
    "type": "approveBuilderFee",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "maxFeeRate": "0.1000%",
    "builder": "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
    "nonce": 1772440978175
  },
  {
    "type": "updateLeverage",
    "asset": 1,
    "isCross": false,
    "leverage": 10,
    "nonce": 1772440978176
  },
  {
    "type": "order",
    "orders": [
      {
        "a": 1,
        "b": true,
        "p": "1978.8",
        "s": "0.5154",
        "r": false,
        "t": { "limit": { "tif": "Ioc" } }
      }
    ],
    "grouping": "na",
    "builder": { "b": "0xc0708cdd6cd166d51da264e3f49a0422be26e35b", "f": 100 },
    "nonce": 1772440978177
  }
]
```

### Order with a builder fee and an option cloid

```json
[
  {
    "type": "approveBuilderFee",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "maxFeeRate": "0.1000%",
    "builder": "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
    "nonce": 1772440978175
  },
  {
    "type": "updateLeverage",
    "asset": 1,
    "isCross": false,
    "leverage": 10,
    "nonce": 1772440978176
  },
  {
    "type": "order",
    "orders": [
      {
        "a": 1,
        "b": true,
        "p": "1978.8",
        "s": "0.5154",
        "r": false,
        "t": { "limit": { "tif": "Ioc" } },
        "c": "0x278da11ed9db4f9cadb8b331488980a5"
      }
    ],
    "grouping": "na",
    "builder": { "b": "0xc0708cdd6cd166d51da264e3f49a0422be26e35b", "f": 100 },
    "nonce": 1772440978177
  }
]
```

### Order with a builder fee and a set account abstraction

You need to set up with your Ethereum account address as the `user` property value.

```json
[{"type":"approveBuilderFee","hyperliquidChain":"Mainnet","signatureChainId":"0xa4b1","maxFeeRate":"0.1000%","builder":"0xc0708cdd6cd166d51da264e3f49a0422be26e35b","nonce":1772440978175},{"type": "userSetAbstraction","hyperliquidChain":"Mainnet","signatureChainId":"0xa4b1","user":<USER_ADDRESS>,"abstraction":"unifiedAccount","nonce":5},{"type":"updateLeverage","asset":1,"isCross":false,"leverage":10,"nonce":1772440978176},{"type":"order","orders":[{"a":1,"b":true,"p":"1978.8","s":"0.5154","r":false,"t":{"limit":{"tif":"Ioc"}}}],"grouping":"na","builder":{"b":"0xc0708cdd6cd166d51da264e3f49a0422be26e35b","f":100},"nonce":1772440978177}]
```

Example:

```json
[
  {
    "type": "approveBuilderFee",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "maxFeeRate": "0.1000%",
    "builder": "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
    "nonce": 1772440978175
  },
  {
    "type": "userSetAbstraction",
    "hyperliquidChain": "Mainnet",
    "signatureChainId": "0xa4b1",
    "user": "0xda45a4b1731fe99c66e8c5d24da51decbbc569b0",
    "abstraction": "unifiedAccount",
    "nonce": 5
  },
  {
    "type": "updateLeverage",
    "asset": 1,
    "isCross": false,
    "leverage": 10,
    "nonce": 1772440978176
  },
  {
    "type": "order",
    "orders": [
      {
        "a": 1,
        "b": true,
        "p": "1978.8",
        "s": "0.5154",
        "r": false,
        "t": { "limit": { "tif": "Ioc" } }
      }
    ],
    "grouping": "na",
    "builder": { "b": "0xc0708cdd6cd166d51da264e3f49a0422be26e35b", "f": 100 },
    "nonce": 1772440978177
  }
]
```
