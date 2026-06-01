import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { StartUntrustedHashTransactionInputCommand } from "./StartUntrustedHashTransactionInputCommand";

describe("StartUntrustedHashTransactionInputCommand", () => {
  it("builds first-round APDU with sapling hash-input-start p2", () => {
    const command = new StartUntrustedHashTransactionInputCommand({
      newTransaction: true,
      firstRound: true,
      transactionData: new Uint8Array([0xaa, 0xbb]),
    });

    expect(command.getApdu().getRawApdu()).toEqual(
      new Uint8Array([0xe0, 0x44, 0x00, 0x05, 0x02, 0xaa, 0xbb]),
    );
  });

  it("uses p2=0x80 for continuation of existing transaction", () => {
    const command = new StartUntrustedHashTransactionInputCommand({
      newTransaction: false,
      firstRound: false,
      transactionData: new Uint8Array([0x01]),
    });

    expect(command.getApdu().getRawApdu()).toEqual(
      new Uint8Array([0xe0, 0x44, 0x80, 0x80, 0x01, 0x01]),
    );
  });

  it("returns success on 0x9000", () => {
    const command = new StartUntrustedHashTransactionInputCommand({
      newTransaction: true,
      firstRound: true,
      transactionData: new Uint8Array([0x01]),
    });
    const apduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([]),
    });

    expect(command.parseResponse(apduResponse)).toEqual(
      CommandResultFactory({ data: apduResponse }),
    );
  });

  it("maps command errors", () => {
    const command = new StartUntrustedHashTransactionInputCommand({
      newTransaction: true,
      firstRound: true,
      transactionData: new Uint8Array([0x01]),
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
