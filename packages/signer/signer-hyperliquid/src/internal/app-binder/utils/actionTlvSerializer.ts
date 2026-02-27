import {
  ByteArrayBuilder,
  type HexaString,
} from "@ledgerhq/device-management-kit";

/**
 * TLV tags for "Set action to sign" (specs.md § Set action to sign).
 */
export const TLV_TAG = {
  STRUCTURE_TYPE: 0x01,
  VERSION: 0x02,
  ACTION_TYPE: 0xd0,
  ASSET_ID: 0xd1,
  NONCE: 0xda,
  ACTION_STRUCTURE: 0xdb,
  ORDER_ID: 0xdc,
  ORDER: 0xdd,
  IS_CROSS: 0xde,
  ORDER_TYPE: 0xe0,
  ORDER_ASSET_ID: 0xe1,
  BUY_OR_NOT: 0xe2,
  PRICE: 0xe3,
  SIZE: 0xe4,
  REDUCE_ONLY: 0xe5,
  TIF: 0xe6,
  TRIGGER_MARKET: 0xe7,
  TRIGGER_PRICE: 0xe8,
  TRIGGER_TYPE: 0xe9,
  GROUPING: 0xea,
  BUILDER_ADDRESS: 0xeb,
  BUILDER_FEE: 0xec,
  LEVERAGE: 0xed,
} as const;

/** Required structure_type value per specs */
export const STRUCTURE_TYPE_VALUE = 0x2c;

/** Required version value per specs */
export const VERSION_VALUE = 0x01;

/** action_type enum: order, modify, cancel, updateLeverage, approvalBuilderFee */
export const ACTION_TYPE = {
  ORDER: 0x00,
  MODIFY: 0x01,
  CANCEL: 0x02,
  UPDATE_LEVERAGE: 0x03,
  APPROVAL_BUILDER_FEE: 0x04,
} as const;

/** order_type: limit, trigger (specs Order structure) */
const ORDER_TYPE = {
  LIMIT: 0x00,
  TRIGGER: 0x01,
} as const;

/** TIF: ALO, IOC, GTC (specs) */
const TIF = {
  ALO: 0x00,
  IOC: 0x01,
  GTC: 0x02,
} as const;

/** trigger_type: TP, SL (specs) */
const TRIGGER_TYPE = {
  TP: 0x00,
  SL: 0x01,
} as const;

/** grouping (specs create_order) */
const GROUPING = {
  NA: 0x00,
  NORMAL_TPSL: 0x01,
  POSITION_TPSL: 0x02,
} as const;

export type ActionTypeValue = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE];

/**
 * One action to send to the device. The task will serialize it to TLV
 * and send it via SendActionCommand.
 * Serialization follows specs.md "Set action to sign" (create_order / update_order / cancel_order / leverage / approveBuilderFee).
 */
export type HyperliquidAction =
  | {
      readonly type: "order";
      orders: Order[];
      grouping: "na" | "normalTpsl" | "positionTpsl";
      builder?: {
        b: HexaString;
        f: number;
      };
      nonce: number;
    }
  | {
      type: "modify";
      modifies: {
        oid: number;
        order: Order;
      }[];
      nonce: number;
    }
  | {
      type: "cancel";
      cancels: {
        asset: number; // asset id
        oid: number; // oid
      }[];
      nonce: number;
    }
  | {
      type: "updateLeverage";
      asset: number; // index of coin
      isCross: boolean; // cross-leverage
      leverage: number;
      nonce: number;
    }
  | {
      type: "approveBuilderFee";
      hyperLiquidChain: "Mainnet" | "Testnet";
      signatureChainId: string; // chainId in hex format. Ex: 0xa4b1 for Arbitrum
      maxFeeRate: string;
      builder: HexaString;
      nonce: number;
    };
type Order = {
  a: number; // Asset
  b: boolean; // buy: true, sell: false
  p: string; // Price in USDC
  s: string; // Size is the price in coin/token unit
  r: boolean; // reduceOnly
  t:
    | {
        limit: {
          tif: "Alo" | "Ioc" | "Gtc";
        };
      }
    | {
        trigger: {
          isMarket: boolean;
          triggerPx: string;
          tpsl: "tp" | "sl";
        };
      }; // Type
};

