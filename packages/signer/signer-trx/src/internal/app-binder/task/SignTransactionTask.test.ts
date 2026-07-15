import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
} from "@internal/app-binder/command/utils/tronApplicationErrors";

import { SignTransactionTask } from "./SignTransactionTask";

const PATH = "44'/195'/0'/0/0";
// Encoded "44'/195'/0'/0/0": length byte (05) + 5 BE32 path elements.
const PATH_HEX = "058000002c800000c3800000000000000000000000";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

const SIGNATURE = fromHex("ab".repeat(65));

describe("SignTransactionTask", () => {
  const sendCommandMock = vi.fn();
  const api = { sendCommand: sendCommandMock } as unknown as InternalApi;

  const sentCommand = (call: number): SignTransactionCommand => {
    const command = sendCommandMock.mock.calls[call]![0] as unknown;
    expect(command).toBeInstanceOf(SignTransactionCommand);
    return command as SignTransactionCommand;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs a single-frame transaction", async () => {
    // GIVEN a transaction fitting in one frame
    const rawTxHex = "0a0100";
    sendCommandMock.mockResolvedValueOnce(
      CommandResultFactory({ data: SIGNATURE }),
    );

    // WHEN
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex(rawTxHex),
    }).run();

    // THEN a single frame is sent with the path header and the signature returned
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(sentCommand(0).args.p1).toBe(0x10);
    expect(toHex(sentCommand(0).args.payload)).toBe(PATH_HEX + rawTxHex);
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("signs a multi-frame transaction and returns the last frame's signature", async () => {
    // GIVEN a transaction spanning two frames; only the last returns a signature
    const rawTxHex = "0801".repeat(200);
    sendCommandMock
      .mockResolvedValueOnce(CommandResultFactory({ data: new Uint8Array() }))
      .mockResolvedValueOnce(CommandResultFactory({ data: SIGNATURE }));

    // WHEN
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex(rawTxHex),
    }).run();

    // THEN both frames are sent in order with the expected start bytes
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
    expect(sentCommand(0).args.p1).toBe(0x00);
    expect(sentCommand(1).args.p1).toBe(0x90);
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("aborts on the first failing frame", async () => {
    // GIVEN a two-frame transaction whose first frame fails
    const rawTxHex = "0801".repeat(200);
    const error = CommandResultFactory({
      error: TronAppCommandErrorFactory({
        ...TRON_APP_ERRORS["6a80"],
        errorCode: "6a80",
      }),
    });
    sendCommandMock.mockResolvedValueOnce(error);

    // WHEN
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex(rawTxHex),
    }).run();

    // THEN no further frame is sent and the error is returned unchanged
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(error);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("propagates a user rejection (6985) on the final frame", async () => {
    // GIVEN a two-frame transaction rejected by the user on the last frame
    const rawTxHex = "0801".repeat(200);
    const rejection = CommandResultFactory({
      error: TronAppCommandErrorFactory({
        ...TRON_APP_ERRORS["6985"],
        errorCode: "6985",
      }),
    });
    sendCommandMock
      .mockResolvedValueOnce(CommandResultFactory({ data: new Uint8Array() }))
      .mockResolvedValueOnce(rejection);

    // WHEN
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex(rawTxHex),
    }).run();

    // THEN the rejection is propagated
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
    expect(result).toBe(rejection);
    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
