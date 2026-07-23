import {
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { RestoreAppStorageError } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";
import { restoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/RestoreAppStorage";
import { RestoreAppStorageTask } from "@api/task/OsUpdate/Restore/RestoreAppStorageTask";

vi.mock("@api/task/OsUpdate/Restore/RestoreAppStorageTask");

describe("RestoreAppStorage", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockTask = vi.mocked(RestoreAppStorageTask);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should restore the app storage data", async () => {
      const appStorageData = Uint8Array.from([0x01, 0x02]);
      const runMock = vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ data: undefined }));
      MockTask.mockImplementation(() => ({ run: runMock }) as never);

      const result = await restoreAppStorage(
        apiMock,
        apiMock.loggerFactory!,
      )({ input: { appStorageData } });

      expect(result.isRight()).toBe(true);
      expect(MockTask).toHaveBeenCalledWith(
        { appStorageData },
        apiMock,
        expect.anything(),
      );
    });
  });

  describe("Error", () => {
    it("Should return RestoreAppStorageError", async () => {
      const appStorageData = Uint8Array.from([0x01, 0x02]);
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      const runMock = vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ error }));
      MockTask.mockImplementation(() => ({ run: runMock }) as never);

      const result = await restoreAppStorage(
        apiMock,
        apiMock.loggerFactory!,
      )({ input: { appStorageData } });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(RestoreAppStorageError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
