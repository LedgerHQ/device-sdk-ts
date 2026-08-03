import { InstallOrUpdateAppsDeviceAction } from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { installOrUpdateApps } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallOrUpdateApps";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    InstallOrUpdateAppsDeviceAction: vi.fn(),
  };
});

describe("InstallOrUpdateApps", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(InstallOrUpdateAppsDeviceAction);
  const applications = [{ name: "Bitcoin" }, { name: "Ethereum" }];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the install or update apps device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = installOrUpdateApps(apiMock, 5000, applications);

      expect(MockDA).toHaveBeenCalledWith({
        input: {
          unlockTimeout: 5000,
          applications,
          allowMissingApplication: true,
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

      expect(() => installOrUpdateApps(apiMock, 5000, applications)).toThrow(
        error,
      );
    });
  });
});
