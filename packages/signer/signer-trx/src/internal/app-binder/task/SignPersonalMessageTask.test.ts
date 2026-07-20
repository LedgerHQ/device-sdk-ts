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
// Encoded "44'/195'/0'/0/0": length byte (05) + 5 BE32 path elements.
const PATH_HEX = "058000002c800000c3800000000000000000000000";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

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
    const message = new TextEncoder().encode("hello");
    sendCommandMock.mockResolvedValueOnce(
      CommandResultFactory({ data: SIGNATURE }),
    );

    // WHEN
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message,
    }).run();

    // THEN a single frame is sent with the path header, the BE32 message
    // length and the message bytes, and the signature is returned
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(sentCommand(0).args.p1).toBe(0x00);
    expect(toHex(sentCommand(0).args.payload)).toBe(
      PATH_HEX + "00000005" + "68656c6c6f",
    );
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("signs a multi-frame message and returns the last frame's signature", async () => {
    // GIVEN a 300-byte message: the 304-byte prefixed payload spans two
    // frames (229 bytes fit alongside the 21-byte path header, 75 remain)
    const message = fromHex("cd".repeat(300));
    sendCommandMock
      .mockResolvedValueOnce(CommandResultFactory({ data: new Uint8Array() }))
      .mockResolvedValueOnce(CommandResultFactory({ data: SIGNATURE }));

    // WHEN
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message,
    }).run();

    // THEN both frames are sent in order with the expected start bytes
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
    expect(sentCommand(0).args.p1).toBe(0x00);
    expect(toHex(sentCommand(0).args.payload)).toBe(
      PATH_HEX + "0000012c" + "cd".repeat(225),
    );
    expect(sentCommand(1).args.p1).toBe(0x80);
    expect(toHex(sentCommand(1).args.payload)).toBe("cd".repeat(75));
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
  });

  it("aborts on the first failing frame", async () => {
    // GIVEN a two-frame message whose first frame fails
    const message = fromHex("cd".repeat(300));
    const error = CommandResultFactory({
      error: TronAppCommandErrorFactory({
        ...TRON_APP_ERRORS["6a80"],
        errorCode: "6a80",
      }),
    });
    sendCommandMock.mockResolvedValueOnce(error);

    // WHEN
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message,
    }).run();

    // THEN no further frame is sent and the error is returned unchanged
    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(error);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("propagates a user rejection (6985) on the final frame", async () => {
    // GIVEN a two-frame message rejected by the user on the last frame
    const message = fromHex("cd".repeat(300));
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
    const result = await new SignPersonalMessageTask(api, {
      derivationPath: PATH,
      message,
    }).run();

    // THEN the rejection is propagated
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
    expect(result).toBe(rejection);
    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
