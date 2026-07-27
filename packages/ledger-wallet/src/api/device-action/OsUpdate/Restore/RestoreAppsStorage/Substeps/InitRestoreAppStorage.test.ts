import {
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { InitRestoreAppStorageCommandError } from "@api/command/OsUpdate/Restore/InitRestoreAppStorageCommand";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { InitRestoreAppStorageError } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";
import { initRestoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/InitRestoreAppStorage";
import { InitRestoreAppStorageConsentResult } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/types";

describe("InitRestoreAppStorage", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { sendCommand: sendCommandMock } = apiMock;
  const input = { appName: "MyApp", appStorageDataLength: 42 };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return consent granted when the command succeeds", async () => {
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );

      const result = await initRestoreAppStorage(apiMock)({ input });

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toBe(InitRestoreAppStorageConsentResult.GRANTED);
    });
  });

  describe("Consent rejected", () => {
    it.each(["5501", "5502"] as const)(
      "Should return consent rejected when the command fails with %s",
      async (errorCode) => {
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new InitRestoreAppStorageCommandError({
              errorCode,
              message: "Invalid consent",
            }),
          }),
        );

        const result = await initRestoreAppStorage(apiMock)({ input });

        expect(result.isRight()).toBe(true);
        expect(result.extract()).toBe(
          InitRestoreAppStorageConsentResult.REJECTED,
        );
      },
    );
  });

  describe("Error", () => {
    it("Should return InitRestoreAppStorageError for other error codes", async () => {
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await initRestoreAppStorage(apiMock)({ input });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(InitRestoreAppStorageError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
