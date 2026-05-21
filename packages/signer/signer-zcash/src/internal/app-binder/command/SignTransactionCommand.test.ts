import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransactionCommand } from "./SignTransactionCommand";

describe("SignTransactionCommand", () => {
  it("builds APDU payload compatible with hw-app-btc signTransaction (Zcash overwinter + expiryHeight)", () => {
    const command = new SignTransactionCommand({
      derivationPath: "44'/133'/0'/0/0",
      lockTime: 1,
      sigHashType: 0x01,
      expiryHeight: Buffer.from([0x01, 0x02, 0x03, 0x04]),
    });

    const apdu = command.getApdu().getRawApdu();
    expect(Buffer.from(apdu).toString("hex")).toBe(
      "e04800001f058000002c8000008580000000000000000000000000000000010101020304",
    );
  });

  it("normalizes first byte of signature payload to 0x30 (legacy compat)", () => {
    const command = new SignTransactionCommand({
      derivationPath: "44'/133'/0'/0/0",
      lockTime: 0,
      sigHashType: 0x01,
      expiryHeight: Buffer.alloc(4, 0),
    });
    const response = command.parseResponse(
      new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x31, 0xaa, 0xbb]),
      }),
    );

    expect(response).toEqual(
      CommandResultFactory({
        data: {
          signature: new Uint8Array([0x30, 0xaa, 0xbb]),
        },
      }),
    );
  });

  it("appends 4-byte expiry height from task-normalized buffer", () => {
    const command = new SignTransactionCommand({
      derivationPath: "44'/133'/0'/1/2",
      lockTime: 0,
      sigHashType: 0x01,
      expiryHeight: Buffer.alloc(4, 0),
    });

    expect(Buffer.from(command.getApdu().getRawApdu()).toString("hex")).toBe(
      "e04800001f058000002c8000008580000000000000010000000200000000000100000000",
    );
  });

  it("maps status-word errors", () => {
    const command = new SignTransactionCommand({
      derivationPath: "44'/133'/0'/0/0",
      lockTime: 0,
      sigHashType: 0x01,
      expiryHeight: Buffer.alloc(4, 0),
    });
    const result = command.parseResponse(
      new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array([]),
      }),
    );

    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
