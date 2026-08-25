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
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";
import {
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
} from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
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

type GetAddressCallArgs = {
  sessionId: DeviceSessionId;
  deviceAction: SendCommandInAppDeviceAction<
    GetAddressCommandResponse,
    GetAddressCommandArgs,
    XrpErrorCodes,
    UserInteractionRequired.VerifyAddress | UserInteractionRequired.None
  >;
};

const DERIVATION_PATH = "44'/144'/0'/0/0";

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

  describe("getAddress", () => {
    const setup = () => {
      const sessionId = "test-session-id";
      const expectedResult = { observable: from([]), cancel: vi.fn() };
      const executeDeviceAction = vi.fn().mockReturnValue(expectedResult);
      const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;

      return {
        executeDeviceAction,
        expectedResult,
        sessionId,
        binder: new XrpAppBinder(dmk, sessionId),
      };
    };

    const lastCall = (executeDeviceAction: ReturnType<typeof vi.fn>) =>
      executeDeviceAction.mock.calls[0]![0] as GetAddressCallArgs;

    it("should execute a SendCommandInAppDeviceAction wrapping GetAddressCommand", () => {
      // GIVEN
      const { binder, executeDeviceAction, expectedResult, sessionId } =
        setup();

      // WHEN
      const result = binder.getAddress({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        returnChainCode: false,
        skipOpenApp: false,
      });

      // THEN
      expect(result).toBe(expectedResult);
      expect(executeDeviceAction).toHaveBeenCalledTimes(1);

      const callArgs = lastCall(executeDeviceAction);
      expect(callArgs.sessionId).toBe(sessionId);
      expect(callArgs.deviceAction).toBeInstanceOf(
        SendCommandInAppDeviceAction,
      );
      expect(callArgs.deviceAction.input.command).toBeInstanceOf(
        GetAddressCommand,
      );
      expect(callArgs.deviceAction.input.appName).toBe(APP_NAME);
      expect(callArgs.deviceAction.input.skipOpenApp).toBe(false);
    });

    it("should require no user interaction when checkOnDevice is false", () => {
      // GIVEN
      const { binder, executeDeviceAction } = setup();

      // WHEN
      binder.getAddress({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        returnChainCode: false,
        skipOpenApp: false,
      });

      // THEN
      expect(
        lastCall(executeDeviceAction).deviceAction.input
          .requiredUserInteraction,
      ).toBe(UserInteractionRequired.None);
    });

    it("should require an address verification when checkOnDevice is true", () => {
      // GIVEN
      const { binder, executeDeviceAction } = setup();

      // WHEN
      binder.getAddress({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: true,
        returnChainCode: false,
        skipOpenApp: false,
      });

      // THEN
      expect(
        lastCall(executeDeviceAction).deviceAction.input
          .requiredUserInteraction,
      ).toBe(UserInteractionRequired.VerifyAddress);
    });

    it("should forward the command arguments through to the APDU", () => {
      // GIVEN
      const { binder, executeDeviceAction } = setup();

      // WHEN
      binder.getAddress({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: true,
        returnChainCode: true,
        skipOpenApp: true,
      });

      // THEN the P1/P2 of the built APDU reflect every argument
      const { command, skipOpenApp } =
        lastCall(executeDeviceAction).deviceAction.input;
      expect(skipOpenApp).toBe(true);

      const apdu = command.getApdu().getRawApdu();
      expect(apdu[2]).toBe(0x01); // P1: display and confirm
      expect(apdu[3]).toBe(0x41); // P2: secp256k1 | return chain code
    });
  });
});
