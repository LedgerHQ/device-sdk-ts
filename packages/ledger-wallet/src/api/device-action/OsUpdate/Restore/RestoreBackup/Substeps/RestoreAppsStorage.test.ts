import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { RestoreAppsStorageDeviceAction } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceAction";
import { restoreAppsStorage } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RestoreAppsStorage";

vi.mock(
  "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceAction",
);

describe("RestoreAppsStorage", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(RestoreAppsStorageDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the restore apps storage device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = restoreAppsStorage(apiMock, 5000);

      expect(MockDA).toHaveBeenCalledWith({
        input: {
          backupApps: [],
          isMasterConsentGranted: true,
          unlockTimeout: 5000,
        },
      });
      expect(makeStateMachineMock).toHaveBeenCalledWith(apiMock);
      expect(result).toBe(fakeStateMachine);
    });
  });

  describe("Error", () => {
    it("Should return the error from the device action", () => {
      const error = new Error("Device action failed");
      const makeStateMachineMock = vi.fn().mockImplementation(() => {
        throw error;
      });
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      expect(() => restoreAppsStorage(apiMock, 5000)).toThrow(error);
    });
  });
});
