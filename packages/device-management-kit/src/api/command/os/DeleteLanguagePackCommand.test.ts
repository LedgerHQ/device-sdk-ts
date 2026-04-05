import {
  CommandResultFactory,
  CommandResultStatus,
} from "@api/command/model/CommandResult";
import {
  DeleteLanguagePackCommand,
  DeleteLanguagePackCommandError,
} from "@api/command/os/DeleteLanguagePackCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

const DELETE_LANGUAGE_PACK_APDU_ID_1 = new Uint8Array([
  0xe0, 0x33, 0x01, 0x00, 0x00,
]);

const DELETE_ALL_LANGUAGE_PACKS = new Uint8Array([
  0xe0, 0x33, 0xff, 0x00, 0x00,
]);

describe("DeleteLanguagePackCommand", () => {
  let command: DeleteLanguagePackCommand;

  beforeEach(() => {
    command = new DeleteLanguagePackCommand({ languagePackageId: 1 });
  });

  describe("name", () => {
    it("should be 'deleteLanguagePack'", () => {
      expect(command.name).toBe("deleteLanguagePack");
    });
  });

  it("should return the correct APDU for languagePackageId 1", () => {
    const apdu = command.getApdu();
    expect(apdu.getRawApdu()).toStrictEqual(DELETE_LANGUAGE_PACK_APDU_ID_1);
  });

  it("should return the correct APDU for languagePackageId 0xFF", () => {
    command = new DeleteLanguagePackCommand({ languagePackageId: 0xff });
    const apdu = command.getApdu();
    expect(apdu.getRawApdu()).toStrictEqual(DELETE_ALL_LANGUAGE_PACKS);
  });

  it("should parse success response", () => {
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

  it("should parse error response", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x6e, 0x01]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(result.status).toBe(CommandResultStatus.Error);
  });

  it("should map 0x681A to DeleteLanguagePackCommandError", () => {
    const response: ApduResponse = new ApduResponse({
      statusCode: new Uint8Array([0x68, 0x1a]),
      data: new Uint8Array([]),
    });
    const result = command.parseResponse(response);
    expect(result.status).toBe(CommandResultStatus.Error);
    if (result.status === CommandResultStatus.Error) {
      const { error } = result;
      expect(error).toBeInstanceOf(DeleteLanguagePackCommandError);
      expect((error as DeleteLanguagePackCommandError).errorCode).toBe("681a");
      expect((error as DeleteLanguagePackCommandError).message).toBe(
        "Invalid LANG_ID value.",
      );
    }
  });
});
