import {
  ApduResponse,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";

import { TRANSACTION_TYPE } from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { LegacyStartUntrustedHashTransactionInputCommand } from "./StartUntrustedHashTransactionInputCommand";

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("LegacyStartUntrustedHashTransactionInputCommand", () => {
  const transactionData = Uint8Array.of(0x01, 0x00, 0x00, 0x00, 0x02);

  it.each([
    [true, true, "e0440000050100000002"],
    [true, false, "e0448000050100000002"],
    [false, true, "e0440080050100000002"],
    [false, false, "e0448080050100000002"],
  ])(
    "should build the APDU of newTransaction %s and firstRound %s",
    (newTransaction, firstRound, apdu) => {
      const command = new LegacyStartUntrustedHashTransactionInputCommand(
        { newTransaction, firstRound, transactionData },
        BTC_LEGACY_ERRORS,
      );
      expect(toHex(command.getApdu().getRawApdu())).toBe(apdu);
    },
  );

  it("should start a new transaction with its transaction type", () => {
    const command = new LegacyStartUntrustedHashTransactionInputCommand(
      {
        newTransaction: true,
        firstRound: false,
        transactionData,
        transactionType: TRANSACTION_TYPE.BIP143,
      },
      BTC_LEGACY_ERRORS,
    );
    expect(toHex(command.getApdu().getRawApdu())).toBe("e0448002050100000002");
  });

  it("should map an app error", () => {
    const result = new LegacyStartUntrustedHashTransactionInputCommand(
      { newTransaction: true, firstRound: true, transactionData },
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
