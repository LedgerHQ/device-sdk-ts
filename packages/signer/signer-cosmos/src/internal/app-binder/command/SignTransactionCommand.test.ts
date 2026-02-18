import {
  ApduBuilder,
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  COSMOS_SIGN_TRANSACTION_APDU_HEADER,
  P1_ADD,
  P1_INIT,
  P1_LAST,
  SignPhase,
  SignTransactionCommand,
} from "@internal/app-binder/command/SignTransactionCommand";
import {
  type CosmosAppCommandError,
  CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

describe("SignTransactionCommand", () => {
  describe("name", () => {
    it("should be 'SignTransaction'", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
      });
      // ASSERT
      expect(command.name).toBe("SignTransaction");
    });
  });

  describe("getApdu", () => {
    const pathToBuffer = (derivationPath: string): Uint8Array => {
      const derivationPathArray = DerivationPathUtils.splitPath(derivationPath);
      const view = new DataView(new ArrayBuffer(20));
      for (let i = 0; i < derivationPathArray.length; i++) {
        const raw = derivationPathArray[i]! & 0x7fffffff;
        const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
        view.setUint32(i * 4, hardened, true);
      }
      return new Uint8Array(view.buffer);
    };

    it("should return first APDU packet when phase is INIT", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
      });
      const expected = new ApduBuilder(
        COSMOS_SIGN_TRANSACTION_APDU_HEADER(P1_INIT),
      )
        .addBufferToData(pathToBuffer("44'/118'/0'/0/0"))
        .encodeInLVFromAscii("cosmos");
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should return APDU add packet (P1=0x01) when phase is ADD", () => {
      // ARRANGE
      const chunk = new TextEncoder().encode('{"fake-tx":"0"}');
      const command = new SignTransactionCommand({
        phase: SignPhase.ADD,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(
        COSMOS_SIGN_TRANSACTION_APDU_HEADER(P1_ADD),
      ).addBufferToData(chunk);
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should return APDU last packet (P1=0x02) when phase is LAST", () => {
      // ARRANGE
      const chunk = new TextEncoder().encode('{"fake-tw":"0"}');
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(
        COSMOS_SIGN_TRANSACTION_APDU_HEADER(P1_LAST),
      ).addBufferToData(chunk);
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should throw when phase is INIT and derivationPath is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        hrp: "cosmos",
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: derivation path and human readable prefix are required for 'init' phase.",
      );
    });

    it("should throw when phase is INIT and hrp is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/118'/0'/0/0",
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: derivation path and human readable prefix are required for 'init' phase.",
      );
    });

    it("should throw when phase is INIT and path does not have 5 elements", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/118'/0'",
        hrp: "cosmos",
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: expected cosmos style number of path elements, got 3",
      );
    });

    it("should throw when phase is ADD and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.ADD,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });

    it("should throw when phase is LAST and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });
  });

  describe("parseResponse", () => {
    it("should return signature on success", () => {
      // ARRANGE
      const signature = new Uint8Array(64).fill(0xab);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: signature,
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(CommandResultFactory({ data: signature }));
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return CosmosAppCommandError with DATA_INVALID when status is 0x6984", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array(64),
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as CosmosAppCommandError;
        expect((err.originalError as { errorCode: string }).errorCode).toBe(
          CosmosErrorCodes.DATA_INVALID.slice(2),
        );
      }
    });
  });
});
