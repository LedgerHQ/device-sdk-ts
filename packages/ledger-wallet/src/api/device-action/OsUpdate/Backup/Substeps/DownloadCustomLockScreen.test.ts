import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { DownloadCustomLockScreenDeviceAction } from "@api/device-action/DownloadCustomLockScreen/DownloadCustomLockScreenDeviceAction";
import { downloadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Backup/Substeps/DownloadCustomLockScreen";

vi.mock(
  "@api/device-action/DownloadCustomLockScreen/DownloadCustomLockScreenDeviceAction",
);

describe("DownloadCustomLockScreen", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(DownloadCustomLockScreenDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });
  describe("Success", () => {
    it("Should return the custom lock screen from the device", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = downloadCustomLockScreenDevice(apiMock, 5000, true);

      expect(MockDA).toHaveBeenCalledWith({
        input: { unlockTimeout: 5000, allowedEmpty: true },
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

      expect(() => downloadCustomLockScreenDevice(apiMock, 5000, true)).toThrow(
        error,
      );
    });
  });
});
