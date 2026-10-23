import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { LegacySignTransactionCommand } from "./SignTransactionCommand";

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("LegacySignTransactionCommand", () => {
  const command = new LegacySignTransactionCommand(
    { derivationPath: "44'/2'/0'/0/1", lockTime: 2_800_000, sigHashType: 1 },
    BTC_LEGACY_ERRORS,
  );

  it("should send the path, the lock time and the sighash type", () => {
    expect(toHex(command.getApdu().getRawApdu())).toBe(
      "e04800001b058000002c8000000280000000000000000000000100002ab98001",
    );
  });

  it("should restore the DER sequence tag of the signature", () => {
    const result = command.parseResponse(
      new ApduResponse({
        statusCode: Uint8Array.of(0x90, 0x00),
        data: Uint8Array.of(0x31, 0x02, 0x02, 0x01, 0x01),
      }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: { signature: Uint8Array.of(0x30, 0x02, 0x02, 0x01, 0x01) },
      }),
    );
  });

  it("should fail without a signature", () => {
    const result = command.parseResponse(
      new ApduResponse({
        statusCode: Uint8Array.of(0x90, 0x00),
        data: new Uint8Array(),
      }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Signature is missing"),
      }),
    );
  });

  it("should map a rejection", () => {
    const result = command.parseResponse(
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
