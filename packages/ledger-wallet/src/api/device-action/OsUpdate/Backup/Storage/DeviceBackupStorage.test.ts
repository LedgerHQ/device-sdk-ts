import { type KeyValueStorage } from "@ledgerhq/device-management-kit";

import { DeviceBackupStorage } from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorage";
import {
  GetBackupError,
  SaveBackupError,
} from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorageErrors";

import { serialize } from "./BackupSerializer";

describe("DeviceBackupStorage", () => {
  const storage: KeyValueStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const deviceBackupStorage = new DeviceBackupStorage(storage);
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getBackup", () => {
    const getItemMock = vi.mocked(storage.getItem);

    describe("Success", () => {
      it("should return backup when it exists", async () => {
        const backup = {
          languageId: 1,
          installedApps: [],
          clsHexImage: undefined,
          createdAt: new Date(),
        };

        getItemMock.mockResolvedValueOnce(
          JSON.stringify({
            ...backup,
            createdAt: backup.createdAt.toISOString(),
          }),
        );
        const result = await deviceBackupStorage.getBackup("12345");

        expect(result.isRight()).toBe(true);
        expect(result.extract()).toEqual(backup);
      });

      it("should return null when backup does not exist", async () => {
        getItemMock.mockResolvedValueOnce(null);
        const result = await deviceBackupStorage.getBackup("12345");

        expect(result.isRight()).toBe(true);
        expect(result.extract()).toBeNull();
      });
    });

    describe("Error", () => {
      it("should return error when getItem fails", async () => {
        const error = new Error("storage read failed");
        getItemMock.mockRejectedValueOnce(error);

        const result = await deviceBackupStorage.getBackup("12345");

        expect(result.isLeft()).toBe(true);
        result.mapLeft((e) => {
          expect(e).toBeInstanceOf(GetBackupError);
          expect(e.originalError).toBe(error);
        });
      });
    });
  });

  describe("saveBackup", () => {
    const setItemMock = vi.mocked(storage.setItem);

    const backup = {
      languageId: 1,
      installedApps: [{ appName: "app1", data: "deadbeef" }],
      clsHexImage: undefined,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    };

    describe("Success", () => {
      it("should save backup", async () => {
        setItemMock.mockResolvedValueOnce(undefined);

        const result = await deviceBackupStorage.saveBackup("12345", backup);

        expect(result.isRight()).toBe(true);
        expect(setItemMock).toHaveBeenCalledWith(
          "dmk-device-backup-12345",
          JSON.stringify({
            ...backup,
            createdAt: backup.createdAt.toISOString(),
          }),
        );
      });
    });

    describe("Error", () => {
      it("should return error when setItem fails", async () => {
        const error = new Error("storage write failed");
        setItemMock.mockRejectedValueOnce(error);

        const result = await deviceBackupStorage.saveBackup("12345", backup);

        expect(result.isLeft()).toBe(true);
        result.mapLeft((e) => {
          expect(e).toBeInstanceOf(SaveBackupError);
          expect(e.originalError).toBe(error);
        });
      });
    });

    describe("Chain saveBackup and getBackup", () => {
      it("should read back the exact same backup that was saved", async () => {
        // ARRANGE
        const getItemMock = vi.mocked(storage.getItem);
        const setItemMock = vi.mocked(storage.setItem);

        const backupCreationDate = new Date("2025-06-15T12:34:56.789Z");
        const originalBackup = {
          languageId: 1,
          installedApps: [{ appName: "app1", data: "deadbeef" }],
          clsHexImage: "0x1234567890",
          createdAt: backupCreationDate,
        };

        setItemMock.mockResolvedValueOnce(undefined);
        await deviceBackupStorage.saveBackup("12345", originalBackup);

        const capturedBackup = serialize(originalBackup);

        getItemMock.mockResolvedValueOnce(capturedBackup.unsafeCoerce());
        const getResult = await deviceBackupStorage.getBackup("12345");

        // ASSERT
        expect(setItemMock).toHaveBeenCalledWith(
          "dmk-device-backup-12345",
          capturedBackup.unsafeCoerce(),
        );
        expect(getResult.isRight()).toBe(true);
        expect(getResult.extract()).toStrictEqual(originalBackup);
      });
    });
  });
});
