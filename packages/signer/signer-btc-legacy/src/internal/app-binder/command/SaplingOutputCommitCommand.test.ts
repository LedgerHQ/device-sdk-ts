import {
  ApduResponse,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { LegacySaplingOutputCommitCommand } from "./SaplingOutputCommitCommand";

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("LegacySaplingOutputCommitCommand", () => {
  const command = new LegacySaplingOutputCommitCommand(
    {
      lockTime: 1_700_000_000,
      sigHashType: 1,
      expiryHeight: Uint8Array.of(0x01, 0x02, 0x03, 0x04),
    },
    BTC_LEGACY_ERRORS,
  );

  it("should send an empty path, the lock time, the sighash type and the expiry height", () => {
    expect(toHex(command.getApdu().getRawApdu())).toBe(
      "e04800000b00006553f1000101020304",
    );
  });

  it("should map an app error", () => {
    const result = command.parseResponse(
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
