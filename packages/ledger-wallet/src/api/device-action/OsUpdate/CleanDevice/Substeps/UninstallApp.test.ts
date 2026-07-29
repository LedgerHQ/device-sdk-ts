import { UninstallAppDeviceAction } from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { uninstallApp } from "@api/device-action/OsUpdate/CleanDevice/Substeps/UninstallApp";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    UninstallAppDeviceAction: vi.fn(),
  };
});

describe("UninstallApp", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(UninstallAppDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });
  describe("Success", () => {
    it("Should uninstall the given app on the device", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = uninstallApp(apiMock, 5000);

      expect(MockDA).toHaveBeenCalledWith({
        input: { unlockTimeout: 5000, appName: "" },
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

      expect(() => uninstallApp(apiMock, 5000)).toThrow(error);
    });
  });
});