function getActionTypeByte(action: HyperliquidAction): number {
  switch (action.type) {
    case "order":
      return ACTION_TYPE.ORDER;
    case "modify":
      return ACTION_TYPE.MODIFY;
    case "cancel":
      return ACTION_TYPE.CANCEL;
    case "updateLeverage":
      return ACTION_TYPE.UPDATE_LEVERAGE;
    case "approveBuilderFee":
      return ACTION_TYPE.APPROVAL_BUILDER_FEE;
    default:
      throw new Error(
        `Unknown action type: ${(action as HyperliquidAction).type}`,
      );
  }
}

function tifToByte(tif: "Alo" | "Ioc" | "Gtc"): number {
  switch (tif) {
    case "Alo":
      return TIF.ALO;
    case "Ioc":
      return TIF.IOC;
    case "Gtc":
      return TIF.GTC;
    default:
      return TIF.GTC;
  }
}

function groupingToByte(g: "na" | "normalTpsl" | "positionTpsl"): number {
  switch (g) {
    case "na":
      return GROUPING.NA;
    case "normalTpsl":
      return GROUPING.NORMAL_TPSL;
    case "positionTpsl":
      return GROUPING.POSITION_TPSL;
    default:
      return GROUPING.NA;
  }
}

/**
 * Encode a non-negative integer as 1–8 bytes big-endian (minimal length).
 * 0 → 1 byte (0x00), 1..255 → 1 byte, 256..65535 → 2 bytes, etc.
 */
function numberToVarBytes(value: number, maxBytes: number = 8): Uint8Array {
  if (value < 0 || !Number.isInteger(value)) {
    throw new Error(`Expected non-negative integer, got ${value}`);
  }
  const big = BigInt(value);
  if (big > 0xffffffffffffffffn) {
    throw new Error(`Value ${value} exceeds u64 range`);
  }
  if (big === 0n) {
    return new Uint8Array([0]);
  }
  const bytes: number[] = [];
  let n = big;
  while (n > 0n && bytes.length < maxBytes) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  return new Uint8Array(bytes);
}

/** Append a TLV field with variable-length number (tag + length 1..8 + value bytes). */
function encodeTlvVarNumber(
  builder: ByteArrayBuilder,
  tag: number,
  value: number,
  maxBytes: number = 8,
): void {
  const bytes = numberToVarBytes(value, maxBytes);
  builder.add8BitUIntToData(tag);
  builder.add8BitUIntToData(bytes.length);
  builder.addBufferToData(bytes);
}

/** Serialize a single Order to TLV (specs Order structure: 0xe0–0xe9). */
function serializeOrderToTlv(order: Order): Uint8Array {
  const b = new ByteArrayBuilder();
  const isLimit = "limit" in order.t;
  const orderType = order.t;

  // 0xe0 ORDER_TYPE: limit 0x00, trigger 0x01
  b.encodeInTLVFromUInt8(
    TLV_TAG.ORDER_TYPE,
    isLimit ? ORDER_TYPE.LIMIT : ORDER_TYPE.TRIGGER,
  );
  // 0xe1 ASSET_ID (var number: 1–8 bytes)
  encodeTlvVarNumber(b, TLV_TAG.ORDER_ASSET_ID, order.a);
  // 0xe2 BUY_OR_NOT: 1 byte boolean
  b.encodeInTLVFromUInt8(TLV_TAG.BUY_OR_NOT, order.b ? 1 : 0);
  // 0xe3 PRICE, 0xe4 SIZE
  b.encodeInTLVFromAscii(TLV_TAG.PRICE, order.p);
  b.encodeInTLVFromAscii(TLV_TAG.SIZE, order.s);
  // 0xe5 REDUCE_ONLY
  b.encodeInTLVFromUInt8(TLV_TAG.REDUCE_ONLY, order.r ? 1 : 0);

  if (isLimit && "limit" in orderType) {
    b.encodeInTLVFromUInt8(TLV_TAG.TIF, tifToByte(orderType.limit.tif));
  } else if ("trigger" in orderType) {
    b.encodeInTLVFromUInt8(
      TLV_TAG.TRIGGER_MARKET,
      orderType.trigger.isMarket ? 1 : 0,
    );
    b.encodeInTLVFromAscii(TLV_TAG.TRIGGER_PRICE, orderType.trigger.triggerPx);
    b.encodeInTLVFromUInt8(
      TLV_TAG.TRIGGER_TYPE,
      orderType.trigger.tpsl === "tp" ? TRIGGER_TYPE.TP : TRIGGER_TYPE.SL,
    );
  }

  return b.build();
}

