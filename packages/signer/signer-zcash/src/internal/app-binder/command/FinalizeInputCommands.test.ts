import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { HashOutputFullCommand } from "./HashOutputFullCommand";
import { ProvideOutputFullChangePathCommand } from "./ProvideOutputFullChangePathCommand";

describe("FinalizeInput commands", () => {
  it("builds provide-change-path APDU", () => {
    const command = new ProvideOutputFullChangePathCommand({
      derivationPath: "44'/133'/0'/1/7",
    });

    expect(command.getApdu().getRawApdu()).toEqual(
      new Uint8Array([
        0xe0, 0x4a, 0xff, 0x00, 0x15, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00,
        0x00, 0x85, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
        0x00, 0x07,
      ]),
    );
  });

  it("builds hash-output APDU with last-chunk flag", () => {
    const command = new HashOutputFullCommand({
      outputChunk: new Uint8Array([0xaa, 0xbb, 0xcc]),
      isLastChunk: true,
    });

    expect(command.getApdu().getRawApdu()).toEqual(
      new Uint8Array([0xe0, 0x4a, 0x80, 0x00, 0x03, 0xaa, 0xbb, 0xcc]),
    );
  });

  it("maps errors in finalize commands", () => {
    const command = new HashOutputFullCommand({
      outputChunk: new Uint8Array([0x01]),
      isLastChunk: false,
    });
    const response = command.parseResponse(
      new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array([]),
      }),
    );

    expect(isSuccessCommandResult(response)).toBe(false);
  });
});
