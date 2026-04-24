import { type KeyValueStorage } from "@ledgerhq/device-management-kit";

import { SaveBackupError } from "@api/device-action/OsUpdate/Backup/BackupDeviceActionErrors";
import { DeviceBackupStorage } from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorage";
import { saveBackup } from "@api/device-action/OsUpdate/Backup/Substeps/SaveBackup";
import { type Backup } from "@api/device-action/OsUpdate/Backup/types";

describe("SaveBackup", () => {
  const storage: KeyValueStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const setItemMock = vi.mocked(storage.setItem);

  const deviceBackupStorage: DeviceBackupStorage = new DeviceBackupStorage(
    storage,
  );

  const backup: Backup = {
    languageId: 1,
    installedApps: [{ appName: "app1", data: "deadbeef" }],
    clsHexImage: undefined,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should have saved backup", async () => {
      setItemMock.mockResolvedValueOnce(undefined);

      const result = await saveBackup(deviceBackupStorage)({
        input: { deviceId: "12345", backup },
      });

      expect(result.isRight()).toBe(true);
      expect(setItemMock).toHaveBeenCalledWith(
        "dmk-device-backup-12345",
        JSON.stringify(backup),
      );
    });
  });
  describe("Error", () => {
    it("Should return SaveBackupError", async () => {
      const error = new Error("data storage failed");
      setItemMock.mockRejectedValueOnce(error);

      const result = await saveBackup(deviceBackupStorage)({
        input: { deviceId: "12345", backup },
      });

      expect(result.isLeft()).toBe(true);
      result.mapLeft((e) => {
        expect(e).toBeInstanceOf(SaveBackupError);
      });
    });
  });
});
