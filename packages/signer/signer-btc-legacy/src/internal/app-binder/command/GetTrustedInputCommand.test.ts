import {
  ApduResponse,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { LegacyGetTrustedInputCommand } from "./GetTrustedInputCommand";

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("LegacyGetTrustedInputCommand", () => {
  const data = Uint8Array.of(0x01, 0x00, 0x00, 0x00, 0x01);

  it("should prefix the first chunk with the output index", () => {
    const command = new LegacyGetTrustedInputCommand(
      { data, indexLookup: 1 },
      BTC_LEGACY_ERRORS,
    );
    expect(toHex(command.getApdu().getRawApdu())).toBe(
      "e042000009000000010100000001",
    );
  });

  it("should send the next chunks as they are", () => {
    const command = new LegacyGetTrustedInputCommand(
      { data },
      BTC_LEGACY_ERRORS,
    );
    expect(toHex(command.getApdu().getRawApdu())).toBe("e0428000050100000001");
  });

  it("should return the response", () => {
    const response = new ApduResponse({
      statusCode: Uint8Array.of(0x90, 0x00),
      data: Uint8Array.of(0x32, 0x00),
    });
    expect(
      new LegacyGetTrustedInputCommand(
        { data },
        BTC_LEGACY_ERRORS,
      ).parseResponse(response),
    ).toStrictEqual(CommandResultFactory({ data: response }));
  });

  it("should map an app error", () => {
    const result = new LegacyGetTrustedInputCommand(
      { data },
      BTC_LEGACY_ERRORS,
    ).parseResponse(
      new ApduResponse({
        statusCode: Uint8Array.of(0x6a, 0x80),
        data: new Uint8Array(),
      }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new BtcLegacyAppCommandError({
          message: "IncorrectDataError",
          errorCode: "6a80",
        }),
      }),
    );
  });
});
