import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  icpSignTransactionApduHeader,
  P1_ADD,
  P1_INIT,
  P1_LAST,
  SignPhase,
  SignTransactionCommand,
} from "@internal/app-binder/command/SignTransactionCommand";
import {
  type IcpAppCommandError,
  IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";

const DERIVATION_PATH = "44'/223'/0'/0/0";

const pathToBuffer = (derivationPath: string): Uint8Array => {
  const parts = DerivationPathUtils.splitPath(derivationPath);
  const view = new DataView(new ArrayBuffer(20));
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i]! & 0x7fffffff;
    const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
    view.setUint32(i * 4, hardened, true);
  }
  return new Uint8Array(view.buffer);
};

describe("SignTransactionCommand", () => {
  describe("name", () => {
    it("should be 'SignTransaction'", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: DERIVATION_PATH,
      });
      // ASSERT
      expect(command.name).toBe("SignTransaction");
    });
  });

  describe("getApdu", () => {
    it("should return the derivation-path packet (P1=INIT, P2=0) when phase is INIT", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: DERIVATION_PATH,
      });
      const expected = new ApduBuilder(icpSignTransactionApduHeader(P1_INIT))
        .addBufferToData(pathToBuffer(DERIVATION_PATH))
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should return an add packet (P1=ADD) carrying the chunk when phase is ADD", () => {
      // ARRANGE
      const chunk = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const command = new SignTransactionCommand({
        phase: SignPhase.ADD,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(icpSignTransactionApduHeader(P1_ADD))
        .addBufferToData(chunk)
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should return a last packet (P1=LAST) carrying the chunk when phase is LAST", () => {
      // ARRANGE
      const chunk = new Uint8Array([0x01, 0x02, 0x03]);
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(icpSignTransactionApduHeader(P1_LAST))
        .addBufferToData(chunk)
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should throw when phase is INIT and derivationPath is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({ phase: SignPhase.INIT });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: derivation path is required for 'init' phase.",
      );
    });

    it("should throw when phase is INIT and path does not have 5 elements", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/223'/0'",
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: expected 5 path elements, got 3",
      );
    });

    it("should throw when phase is ADD and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({ phase: SignPhase.ADD });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });

    it("should throw when phase is LAST and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({ phase: SignPhase.LAST });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });
  });

  describe("parseResponse", () => {
    it("should split the response into r, s, v and DER signature on success", () => {
      // ARRANGE
      const r = new Uint8Array(32).fill(0xaa);
      const s = new Uint8Array(32).fill(0xbb);
      const v = new Uint8Array([0x01]);
      const der = new Uint8Array([
        0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01,
      ]);
      const data = new Uint8Array([...r, ...s, ...v, ...der]);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.r).toBe("aa".repeat(32));
        expect(result.data.s).toBe("bb".repeat(32));
        expect(result.data.v).toBe(1);
        expect(result.data.der).toBe("3006020101020101");
      }
    });

    it("should reject a response that carries r, s and v but no DER signature", () => {
      // ARRANGE
      const r = new Uint8Array(32).fill(0xaa);
      const s = new Uint8Array(32).fill(0xbb);
      const v = new Uint8Array([0x01]);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([...r, ...s, ...v]), // 65 bytes, DER missing
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error when the signature is incomplete", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(10),
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return IcpAppCommandError when status word signals an error", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array(0),
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
        const err = result.error as IcpAppCommandError;
        expect((err.originalError as { errorCode: string }).errorCode).toBe(
          IcpErrorCodes.DATA_INVALID.slice(2),
        );
      }
    });
  });
});
