import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { ListLanguagePackCommand } from "@api/command/os/ListLanguagePackCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

const LIST_LANGUAGE_PACK_APDU = new Uint8Array([0xe0, 0x34, 0x00, 0x00, 0x00]);
const LIST_LANGUAGE_PACK_CONTINUE_APDU = new Uint8Array([
  0xe0, 0x34, 0x01, 0x00, 0x00,
]);

describe("ListLanguagePackCommand", () => {
  let command: ListLanguagePackCommand;

  beforeEach(() => {
    command = new ListLanguagePackCommand({ firstChunk: true });
  });

  it("should return the correct APDU", () => {
    const apdu = command.getApdu();
    expect(apdu.getRawApdu()).toStrictEqual(LIST_LANGUAGE_PACK_APDU);
  });

  it("should return the correct next chunks APDU", () => {
    command = new ListLanguagePackCommand({ firstChunk: false });
    const apdu = command.getApdu();
    expect(apdu.getRawApdu()).toStrictEqual(LIST_LANGUAGE_PACK_CONTINUE_APDU);
  });

  it("should parse result successfully", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([
        0x01, 0x0f, 0x01, 0x01, 0x04, 0x00, 0x00, 0x50, 0x00, 0x05, 0x30, 0x2e,
        0x30, 0x2e, 0x34, 0x00,
      ]),
    });
    const result = command.parseResponse(response);
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          id: 1,
          size: 20480,
        },
      }),
    );
  });

  it("should parse empty result successfully", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: undefined,
      }),
    );
  });

  it("should fail on invalid id", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0x01, 0x0f]),
    });
    const result = command.parseResponse(response);
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Failed to get language pack id"),
      }),
    );
  });

  it("should fail on invalid size", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0x01, 0x0f, 0x01, 0x01]),
    });
    const result = command.parseResponse(response);
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Failed to get language pack size"),
      }),
    );
  });

  it("should fail on device error", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x66, 0x2d]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(isSuccessCommandResult(result)).toBeFalsy();
  });
});
