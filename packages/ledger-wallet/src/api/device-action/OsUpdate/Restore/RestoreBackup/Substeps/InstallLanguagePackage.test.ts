import { InstallLanguagePackageDeviceAction } from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { installLanguagePackage } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallLanguagePackage";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    InstallLanguagePackageDeviceAction: vi.fn(),
  };
});

describe("InstallLanguagePackage", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(InstallLanguagePackageDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the install language package device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = installLanguagePackage(apiMock, 5000, "brazilian");

      expect(MockDA).toHaveBeenCalledWith({
        input: { unlockTimeout: 5000, language: "brazilian" },
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

      expect(() => installLanguagePackage(apiMock, 5000, "brazilian")).toThrow(
        error,
      );
    });
  });
});
