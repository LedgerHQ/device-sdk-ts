# 001 - Unified Address

Date: 2026-07-22

## Status

Accepted

## Context
With the integration of HIP-3, the use of a “unified account” allows user to maintain a shared balance between different Hyperliquid features: perps, HIP-3, spot, …

```
⚠️ Hypothesis:

Yield API will be updated to include userSetAbstraction payload along builderFee one, during the create order process

If a userSetAbstraction action is asked to Ledger Wallet (i.e. DMK / Device App), the “unified” mode is the only one managed as it is silently validated by the user
```

```
⚠️ The use case where the user can update his account abstraction type on Hyperliquid directly or outside Ledger Wallet flow is not taking into account
```

### Analysis
To activate an unified account, the user need to sign a EIP-712 message:

```typescript
  {
    "primaryType": "HyperliquidTransaction:UserSetAbstraction",
    "domain": {
      "name": "HyperliquidSignTransaction",
      "version": "1",
      "chainId": 42161,
      "verifyingContract": "0x000...000"
    },
    "message": {
      "hyperliquidChain": "Mainnet",
      "user": "0x...",
      "abstraction": "unifiedAccount",
      "nonce": 1716531066415
    }
  }
```

The abstraction value can take one of the following value: disabled, unifiedAccountand portfolioMargin. The value must be set to unifiedAccount.

### Security concerns
The user value will never be passed as a value to the Device. The App will compute it as the user’s one.

We can add a check on the value passed for the abstractionas unifiedAccountto avoid user’s confusion.


## Decision
Adapt the current codebase to this new requirement

## Consequences

### Hyperliquid App
The app must embed a new EIP-712 template message (like the one for approveBuilderFee). The template is:

```typescript
{
  "domain": {
    "name": "HyperliquidSignTransaction",
    "version": "1",
    "chainId": 42161, // 42161 = Arbitrum One | 421614 = Abitrum Sepolia
    "verifyingContract": "0x0000000000000000000000000000000000000000"
  },
  "types": {
    "HyperliquidTransaction:UserSetAbstraction": [
      {"name": "hyperliquidChain", "type": "string"},
      {"name": "user",             "type": "address"},
      {"name": "abstraction",      "type": "string"},
      {"name": "nonce",            "type": "uint64"}
    ],
    "EIP712Domain": [
      {"name": "name",              "type": "string"},
      {"name": "version",           "type": "string"},
      {"name": "chainId",           "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ]
  },
  "primaryType": "HyperliquidTransaction:UserSetAbstraction",
  "message": {
    "hyperliquidChain": "Mainnet", // "Mainnet" | "Testnet"
    "user": "0x...", // User's address
    "abstraction": "unifiedAccount", // Hardcoded value to enforce unifiedAccount only
    "nonce": 1716531066415
  }
}
```

Like the approvalBuilderFee message, it doesn’t have to be displayed to the user.

#### ADPU
An update on the setAction APDU (INS = 0x03) ; the action_type can take a new value

| Field | Tag | Length | Type | Description |
| ----- | --- | ------ | ---- | ----------- |
| action_type | 0xd0 - ACTION_TYPE | 1 | required u8 | One of:<ul><li>order: 0x00</li><li>modify: 0x01</li><li>cancel: 0x02</li><li>updateLeverage: 0x03</li><li>approvalBuilderFee: 0x04</li><li>updateIsolatedMargin: 0x05</li><li>**userSetAbstraction: 0x06**</li></ul> |
| action_structure | 0xdb - ACTION_STRUCTURE | var | create_order|update_order|cancel_order|leverage|approveBuilderFee|updateIsolatedMargin|userSetAbstraction | Depending on action_type the describe action has a specific structure. |

The values associated to this new type, userSetAbstraction,  are:

| Field | Tag | Length | Type | Description |
| ----- | --- | ------ | ---- | ----------- |
| chain_id | 0x23 - CHAIN_ID | 8 | byte[] | Network identifier |
| abstraction | 0xee - ABSTRACTION | 1 | required u8 | One of:<ul><li>disabled: 0x00</li><li>unifiedAccount: 0x01</li><li>portfolioMargin: 0x02</li></ul> |

```
As there is no “user address” field in this APDU, the field user in the EIP-712 will need to be filled during the signature process, along with the derivation path parameters passed.
```

### Hyperliquid Signer
A new type of Action is possible: userSetAbstraction

Impact on type definition:

```typescript
  type Action = {
    ...
    } | {  // -- Previous type defined as an example --
      type: "approveBuilderFee";
      hyperLiquidChain: "Mainnet" | "Testnet";
      signatureChainId: string; // chainId in hex format. Ex: 0xa4b1 for Arbitrum
      maxFeeRate: string;
      builder: Address;
      nonce: number;
    } | {  // -- NEW type to defined --
      type: "userSetAbstraction";
      hyperLiquidChain: "Mainnet" | "Testnet";
      signatureChainId: string; // chainId in hex format. Ex: 0xa4b1 for Arbitrum
      user: Address;
      abstraction: "disabled" | "unifiedAccount" | "portfolioMargin";
      nonce: number;
    };
```

The actionTlvSerializer will need to be updated in order to marshalling this new action type correctly.

