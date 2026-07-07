import {
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { GetLanguageIdError } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";
import { getLanguageId } from "@api/device-action/OsUpdate/Backup/Substeps/GetLanguageId";

describe("GetLanguageId", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { sendCommand: sendCommandMock } = apiMock;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return language Id", async () => {
      const langId = 1;
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({ data: { langId } }),
      );

      const result = await getLanguageId(apiMock)();

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toBe(langId);
    });
  });
  describe("Error", () => {
    it("Should return GetLanguageIdError", async () => {
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await getLanguageId(apiMock)();

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(GetLanguageIdError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
