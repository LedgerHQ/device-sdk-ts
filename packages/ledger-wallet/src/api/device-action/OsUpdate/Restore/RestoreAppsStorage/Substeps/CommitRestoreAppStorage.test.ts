import {
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { CommitRestoreAppStorageError } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";
import { commitRestoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/CommitRestoreAppStorage";

describe("CommitRestoreAppStorage", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { sendCommand: sendCommandMock } = apiMock;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should commit the restored app storage", async () => {
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );

      const result = await commitRestoreAppStorage(apiMock)();

      expect(result.isRight()).toBe(true);
    });
  });

  describe("Error", () => {
    it("Should return CommitRestoreAppStorageError", async () => {
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await commitRestoreAppStorage(apiMock)();

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(CommitRestoreAppStorageError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
