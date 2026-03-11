import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import type { HyperliquidAction } from "@internal/app-binder/di/appBinderTypes";

import {
  buildActionStructure,
  serializeOrderToTlv,
} from "./actionTlvSerializer";

describe("serializeOrderToTlv", () => {
  it.each([
    {
      name: "order limit (Gtc)",
      order: {
        a: 0,
        b: true,
        p: "100",
        s: "1",
        r: false,
        t: { limit: { tif: "Gtc" as const } },
      },
      expectedHex:
        "81e00100" + // ORDER_TYPE
        "81d10100" + // ASSET_ID
        "81e20101" + // BUY_OR_NOT
        "81e303313030" + // PRICE
        "81e40131" + // SIZE
        "81e50100" + // REDUCE_ONLY
        "81d704" + // ORDER_DETAIL
        "81e60102", // TIF
    },
    {
      name: "order trigger (tp, isMarket)",
      order: {
        a: 0,
        b: false,
        p: "85169",
        s: "0.0005",
        r: true,
        t: {
          trigger: {
            isMarket: true,
            triggerPx: "85169",
            tpsl: "tp" as const,
          },
        },
      },
      expectedHex:
        "81e00101" + // ORDER_TYPE
        "81d10100" + // ASSET_ID
        "81e20100" + // BUY_OR_NOT
        "81e3053835313639" + // PRICE
        "81e406302E30303035" + // SIZE
        "81e50101" + // REDUCE_ONLY
        "81d710" + // ORDER_DETAIL
        "81e70101" + // TRIGGER_MARKET
        "81e8053835313639" + // TRIGGER_PRICE
        "81e90100", // TRIGGER_TYPE
    },
    {
      name: "order limit (Ioc)",
      order: {
        a: 42,
        b: false,
        p: "1992",
        s: "0.512",
        r: false,
        t: { limit: { tif: "Ioc" as const } },
      },
      expectedHex:
        "81e00100" + // ORDER_TYPE
        "81d1012a" + // ASSET_ID
        "81e20100" + // BUY_OR_NOT
        "81e30431393932" + // PRICE
        "81e405302E353132" + // SIZE
        "81e50100" + // REDUCE_ONLY
        "81d704" + // ORDER_DETAIL
        "81e60101", // TIF
    },
  ])("$name", ({ order, expectedHex }) => {
    const result = serializeOrderToTlv(order);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const expected = hexaStringToBuffer(expectedHex);
    expect(result).toEqual(expected);
  });
});

describe("buildActionStructure", () => {
  it.each([
    {
      name: "action type order (create_order)",
      action: {
        type: "order",
        orders: [
          {
            a: 0,
            b: true,
            p: "1",
            s: "1",
            r: false,
            t: { limit: { tif: "Gtc" as const } },
          },
        ],
        grouping: "na",
        nonce: 1, // Not serialized with this fuction call
      } satisfies HyperliquidAction,
      expectedHex:
        /* eslint-disable prettier/prettier */
        "81dd1f" + // ORDER
          "81e00100" + // ORDER_TYPE
          "81d10100" + // ASSET_ID
          "81e20101" + // BUY_OR_NOT
          "81e30131" + // PRICE
          "81e40131" + // SIZE
          "81e50100" + // REDUCE_ONLY
          "81d704" + // ORDER_DETAIL
          "81e60102" + // TIF
        "81ea0100", // GROUPING
        /* eslint-enable prettier/prettier */
    },
    {
      name: "action type batchModify (update_order)",
      action: {
        type: "batchModify",
        modifies: [
          {
            oid: 343050796655,
            order: {
              a: 0,
              b: false,
              p: "85169",
              s: "0.0005",
              r: true,
              t: {
                trigger: {
                  isMarket: true,
                  triggerPx: "85169",
                  tpsl: "tp" as const,
                },
              },
            },
          },
        ],
        nonce: 1773050015814, // Not serialized with this fuction call // Not serialized with this fuction call
      } satisfies HyperliquidAction,
      expectedHex:
        /* eslint-disable prettier/prettier */
        "81d842" + // UPDATE_ORDERS
          "81dd34" + // ORDER
            "81e00101" + // ORDER_TYPE
            "81d10100" + // ASSET_ID
            "81e20100" + // BUY_OR_NOT
            "81e3053835313639" + // PRICE
            "81e406302E30303035" + // SIZE
            "81e50101" + // REDUCE_ONLY
            "81d710" + // ORDER_DETAIL
              "81e70101" + // TRIGGER_MARKET
              "81e8053835313639" + // TRIGGER_PRICE
              "81e90100" + // TRIGGER_TYPE
          "81dc080000004FDF6BBE6F", // ORDER_ID
        /* eslint-enable prettier/prettier */
    },
    {
      name: "action type cancel",
      action: {
        type: "cancel",
        cancels: [{ a: 0, o: 340574409238 }],
        nonce: 1772813983827, // Not serialized with this fuction call
      } satisfies HyperliquidAction,
      expectedHex:
        /* eslint-disable prettier/prettier */
        "81d90f" + // CANCEL_ORDERS
          "81d10100" + // ASSET_ID
          "81dc080000004F4BD11216", // ORDER_ID
        /* eslint-enable prettier/prettier */
    },
    {
      name: "action type updateLeverage",
      action: {
        type: "updateLeverage",
        asset: 0,
        isCross: false,
        leverage: 10,
        nonce: 3, // Not serialized with this fuction call
      } satisfies HyperliquidAction,
      expectedHex:
        /* eslint-disable prettier/prettier */
        "81d10100" + // ASSET_ID
        "81de0100" + // IS_CROSS
        "81ed08000000000000000a", // LEVERAGE,
        /* eslint-enable prettier/prettier */
    },
    {
      name: "action type approveBuilderFee",
      action: {
        type: "approveBuilderFee",
        hyperliquidChain: "Mainnet",
        signatureChainId: "0xa4b1",
        maxFeeRate: "0.1000%",
        builder: "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
        nonce: 1772440978175, // Not serialized with this fuction call
      } satisfies HyperliquidAction,
      expectedHex:
        "2302a4b1" + // CHAIN_ID
        "81b007302E3130303025" + // MAX_FEE
        "81d314c0708cdd6cd166d51da264e3f49a0422be26e35b", // APPROVE_BUILDER_ADDRESS
    },
    {
      name: "action type updateIsolatedMargin",
      action: {
        type: "updateIsolatedMargin",
        asset: 0,
        isBuy: true,
        ntli: 10000000,
        nonce: 1772440978175,
      } satisfies HyperliquidAction,
      expectedHex:
        "81d10100" + // ASSET_ID
        "81e20101" + // BUY_OR_NOT
        "81d6080000000000989680", // NTLI
    },
  ])("$name", ({ action, expectedHex }) => {
    const result = buildActionStructure(action);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const expected = hexaStringToBuffer(expectedHex);
    expect(result).toEqual(expected);
  });
});
