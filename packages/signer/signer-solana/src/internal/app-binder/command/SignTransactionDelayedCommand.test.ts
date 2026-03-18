import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { UserInputType } from "@api/model/TransactionResolutionContext";
import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import {
  CLA,
  INS,
  P1,
  P2,
  SignTransactionDelayedCommand,
  type SignTransactionDelayedCommandArgs,
} from "./SignTransactionDelayedCommand";

describe("SignTransactionDelayedCommand", () => {
  const defaultArgs: SignTransactionDelayedCommandArgs = {
    serializedTransaction: new Uint8Array(),
    more: false,
    extend: false,
  };

  describe("name", () => {
    it("should be 'signTransactionDelayed'", () => {
      const command = new SignTransactionDelayedCommand(defaultArgs);
      expect(command.name).toBe("signTransactionDelayed");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU when the data is empty", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array());
      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2.INIT);
    });

    it("should return the correct APDU when the data is not empty", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand({
        serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
        more: false,
        extend: false,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2.INIT);
    });

    it("should return the correct APDU when the more flag is set", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand({
        serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
        more: true,
        extend: false,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2.MORE);
    });

    it("should return the correct APDU when the extend flag is set", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand({
        serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
        more: false,
        extend: true,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2.EXTEND);
    });

    it("should return the correct APDU when the more and extend flags are set", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand({
        serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
        more: true,
        extend: true,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2.MORE | P2.EXTEND);
    });

    it("should set the ATA userInputType flag in p2", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand({
        ...defaultArgs,
        userInputType: UserInputType.ATA,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array());
      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2.ATA);
    });

    it("should combine ATA userInputType flag with more and extend flags in p2", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand({
        serializedTransaction: new Uint8Array([0x01, 0x02]),
        more: true,
        extend: true,
        userInputType: UserInputType.ATA,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02]));
      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2.ATA | P2.MORE | P2.EXTEND);
    });
  });

  describe("parseResponse", () => {
    it("should return Nothing when the response is empty", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);

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

    it("should return the signature when the response is not empty", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);
      const data = new Uint8Array(Array.from({ length: 64 }, (_, i) => i + 1));

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

    it("should return an error when the response data is not valid", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array([0x01]),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result))
        assert.fail("The result should be an error.");
      else {
        expect(result.error).toEqual(
          new InvalidStatusWordError("Signature is missing"),
        );
      }
    });

    it("should return an error for delayed preview not found (0x6f10)", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6f, 0x10]),
          data: new Uint8Array(),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result))
        assert.fail("The result should be an error.");
      else {
        expect(result.error).toBeInstanceOf(SolanaAppCommandError);
        expect((result.error as SolanaAppCommandError).message).toBe(
          "Delayed signing preview not found",
        );
      }
    });

    it("should return an error for delayed hash mismatch (0x6f11)", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6f, 0x11]),
          data: new Uint8Array(),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result))
        assert.fail("The result should be an error.");
      else {
        expect(result.error).toBeInstanceOf(SolanaAppCommandError);
        expect((result.error as SolanaAppCommandError).message).toBe(
          "Delayed signing hash mismatch",
        );
      }
    });

    it("should return an error for delayed length mismatch (0x6f12)", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6f, 0x12]),
          data: new Uint8Array(),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result))
        assert.fail("The result should be an error.");
      else {
        expect(result.error).toBeInstanceOf(SolanaAppCommandError);
        expect((result.error as SolanaAppCommandError).message).toBe(
          "Delayed signing length mismatch",
        );
      }
    });

    it("should return an error for delayed derivation mismatch (0x6f13)", () => {
      // GIVEN
      const command = new SignTransactionDelayedCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6f, 0x13]),
          data: new Uint8Array(),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result))
        assert.fail("The result should be an error.");
      else {
        expect(result.error).toBeInstanceOf(SolanaAppCommandError);
        expect((result.error as SolanaAppCommandError).message).toBe(
          "Delayed signing derivation mismatch",
        );
      }
    });
  });
});
