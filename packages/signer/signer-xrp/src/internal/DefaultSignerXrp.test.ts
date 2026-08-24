import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import { APP_NAME } from "@internal/app-binder/constants";

import { DefaultSignerXrp } from "./DefaultSignerXrp";

type GetAppConfigCallArgs = {
  sessionId: DeviceSessionId;
  deviceAction: {
    input: {
      command: GetAppConfigCommand;
      appName: string;
      requiredUserInteraction: UserInteractionRequired;
      skipOpenApp: boolean;
    };
  };
};

describe("DefaultSignerXrp", () => {
  const sessionId = "test-session-id" as DeviceSessionId;

  const setup = () => {
    const expectedResult = { observable: from([]), cancel: vi.fn() };
    const executeDeviceAction = vi.fn().mockReturnValue(expectedResult);
    const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;

    return {
      executeDeviceAction,
      expectedResult,
      signer: new DefaultSignerXrp({ dmk, sessionId }),
    };
  };

  it("should be defined", () => {
    const signer = new DefaultSignerXrp({
      dmk: {} as DeviceManagementKit,
      sessionId,
    });

    expect(signer).toBeDefined();
  });

  describe("getAppConfig", () => {
    it("should delegate to the use case and return its result", () => {
      // GIVEN
      const { executeDeviceAction, expectedResult, signer } = setup();

      // WHEN
      const result = signer.getAppConfig();

      // THEN
      expect(result).toBe(expectedResult);
      expect(executeDeviceAction).toHaveBeenCalledTimes(1);

      const callArgs = executeDeviceAction.mock
        .calls[0]![0] as GetAppConfigCallArgs;
      expect(callArgs.sessionId).toBe(sessionId);
      expect(callArgs.deviceAction).toBeInstanceOf(
        SendCommandInAppDeviceAction,
      );
      expect(callArgs.deviceAction.input.command).toBeInstanceOf(
        GetAppConfigCommand,
      );
      expect(callArgs.deviceAction.input.appName).toBe(APP_NAME);
      expect(callArgs.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.None,
      );
      expect(callArgs.deviceAction.input.skipOpenApp).toBe(false);
    });

    it("should forward skipOpenApp", () => {
      // GIVEN
      const { executeDeviceAction, signer } = setup();

      // WHEN
      signer.getAppConfig({ skipOpenApp: true });

      // THEN
      const callArgs = executeDeviceAction.mock
        .calls[0]![0] as GetAppConfigCallArgs;
      expect(callArgs.deviceAction.input.skipOpenApp).toBe(true);
    });
  });
});
