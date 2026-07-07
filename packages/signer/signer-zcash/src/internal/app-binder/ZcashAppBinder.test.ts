import {
  CallTaskInAppDeviceAction,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DmkError,
  type ExecuteDeviceActionReturnType,
  type InternalApi,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
} from "@api/app-binder/GetAddressDeviceActionTypes";
import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import {
  GetAddressCommand,
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@internal/app-binder/command/GetAddressCommand";
import type { ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { privateToPrivateTransaction } from "@internal/app-binder/task/__fixtures__/pcztFixtures";
import { GetFullViewingKeyTask } from "@internal/app-binder/task/GetFullViewingKeyTask";
import { GetTrustedInputTask } from "@internal/app-binder/task/GetTrustedInputTask";
import { SignPcztTransactionTask } from "@internal/app-binder/task/SignPcztTransactionTask";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";
import { ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

type ZcashGetAddressSendCommandAction = SendCommandInAppDeviceAction<
  GetAddressCommandResponse,
  GetAddressCommandArgs,
  ZcashErrorCodes,
  UserInteractionRequired.None | UserInteractionRequired.VerifyAddress
>;

type ExecuteDeviceActionCallArgs = {
  sessionId: DeviceSessionId;
  deviceAction: ZcashGetAddressSendCommandAction;
};

type ExecuteDeviceActionTaskCallArgs = {
  sessionId: DeviceSessionId;
  deviceAction: CallTaskInAppDeviceAction<
    unknown,
    DmkError,
    UserInteractionRequired.None | UserInteractionRequired.SignTransaction
  >;
};

describe("ZcashAppBinder", () => {
  it("should be defined", () => {
    const binder = new ZcashAppBinder({} as DeviceManagementKit, "session-id");
    expect(binder).toBeDefined();
  });

  describe("getAddress", () => {
    it("should call dmk.executeDeviceAction with SendCommandInAppDeviceAction and return the result", () => {
      const sessionId = "test-session-id";
      const getAddressArgs = {
        derivationPath: "44'/133'/0'/0/0",
        checkOnDevice: false,
        skipOpenApp: false,
      };
      const expectedResult: ExecuteDeviceActionReturnType<
        GetAddressDAOutput,
        GetAddressDAError,
        GetAddressDAIntermediateValue
      > = {
        observable: from([
          {
            status: DeviceActionStatus.Completed as const,
            output: {
              publicKey: new Uint8Array([0x01, 0x02]),
              address: "t1KstBMLLaGcEBGKFxeGqTGmtCNsDE79Ljd",
              chainCode: new Uint8Array(32).fill(0xcd),
            },
          },
        ]),
        cancel: vi.fn(),
      };
      const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, sessionId);

      const result = binder.getAddress(getAddressArgs);

      expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionCallArgs;
      expect(args.sessionId).toBe(sessionId);
      expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
      expect(args.deviceAction.input.command).toBeInstanceOf(GetAddressCommand);
      expect(args.deviceAction.input.appName).toBe(APP_NAME);
      expect(args.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.None,
      );
      expect(args.deviceAction.input.skipOpenApp).toBe(false);
      expect(result).toBe(expectedResult);
    });

    it("when checkOnDevice is true: UserInteractionRequired.VerifyAddress", () => {
      const executeDeviceActionMock = vi.fn().mockReturnValue({
        observable: from([]),
        cancel: vi.fn(),
      });
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, "sessionId");

      binder.getAddress({
        derivationPath: "44'/133'/0'/0/0",
        checkOnDevice: true,
        skipOpenApp: false,
      });

      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionCallArgs;
      expect(args.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.VerifyAddress,
      );
    });

    it("when checkOnDevice is false: UserInteractionRequired.None", () => {
      const executeDeviceActionMock = vi.fn().mockReturnValue({
        observable: from([]),
        cancel: vi.fn(),
      });
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, "sessionId");

      binder.getAddress({
        derivationPath: "44'/133'/0'/0/0",
        checkOnDevice: false,
        skipOpenApp: true,
      });

      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionCallArgs;
      expect(args.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.None,
      );
      expect(args.deviceAction.input.skipOpenApp).toBe(true);
    });
  });

  describe("getFullViewingKey", () => {
    it("should call dmk.executeDeviceAction with CallTaskInAppDeviceAction and run GetFullViewingKeyTask", async () => {
      const sessionId = "test-session-id";
      const expectedResult = {
        observable: from([]),
        cancel: vi.fn(),
      };
      const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, sessionId);
      const runSpy = vi
        .spyOn(GetFullViewingKeyTask.prototype, "run")
        .mockResolvedValue(
          {} as unknown as Awaited<
            ReturnType<typeof GetFullViewingKeyTask.prototype.run>
          >,
        );

      const result = binder.getFullViewingKey({
        derivationPath: "44'/133'/0'/0/0",
        mode: "ufvk",
        skipOpenApp: false,
      });

      expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionTaskCallArgs;
      expect(args.sessionId).toBe(sessionId);
      expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
      expect(args.deviceAction.input.appName).toBe(APP_NAME);
      expect(args.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.None,
      );
      expect(args.deviceAction.input.skipOpenApp).toBe(false);
      expect(result).toBe(expectedResult);

      await args.deviceAction.input.task({} as InternalApi);
      expect(runSpy).toHaveBeenCalledOnce();
    });
  });

  describe("getTrustedInput", () => {
    it("should call dmk.executeDeviceAction with CallTaskInAppDeviceAction and default skipOpenApp to false", async () => {
      const sessionId = "test-session-id";
      const getTrustedInputArgs = {
        transaction: new Uint8Array([0x01, 0x02, 0x03]),
      };
      const expectedResult = {
        observable: from([]),
        cancel: vi.fn(),
      };
      const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, sessionId);
      const runSpy = vi
        .spyOn(GetTrustedInputTask.prototype, "run")
        .mockResolvedValue(
          {} as unknown as Awaited<
            ReturnType<typeof GetTrustedInputTask.prototype.run>
          >,
        );

      const result = binder.getTrustedInput(getTrustedInputArgs);

      expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionTaskCallArgs;
      expect(args.sessionId).toBe(sessionId);
      expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
      expect(args.deviceAction.input.appName).toBe(APP_NAME);
      expect(args.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.None,
      );
      expect(args.deviceAction.input.skipOpenApp).toBe(false);
      expect(result).toBe(expectedResult);

      await args.deviceAction.input.task({} as InternalApi);
      expect(runSpy).toHaveBeenCalledOnce();
    });

    it("should keep provided skipOpenApp value", () => {
      const executeDeviceActionMock = vi.fn().mockReturnValue({
        observable: from([]),
        cancel: vi.fn(),
      });
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, "sessionId");

      binder.getTrustedInput({
        transaction: new Uint8Array([0x00]),
        skipOpenApp: true,
      });

      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionTaskCallArgs;
      expect(args.deviceAction.input.skipOpenApp).toBe(true);
    });
  });

  describe("signTransaction", () => {
    const signTransactionArg = {
      inputs: [
        [
          {
            version: new Uint8Array([0x05, 0x00, 0x00, 0x80]),
            inputs: [],
            outputs: [],
            locktime: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
          },
          0,
          undefined,
          undefined,
        ],
      ],
      associatedKeysets: ["44'/133'/0'/0/0"],
      outputScriptHex: "01",
      additionals: ["zcash"],
    } satisfies LegacyCreateTransactionArg;

    it("should call dmk.executeDeviceAction with CallTaskInAppDeviceAction and default skipOpenApp to false", async () => {
      const sessionId = "test-session-id";
      const expectedResult = {
        observable: from([]),
        cancel: vi.fn(),
      };
      const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, sessionId);
      const runSpy = vi
        .spyOn(SignTransactionTask.prototype, "run")
        .mockResolvedValue(
          {} as unknown as Awaited<
            ReturnType<typeof SignTransactionTask.prototype.run>
          >,
        );

      const result = binder.signTransaction({
        transactionArg: signTransactionArg,
      });

      expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionTaskCallArgs;
      expect(args.sessionId).toBe(sessionId);
      expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
      expect(args.deviceAction.input.appName).toBe(APP_NAME);
      expect(args.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.SignTransaction,
      );
      expect(args.deviceAction.input.skipOpenApp).toBe(false);
      expect(result).toBe(expectedResult);

      await args.deviceAction.input.task({} as InternalApi);
      expect(runSpy).toHaveBeenCalledOnce();
    });

    it("should keep provided skipOpenApp value", () => {
      const executeDeviceActionMock = vi.fn().mockReturnValue({
        observable: from([]),
        cancel: vi.fn(),
      });
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, "sessionId");

      binder.signTransaction({
        transactionArg: signTransactionArg,
        skipOpenApp: true,
      });

      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionTaskCallArgs;
      expect(args.deviceAction.input.skipOpenApp).toBe(true);
    });

    it("should return the result from executeDeviceAction", () => {
      const expectedResult: ExecuteDeviceActionReturnType<
        SignTransactionDAOutput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      > = {
        observable: from([
          {
            status: DeviceActionStatus.Completed as const,
            output: "0x01" as SignTransactionDAOutput,
          },
        ]),
        cancel: vi.fn(),
      };
      const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, "sessionId");

      const result = binder.signTransaction({
        transactionArg: signTransactionArg,
      });

      expect(result).toBe(expectedResult);
    });
  });

  describe("signPcztTransaction", () => {
    it("should call executeDeviceAction with CallTaskInAppDeviceAction and run SignPcztTransactionTask", async () => {
      const sessionId = "test-session-id";
      const expectedResult = {
        observable: from([]),
        cancel: vi.fn(),
      };
      const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, sessionId);
      const runSpy = vi
        .spyOn(SignPcztTransactionTask.prototype, "run")
        .mockResolvedValue(
          {} as unknown as Awaited<
            ReturnType<typeof SignPcztTransactionTask.prototype.run>
          >,
        );

      const result = binder.signPcztTransaction({
        transaction: privateToPrivateTransaction(),
      });

      expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionTaskCallArgs;
      expect(args.sessionId).toBe(sessionId);
      expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
      expect(args.deviceAction.input.appName).toBe(APP_NAME);
      expect(args.deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.SignTransaction,
      );
      expect(args.deviceAction.input.skipOpenApp).toBe(false);
      expect(result).toBe(expectedResult);

      await args.deviceAction.input.task({} as InternalApi);
      expect(runSpy).toHaveBeenCalledOnce();
    });

    it("should keep provided skipOpenApp value", () => {
      const executeDeviceActionMock = vi.fn().mockReturnValue({
        observable: from([]),
        cancel: vi.fn(),
      });
      const dmkMock = {
        executeDeviceAction: executeDeviceActionMock,
      } as unknown as DeviceManagementKit;
      const binder = new ZcashAppBinder(dmkMock, "sessionId");

      binder.signPcztTransaction({
        transaction: privateToPrivateTransaction(),
        skipOpenApp: true,
      });

      const args = executeDeviceActionMock.mock
        .calls[0]![0] as ExecuteDeviceActionTaskCallArgs;
      expect(args.deviceAction.input.skipOpenApp).toBe(true);
    });
  });
});
