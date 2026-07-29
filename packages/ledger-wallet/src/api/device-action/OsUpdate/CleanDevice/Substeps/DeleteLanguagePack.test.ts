import {
  CommandResultFactory,
  DeleteLanguagePackCommandError,
  DeleteLanguagePackDAError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { deleteLanguagePack } from "@api/device-action/OsUpdate/CleanDevice/Substeps/DeleteLanguagePack";

describe("DeleteLanguagePack", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { sendCommand: sendCommandMock } = apiMock;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should delete every installed language pack", async () => {
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );

      const result = await deleteLanguagePack(apiMock)();

      expect(result.isRight()).toBe(true);
    });
  });

  describe("Error", () => {
    it("Should return a DeleteLanguagePackDAError with the command error message", async () => {
      const error = new DeleteLanguagePackCommandError({
        message: "Invalid LANG_ID value.",
        errorCode: "681a",
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await deleteLanguagePack(apiMock)();

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(DeleteLanguagePackDAError);
        expect(e.originalError).toStrictEqual(
          new Error("Invalid LANG_ID value."),
        );
      });
    });
  });
});