/** Build action_structure (value for tag 0xdb) per specs create_order / update_order / cancel_order / leverage. */
function buildActionStructure(action: HyperliquidAction): Uint8Array {
  const b = new ByteArrayBuilder();

  switch (action.type) {
    case "order": {
      // create_order: order (0xdd), grouping (0xea), optional builder_address (0xeb), builder_fee (0xec)
      const order = action.orders[0];
      if (!order) throw new Error("order action must have at least one order");
      const orderPayload = serializeOrderToTlv(order);
      b.encodeInTLVFromBuffer(TLV_TAG.ORDER, orderPayload);
      b.encodeInTLVFromUInt8(TLV_TAG.GROUPING, groupingToByte(action.grouping));
      if (action.builder !== undefined) {
        b.encodeInTLVFromHexa(TLV_TAG.BUILDER_ADDRESS, action.builder.b);
        encodeTlvVarNumber(b, TLV_TAG.BUILDER_FEE, action.builder.f);
      }
      break;
    }
    case "modify": {
      // update_order: order (0xdd), oid (0xdc)
      const mod = action.modifies[0];
      if (!mod) throw new Error("modify action must have at least one modify");
      b.encodeInTLVFromBuffer(TLV_TAG.ORDER, serializeOrderToTlv(mod.order));
      b.encodeInTLVFromUInt64(TLV_TAG.ORDER_ID, mod.oid, true);
      break;
    }
    case "cancel": {
      // cancel_order: asset_id (0xd1), oid (0xdc)
      const cancel = action.cancels[0];
      if (!cancel)
        throw new Error("cancel action must have at least one cancel");
      b.encodeInTLVFromUInt64(TLV_TAG.ASSET_ID, cancel.asset, true);
      b.encodeInTLVFromUInt64(TLV_TAG.ORDER_ID, cancel.oid, true);
      break;
    }
    case "updateLeverage": {
      // leverage: asset_id (0xd1), is_cross (0xde), leverage (0xed)
      b.encodeInTLVFromUInt64(TLV_TAG.ASSET_ID, action.asset, true);
      b.encodeInTLVFromUInt8(TLV_TAG.IS_CROSS, action.isCross ? 1 : 0);
      b.encodeInTLVFromUInt64(TLV_TAG.LEVERAGE, action.leverage, true);
      break;
    }
    case "approveBuilderFee":
      // Specs do not define action_structure for approveBuilderFee; use empty.
      break;
    default:
      break;
  }

  return b.build();
}

/**
 * Serialize a single action to the TLV format defined in specs.md "Set action to sign".
 * Data fields: structure_type (0x01), version (0x02), action_type (0xd0), nonce (0xda), action_structure (0xdb).
 */
export function serializeActionToTlv(action: HyperliquidAction): Uint8Array {
  const builder = new ByteArrayBuilder();
  const actionTypeByte = getActionTypeByte(action);
  const actionStructure = buildActionStructure(action);

  // structure_type (0x01): required u8, value 0x2c
  builder
    .add8BitUIntToData(TLV_TAG.STRUCTURE_TYPE)
    .add8BitUIntToData(1)
    .add8BitUIntToData(STRUCTURE_TYPE_VALUE);

  // version (0x02): required u8, value 0x01
  builder
    .add8BitUIntToData(TLV_TAG.VERSION)
    .add8BitUIntToData(1)
    .add8BitUIntToData(VERSION_VALUE);

  // action_type (0xd0): 1 byte, required u8
  builder
    .add8BitUIntToData(TLV_TAG.ACTION_TYPE)
    .add8BitUIntToData(1)
    .add8BitUIntToData(actionTypeByte);

  // nonce (0xda): var, required number — 1–8 bytes
  encodeTlvVarNumber(builder, TLV_TAG.NONCE, action.nonce);

  // action_structure (0xdb): var
  builder.encodeInTLVFromBuffer(TLV_TAG.ACTION_STRUCTURE, actionStructure);

  return builder.build();
}
