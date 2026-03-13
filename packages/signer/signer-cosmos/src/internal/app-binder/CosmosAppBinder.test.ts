import {
  CallTaskInAppDeviceAction,
  DeviceActionStatus,
  type DeviceManagementKit,
  type ExecuteDeviceActionReturnType,
  type LoggerPublisherService,
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
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
} from "@api/app-binder/GetAppConfigDeviceActionTypes";
import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import { CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";

describe("CosmosAppBinder", () => {
  const loggerMock = {
    debug: vi.fn(),
  } as unknown as LoggerPublisherService;

  const loggerFactoryMock = vi.fn().mockReturnValue(loggerMock);

  it("getAppConfig should call dmk.executeDeviceAction with SendCommandInAppDeviceAction and return the result", () => {
    // ARRANGE
    const sessionId = "test-session-id";
    const expectedResult: ExecuteDeviceActionReturnType<
      GetAppConfigDAOutput,
      GetAppConfigDAError,
      GetAppConfigDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: {
            major: 1,
            minor: 2,
            patch: 3,
          },
        },
      ]),
      cancel: vi.fn(),
    };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    const binder = new CosmosAppBinder(dmkMock, sessionId, loggerFactoryMock);

    // ACT
    const result = binder.getAppConfig({ skipOpenApp: false });

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    const args = executeDeviceActionMock.mock.calls[0]![0];
    expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(args.deviceAction.input.command).toBeInstanceOf(GetAppConfigCommand);
    expect(args.deviceAction.input.appName).toBe("Cosmos");
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
    expect(args.deviceAction.input.skipOpenApp).toBe(false);
    expect(result).toBe(expectedResult);
  });

  it("getAddress should call dmk.executeDeviceAction with SendCommandInAppDeviceAction and return the result", () => {
    // ARRANGE
    const sessionId = "test-session-id";
    const getAddressArgs = {
      derivationPath: "44'/118'/0'/0/0",
      hrp: "cosmos",
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
            address: "cosmos1234567890",
          },
        },
      ]),
      cancel: vi.fn(),
    };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    const binder = new CosmosAppBinder(dmkMock, sessionId, loggerFactoryMock);

    // ACT
    const result = binder.getAddress(getAddressArgs);

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    const args = executeDeviceActionMock.mock.calls[0]![0];
    expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(args.deviceAction.input.command).toBeInstanceOf(GetAddressCommand);
    expect(args.deviceAction.input.appName).toBe("Cosmos");
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
    expect(args.deviceAction.input.skipOpenApp).toBe(false);
    expect(result).toBe(expectedResult);
  });

  it("signTransaction should call dmk.executeDeviceAction with CallTaskInAppDeviceAction and return the result", () => {
    // ARRANGE
    const sessionId = "test-session-id";
    const signTransactionArgs = {
      derivationPath: "44'/118'/0'/0/0",
      hrp: "cosmos",
      transaction: new Uint8Array([0x01, 0x02]),
      skipOpenApp: false,
    };
    const expectedResult: ExecuteDeviceActionReturnType<
      SignTransactionDAOutput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: new Uint8Array([0x01, 0x02]),
        },
      ]),
      cancel: vi.fn(),
    };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    const binder = new CosmosAppBinder(dmkMock, sessionId, loggerFactoryMock);

    // ACT
    const result = binder.signTransaction(signTransactionArgs);

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    const args = executeDeviceActionMock.mock.calls[0]![0];
    expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
    expect(args.deviceAction.input.appName).toBe("Cosmos");
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.SignTransaction,
    );
    expect(args.deviceAction.input.skipOpenApp).toBe(false);
    expect(result).toBe(expectedResult);
  });
});
