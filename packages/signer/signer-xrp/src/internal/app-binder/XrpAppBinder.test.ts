import {
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type ExecuteDeviceActionReturnType,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
} from "@api/app-binder/GetAppConfigDeviceActionTypes";
import {
  GetAppConfigCommand,
  type GetAppConfigCommandResponse,
} from "@internal/app-binder/command/GetAppConfigCommand";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { XrpAppBinder } from "@internal/app-binder/XrpAppBinder";

type GetAppConfigSendCommandAction = SendCommandInAppDeviceAction<
  GetAppConfigCommandResponse,
  void,
  XrpErrorCodes,
  UserInteractionRequired.None
>;

type ExecuteDeviceActionCallArgs = {
  sessionId: DeviceSessionId;
  deviceAction: GetAppConfigSendCommandAction;
};

describe("XrpAppBinder", () => {
  it("should be defined", () => {
    const binder = new XrpAppBinder({} as DeviceManagementKit, "session-id");

    expect(binder).toBeDefined();
  });

  describe("getAppConfig", () => {
    it("should execute a SendCommandInAppDeviceAction wrapping GetAppConfigCommand", () => {
      // GIVEN
      const sessionId = "test-session-id";
      const expectedResult: ExecuteDeviceActionReturnType<
        GetAppConfigDAOutput,
        GetAppConfigDAError,
        GetAppConfigDAIntermediateValue
      > = {
        observable: from([
          {
            status: DeviceActionStatus.Completed as const,
            output: { version: "1.2.3" },
          },
        ]),
        cancel: vi.fn(),
      };
      const executeDeviceAction = vi.fn().mockReturnValue(expectedResult);
      const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;
      const binder = new XrpAppBinder(dmk, sessionId);

      // WHEN
      const result = binder.getAppConfig({ skipOpenApp: false });

      // THEN
      expect(result).toEqual(expectedResult);
      expect(executeDeviceAction).toHaveBeenCalledTimes(1);

      const callArgs = executeDeviceAction.mock
        .calls[0]![0] as ExecuteDeviceActionCallArgs;
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
      const executeDeviceAction = vi.fn().mockReturnValue({
        observable: from([]),
        cancel: vi.fn(),
      });
      const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;
      const binder = new XrpAppBinder(dmk, "test-session-id");

      // WHEN
      binder.getAppConfig({ skipOpenApp: true });

      // THEN
      const callArgs = executeDeviceAction.mock
        .calls[0]![0] as ExecuteDeviceActionCallArgs;
      expect(callArgs.deviceAction.input.skipOpenApp).toBe(true);
    });
  });
});
