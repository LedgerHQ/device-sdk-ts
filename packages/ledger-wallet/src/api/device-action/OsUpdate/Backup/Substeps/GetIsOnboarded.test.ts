import {
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { GetIsOnboardedError } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";
import { getIsOnboarded } from "@api/device-action/OsUpdate/Backup/Substeps/GetIsOnboarded";

describe("GetIsOnboarded", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { sendCommand: sendCommandMock } = apiMock;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the device onboarding status", async () => {
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            secureElementFlags: {
              isOnboarded: true,
            },
          },
        }),
      );

      const result = await getIsOnboarded(apiMock)();

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toBe(true);
    });

    it("Should return false when the device is not onboarded", async () => {
      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            secureElementFlags: {
              isOnboarded: false,
            },
          },
        }),
      );

      const result = await getIsOnboarded(apiMock)();

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toBe(false);
    });
  });

  describe("Error", () => {
    it("Should return GetIsOnboardedError", async () => {
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await getIsOnboarded(apiMock)();

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(GetIsOnboardedError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
