import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignPersonalMessageCommand } from "@internal/app-binder/command/SignPersonalMessageCommand";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
} from "@internal/app-binder/command/utils/tronApplicationErrors";

import { SignPersonalMessageTask } from "./SignPersonalMessageTask";

const PATH = "44'/195'/0'/0/0";

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

const SIGNATURE = fromHex("ab".repeat(65));

describe("SignPersonalMessageTask", () => {
  const sendCommandMock = vi.fn();
  const api = { sendCommand: sendCommandMock } as unknown as InternalApi;

  const sentCommand = (call: number): SignPersonalMessageCommand => {
    const command = sendCommandMock.mock.calls[call]![0] as unknown;
    expect(command).toBeInstanceOf(SignPersonalMessageCommand);
    return command as SignPersonalMessageCommand;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs a single-frame message", async () => {
    // GIVEN a message whose length-prefixed payload fits in one frame
    sendCommandMock.mockResolvedValueOnce(
      CommandResultFactory({ data: SIGNATURE }),
    );

    // WHEN
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message: new TextEncoder().encode("hello"),
    }).run();

    // THEN a single FIRST-frame is sent and the signature is returned
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(sentCommand(0).args.p1).toBe(0x00);
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("signs a multi-frame message and returns the last frame's signature", async () => {
    // GIVEN a 300-byte message spanning two frames
    sendCommandMock
      .mockResolvedValueOnce(CommandResultFactory({ data: new Uint8Array() }))
      .mockResolvedValueOnce(CommandResultFactory({ data: SIGNATURE }));

    // WHEN
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message: fromHex("cd".repeat(300)),
    }).run();

    // THEN both frames are sent in order and the signature is returned
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
    expect(sentCommand(0).args.p1).toBe(0x00);
    expect(sentCommand(1).args.p1).toBe(0x80);
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("aborts on the first failing frame", async () => {
    // GIVEN a two-frame message whose first frame fails
    const error = CommandResultFactory({
      error: TronAppCommandErrorFactory({
        ...TRON_APP_ERRORS["6985"],
        errorCode: "6985",
      }),
    });
    sendCommandMock.mockResolvedValueOnce(error);

    // WHEN
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message: fromHex("cd".repeat(300)),
    }).run();

    // THEN no further frame is sent and the error is returned unchanged
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(error);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("returns an error when the final frame carries no signature", async () => {
    // GIVEN a single-frame message whose response has an empty payload
    sendCommandMock.mockResolvedValueOnce(
      CommandResultFactory({ data: new Uint8Array() }),
    );

    // WHEN
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message: new TextEncoder().encode("hello"),
    }).run();

    // THEN the empty signature is treated as an error, not a success
    expect(isSuccessCommandResult(result)).toBe(false);
    expect(
      !isSuccessCommandResult(result) &&
        (result.error as { originalError?: Error }).originalError?.message,
    ).toBe("No signature returned by the device");
  });
});
