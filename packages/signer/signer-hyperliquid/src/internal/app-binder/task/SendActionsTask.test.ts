import {
  CommandResultFactory,
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

  it("calls SendActionCommand once when actions has one item", async () => {
    const action: HyperliquidAction = {
      type: "order",
      orders: [
        {
          a: 0,
          b: true,
          p: "100",
          s: "100",
          t: {
            limit: {
              tif: "Gtc",
            },
          },
          r: false,
        },
      ],
      grouping: "na",
      builder: {
        b: "0x1234567890123456789012345678901234567890",
        f: 100,
      },
      nonce: 1,
    };

    const task = new SendActionsTask(apiMock, { actions: [action] });
    const result = await task.run();

    expect(result).toEqual(
      CommandResultFactory({
        data: undefined,
      }),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);

    /* eslint-disable prettier/prettier */
    const expectedBytes = new Uint8Array([
      0x01, 0x01, 0x2c, // STRUCTURE_TYPE
      0x02, 0x01, 0x01, // VERSION
      0xd0, 0x01, 0x00, // ACTION_TYPE
      0xda, 0x01, 0x01, // NONCE
      0xdb, 0x37, // ACTION_STRUCTURE
        0xdd, 0x19, // ORDER
          0xe0, 0x01, 0x00,
          0xe1, 0x01, 0x00, // ORDER_ASSET_ID
          0xe2, 0x01, 0x01, // BUY_OR_NOT
          0xe3, 0x03, 0x31, 0x30, 0x30, // PRICE
          0xe4, 0x03, 0x31, 0x30, 0x30, // SIZE
          0xe5, 0x01, 0x00, // REDUCE_ONLY
          0xe6, 0x01, 0x02, // TIF
      0xea, 0x01, 0x00, // GROUPING
      0xeb, 0x14, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, 0x12, 0x34, 0x56, 0x78, 0x90, // BUILDER_ADDRESS
      0xec, 0x01, 0x64, // BUILDER_FEE
    ]);
    /* eslint-enable prettier/prettier */
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SendActionCommand({
        serializedAction: expectedBytes,
      }),
    );
  });

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
    const expectedFirst = new Uint8Array([
      0x01, 0x01, 0x2c, // STRUCTURE_TYPE
      0x02, 0x01, 0x01, // VERSION
      0xd0, 0x01, 0x00, // ACTION_TYPE order
      0xda, 0x01, 0x01, // NONCE
      0xdb, 0x1a, // ACTION_STRUCTURE
      0xdd, 0x15, // ORDER
      0xe0, 0x01, 0x00,
      0xe1, 0x01, 0x00, // ORDER_ASSET_ID
      0xe2, 0x01, 0x01,
      0xe3, 0x01, 0x31, // PRICE "1"
      0xe4, 0x01, 0x31, // SIZE "1"
      0xe5, 0x01, 0x00,
      0xe6, 0x01, 0x02, // TIF Gtc
      0xea, 0x01, 0x00, // GROUPING na
    ]);
    const expectedSecond = new Uint8Array([
      0x01, 0x01, 0x2c,
      0x02, 0x01, 0x01,
      0xd0, 0x01, 0x02, // ACTION_TYPE cancel
      0xda, 0x01, 0x02, // NONCE
      0xdb, 0x14, // ACTION_STRUCTURE
      0xd1, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // ASSET_ID
      0xdc, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2a, // ORDER_ID 42
    ]);
    const expectedThird = new Uint8Array([
      0x01, 0x01, 0x2c,
      0x02, 0x01, 0x01,
      0xd0, 0x01, 0x03, // ACTION_TYPE updateLeverage
      0xda, 0x01, 0x03, // NONCE
      0xdb, 0x17, // ACTION_STRUCTURE
      0xd1, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // ASSET_ID
      0xde, 0x01, 0x00, // IS_CROSS
      0xed, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, // LEVERAGE 10
    ]);
    /* eslint-enable prettier/prettier */

    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      1,
      new SendActionCommand({
        serializedAction: expectedFirst,
      }),
    );

    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      2,
      new SendActionCommand({
        serializedAction: expectedSecond,
      }),
    );

    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      3,
      new SendActionCommand({
        serializedAction: expectedThird,
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
