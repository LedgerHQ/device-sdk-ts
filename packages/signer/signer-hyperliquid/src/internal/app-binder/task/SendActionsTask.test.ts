import {
  CommandResultFactory,
  hexaStringToBuffer,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type vi } from "vitest";

import { SendActionCommand } from "@internal/app-binder/command/SendActionCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import type { HyperliquidAction } from "@internal/app-binder/di/appBinderTypes";

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
        /* eslint-disable prettier/prettier */
        "01012c" +
        "020101" +
        "81d00100" +
        "81da06019c4ce55cd1" +
        "81db4b" +
          "81dd26" +
          "81e00100" +
          "81d1012a" +
          "81e20101" +
          "81e30431393932" +
          "81e405302e353132" +
          "81e50100" +
          "81d704" + // ORDER_DETAIL
            "81e60101" + // TIF
          "81ea0100" + // GROUPING
          "81eb1b" + //BUILDER
            "81d314c0708cdd6cd166d51da264e3f49a0422be26e35b" + // BUILDER_ADDRESS
            "81ec0164", // BUILDER_FEE
          /* eslint-enable prettier/prettier */
    },
    {
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
                  tpsl: "tp",
                },
              },
            },
          },
        ],
        nonce: 1773050015814,
      } satisfies HyperliquidAction,
      expectedSerialization:
        /* eslint-disable prettier/prettier */
        "01012c" + // STRUCTURE_TYPE
        "020101" + // VERSION
        "81d00101" + // ACTION_TYPE
        "81da06019CD2043046" + // NONCE
        "81db45" + // ACTION_STRUCTURE
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
      action: {
        type: "cancel",
        cancels: [
          {
            asset: 0,
            oid: 340574409238,
          },
        ],
        nonce: 1772813983827,
      } satisfies HyperliquidAction,
      expectedSerialization:
        /* eslint-disable prettier/prettier */
        "01012c" + // STRUCTURE_TYPE
        "020101" + // VERSION
        "81d00102" + // ACTION_TYPE
        "81da06019CC3F2A053" + // NONCE
        "81db12" + // ACTION_STRUCTURE
          "81d90f" + // CANCEL_ORDERS
            "81d10100" + // ASSET_ID
            "81dc080000004F4BD11216", // ORDER_ID
        /* eslint-enable prettier/prettier */
    },
  ])(
    "calls SendActionCommand once when actions has one item",
    async ({ action, expectedSerialization }) => {
      // GIVEN one action
      // WHEN
      const task = new SendActionsTask(apiMock, { actions: [action] });
      const result = await task.run();

      // THEN
      expect(result).toEqual(
        CommandResultFactory({
          data: undefined,
        }),
      );
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);

      const expectedBytes = hexaStringToBuffer(expectedSerialization)!;
      expect(apiMock.sendCommand).toHaveBeenCalledWith(
        new SendActionCommand({
          serializedAction: expectedBytes,
        }),
      );
    },
  );

  it.each([
    {
      actions: [
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
      ] satisfies HyperliquidAction[],
      expectedSerializations: [
        hexaStringToBuffer(
          "01012c02010181d0010081da010181db2681dd1f81e0010081d1010081e2010181e3013181e4013181e5010081d70481e6010281ea0100",
        )!,
        hexaStringToBuffer(
          "01012c02010181d0010281da010281db1281d90f81d1010081dc08000000000000002a",
        )!,
        hexaStringToBuffer(
          "01012c02010181d0010381da010381db1381d1010081de010081ed08000000000000000a",
        )!,
      ],
    },
  ])(
    "calls SendActionCommand multiple times in order when actions has several items",
    async ({ actions, expectedSerializations }) => {
      // GIVEN several actions
      // WHEN
      const task = new SendActionsTask(apiMock, { actions });
      await task.run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);

      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        1,
        new SendActionCommand({
          serializedAction: expectedSerializations[0]!,
        }),
      );

      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        2,
        new SendActionCommand({
          serializedAction: expectedSerializations[1]!,
        }),
      );

      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        3,
        new SendActionCommand({
          serializedAction: expectedSerializations[2]!,
        }),
      );
    },
  );

  it("returns error result and stops on first SendActionCommand failure", async () => {
    // GIVEN api returns success for first command then error for second
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

    // WHEN
    const task = new SendActionsTask(apiMock, { actions });
    const result = await task.run();

    // THEN
    expect(result).toStrictEqual(errorResult);
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("returns success when actions is empty", async () => {
    // GIVEN empty actions
    // WHEN
    const task = new SendActionsTask(apiMock, { actions: [] });
    const result = await task.run();

    // THEN
    expect(result).toEqual(
      CommandResultFactory({
        data: undefined,
      }),
    );
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});
