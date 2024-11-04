import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignOffChainMessageCommand } from "./SignOffChainMessageCommand";

describe("SignOffChainMessageCommand", () => {
  let command: SignOffChainMessageCommand;
  const MESSAGE = new Uint8Array(
    Buffer.from("Solana SignOffChainMessage", "utf-8"),
  );
  const SIGNATURE_LENGTH = 64;

  beforeEach(() => {
    command = new SignOffChainMessageCommand({
      message: MESSAGE,
      derivationPath: "44'/501'/0'/0'",
    });
    jest.clearAllMocks();
    jest.requireActual("@ledgerhq/device-management-kit");
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();

      const expectedApdu = new ApduBuilder({
        cla: 0xe0,
        ins: 0x07,
        p1: 0x01,
        p2: 0x00,
      })
        .addBufferToData(MESSAGE)
        .build();

      expect(apdu.getRawApdu()).toEqual(expectedApdu.getRawApdu());
    });
  });

  describe("parseResponse", () => {
    it("should parse the response correctly", () => {
      const signature = new Uint8Array(SIGNATURE_LENGTH).fill(0x01);
      const parsed = command.parseResponse(
        new ApduResponse({
          data: signature,
          statusCode: new Uint8Array([0x90, 0x00]),
        }),
      );

      expect(isSuccessCommandResult(parsed)).toBe(true);
      if (isSuccessCommandResult(parsed)) {
        expect(parsed.data).toEqual(signature);
      } else {
        fail("Expected success result");
      }
    });

    describe("error handling", () => {
      it("should return error if response is not success", () => {
        const result = command.parseResponse(
          new ApduResponse({
            statusCode: new Uint8Array([0x6a, 0x82]),
            data: new Uint8Array(0),
          }),
        );

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              message: "Unexpected device exchange error happened.",
            }),
          );
        } else {
          fail("Expected error");
        }
      });

      it("should return error if signature is missing or incomplete", () => {
        const incompleteSignature = new Uint8Array(SIGNATURE_LENGTH - 1).fill(
          0x01,
        );
        const result = command.parseResponse(
          new ApduResponse({
            data: incompleteSignature,
            statusCode: new Uint8Array([0x90, 0x00]),
          }),
        );
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          if (
            typeof result.error.originalError === "object" &&
            result.error.originalError !== null &&
            "message" in result.error.originalError
          ) {
            expect(result.error.originalError.message).toBe(
              "Signature is missing or incomplete",
            );
          }
        } else {
          fail("Expected error");
        }
      });
    });
  });
});
