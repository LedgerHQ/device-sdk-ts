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
        nonce: 1, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

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
    },
    {
      name: "action type order (create_order) with a cloid",
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
            c: "0x278da11ed9db4f9cadb8b331488980a5",
          },
        ],
        grouping: "na",
        nonce: 1, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81dd32" + // ORDER
          "81e00100" + // ORDER_TYPE
          "81d10100" + // ASSET_ID
          "81e20101" + // BUY_OR_NOT
          "81e30131" + // PRICE
          "81e40131" + // SIZE
          "81e50100" + // REDUCE_ONLY
          "81d704" + // ORDER_DETAIL
          "81e60102" + // TIF
          "81ee10278da11ed9db4f9cadb8b331488980a5" + // CLOID
        "81ea0100", // GROUPING
    },
    {
      name: "action type with multiple orders",
      action: {
        type: "order",
        orders: [
          {
            a: 5,
            b: true,
            p: "95.302",
            s: "0.16",
            r: false,
            t: {
              limit: {
                tif: "Ioc",
              },
            },
          },
          {
            a: 5,
            b: false,
            p: "102.78",
            s: "0.16",
            r: true,
            t: {
              trigger: {
                isMarket: true,
                triggerPx: "102.78",
                tpsl: "tp",
              },
            },
          },
        ],
        grouping: "normalTpsl",
        builder: {
          b: "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
          f: 100,
        },
        nonce: 1773655934209,
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81dd27" + // ORDER
          "81e00100" + // ORDER_TYPE
          "81d10105" + // ASSET_ID
          "81e20101" + // BUY_OR_NOT
          "81e30639352E333032" + // PRICE
          "81e404302E3136" + // SIZE
          "81e50100" + // REDUCE_ONLY
          "81d704" + // ORDER_DETAIL
          "81e60101" + // TIF

        "81dd34" + // ORDER
          "81e00101" + // ORDER_TYPE
          "81d10105" + // ASSET_ID
          "81e20100" + // BUY_OR_NOT
          "81e3063130322E3738" + // PRICE
          "81e404302E3136" + // SIZE
          "81e50101" + // REDUCE_ONLY
          "81d711" + // ORDER_DETAIL
            "81e70101" + // TRIGGER_MARKET
            "81e8063130322E3738" + // TRIGGER_PRICE
            "81e90100" + // TRIGGER_TYPE

        "81ea0101" + // GROUPING
        "81eb1b" + // BUILDER_INFO
          "81d314c0708cdd6cd166d51da264e3f49a0422be26e35b" + // BUILDER_ADDRESS
          "81ec0164", // BUILDER_FEE
    },
    {
      name: "action type with multiple orders with a cloid",
      action: {
        type: "order",
        orders: [
          {
            a: 5,
            b: true,
            p: "95.302",
            s: "0.16",
            r: false,
            t: {
              limit: {
                tif: "Ioc",
              },
            },
            c: "0x278da11ed9db4f9cadb8b331488980a5",
          },
          {
            a: 5,
            b: false,
            p: "102.78",
            s: "0.16",
            r: true,
            t: {
              trigger: {
                isMarket: true,
                triggerPx: "102.78",
                tpsl: "tp",
              },
            },
            c: "0x278da11ed9db4f9cadb8b331488980a5",
          },
        ],
        grouping: "normalTpsl",
        builder: {
          b: "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
          f: 100,
        },
        nonce: 1773655934209,
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81dd3a" + // ORDER
          "81e00100" + // ORDER_TYPE
          "81d10105" + // ASSET_ID
          "81e20101" + // BUY_OR_NOT
          "81e30639352E333032" + // PRICE
          "81e404302E3136" + // SIZE
          "81e50100" + // REDUCE_ONLY
          "81d704" + // ORDER_DETAIL
          "81e60101" + // TIF
          "81ee10278da11ed9db4f9cadb8b331488980a5" + // CLOID


        "81dd47" + // ORDER
          "81e00101" + // ORDER_TYPE
          "81d10105" + // ASSET_ID
          "81e20100" + // BUY_OR_NOT
          "81e3063130322E3738" + // PRICE
          "81e404302E3136" + // SIZE
          "81e50101" + // REDUCE_ONLY
          "81d711" + // ORDER_DETAIL
            "81e70101" + // TRIGGER_MARKET
            "81e8063130322E3738" + // TRIGGER_PRICE
            "81e90100" + // TRIGGER_TYPE
          "81ee10278da11ed9db4f9cadb8b331488980a5" + // CLOID

        "81ea0101" + // GROUPING
        "81eb1b" + // BUILDER_INFO
          "81d314c0708cdd6cd166d51da264e3f49a0422be26e35b" + // BUILDER_ADDRESS
          "81ec0164", // BUILDER_FEE
    },
    {
      name: "action type order with 3 orders (limit Ioc + trigger tp + trigger sl) with cloid and builder",
      action: {
        type: "order",
        orders: [
          {
            a: 0,
            b: true,
            p: "77537",
            s: "0.00017",
            r: false,
            t: { limit: { tif: "Ioc" as const } },
            c: "0x614cb6c28c875ff64c2237d3c3bba694",
          },
          {
            a: 0,
            b: false,
            p: "83614",
            s: "0.00017",
            r: true,
            t: {
              trigger: {
                isMarket: true,
                triggerPx: "83614",
                tpsl: "tp" as const,
              },
            },
            c: "0xd4e9b848a55c745ad1f2c030630cff62",
          },
          {
            a: 0,
            b: false,
            p: "72212",
            s: "0.00017",
            r: true,
            t: {
              trigger: {
                isMarket: true,
                triggerPx: "72212",
                tpsl: "sl" as const,
              },
            },
            c: "0xd0c4974ab1dce46c5508930a9a5db95d",
          },
        ],
        grouping: "normalTpsl",
        builder: {
          b: "0x14c1cf26360f42681105a03137cf6951bddb1293",
          f: 100,
        },
        nonce: 1779870545049,
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81dd3c" + // ORDER
          "81e00100" + // ORDER_TYPE
          "81d10100" + // ASSET_ID
          "81e20101" + // BUY_OR_NOT
          "81e3053737353337" + // PRICE
          "81e407302E3030303137" + // SIZE
          "81e50100" + // REDUCE_ONLY
          "81d704" + // ORDER_DETAIL
            "81e60101" + // TIF
          "81ee10614cb6c28c875ff64c2237d3c3bba694" + // CLOID

        "81dd48" + // ORDER 2
          "81e00101" + // ORDER_TYPE
          "81d10100" + // ASSET_ID
          "81e20100" + // BUY_OR_NOT
          "81e3053833363134" + // PRICE
          "81e407302E3030303137" + // SIZE
          "81e50101" + // REDUCE_ONLY
          "81d710" + // ORDER_DETAIL
            "81e70101" + // TRIGGER_MARKET
            "81e8053833363134" + // TRIGGER_PRICE
            "81e90100" + // TRIGGER_TYPE
          "81ee10d4e9b848a55c745ad1f2c030630cff62" + // CLOID

        "81dd48" + // ORDER 3
          "81e00101" + // ORDER_TYPE
          "81d10100" + // ASSET_ID
          "81e20100" + // BUY_OR_NOT
          "81e3053732323132" + // PRICE
          "81e407302E3030303137" + // SIZE
          "81e50101" + // REDUCE_ONLY
          "81d710" + // ORDER_DETAIL
            "81e70101" + // TRIGGER_MARKET
            "81e8053732323132" + // TRIGGER_PRICE
            "81e90101" + // TRIGGER_TYPE
          "81ee10d0c4974ab1dce46c5508930a9a5db95d" + // CLOID

        "81ea0101" + // GROUPING
        "81eb1b" + // BUILDER_INFO
          "81d31414c1cf26360f42681105a03137cf6951bddb1293" + // BUILDER_ADDRESS
          "81ec0164", // BUILDER_FEE
    },
    {
      name: "action type batchModify update_order",
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
        nonce: 1773050015814, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

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
    },
    {
      name: "action type batchModify update_order with cloid",
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
              c: "0x278da11ed9db4f9cadb8b331488980a5",
            },
          },
        ],
        nonce: 1773050015814, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81d855" + // UPDATE_ORDERS
          "81dd47" + // ORDER
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
            "81ee10278da11ed9db4f9cadb8b331488980a5" + // CLOID
          "81dc080000004FDF6BBE6F", // ORDER_ID
    },
    {
      name: "action type batchModify 2 update_orders",
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
        nonce: 1773050015814, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81d842" + // UPDATE_ORDER
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
          "81dc080000004FDF6BBE6F" + // ORDER_ID
        "81d842" + // UPDATE_ORDER 2
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
    },
    {
      name: "action type batchModify 2 update_orders with cloid",
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
              c: "0x278da11ed9db4f9cadb8b331488980a5",
            },
          },
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
              c: "0x278da11ed9db4f9cadb8b331488980a5",
            },
          },
        ],
        nonce: 1773050015814, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81d855" + // UPDATE_ORDER
          "81dd47" + // ORDER
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
            "81ee10278da11ed9db4f9cadb8b331488980a5" + // CLOID
          "81dc080000004FDF6BBE6F" + // ORDER_ID
        "81d855" + // UPDATE_ORDER 2
          "81dd47" + // ORDER
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
            "81ee10278da11ed9db4f9cadb8b331488980a5" + // CLOID
          "81dc080000004FDF6BBE6F", // ORDER_ID
    },
    {
      name: "action type cancel",
      action: {
        type: "cancel",
        cancels: [{ a: 0, o: 340574409238 }],
        nonce: 1772813983827, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81d90f" + // CANCEL_ORDERS
          "81d10100" + // ASSET_ID
          "81dc080000004F4BD11216", // ORDER_ID
    },
    {
      name: "action type with 2 cancels",
      action: {
        type: "cancel",
        cancels: [
          { a: 0, o: 340574409238 },
          { a: 0, o: 340574409238 },
        ],
        nonce: 1772813983827, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        // prettier-ignore

        "81d90f" + // CANCEL_ORDERS
          "81d10100" + // ASSET_ID
          "81dc080000004F4BD11216" + // ORDER_ID
        "81d90f" + // CANCEL_ORDERS 2
          "81d10100" + // ASSET_ID
          "81dc080000004F4BD11216", // ORDER_ID
    },
    {
      name: "action type updateLeverage",
      action: {
        type: "updateLeverage",
        asset: 0,
        isCross: false,
        leverage: 10,
        nonce: 3, // Not serialized with this function call
      } satisfies HyperliquidAction,
      expectedHex:
        "81d10100" + // ASSET_ID
        "81de0100" + // IS_CROSS
        "81ed08000000000000000a", // LEVERAGE,
    },
    {
      name: "action type approveBuilderFee",
      action: {
        type: "approveBuilderFee",
        hyperliquidChain: "Mainnet",
        signatureChainId: "0xa4b1",
        maxFeeRate: "0.1000%",
        builder: "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
        nonce: 1772440978175, // Not serialized with this function call
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
    {
      name: "action type userSetAbstraction (unifiedAccount)",
      action: {
        type: "userSetAbstraction",
        hyperliquidChain: "Mainnet",
        signatureChainId: "0xa4b1",
        user: "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
        abstraction: "unifiedAccount",
        nonce: 1716531066415,
      } satisfies HyperliquidAction,
      expectedHex:
        "2302a4b1" + // CHAIN_ID (tag 0x23, length 2, value a4b1)
        "81df0101", // ABSTRACTION (tag 0xdf, length 1, value 0x01 = unifiedAccount)
    },
  ])("$name", ({ action, expectedHex }) => {
    const result = buildActionStructure(action);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    const expected = hexaStringToBuffer(expectedHex);
    expect(result).toEqual(expected);
  });
});
