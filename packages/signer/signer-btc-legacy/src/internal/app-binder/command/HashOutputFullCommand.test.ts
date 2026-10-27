import {
  ApduResponse,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { LegacyHashOutputFullCommand } from "./HashOutputFullCommand";

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("LegacyHashOutputFullCommand", () => {
  const outputChunk = Uint8Array.of(0x01, 0x02);

  it.each([
    [false, "e04a0000020102"],
    [true, "e04a8000020102"],
  ])("should build the APDU of a last chunk %s", (isLastChunk, apdu) => {
    const command = new LegacyHashOutputFullCommand(
      { outputChunk, isLastChunk },
      BTC_LEGACY_ERRORS,
    );
    expect(toHex(command.getApdu().getRawApdu())).toBe(apdu);
  });

  it("should map a rejection", () => {
    const result = new LegacyHashOutputFullCommand(
      { outputChunk, isLastChunk: true },
      BTC_LEGACY_ERRORS,
    ).parseResponse(
      new ApduResponse({
        statusCode: Uint8Array.of(0x69, 0x85),
        data: new Uint8Array(),
      }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new BtcLegacyAppCommandError({
          message: "UserRejectedError",
          errorCode: "6985",
        }),
      }),
    );
  });
});
