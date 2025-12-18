import {
  ApduResponse,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import {
  SignTransactionCommand,
  type SignTransactionCommandArgs,
} from "@internal/app-binder/command/SignTransactionCommand";

describe("SignTransactionCommand (Cosmos)", () => {
  const defaultDerivationPath = "44'/118'/0'/0/0";
  const defaultPrefix = "cosmos";

  const initArgs: SignTransactionCommandArgs = {
    phase: "init",
    format: "json",
    prefix: defaultPrefix,
    derivationPath: defaultDerivationPath,
  };

  const addArgs: SignTransactionCommandArgs = {
    phase: "add",
    format: "json",
    prefix: defaultPrefix,
    serializedTransactionChunk: new Uint8Array([0x01, 0x02, 0x03]),
  };

  const lastArgs: SignTransactionCommandArgs = {
    phase: "last",
    format: "json",
    prefix: defaultPrefix,
    serializedTransactionChunk: new Uint8Array([0x04, 0x05, 0x06]),
  };

  const textDecoder = new TextDecoder("ascii");

  describe("name", () => {
    it("should be 'signTransaction'", () => {
      const command = new SignTransactionCommand(initArgs);
      expect(command.name).toBe("signTransaction");
    });
  });

  describe("getApdu", () => {
    it("should build the correct APDU for phase 'init' (HRP + derivation path)", () => {
      // GIVEN
      const command = new SignTransactionCommand(initArgs);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.cla).toBe(0x55);
      expect(apdu.ins).toBe(0x02);
      // p1 = phase 'init'
      expect(apdu.p1).toBe(0x00);
      // p2 = format 'json'
      expect(apdu.p2).toBe(0x00);

      const data = apdu.data;
      expect(data.length).toBeGreaterThan(0);

      const hrpLocation = 21; // 4 + 4 + 4 + 4 + 4 + 1;
      // see First Packet in https://github.com/LedgerHQ/app-cosmos/blob/develop/docs/APDUSPEC.md#ins_sign
      const hrpLen = data[hrpLocation - 1]!;
      expect(hrpLen).toBe(defaultPrefix.length);

      const hrpBytes = data.slice(hrpLocation, hrpLocation + hrpLen);
      expect(textDecoder.decode(hrpBytes)).toBe(defaultPrefix);

      // since data contains first packet only, everything upto the hrp len location is the derivation path
      const pathLen = data.slice(0, hrpLocation - 1).length;
      const pathCount = pathLen / 4;
      expect(pathCount).toBe(5);
      expect(data.length).toBeGreaterThan(pathLen + 1);
    });

    it("should build the correct APDU for phase 'add' (transaction chunk)", () => {
      // GIVEN
      const command = new SignTransactionCommand(addArgs);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.cla).toBe(0x55);
      expect(apdu.ins).toBe(0x02);
      // p1 = phase 'add'
      expect(apdu.p1).toBe(0x01);
      // p2 = format 'json'
      expect(apdu.p2).toBe(0x00);
      // since it's not the first packet, data contains full message bytes for the chunk
      expect(apdu.data).toStrictEqual(addArgs.serializedTransactionChunk);
    });

    it("should build the correct APDU for phase 'last' (final transaction chunk)", () => {
      // GIVEN
      const command = new SignTransactionCommand(lastArgs);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.cla).toBe(0x55);
      expect(apdu.ins).toBe(0x02);
      // p1 = phase 'last'
      expect(apdu.p1).toBe(0x02);
      // p2 = format 'json'
      expect(apdu.p2).toBe(0x00);
      // since it's not the first packet, data contains full message bytes for the chunk
      expect(apdu.data).toStrictEqual(lastArgs.serializedTransactionChunk);
    });
  });

  describe("parseResponse", () => {
    it("should return Nothing when the response data is empty", () => {
      // GIVEN
      const command = new SignTransactionCommand(initArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array([]),
        }),
      );

      // THEN
      expect(result).toStrictEqual(CommandResultFactory({ data: Nothing }));
    });

    it("should return the signature when the response contains > 0 bytes", () => {
      // GIVEN
      const command = new SignTransactionCommand(initArgs);
      const data = new Uint8Array(
        Array.from({ length: 64 }, (_, i) => (i + 1) & 0xff),
      );

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data,
        }),
      );

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Just(data),
        }),
      );
    });
  });
});
