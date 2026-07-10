import {
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { RequestMasterConsentCommandError } from "@api/command/OsUpdate/Restore/RequestMasterConsentCommand";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { RequestMasterConsentError } from "@api/device-action/OsUpdate/Restore/RestoreBackup/RestoreBackupDeviceActionErrors";
import { requestMasterConsent } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RequestMasterConsent";
import { RequestMasterConsentResult } from "@api/device-action/OsUpdate/Restore/RestoreBackup/types";

describe("RequestMasterConsent", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { sendCommand: sendCommandMock } = apiMock;
  const input = {
    languagePackConsentEnabled: true,
    lockScreenPictureConsentEnabled: true,
    appNumber: 2,
    appStorageNumber: 1,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return consent granted when the command succeeds", async () => {
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );

      const result = await requestMasterConsent(apiMock)({ input });

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toBe(RequestMasterConsentResult.GRANTED);
    });
  });

  describe("Consent rejected", () => {
    it.each(["5501", "5502"] as const)(
      "Should return consent rejected when the command fails with %s",
      async (errorCode) => {
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new RequestMasterConsentCommandError({
              errorCode,
              message: "Invalid consent",
            }),
          }),
        );

        const result = await requestMasterConsent(apiMock)({ input });

        expect(result.isRight()).toBe(true);
        expect(result.extract()).toBe(RequestMasterConsentResult.REJECTED);
      },
    );
  });

  describe("Error", () => {
    it("Should return RequestMasterConsentError for other error codes", async () => {
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await requestMasterConsent(apiMock)({ input });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(RequestMasterConsentError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
