import {
  CallTaskInAppDeviceAction,
  CommandResultFactory,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type ExecuteDeviceActionReturnType,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Just } from "purify-ts";
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
import { type SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
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

type SignTransactionCallArgs = {
  sessionId: DeviceSessionId;
  deviceAction: CallTaskInAppDeviceAction<
    Uint8Array,
    never,
    UserInteractionRequired.SignTransaction
  > & {
    input: {
      appName: string;
      requiredUserInteraction: UserInteractionRequired;
      skipOpenApp: boolean;
      task: (api: InternalApi) => Promise<unknown>;
    };
    logger?: LoggerPublisherService;
  };
};

const DERIVATION_PATH = "44'/144'/0'/0/0";

const loggerFactory = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  }) as unknown as LoggerPublisherService;

describe("XrpAppBinder", () => {
  it("should be defined", () => {
    const binder = new XrpAppBinder(
      {} as DeviceManagementKit,
      "session-id",
      loggerFactory,
    );

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
      const binder = new XrpAppBinder(dmk, sessionId, loggerFactory);

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
      const binder = new XrpAppBinder(dmk, "test-session-id", loggerFactory);

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
        binder: new XrpAppBinder(dmk, sessionId, loggerFactory),
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

  describe("signTransaction", () => {
    const TRANSACTION = Uint8Array.from([0x12, 0x00, 0x00, 0x24]);

    const setup = () => {
      const sessionId = "test-session-id";
      const expectedResult = { observable: from([]), cancel: vi.fn() };
      const executeDeviceAction = vi.fn().mockReturnValue(expectedResult);
      const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;

      return {
        executeDeviceAction,
        expectedResult,
        sessionId,
        binder: new XrpAppBinder(dmk, sessionId, loggerFactory),
      };
    };

    const lastCall = (executeDeviceAction: ReturnType<typeof vi.fn>) =>
      executeDeviceAction.mock.calls[0]![0] as SignTransactionCallArgs;

    it("should execute a CallTaskInAppDeviceAction for the XRP app", () => {
      // GIVEN
      const { binder, executeDeviceAction, expectedResult, sessionId } =
        setup();

      // WHEN
      const result = binder.signTransaction({
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        skipOpenApp: false,
      });

      // THEN
      expect(result).toBe(expectedResult);
      expect(executeDeviceAction).toHaveBeenCalledTimes(1);

      const callArgs = lastCall(executeDeviceAction);
      expect(callArgs.sessionId).toBe(sessionId);
      expect(callArgs.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
      expect(callArgs.deviceAction.input.appName).toBe(APP_NAME);
      expect(callArgs.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.SignTransaction,
      );
      expect(callArgs.deviceAction.input.skipOpenApp).toBe(false);
    });

    it("should forward skipOpenApp", () => {
      // GIVEN
      const { binder, executeDeviceAction } = setup();

      // WHEN
      binder.signTransaction({
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        skipOpenApp: true,
      });

      // THEN
      expect(lastCall(executeDeviceAction).deviceAction.input.skipOpenApp).toBe(
        true,
      );
    });

    it("should give the device action a named logger", () => {
      // GIVEN
      const tagged: string[] = [];
      const taggingFactory = (tag: string) => {
        tagged.push(tag);
        return loggerFactory();
      };
      const executeDeviceAction = vi
        .fn()
        .mockReturnValue({ observable: from([]), cancel: vi.fn() });

      // WHEN
      new XrpAppBinder(
        { executeDeviceAction } as unknown as DeviceManagementKit,
        "test-session-id",
        taggingFactory,
      ).signTransaction({
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        skipOpenApp: false,
      });

      // THEN
      expect(tagged).toContain("SignTransactionDeviceAction");
      expect(lastCall(executeDeviceAction).deviceAction.logger).toBeDefined();
    });

    it("should run the task with the derivation path and transaction", async () => {
      // GIVEN a binder whose logger factory records the tags asked of it
      const tagged: string[] = [];
      const taggingFactory = (tag: string) => {
        tagged.push(tag);
        return loggerFactory();
      };
      const executeDeviceAction = vi
        .fn()
        .mockReturnValue({ observable: from([]), cancel: vi.fn() });

      new XrpAppBinder(
        { executeDeviceAction } as unknown as DeviceManagementKit,
        "test-session-id",
        taggingFactory,
      ).signTransaction({
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        skipOpenApp: false,
      });

      const { task } = (
        executeDeviceAction.mock.calls[0]![0] as SignTransactionCallArgs
      ).deviceAction.input;
      const sendCommand = vi
        .fn()
        .mockResolvedValue(
          CommandResultFactory({ data: Just(Uint8Array.from([0x30, 0x44])) }),
        );

      // WHEN the device action runs the task
      const taskResult = await task({
        sendCommand,
      } as unknown as InternalApi);

      // THEN the task ran against the arguments the binder was given, sending
      // the encoded path followed by the transaction, and it built its logger
      // from the factory that was threaded through.
      expect(sendCommand).toHaveBeenCalledTimes(1);
      const apdu = (
        sendCommand.mock.calls[0]![0] as SignTransactionCommand
      ).getApdu();
      expect(apdu.getRawApdu().slice(5)).toStrictEqual(
        Uint8Array.from([
          0x05,
          0x80,
          0x00,
          0x00,
          0x2c,
          0x80,
          0x00,
          0x00,
          0x90,
          0x80,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          ...TRANSACTION,
        ]),
      );
      expect(tagged).toContain("SendSignTransactionTask");
      expect(isSuccessCommandResult(taskResult)).toBe(true);
    });
  });
});
