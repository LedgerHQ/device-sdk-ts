# 2. Overall

The application scope is to replace what is untold in the EIP-712 message action order.

| **Function / user order**                           | **Technical action type**                                                                                  | **Remarque** |
| ---                                                | ---                                                                                                        | --- |
| Market order (Open)                                | order (`limit` kind with asset mid price for `p`) + updateLeverage                                        |  |
| Limit order (Open)                                 | order (`limit` kind with custom asset price for `p`) + updateLeverage                                     |  |
| Take Profit (TP)                                   | order or modify (`trigger` kind)                                                                          |  |
| Stop Loss (SL)                                     | order or modify (`trigger`kind)                                                                           |  |
| Close                                              | //TODO `reduceOnly` true?                                                                                 |  |
| Update (for Leverage, TP, SL, Limit order)         | Either: * updateLeverage<br/>* modify (`trigger` kind) with `tpsl` property set<br/>* modify (`limit` kind) |  |
| Approve Builder Fee                                | approveBuilderFee                                                                                          |  |
| Withdraw                                           | withdraw                                                                                                   | AppEth scope |

Example of EIP-712 message for HyperLiquid action order:

```json
{
  "domain": {
    "name": "Exchange",
    "version": "1",
    "chainId": 1337,
    "verifyingContract": "0x0000000000000000000000000000000000000000"
  },
  "types": {
    "Agent": [
      {
        "name": "source",
        "type": "string"
      },
      {
        "name": "connectionId",
        "type": "bytes32"
      }
    ]
  },
  "primaryType": "Agent",
  "message": {
    "source": "a",
    "connectionId": "0xae4a184245ec31d2952846ff956b52419e7ac1ef820349550a7424eb3909ec7f"
  }
}

# 3. App Requirement

## APDUs

### Set action to sign

#### APDU description
This is the user action that will be signed

| **CLA** | **INS** | **P1** | **P2** | **Data Length** | **Data** |
| --- | --- | --- | --- | --- | --- |
| 0x0E | 0x03 | 0x00 | 0x00 | var | var |

#### Data fields

| **Field** | **Tag** | **Length** | **Type** | **Description** |
| --- | --- | --- | --- | --- |
| structure_type | 0x01 - STRUCTURE_TYPE |  | **required** u8 | value: 0x2c |
| version | 0x02 - VERSION |  | **required** u8 | value: 0x01 |
| action_type | 0xd0 - ACTION_TYPE | 1 | **required** u8 | One of: * order: 0x00<br/>* modify: 0x01<br/>* cancel: 0x02<br/>* updateLeverage: 0x03<br/>* approvalBuilderFee: 0x04 |
| nonce | 0xda - NONCE | var | **required** number | Use for generating the `connectionId` |
| action_structure | 0xdb - ACTION_STRUCTURE | var |  | create_order / update_order / cancel_order / leverage / approveBuilderFee — Depending on `action_type` the described action has a specific structure. |

#### Action structure — create_order

| **Field** | **Tag** | **Length** | **Type** | **Description** |
| --- | --- | --- | --- | --- |
| order | 0xdd - ORDER | var | **required** order |  |
| grouping | 0xea -  |  | **required** u8 | one Of: * "na": 0x00<br/>* “normalTpsl”: 0x01<br/>* “positionTpsl”: 0x02 |
| builder_address | 0xeb - BUILDER_ADDRESS |  | byte[] | Address |
| builder_fee | 0xec -  |  | number |  |

#### Action structure — update_order

| **Field** | **Tag** | **Length** | **Type** | **Description** |
| --- | --- | --- | --- | --- |
| order | 0xdd - ORDER | var | **required** order |  |
| oid | 0xdc - ORDER_ID | var | **required** number |  |

#### Action structure — cancel_order

| **Field** | **Tag** | **Length** | **Type** | **Description** |
| --- | --- | --- | --- | --- |
| asset_id | 0xd1 - ASSET_ID | var | **required** number |  |
| oid | 0xdc - ORDER_ID | var | **required** number |  |

#### Action structure — leverage

| **Field** | **Tag** | **Length** | **Type** | **Description** |
| --- | --- | --- | --- | --- |
| asset_id | 0xd1 - ASSET_ID | var | **required** number |  |
| is_cross | 0xde - IS_CROSS | 1 | **required** boolean |  |
| leverage | 0xed - LEVERAGE | var | **required** number |  |

#### Order structure

| **Field** | **Tag** | **Length** | **Type** | **Description** |
| --- | --- | --- | --- | --- |
| order_type | 0xe0 - ORDER_TYPE | 1 | **required** u8 | One of: * limit: 0x00<br/>* trigger: 0x01 |
| asset_id | 0xe1 - ASSET_ID |  | **required** byte | Asset id in HyperLiquid `meta.universe` field (index) |
| buy_or_not | 0xe2 - BUY_OR_NOT | 1 | **required** boolean | 1 = true, 0 = false |
| price | 0xe3 - PRICE |  | **required** |  |
| size | 0xe4 - SIZE |  | **required** |  |
| reduce_only | 0xe5 - REDUCE_ONLY | 1 | **required** boolean | 1 = true, 0 = false |
| tif | 0xe6 - TIF | 1 | u8 | One of: * "ALO": “Add Liquidity Only”: 0x00<br/>* "IOC": “Immediate On Cancel”: 0x01<br/>* "GTC": “Good Til Cancel”: 0x02 |
| trigger_market | 0xe7 - TRIGGER_MARKET | 1 | boolean | 1 = true, 0 = false |
| trigger_price | 0xe8 - TRIGGER_PRICE |  | string |  |
| trigger_type | 0xe9 - TRIGGER_TYPE | 1 | u8 | One of: * TP: Take Profit: 0x00<br/>* SL: Stop Loss: 0x01 |