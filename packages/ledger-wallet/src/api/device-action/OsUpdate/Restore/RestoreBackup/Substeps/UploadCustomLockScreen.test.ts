import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { uploadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/UploadCustomLockScreen";
import { UploadCustomLockScreenDeviceAction } from "@api/device-action/UploadCustomLockScreen/UploadCustomLockScreenDeviceAction";

vi.mock(
  "@api/device-action/UploadCustomLockScreen/UploadCustomLockScreenDeviceAction",
);

describe("UploadCustomLockScreen", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(UploadCustomLockScreenDeviceAction);
  const imageData = Uint8Array.from([1, 2, 3]);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the upload custom lock screen device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = uploadCustomLockScreenDevice(apiMock, 5000, imageData);

      expect(MockDA).toHaveBeenCalledWith({
        input: { unlockTimeout: 5000, imageData },
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

      expect(() =>
        uploadCustomLockScreenDevice(apiMock, 5000, imageData),
      ).toThrow(error);
    });
  });
});
