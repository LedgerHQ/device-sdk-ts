import {
  BackupAppStorageTask,
  CommandResultFactory,
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { BackupAppsStorageError } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";
import { backupAppsStorage } from "@api/device-action/OsUpdate/Backup/Substeps/BackupAppsStorage";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    BackupAppStorageTask: vi.fn(),
  };
});

describe("BackupAppStorage", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockTask = vi.mocked(BackupAppStorageTask);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the list of installed apps and their storage", async () => {
      const installedApps = [
        { name: "app1", flags: 0, hash: "hash1", hash_code_data: "hcd1" },
        { name: "app2", flags: 0, hash: "hash2", hash_code_data: "hcd2" },
      ];
      const runMock = vi
        .fn()
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { appStorageData: "deadbeef" } }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { appStorageData: "cafebabe" } }),
        );
      MockTask.mockImplementation(() => ({ run: runMock }) as never);

      const result = await backupAppsStorage(
        apiMock,
        apiMock.loggerFactory!,
      )({ input: { installedApps } });

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toEqual([
        { appName: "app1", data: "deadbeef" },
        { appName: "app2", data: "cafebabe" },
      ]);
    });

    it("Should set data to undefined when appStorageData is '0x'", async () => {
      const installedApps = [
        { name: "app1", flags: 0, hash: "hash1", hash_code_data: "hcd1" },
      ];
      const runMock = vi
        .fn()
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { appStorageData: "0x" } }),
        );
      MockTask.mockImplementation(() => ({ run: runMock }) as never);

      const result = await backupAppsStorage(
        apiMock,
        apiMock.loggerFactory!,
      )({ input: { installedApps } });

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toEqual([{ appName: "app1", data: undefined }]);
    });
  });
  describe("Error", () => {
    it("Should return BackupAppsStorageError", async () => {
      const installedApps = [
        { name: "app1", flags: 0, hash: "hash1", hash_code_data: "hcd1" },
      ];
      const error = new GlobalCommandError({
        errorCode: "6e00",
        ...GLOBAL_ERRORS["6e00"],
      });
      const runMock = vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ error }));
      MockTask.mockImplementation(() => ({ run: runMock }) as never);

      const result = await backupAppsStorage(
        apiMock,
        apiMock.loggerFactory!,
      )({ input: { installedApps } });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(BackupAppsStorageError);
        expect(e.originalError).toBe(error.originalError);
      });
    });
  });
});
