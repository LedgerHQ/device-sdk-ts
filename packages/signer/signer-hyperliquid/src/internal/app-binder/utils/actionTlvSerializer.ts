import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";

import type {
  HyperliquidAction,
  Order,
} from "@internal/app-binder/di/appBinderTypes";

const LONG_NUMBER_MAX_BYTES = 0x81 << 8;

/**
 * TLV tags for "Set action to sign" (specs.md § Set action to sign).
 */
export const TLV_TAG = {
  STRUCTURE_TYPE: 0x01,
  VERSION: 0x02,
  CHAIN_ID: 0x23,
  MAX_FEE: 0xb0,
  ACTION_TYPE: 0xd0,
  ASSET_ID: 0xd1,
  BUILDER_ADDRESS: 0xd3,
  NONCE: 0xda,
  ACTION_STRUCTURE: 0xdb,
  ORDER_ID: 0xdc,
  ORDER: 0xdd,
  IS_CROSS: 0xde,
  ORDER_TYPE: 0xe0,
  BUY_OR_NOT: 0xe2,
  PRICE: 0xe3,
  SIZE: 0xe4,
  REDUCE_ONLY: 0xe5,
  TIF: 0xe6,
  TRIGGER_MARKET: 0xe7,
  TRIGGER_PRICE: 0xe8,
  TRIGGER_TYPE: 0xe9,
  GROUPING: 0xea,
  BUILDER_INFO: 0xeb,
  BUILDER_FEE: 0xec,
  LEVERAGE: 0xed,
  UPDATE_ORDERS: 0xd8,
  CANCEL_ORDERS: 0xd9,
  ORDER_DETAIL: 0xd7,
  NTLI: 0xd6,
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
  UPDATE_ISOLATED_MARGIN: 0x05,
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

function getActionTypeByte(action: HyperliquidAction): number {
  switch (action.type) {
    case "order":
      return ACTION_TYPE.ORDER;
    case "modify":
    case "batchModify":
      return ACTION_TYPE.MODIFY;
    case "cancel":
      return ACTION_TYPE.CANCEL;
    case "updateLeverage":
      return ACTION_TYPE.UPDATE_LEVERAGE;
    case "approveBuilderFee":
      return ACTION_TYPE.APPROVAL_BUILDER_FEE;
    case "updateIsolatedMargin":
      return ACTION_TYPE.UPDATE_ISOLATED_MARGIN;
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
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Value ${value} is not a safe integer`);
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

/**
 * DER-encode a length value: short form for < 0x80, long form otherwise.
 * Matches the Ledger SDK's lib_tlv expectations.
 */
function encodeDerLength(builder: ByteArrayBuilder, length: number): void {
  if (length < 0x80) {
    builder.add8BitUIntToData(length);
  } else if (length <= 0xff) {
    builder.add8BitUIntToData(0x81);
    builder.add8BitUIntToData(length);
  } else {
    builder.add8BitUIntToData(0x82);
    builder.add16BitUIntToData(length);
  }
}

/** Append a TLV field with variable-length number (tag + length 1..8 + value bytes). */
function encodeTlvVarNumber(
  builder: ByteArrayBuilder,
  tag: number,
  value: number,
  maxBytes: number = 8,
): void {
  if (tag > 0x7f) {
    builder.add16BitUIntToData(LONG_NUMBER_MAX_BYTES + tag);
  } else {
    builder.add8BitUIntToData(tag);
  }
  const bytes = numberToVarBytes(value, maxBytes);
  builder.add8BitUIntToData(bytes.length);
  builder.addBufferToData(bytes);
}

function encodeInTlvFromUInt8(
  builder: ByteArrayBuilder,
  tag: number,
  value: number,
): void {
  if (tag > 0x7f) {
    builder.add16BitUIntToData(LONG_NUMBER_MAX_BYTES + tag);
  } else {
    builder.add8BitUIntToData(tag);
  }
  builder.add8BitUIntToData(1);
  builder.add8BitUIntToData(value);
}

function encodeInTlvFromUInt64(
  builder: ByteArrayBuilder,
  tag: number,
  value: number,
): void {
  if (tag > 0x7f) {
    builder.add16BitUIntToData(LONG_NUMBER_MAX_BYTES + tag);
  } else {
    builder.add8BitUIntToData(tag);
  }
  builder.add8BitUIntToData(8);
  builder.add64BitUIntToData(value);
}

function encodeInTlvFromAscii(
  builder: ByteArrayBuilder,
  tag: number,
  value: string,
): void {
  if (tag > 0x7f) {
    builder.add16BitUIntToData(LONG_NUMBER_MAX_BYTES + tag);
  } else {
    builder.add8BitUIntToData(tag);
  }
  const bytes = new TextEncoder().encode(value);
  encodeDerLength(builder, bytes.length);
  builder.addBufferToData(bytes);
}

function encodeInTlvFromBuffer(
  builder: ByteArrayBuilder,
  tag: number,
  value: Uint8Array,
): void {
  if (tag > 0x7f) {
    builder.add16BitUIntToData(LONG_NUMBER_MAX_BYTES + tag);
  } else {
    builder.add8BitUIntToData(tag);
  }
  encodeDerLength(builder, value.length);
  builder.addBufferToData(value);
}

/** Serialize a single Order to TLV (specs Order structure: 0xe0–0xe9). */
export function serializeOrderToTlv(order: Order): Uint8Array {
  const b = new ByteArrayBuilder();
  const isLimit = "limit" in order.t;
  const orderType = order.t;

  // 0xe0 ORDER_TYPE: limit 0x00, trigger 0x01
  encodeInTlvFromUInt8(
    b,
    TLV_TAG.ORDER_TYPE,
    isLimit ? ORDER_TYPE.LIMIT : ORDER_TYPE.TRIGGER,
  );
  // 0xe1 ASSET_ID (var number: 1–8 bytes)
  encodeTlvVarNumber(b, TLV_TAG.ASSET_ID, order.a);
  // 0xe2 BUY_OR_NOT: 1 byte boolean
  encodeInTlvFromUInt8(b, TLV_TAG.BUY_OR_NOT, order.b ? 1 : 0);
  // 0xe3 PRICE, 0xe4 SIZE
  encodeInTlvFromAscii(b, TLV_TAG.PRICE, order.p);
  encodeInTlvFromAscii(b, TLV_TAG.SIZE, order.s);
  // 0xe5 REDUCE_ONLY
  encodeInTlvFromUInt8(b, TLV_TAG.REDUCE_ONLY, order.r ? 1 : 0);

  const payloadBuilder = new ByteArrayBuilder();
  if (isLimit && "limit" in orderType) {
    encodeInTlvFromUInt8(
      payloadBuilder,
      TLV_TAG.TIF,
      tifToByte(orderType.limit.tif),
    );
  } else if ("trigger" in orderType) {
    encodeInTlvFromUInt8(
      payloadBuilder,
      TLV_TAG.TRIGGER_MARKET,
      orderType.trigger.isMarket ? 1 : 0,
    );
    encodeInTlvFromAscii(
      payloadBuilder,
      TLV_TAG.TRIGGER_PRICE,
      orderType.trigger.triggerPx,
    );
    encodeInTlvFromUInt8(
      payloadBuilder,
      TLV_TAG.TRIGGER_TYPE,
      orderType.trigger.tpsl === "tp" ? TRIGGER_TYPE.TP : TRIGGER_TYPE.SL,
    );
  }
  encodeInTlvFromBuffer(b, TLV_TAG.ORDER_DETAIL, payloadBuilder.build());

  return b.build();
}

function encodeInTlvFromHexa(
  builder: ByteArrayBuilder,
  tag: number,
  value: string,
): void {
  if (tag > 0x7f) {
    builder.add16BitUIntToData(LONG_NUMBER_MAX_BYTES + tag);
  } else {
    builder.add8BitUIntToData(tag);
  }
  builder.encodeInLVFromHexa(value);
}

/** Build action_structure (value for tag 0xdb) per specs create_order / update_order / cancel_order / leverage. */
export function buildActionStructure(action: HyperliquidAction): Uint8Array {
  const b = new ByteArrayBuilder();

  switch (action.type) {
    case "order": {
      if (action.orders.length === 0) {
        throw new Error("order action must have at least one order");
      }
      for (const order of action.orders) {
        const orderPayload = serializeOrderToTlv(order);
        encodeInTlvFromBuffer(b, TLV_TAG.ORDER, orderPayload);
      }
      encodeInTlvFromUInt8(
        b,
        TLV_TAG.GROUPING,
        groupingToByte(action.grouping),
      );
      if (action.builder !== undefined) {
        const builderInfoBuilder = new ByteArrayBuilder();
        encodeInTlvFromHexa(
          builderInfoBuilder,
          TLV_TAG.BUILDER_ADDRESS,
          action.builder.b,
        );
        encodeTlvVarNumber(
          builderInfoBuilder,
          TLV_TAG.BUILDER_FEE,
          action.builder.f,
        );

        encodeInTlvFromBuffer(
          b,
          TLV_TAG.BUILDER_INFO,
          builderInfoBuilder.build(),
        );
      }
      break;
    }
    case "modify":
    case "batchModify": {
      // update_order: tag UPDATE_ORDER (0xd8) once, then length of buffer, then buffer of [order (0xdd), oid (0xdc)] per modify
      if (!action.modifies.length) {
        throw new Error("modify action must have at least one modify");
      }
      const payloadBuilder = new ByteArrayBuilder();
      for (const mod of action.modifies) {
        encodeInTlvFromBuffer(
          payloadBuilder,
          TLV_TAG.ORDER,
          serializeOrderToTlv(mod.order),
        );
        encodeInTlvFromUInt64(payloadBuilder, TLV_TAG.ORDER_ID, mod.oid);
      }
      const updateOrderPayload = payloadBuilder.build();
      encodeInTlvFromBuffer(b, TLV_TAG.UPDATE_ORDERS, updateOrderPayload);
      break;
    }
    case "cancel": {
      // cancel_order: asset_id (0xd1), oid (0xdc)
      if (!action.cancels.length) {
        throw new Error("cancel action must have at least one cancel");
      }
      const payloadBuilder = new ByteArrayBuilder();
      for (const cancel of action.cancels) {
        encodeTlvVarNumber(payloadBuilder, TLV_TAG.ASSET_ID, cancel.a);
        encodeInTlvFromUInt64(payloadBuilder, TLV_TAG.ORDER_ID, cancel.o);
      }
      const updateOrderPayload = payloadBuilder.build();
      encodeInTlvFromBuffer(b, TLV_TAG.CANCEL_ORDERS, updateOrderPayload);

      break;
    }
    case "updateLeverage": {
      // leverage: asset_id (0xd1), is_cross (0xde), leverage (0xed)
      encodeTlvVarNumber(b, TLV_TAG.ASSET_ID, action.asset);
      encodeInTlvFromUInt8(b, TLV_TAG.IS_CROSS, action.isCross ? 1 : 0);
      encodeInTlvFromUInt64(b, TLV_TAG.LEVERAGE, action.leverage);
      break;
    }
    case "approveBuilderFee":
      encodeInTlvFromHexa(b, TLV_TAG.CHAIN_ID, action.signatureChainId);
      encodeInTlvFromAscii(b, TLV_TAG.MAX_FEE, action.maxFeeRate);
      encodeInTlvFromHexa(b, TLV_TAG.BUILDER_ADDRESS, action.builder);
      break;
    case "updateIsolatedMargin":
      encodeTlvVarNumber(b, TLV_TAG.ASSET_ID, action.asset);
      encodeInTlvFromUInt8(b, TLV_TAG.BUY_OR_NOT, action.isBuy ? 1 : 0);
      encodeInTlvFromUInt64(b, TLV_TAG.NTLI, action.ntli);
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
    .add16BitUIntToData(LONG_NUMBER_MAX_BYTES + TLV_TAG.ACTION_TYPE)
    .add8BitUIntToData(1)
    .add8BitUIntToData(actionTypeByte);

  // nonce (0xda): var, required number — 1–8 bytes
  encodeTlvVarNumber(builder, TLV_TAG.NONCE, action.nonce);

  // action_structure (0xdb): var
  encodeInTlvFromBuffer(builder, TLV_TAG.ACTION_STRUCTURE, actionStructure);

  return builder.build();
}
