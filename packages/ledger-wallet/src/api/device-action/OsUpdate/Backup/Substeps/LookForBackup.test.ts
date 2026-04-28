import { type KeyValueStorage } from "@ledgerhq/device-management-kit";

import { LookForBackupError } from "@api/device-action/OsUpdate/Backup/BackupDeviceActionErrors";
import { DeviceBackupStorage } from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorage";
import { GetBackupError } from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorageErrors";
import { lookForBackup } from "@api/device-action/OsUpdate/Backup/Substeps/LookForBackup";

describe("LookForBackup", () => {
  const storage: KeyValueStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  const getItemMock = vi.mocked(storage.getItem);

  const deviceBackupStorage: DeviceBackupStorage = new DeviceBackupStorage(
    storage,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return true if a backup already exists and is not expired", async () => {
      getItemMock.mockResolvedValueOnce(
        JSON.stringify({
          languageId: 1,
          installedApps: [],
          clsHexImage: undefined,
          createdAt: new Date(),
        }),
      );

      const result = await lookForBackup(deviceBackupStorage)({
        input: { deviceId: "12345" },
      });

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toBe(true);
    });

    it("Should return false if there is a backup but it's expired", async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      getItemMock.mockResolvedValueOnce(
        JSON.stringify({
          languageId: 1,
          installedApps: [],
          clsHexImage: undefined,
          createdAt: twoDaysAgo,
        }),
      );

      const result = await lookForBackup(deviceBackupStorage)({
        input: { deviceId: "12345" },
      });

      expect(result.isRight()).toBe(true);
      expect(result.extract()).toBe(false);
    });
  });

  describe("Error", () => {
    it("Should return LookForBackupError", async () => {
      const error = new Error("data storage failed");
      getItemMock.mockRejectedValueOnce(error);

      const result = await lookForBackup(deviceBackupStorage)({
        input: { deviceId: "12345" },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(LookForBackupError);
        expect(e.originalError).toBeInstanceOf(GetBackupError);
        expect((e.originalError as GetBackupError).originalError).toBe(error);
      });
    });
  });
});
