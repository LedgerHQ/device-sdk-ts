import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetVersionCommand } from "@internal/app-binder/command/GetVersionCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

const DERIVATION_PATH = "44'/223'/0'/0/0";

describe("IcpAppBinder", () => {
  const loggerMock = { debug: vi.fn() } as unknown as LoggerPublisherService;
  const loggerFactoryMock = vi.fn().mockReturnValue(loggerMock);
  const sessionId = "test-session-id";

  const makeBinder = (executeDeviceActionMock: ReturnType<typeof vi.fn>) => {
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    return new IcpAppBinder(dmkMock, sessionId, loggerFactoryMock);
  };

  it("getVersion should run a SendCommandInAppDeviceAction with GetVersionCommand", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const binder = makeBinder(executeDeviceActionMock);

    // ACT
    const result = binder.getVersion({ skipOpenApp: false });

    // ASSERT
    const args = executeDeviceActionMock.mock.calls[0]![0];
    expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(args.deviceAction.input.command).toBeInstanceOf(GetVersionCommand);
    expect(args.deviceAction.input.appName).toBe(APP_NAME);
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
    expect(result).toBe(expectedResult);
  });

  it("getAddress should request VerifyAddress interaction when checkOnDevice is true", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const binder = makeBinder(executeDeviceActionMock);

    // ACT
    const result = binder.getAddress({
      derivationPath: DERIVATION_PATH,
      checkOnDevice: true,
      skipOpenApp: false,
    });

    // ASSERT
    const args = executeDeviceActionMock.mock.calls[0]![0];
    expect(args.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(args.deviceAction.input.command).toBeInstanceOf(GetAddressCommand);
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.VerifyAddress,
    );
    expect(result).toBe(expectedResult);
  });

  it("getAddress should require no interaction when checkOnDevice is false", () => {
    // ARRANGE
    const executeDeviceActionMock = vi.fn().mockReturnValue({});
    const binder = makeBinder(executeDeviceActionMock);

    // ACT
    binder.getAddress({
      derivationPath: DERIVATION_PATH,
      checkOnDevice: false,
      skipOpenApp: false,
    });

    // ASSERT
    const args = executeDeviceActionMock.mock.calls[0]![0];
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
  });

  it("signTransaction should run a CallTaskInAppDeviceAction requiring SignTransaction", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const binder = makeBinder(executeDeviceActionMock);

    // ACT
    const result = binder.signTransaction({
      derivationPath: DERIVATION_PATH,
      transaction: new Uint8Array([0x01, 0x02]),
    });

    // ASSERT
    const args = executeDeviceActionMock.mock.calls[0]![0];
    expect(args.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
    expect(args.deviceAction.input.appName).toBe(APP_NAME);
    expect(args.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.SignTransaction,
    );
    expect(args.deviceAction.input.skipOpenApp).toBe(false);
    expect(result).toBe(expectedResult);
  });
});
