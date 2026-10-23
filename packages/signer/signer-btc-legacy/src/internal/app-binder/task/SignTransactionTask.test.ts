import {
  bufferToHexaString,
  type Command,
  type DeviceManagementKit,
  type DeviceSessionId,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { BITCOIN_CASH_PROFILE } from "@api/profiles/bitcoinCashProfile";
import { BITCOIN_LEGACY_PROFILE } from "@api/profiles/bitcoinLegacyProfile";
import { BITCOIN_PROFILE } from "@api/profiles/bitcoinProfile";
import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import {
  BtcLegacyAppCommandError,
  type BtcLegacyErrorCodes,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { REFERENCE_TRANSACTIONS } from "@internal/app-binder/task/__fixtures__/referenceTransactions";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";
import { makeContainer } from "@internal/di";

import { type SignTransactionTask } from "./SignTransactionTask";

const getTask = (profile: LegacyCoinProfile<BtcLegacyErrorCodes>) =>
  makeContainer({
    dmk: {} as DeviceManagementKit,
    sessionId: "session-id" as DeviceSessionId,
    profile,
  }).get<SignTransactionTask<BtcLegacyErrorCodes>>(
    btcLegacyTypes.SignTransactionTask,
  );

// Answers each command with the recorded response, after checking that its
// APDU is the one hw-app-btc sent at that point.
const replay = (exchanges: [apdu: string, response: string][]) => {
  let index = 0;
  const sendCommand = vi.fn(
    (command: Command<unknown, unknown, BtcLegacyErrorCodes>) => {
      const [apdu, response] = exchanges[index++]!;
      expect(bufferToHexaString(command.getApdu().getRawApdu(), false)).toBe(
        apdu,
      );
      const bytes = hexaStringToBuffer(response)!;
      return Promise.resolve(
        command.parseResponse({
          data: bytes.slice(0, -2),
          statusCode: bytes.slice(-2),
        }),
      );
    },
  );
  return { api: { sendCommand } as unknown as InternalApi, sendCommand };
};

const [ONE_INPUT, TWO_INPUTS] = REFERENCE_TRANSACTIONS;

describe("SignTransactionTask", () => {
  describe.each(REFERENCE_TRANSACTIONS)(
    "$name",
    ({ profile, transaction, exchanges, signedTransaction }) => {
      it("should send hw-app-btc's APDUs and build its transaction", async () => {
        const { api, sendCommand } = replay(exchanges);

        const result = await getTask(profile).run(api, transaction);

        expect(result).toStrictEqual({
          status: "SUCCESS",
          data: signedTransaction,
        });
        expect(sendCommand).toHaveBeenCalledTimes(exchanges.length);
      });
    },
  );

  it("should default to the profile's sighash type", async () => {
    const { transaction, exchanges, signedTransaction } =
      REFERENCE_TRANSACTIONS.find(
        (reference) => reference.profile === BITCOIN_CASH_PROFILE,
      )!;
    const { api } = replay(exchanges);

    const result = await getTask(BITCOIN_CASH_PROFILE).run(api, {
      ...transaction,
      sigHashType: undefined,
    });

    expect(result).toStrictEqual({
      status: "SUCCESS",
      data: signedTransaction,
    });
  });

  // Speculos no longer runs the Bitcoin app before 2.1. Bitcoin Legacy is
  // that app under another name.
  it("should sign for the old Bitcoin apps as Bitcoin Legacy", async () => {
    const { transaction, exchanges, signedTransaction } =
      REFERENCE_TRANSACTIONS.find(
        (reference) => reference.profile === BITCOIN_LEGACY_PROFILE,
      )!;
    const { api } = replay(exchanges);

    const result = await getTask(BITCOIN_PROFILE).run(api, transaction);

    expect(result).toStrictEqual({
      status: "SUCCESS",
      data: signedTransaction,
    });
  });

  it("should return the error of a rejected signature", async () => {
    const { transaction, exchanges } = ONE_INPUT!;
    const signIndex = exchanges.findIndex(([apdu]) => apdu.startsWith("e048"));
    const { api, sendCommand } = replay([
      ...exchanges.slice(0, signIndex),
      [exchanges[signIndex]![0], "6985"],
    ]);

    const result = await getTask(LITECOIN_PROFILE).run(api, transaction);

    expect(result).toStrictEqual({
      status: "ERROR",
      error: new BtcLegacyAppCommandError({
        message: "UserRejectedError",
        errorCode: "6985",
      }),
    });
    expect(sendCommand).toHaveBeenCalledTimes(signIndex + 1);
  });

  it("should return the error of a trusted input", async () => {
    const { transaction, exchanges } = TWO_INPUTS!;
    const { api } = replay([[exchanges[0]![0], "6a80"]]);

    const result = await getTask(LITECOIN_PROFILE).run(api, transaction);

    expect(result).toStrictEqual({
      status: "ERROR",
      error: new BtcLegacyAppCommandError({
        message: "IncorrectDataError",
        errorCode: "6a80",
      }),
    });
  });

  describe("invalid arguments", () => {
    const { api, sendCommand } = replay([]);
    const base = ONE_INPUT!.transaction;
    const [previousTransaction] = base.inputs[0]!;

    it.each<[string, LegacyCreateTransactionArg, string]>([
      [
        "the transaction has no input",
        { ...base, inputs: [], associatedKeysets: [] },
        "The transaction has no input",
      ],
      [
        "an associated keyset is missing",
        { ...base, associatedKeysets: [] },
        "Inputs and associatedKeysets lengths mismatch",
      ],
      [
        "the output script is not hexadecimal",
        { ...base, outputScriptHex: "zz" },
        "The output script is not a non-empty hexadecimal string",
      ],
      [
        "the output script is empty",
        { ...base, outputScriptHex: "" },
        "The output script is not a non-empty hexadecimal string",
      ],
      [
        "the lock time is out of range",
        { ...base, lockTime: 2 ** 32 },
        "The lock time is not a uint32",
      ],
      [
        "the sighash type is out of range",
        { ...base, sigHashType: 0x100 },
        "The sighash type is not a uint8",
      ],
      [
        "a sequence is out of range",
        { ...base, inputs: [[previousTransaction, 1, null, -1]] },
        "The sequence is not a uint32",
      ],
      [
        "the output index is out of the previous transaction",
        { ...base, inputs: [[previousTransaction, 2]] },
        "Invalid output index in previous transaction",
      ],
      [
        "the redeem script is not hexadecimal",
        { ...base, inputs: [[previousTransaction, 1, "zz"]] },
        "The redeem script is not a hexadecimal string",
      ],
      [
        "the expiry height is not 4 bytes",
        { ...base, expiryHeight: new Uint8Array(3) },
        "The expiry height is not 4 bytes",
      ],
      [
        "the previous transaction has no lock time",
        {
          ...base,
          inputs: [[{ ...previousTransaction, locktime: undefined }, 1]],
        },
        "The previous transaction needs its outputs and lock time",
      ],
      [
        "an output of the previous transaction does not fit in one APDU",
        {
          ...base,
          inputs: [
            [
              {
                ...previousTransaction,
                outputs: [
                  ...previousTransaction.outputs!,
                  { amount: new Uint8Array(8), script: new Uint8Array(247) },
                ],
              },
              1,
            ],
          ],
        },
        "An output of the previous transaction does not fit in one APDU",
      ],
    ])(
      "should fail before any APDU when %s",
      async (_, transaction, message) => {
        const result = await getTask(LITECOIN_PROFILE).run(api, transaction);

        expect(result).toStrictEqual({
          status: "ERROR",
          error: new InvalidStatusWordError(message),
        });
        expect(sendCommand).not.toHaveBeenCalled();
      },
    );
  });
});
