import {
  CommandResultFactory,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import type { HyperliquidAction } from "@internal/app-binder/di/appBinderTypes";
import { serializeActionToTlv } from "@internal/app-binder/utils/actionTlvSerializer";

import {
  SendActionCommand,
  type SendActionCommandArgs,
} from "./SendActionCommand";

describe("SendActionCommand", () => {
  const serializedAction = new Uint8Array([
    0x01, 0x01, 0x2c, 0x02, 0x01, 0x01, 0xd0, 0x01, 0x00, 0xda, 0x08, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2a, 0xdb, 0x03, 0xdd, 0x01, 0x00,
  ]);

  const defaultArgs: SendActionCommandArgs = {
    serializedAction,
  };

  describe("name", () => {
    it("should be 'sendAction'", () => {
      const command = new SendActionCommand(defaultArgs);
      expect(command.name).toBe("sendAction");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with cla 0x0E and ins 0x03 per specs", () => {
      const command = new SendActionCommand(defaultArgs);

      const apdu = command.getApdu();

      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x03);
      expect(apdu.p1).toBe(0x01);
      expect(apdu.p2).toBe(0x00);
      expect(apdu.data).toStrictEqual(
        new Uint8Array([0x00, 0x18, ...serializedAction]),
      );
    });

    it("should use serializedAction as APDU data", () => {
      const customTlv = new Uint8Array([0x01, 0x02, 0x03]);
      const command = new SendActionCommand({
        serializedAction: customTlv,
      });

      const apdu = command.getApdu();

      expect(apdu.data).toStrictEqual(
        new Uint8Array([0x00, 0x03, ...customTlv]),
      );
    });

    // Real-world use case from actionTlvSerializer.test.ts:302 — order action with
    // 3 orders (limit Ioc + trigger tp + trigger sl), each with a cloid, plus a builder.
    // Serialized payload is 270 bytes, which exceeds APDU_MAX_PAYLOAD (255) and currently
    // gets silently truncated by ApduBuilder.addBufferToData — this test exposes that bug.
    it("should build a proper APDU for a real-world order action (3 orders with cloid + builder)", () => {
      const action: HyperliquidAction = {
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
      };

      const fullSerializedAction = serializeActionToTlv(action);
      const command = new SendActionCommand({
        serializedAction: fullSerializedAction,
      });

      const apdu = command.getApdu();

      expect(fullSerializedAction.length).toBeGreaterThan(0xff);
      console.log(`Message lenght: ${fullSerializedAction.length}`);

      const length = fullSerializedAction.length;
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x03);
      expect(apdu.p1).toBe(0x01);
      expect(apdu.p2).toBe(0x00);
      console.log(`APDU lenght: ${apdu.data.length}`);
      expect(apdu.data).toStrictEqual(
        new Uint8Array([
          0x00,
          0x82,
          (length >> 8) & 0xff,
          length & 0xff,
          ...fullSerializedAction,
        ]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return success when status is 0x9000 and no data", () => {
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      const parsed = new SendActionCommand(defaultArgs).parseResponse(response);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: undefined }));
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });

    it("should return an error if the status code is not 0x9000", () => {
      const response = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      const result = new SendActionCommand(defaultArgs).parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if response contains unexpected data", () => {
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      const result = new SendActionCommand(defaultArgs).parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
      expect((result as { error: unknown }).error).toBeInstanceOf(
        InvalidResponseFormatError,
      );
    });
  });
});
