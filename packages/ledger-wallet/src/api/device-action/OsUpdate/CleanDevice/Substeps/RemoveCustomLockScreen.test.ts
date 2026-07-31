import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { removeCustomLockScreen } from "@api/device-action/OsUpdate/CleanDevice/Substeps/RemoveCustomLockScreen";
import { RemoveCustomLockScreenDeviceAction } from "@api/device-action/RemoveCustomLockScreen/RemoveCustomLockScreenDeviceAction";

vi.mock(
  "@api/device-action/RemoveCustomLockScreen/RemoveCustomLockScreenDeviceAction",
);

describe("RemoveCustomLockScreen", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(RemoveCustomLockScreenDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the remove custom lock screen device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = removeCustomLockScreen(apiMock, 5000);

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

      expect(() => removeCustomLockScreen(apiMock, 5000)).toThrow(error);
    });
  });
});
