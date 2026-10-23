import {
  ApduResponse,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { LegacyProvideOutputFullChangePathCommand } from "./ProvideOutputFullChangePathCommand";

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("LegacyProvideOutputFullChangePathCommand", () => {
  it("should send the change path", () => {
    const command = new LegacyProvideOutputFullChangePathCommand(
      { derivationPath: "44'/2'/0'/1/0" },
      BTC_LEGACY_ERRORS,
    );
    expect(toHex(command.getApdu().getRawApdu())).toBe(
      "e04aff0015058000002c80000002800000000000000100000000",
    );
  });

  it("should map an app error", () => {
    const result = new LegacyProvideOutputFullChangePathCommand(
      { derivationPath: "44'/2'/0'/1/0" },
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
