import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { GetCustomLockScreenInfoDeviceAction } from "@api/device-action/GetCustomLockScreenInfo/GetCustomLockScreenInfoDeviceAction";
import { getCustomLockScreenInfo } from "@api/device-action/OsUpdate/CleanDevice/Substeps/GetCustomLockScreenInfo";

vi.mock(
  "@api/device-action/GetCustomLockScreenInfo/GetCustomLockScreenInfoDeviceAction",
);

describe("GetCustomLockScreenInfo", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(GetCustomLockScreenInfoDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the get custom lock screen info device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = getCustomLockScreenInfo(apiMock, 5000);

      expect(MockDA).toHaveBeenCalledWith({ input: { unlockTimeout: 5000 } });
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

      expect(() => getCustomLockScreenInfo(apiMock, 5000)).toThrow(error);
    });
  });
});
