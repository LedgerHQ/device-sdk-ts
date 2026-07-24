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
    sendCommandMock.mockResolvedValueOnce(
      CommandResultFactory({ data: SIGNATURE }),
    );

    // WHEN
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex("0a0100"),
    }).run();

    // THEN a single SINGLE-frame is sent and the signature is returned
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(sentCommand(0).args.p1).toBe(0x10);
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("signs a multi-frame transaction and returns the last frame's signature", async () => {
    // GIVEN a transaction spanning two frames; only the last returns a signature
    sendCommandMock
      .mockResolvedValueOnce(CommandResultFactory({ data: new Uint8Array() }))
      .mockResolvedValueOnce(CommandResultFactory({ data: SIGNATURE }));

    // WHEN
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex("0a01" + "01".repeat(400)),
    }).run();

    // THEN both frames are sent in order and the signature is returned
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
    expect(sentCommand(0).args.p1).toBe(0x00);
    expect(sentCommand(1).args.p1).toBe(0x90);
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("aborts on the first failing frame", async () => {
    // GIVEN a two-frame transaction whose first frame fails
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
      transaction: fromHex("0a01" + "01".repeat(400)),
    }).run();

    // THEN no further frame is sent and the error is returned unchanged
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(error);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("returns a typed error when serialization throws", async () => {
    // GIVEN a transaction whose first protobuf field exceeds the chunk size
    // (field key 0x0a, declared length 251) - serializeTransaction throws
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex("0afb01"),
    }).run();

    // THEN no command is sent and the failure is a typed command error
    expect(sendCommandMock).not.toHaveBeenCalled();
    expect(isSuccessCommandResult(result)).toBe(false);
    expect(
      !isSuccessCommandResult(result) &&
        (result.error as { originalError?: Error }).originalError?.message,
    ).toBe("Too many bytes to encode.");
  });

  it("returns an error when the final frame carries no signature", async () => {
    // GIVEN a single-frame transaction whose response has an empty payload
    sendCommandMock.mockResolvedValueOnce(
      CommandResultFactory({ data: new Uint8Array() }),
    );

    // WHEN
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex("0a0100"),
    }).run();

    // THEN the empty signature is treated as an error, not a success
    expect(isSuccessCommandResult(result)).toBe(false);
    expect(
      !isSuccessCommandResult(result) &&
        (result.error as { originalError?: Error }).originalError?.message,
    ).toBe("No signature returned by the device");
  });

  it("returns a typed error for an invalid token signature hex", async () => {
    // WHEN a token signature is not valid hex
    const result = await new SignTransactionTask(api, {
      derivationPath: PATH,
      transaction: fromHex("0a0100"),
      tokenSignatures: ["nothex"],
    }).run();

    // THEN no command is sent and a typed error is returned
    expect(sendCommandMock).not.toHaveBeenCalled();
    expect(isSuccessCommandResult(result)).toBe(false);
    expect(
      !isSuccessCommandResult(result) &&
        (result.error as { originalError?: Error }).originalError?.message,
    ).toBe("Invalid token signature hex: nothex");
  });
});
