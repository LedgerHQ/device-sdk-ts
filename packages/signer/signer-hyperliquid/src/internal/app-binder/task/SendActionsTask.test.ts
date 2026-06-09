import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  hexaStringToBuffer,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type vi } from "vitest";

import { SendActionCommand } from "@internal/app-binder/command/SendActionCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import type { HyperliquidAction } from "@internal/app-binder/di/appBinderTypes";

import { SendActionsTask } from "./SendActionsTask";

// Per APP_SPECIFICATION.md (SET_ACTION) the first chunk's data field is
// [lenH, lenL] (big-endian length of the serialized ACTION struct) followed
// by the start of the struct itself. Following chunks carry the rest of the
// struct with no extra prefix.
function frameAction(serialized: Uint8Array): Uint8Array {
  const length = serialized.length;
  const framed = new Uint8Array(2 + length);
  framed[0] = (length >> 8) & 0xff;
  framed[1] = length & 0xff;
  framed.set(serialized, 2);
  return framed;
}

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
        // prettier-ignore

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
        // prettier-ignore

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
    },
    {
      action: {
        type: "cancel",
        cancels: [
          {
            a: 0,
            o: 340574409238,
          },
        ],
        nonce: 1772813983827,
      } satisfies HyperliquidAction,
      expectedSerialization:
        // prettier-ignore

        "01012c" + // STRUCTURE_TYPE
        "020101" + // VERSION
        "81d00102" + // ACTION_TYPE
        "81da06019CC3F2A053" + // NONCE
        "81db12" + // ACTION_STRUCTURE
          "81d90f" + // CANCEL_ORDERS
            "81d10100" + // ASSET_ID
            "81dc080000004F4BD11216", // ORDER_ID
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
      const framed = frameAction(expectedBytes);
      expect(framed.length).toBeLessThanOrEqual(APDU_MAX_PAYLOAD);
      expect(apiMock.sendCommand).toHaveBeenCalledWith(
        new SendActionCommand({
          chunkedData: framed,
          more: false,
          extend: false,
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
          cancels: [{ a: 0, o: 42 }],
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
    {
      actions: [
        {
          type: "updateLeverage",
          asset: 5,
          isCross: false,
          leverage: 3,
          nonce: 1773655934208,
        },
        {
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
        },
      ] satisfies HyperliquidAction[],
      expectedSerializations: [
        hexaStringToBuffer(
          "01012c02010181d0010381da06019cf621c50081db1381d1010581de010081ed080000000000000003",
        )!,
        hexaStringToBuffer(
          "01012c02010181d0010081da06019cf621c50181db8183" +
            "81dd2781e0010081d1010581e2010181e30639352e33303281e404302e313681e5010081d70481e60101" +
            "81dd3481e0010181d1010581e2010081e3063130322e373881e404302e313681e5010181d71181e7010181e8063130322e373881e9010081ea010181eb1b81d314c0708cdd6cd166d51da264e3f49a0422be26e35b81ec0164",
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
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(actions.length);

      expectedSerializations.forEach((serialized, index) => {
        const framed = frameAction(serialized);
        expect(framed.length).toBeLessThanOrEqual(APDU_MAX_PAYLOAD);
        expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
          index + 1,
          new SendActionCommand({
            chunkedData: framed,
            more: false,
            extend: false,
          }),
        );
      });
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
        cancels: [{ a: 0, o: 1 }],
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

  it("splits a real-world order action (3 orders with cloid + builder) into chunks with the proper EXTEND/MORE flags", async () => {
    // Same action as the original test case in SendActionCommand.test.ts —
    // its TLV serialization is 270 bytes, so framed it exceeds APDU_MAX_PAYLOAD
    // and must be split into two chunks.
    const action: HyperliquidAction = {
      type: "order",
      orders: [
        {
          a: 0,
          b: true,
          p: "77537",
          s: "0.00017",
          r: false,
          t: { limit: { tif: "Ioc" } },
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
              tpsl: "tp",
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
              tpsl: "sl",
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
    };

    const task = new SendActionsTask(apiMock, { actions: [action] });
    await task.run();

    // Framed payload is > APDU_MAX_PAYLOAD; expect exactly 2 chunks.
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

    const firstCall = apiMock.sendCommand.mock
      .calls[0]?.[0] as SendActionCommand;
    expect(firstCall.args.extend).toBe(false);
    expect(firstCall.args.more).toBe(true);
    expect(firstCall.args.chunkedData.length).toBe(APDU_MAX_PAYLOAD);

    const lastCall = apiMock.sendCommand.mock
      .calls[1]?.[0] as SendActionCommand;
    expect(lastCall.args.extend).toBe(true);
    expect(lastCall.args.more).toBe(false);
    expect(lastCall.args.chunkedData.length).toBeLessThanOrEqual(
      APDU_MAX_PAYLOAD,
    );
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
