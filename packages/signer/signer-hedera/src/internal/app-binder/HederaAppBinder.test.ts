import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { type AppConfig } from "@api/model/AppConfig";
import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import {
  GetPublicKeyCommand,
  type GetPublicKeyCommandArgs,
  type GetPublicKeyCommandResponse,
} from "@internal/app-binder/command/GetPublicKeyCommand";
import {
  SignTransactionCommand,
  type SignTransactionCommandArgs,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { type HederaErrorCodes } from "@internal/app-binder/command/utils/hederaApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

type CallArgs<Response, Args, Interaction extends UserInteractionRequired> = {
  sessionId: DeviceSessionId;
  deviceAction: SendCommandInAppDeviceAction<
    Response,
    Args,
    HederaErrorCodes,
    Interaction
  >;
};

type GetAppConfigCallArgs = CallArgs<
  AppConfig,
  void,
  UserInteractionRequired.None
>;

type GetPublicKeyCallArgs = CallArgs<
  GetPublicKeyCommandResponse,
  GetPublicKeyCommandArgs,
  UserInteractionRequired.None | UserInteractionRequired.VerifyAddress
>;

type SignTransactionCallArgs = CallArgs<
  SignTransactionCommandResponse,
  SignTransactionCommandArgs,
  UserInteractionRequired.SignTransaction
>;

describe("HederaAppBinder", () => {
  const sessionId = "test-session-id";

  const makeBinder = (executeDeviceActionMock: ReturnType<typeof vi.fn>) => {
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    return new HederaAppBinder(dmkMock, sessionId);
  };

  it("getAppConfig should run a SendCommandInAppDeviceAction with GetAppConfigCommand", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const binder = makeBinder(executeDeviceActionMock);

    // ACT
    const result = binder.getAppConfig({ skipOpenApp: false });

    // ASSERT
    const args = executeDeviceActionMock.mock
      .calls[0]![0] as GetAppConfigCallArgs;
    expect(args.sessionId).toBe(sessionId);
    expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    const { input } = args.deviceAction;
    expect(input.command).toBeInstanceOf(GetAppConfigCommand);
    expect(input.appName).toBe(APP_NAME);
    expect(input.requiredUserInteraction).toBe(UserInteractionRequired.None);
    expect(input.skipOpenApp).toBe(false);
    expect(result).toBe(expectedResult);
  });

  it("getPublicKey should request VerifyAddress interaction when checkOnDevice is true", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const binder = makeBinder(executeDeviceActionMock);

    // ACT
    const result = binder.getPublicKey({
      keyIndex: 3,
      checkOnDevice: true,
      skipOpenApp: true,
    });

    // ASSERT
    const { input } = (
      executeDeviceActionMock.mock.calls[0]![0] as GetPublicKeyCallArgs
    ).deviceAction;
    expect(input.command).toBeInstanceOf(GetPublicKeyCommand);
    expect((input.command as GetPublicKeyCommand).args).toEqual({
      keyIndex: 3,
      checkOnDevice: true,
    });
    expect(input.requiredUserInteraction).toBe(
      UserInteractionRequired.VerifyAddress,
    );
    expect(input.skipOpenApp).toBe(true);
    expect(result).toBe(expectedResult);
  });

  it("getPublicKey should require no interaction when checkOnDevice is false", () => {
    // ARRANGE
    const executeDeviceActionMock = vi.fn().mockReturnValue({});
    const binder = makeBinder(executeDeviceActionMock);

    // ACT
    binder.getPublicKey({
      keyIndex: 0,
      checkOnDevice: false,
      skipOpenApp: false,
    });

    // ASSERT
    const { input } = (
      executeDeviceActionMock.mock.calls[0]![0] as GetPublicKeyCallArgs
    ).deviceAction;
    expect(input.requiredUserInteraction).toBe(UserInteractionRequired.None);
  });

  it("signTransaction should run a SendCommandInAppDeviceAction requiring SignTransaction", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const binder = makeBinder(executeDeviceActionMock);
    const transactionBody = new Uint8Array([0x01, 0x02]);

    // ACT
    const result = binder.signTransaction({
      keyIndex: 0,
      transactionBody,
      skipOpenApp: false,
    });

    // ASSERT
    const { input } = (
      executeDeviceActionMock.mock.calls[0]![0] as SignTransactionCallArgs
    ).deviceAction;
    expect(input.command).toBeInstanceOf(SignTransactionCommand);
    expect((input.command as SignTransactionCommand).args).toEqual({
      keyIndex: 0,
      transactionBody,
    });
    expect(input.appName).toBe(APP_NAME);
    expect(input.requiredUserInteraction).toBe(
      UserInteractionRequired.SignTransaction,
    );
    expect(input.skipOpenApp).toBe(false);
    expect(result).toBe(expectedResult);
  });
});
