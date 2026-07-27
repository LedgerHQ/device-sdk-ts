import { GoToDashboardDeviceAction } from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { goToDashboard } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/GoToDashboard";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    GoToDashboardDeviceAction: vi.fn(),
  };
});

describe("GoToDashboard", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(GoToDashboardDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the go to dashboard device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = goToDashboard(apiMock, 5000);

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

      expect(() => goToDashboard(apiMock, 5000)).toThrow(error);
    });
  });
});
