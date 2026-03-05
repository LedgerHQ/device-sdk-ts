import {
  CommandResultFactory,
  hexaStringToBuffer,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type vi } from "vitest";

import { SendActionCommand } from "@internal/app-binder/command/SendActionCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import type { HyperliquidAction } from "@internal/app-binder/utils/actionTlvSerializer";

import { SendActionsTask } from "./SendActionsTask";

describe("SendActionsTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    apiMock.sendCommand.mockClear();
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
  });

  it.each([
    {
      action: {
        type: "order",
        orders: [
          {
            a: 42,
            b: true,
            p: "1992",
            s: "0.512",
            t: {
              limit: {
                tif: "Ioc",
              },
            },
            r: false,
          },
        ],
        grouping: "na",
        builder: {
          b: "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
          f: 100,
        },
        nonce: 1770816625873,
      } satisfies HyperliquidAction,
      expectedSerialization:
        "01012c02010181d0010081da06019c4ce55cd181db4581dd2381e0010081e1012a81e2010181e3043139393281e405302e35313281e5010081e6010181ea010081eb14c0708cdd6cd166d51da264e3f49a0422be26e35b81ec0164",
    },
    {
      action: {
        type: "approveBuilderFee",
        hyperliquidChain: "Mainnet",
        signatureChainId: "0xa4b1",
        maxFeeRate: "0.1000%",
        builder: "0xc0708cdd6cd166d51da264e3f49a0422be26e35b",
        nonce: 1772440978175,
      } satisfies HyperliquidAction,
      // 01012c 020101 81d00104 81da06019CADB702FF 81db27 23040000a4b1 81b007302E3130303025 81d314c0708cdd6cd166d51da264e3f49a0422be26e35b
      // 01012c 020101 81d00104 81da06019CADB702FF 81db25 2302a4b1 81b007302E3130303025 81d314c0708cdd6cd166d51da264e3f49a0422be26e35b
      expectedSerialization:
        "01012c02010181d0010481da06019CADB702FF81db252302a4b181b007302E313030302581d314c0708cdd6cd166d51da264e3f49a0422be26e35b",
    },
  ])(
    "calls SendActionCommand once when actions has one item",
    async ({ action, expectedSerialization }) => {
      const task = new SendActionsTask(apiMock, { actions: [action] });
      const result = await task.run();

      expect(result).toEqual(
        CommandResultFactory({
          data: undefined,
        }),
      );
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);

      // e0 03 01 00
      // 18 0016
      // 01012c 020101 81d00104 81da06019cadb702ff81db00

      // e0030100
      // 5d 005b
      // 01012c 020101 81d00100 81da06019c4ce55cd1
      // 81db45 81dd23 81e00100 81e1012a 81e20101 81e30431393932 81e405302e353132 81e50100 81e60101
      // 81ea0100 81eb14c0708cdd6cd166d51da264e3f49a0422be26e35b
      // 81ec0164

      /* eslint-disable prettier/prettier */
      const expectedBytes = hexaStringToBuffer(expectedSerialization)!;
      // const expectedBytes = new Uint8Array([
      //   0x01, 0x01, 0x2c, // STRUCTURE_TYPE
      //   0x02, 0x01, 0x01, // VERSION
      //   0xd0, 0x01, 0x00, // ACTION_TYPE
      //   0xda, 0x01, 0x01, // NONCE
      //   0xdb, 0x37, // ACTION_STRUCTURE
      //     0xdd, 0x19, // ORDER
      //       0xe0, 0x01, 0x00,
      //       0xe1, 0x01, 0x00, // ORDER_ASSET_ID
      //       0xe2, 0x01, 0x01, // BUY_OR_NOT
      //       0xe3, 0x03, 0x31, 0x30, 0x30, // PRICE
      //       0xe4, 0x03, 0x31, 0x30, 0x30, // SIZE
      //       0xe5, 0x01, 0x00, // REDUCE_ONLY
      //       0xe6, 0x01, 0x02, // TIF
      //   0xea, 0x01, 0x00, // GROUPING
      //   0xeb, 0x14, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, // BUILDER_ADDRESS
      //   0xec, 0x01, 0x64, // BUILDER_FEE
      // ]);
      /* eslint-enable prettier/prettier */
      expect(apiMock.sendCommand).toHaveBeenCalledWith(
        new SendActionCommand({
          serializedAction: expectedBytes,
        }),
      );
    },
  );

  it("calls SendActionCommand multiple times in order when actions has several items", async () => {
    const actions: HyperliquidAction[] = [
      {
        type: "order",
        orders: [
          {
            a: 0,
            b: true,
            p: "1",
            s: "1",
            t: { limit: { tif: "Gtc" } },
            r: false,
          },
        ],
        grouping: "na",
        nonce: 1,
      },
      {
        type: "cancel",
        cancels: [{ asset: 0, oid: 42 }],
        nonce: 2,
      },
      {
        type: "updateLeverage",
        asset: 0,
        isCross: false,
        leverage: 10,
        nonce: 3,
      },
    ];

    const task = new SendActionsTask(apiMock, { actions });
    await task.run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);

    /* eslint-disable prettier/prettier */
    const expectedPlacingOrder = new Uint8Array([
      0x01,
      0x01,
      0x2c, // STRUCTURE_TYPE
      0x02,
      0x01,
      0x01, // VERSION
      0x81,
      0xd0,
      0x01,
      0x00, // ACTION_TYPE order
      0x81,
      0xda,
      0x01,
      0x01, // NONCE
      0x81,
      0xdb,
      0x23, // ACTION_STRUCTURE
      0x81,
      0xdd,
      0x1c, // ORDER
      0x81,
      0xe0,
      0x01,
      0x00,
      0x81,
      0xe1,
      0x01,
      0x00, // ORDER_ASSET_ID
      0x81,
      0xe2,
      0x01,
      0x01,
      0x81,
      0xe3,
      0x01,
      0x31, // PRICE "1"
      0x81,
      0xe4,
      0x01,
      0x31, // SIZE "1"
      0x81,
      0xe5,
      0x01,
      0x00,
      0x81,
      0xe6,
      0x01,
      0x02, // TIF Gtc
      0x81,
      0xea,
      0x01,
      0x00, // GROUPING na
    ]);
    const expectedCancelOrder = new Uint8Array([
      0x01,
      0x01,
      0x2c,
      0x02,
      0x01,
      0x01,
      0x81,
      0xd0,
      0x01,
      0x02, // ACTION_TYPE cancel
      0x81,
      0xda,
      0x01,
      0x02, // NONCE
      0x81,
      0xdb,
      0x16, // ACTION_STRUCTURE
      0x81,
      0xd1,
      0x08,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // ASSET_ID
      0x81,
      0xdc,
      0x08,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x2a, // ORDER_ID 42
    ]);
    const expectedUpdateLeverage = new Uint8Array([
      0x01,
      0x01,
      0x2c,
      0x02,
      0x01,
      0x01,
      0x81,
      0xd0,
      0x01,
      0x03, // ACTION_TYPE updateLeverage
      0x81,
      0xda,
      0x01,
      0x03, // NONCE
      0x81,
      0xdb,
      0x1a, // ACTION_STRUCTURE
      0x81,
      0xd1,
      0x08,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // ASSET_ID
      0x81,
      0xde,
      0x01,
      0x00, // IS_CROSS
      0x81,
      0xed,
      0x08,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x0a, // LEVERAGE 10
    ]);
    /* eslint-enable prettier/prettier */

    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      1,
      new SendActionCommand({
        serializedAction: expectedPlacingOrder,
      }),
    );

    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      2,
      new SendActionCommand({
        serializedAction: expectedCancelOrder,
      }),
    );

    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      3,
      new SendActionCommand({
        serializedAction: expectedUpdateLeverage,
      }),
    );
  });

  it("returns error result and stops on first SendActionCommand failure", async () => {
    const errorResult = CommandResultFactory({
      error: new UnknownDeviceExchangeError(),
    });
    (apiMock.sendCommand as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
      .mockResolvedValueOnce(errorResult);

    const actions: HyperliquidAction[] = [
      {
        type: "order",
        orders: [
          {
            a: 0,
            b: false,
            p: "1",
            s: "1",
            t: { limit: { tif: "Gtc" } },
            r: false,
          },
        ],
        grouping: "na",
        nonce: 1,
      },
      {
        type: "cancel",
        cancels: [{ asset: 0, oid: 1 }],
        nonce: 2,
      },
    ];

    const task = new SendActionsTask(apiMock, { actions });
    const result = await task.run();

    expect(result).toStrictEqual(errorResult);
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("returns success when actions is empty", async () => {
    const task = new SendActionsTask(apiMock, { actions: [] });
    const result = await task.run();

    expect(result).toEqual(
      CommandResultFactory({
        data: undefined,
      }),
    );
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});
