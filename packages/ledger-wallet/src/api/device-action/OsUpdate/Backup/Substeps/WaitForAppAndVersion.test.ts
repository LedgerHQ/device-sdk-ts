import { WaitForAppAndVersionDeviceAction } from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Backup/Substeps/WaitForAppAndVersion";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    WaitForAppAndVersionDeviceAction: vi.fn(),
  };
});

describe("WaitForAppAndVersion", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const MockDA = vi.mocked(WaitForAppAndVersionDeviceAction);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success", () => {
    it("Should return the wait for app and version device action state machine", () => {
      const fakeStateMachine = Symbol("stateMachine");
      const makeStateMachineMock = vi.fn().mockReturnValue(fakeStateMachine);
      MockDA.mockImplementation(
        () => ({ makeStateMachine: makeStateMachineMock }) as never,
      );

      const result = waitForAppAndVersion(apiMock, 5000);

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

      expect(() => waitForAppAndVersion(apiMock, 5000)).toThrow(error);
    });
  });
});
