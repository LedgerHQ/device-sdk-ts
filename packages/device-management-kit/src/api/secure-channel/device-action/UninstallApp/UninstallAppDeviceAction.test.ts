import { Right } from "purify-ts";
import { of, throwError } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import {
  setupGoToDashboardMock,
  setupListInstalledAppsMock,
} from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import {
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import { type InstalledApp } from "@api/secure-channel/device-action/ListInstalledApps/types";
import {
  type SecureChannelEvent,
  SecureChannelEventType,
} from "@api/secure-channel/task/types";
import { type Application } from "@internal/manager-api/model/Application";
import { SecureChannelError } from "@internal/secure-channel/model/Errors";

import { type UninstallAppDAState } from "./types";
import { UninstallAppDeviceAction } from "./UninstallAppDeviceAction";

vi.mock(
  "@api/secure-channel/device-action/ListInstalledApps/ListInstalledAppsDeviceAction",
);
vi.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");

describe("UninstallAppDeviceAction", () => {
  const getOsVersionMock = vi.fn();
  const getAppsByHashMock = vi.fn();
  const uninstallAppMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const setDeviceSessionStateMock = vi.fn();
  const extractDependenciesMock = () => ({
    getOsVersion: getOsVersionMock,
    getAppsByHash: getAppsByHashMock,
    uninstallApp: uninstallAppMock,
    getDeviceSessionState: getDeviceSessionStateMock,
    setDeviceSessionState: setDeviceSessionStateMock,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should finish successfully when the app is not installed on the device", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([
        { installedApps: [{ name: "Bitcoin" } as InstalledApp] },
      ]);

      const expectedStates: Array<UninstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      const uninstallAppDeviceAction = new UninstallAppDeviceAction({
        input: { appName: "Ethereum" },
      });
      vi.spyOn(
        uninstallAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        uninstallAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should finish successfully when the app is installed on the device", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([
        { installedApps: [{ name: "Bitcoin" } as InstalledApp] },
        { installedApps: [] },
      ]);
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: 12345678,
            secureElementFlags: {
              isSecureConnectionAllowed: true,
            },
          } as GetOsVersionResponse,
        }),
      );
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "BOLOS", version: "0.0.0" },
        isSecureConnectionAllowed: false,
      });
      getAppsByHashMock.mockResolvedValue(
        Right([
          {
            versionName: "Bitcoin",
            perso: "test_perso",
            firmware: "test_firmware_for_bitcoin",
            firmwareKey: "test_firmware_key_for_bitcoin",
            hash: "test_hash_for_bitcoin",
          } as Application,
        ]),
      );
      uninstallAppMock.mockReturnValue(
        of({
          type: SecureChannelEventType.Exchange,
        } as SecureChannelEvent),
      );

      const expectedStates: Array<UninstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      const uninstallAppDeviceAction = new UninstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        uninstallAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        uninstallAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should finish unsuccessfully when the app is a dependency of other installed apps", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([
        {
          installedApps: [
            { name: "Bitcoin" },
            { name: "Testcoin" },
          ] as InstalledApp[],
        },
      ]);
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: 12345678,
            secureElementFlags: {
              isSecureConnectionAllowed: true,
            },
          } as GetOsVersionResponse,
        }),
      );
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "BOLOS", version: "0.0.0" },
        isSecureConnectionAllowed: false,
      });
      getAppsByHashMock.mockResolvedValue(
        Right([
          {
            versionName: "Testcoin",
            parentName: "Bitcoin",
          },
          {
            versionName: "Bitcoin",
          },
        ] as Application[]),
      );

      const expectedStates: Array<UninstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError(
            "App to uninstall is a dependency of another installed app",
          ),
        },
      ];

      const uninstallAppDeviceAction = new UninstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        uninstallAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        uninstallAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should finish unsuccessfully when the app is not found in manager API", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([
        { installedApps: [{ name: "Bitcoin" } as InstalledApp] },
      ]);
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: 12345678,
            secureElementFlags: {
              isSecureConnectionAllowed: true,
            },
          } as GetOsVersionResponse,
        }),
      );
      getDeviceSessionStateMock.mockReturnValue({} as DeviceSessionState);
      getAppsByHashMock.mockResolvedValueOnce(Right([]));

      const expectedStates: Array<UninstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError(
            "App to uninstall not found in manager API",
          ),
        },
      ];

      const uninstallAppDeviceAction = new UninstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        uninstallAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        uninstallAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should finish unsuccessfully when there is error in uninstallApp", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([
        { installedApps: [{ name: "Bitcoin" } as InstalledApp] },
      ]);
      setupGoToDashboardMock();
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            targetId: 12345678,
            secureElementFlags: {
              isSecureConnectionAllowed: true,
            },
          } as GetOsVersionResponse,
        }),
      );
      getDeviceSessionStateMock.mockReturnValue({} as DeviceSessionState);
      getAppsByHashMock.mockResolvedValueOnce(
        Right([{ versionName: "Bitcoin" } as Application]),
      );
      uninstallAppMock.mockReturnValue(
        throwError(
          () => new SecureChannelError("Uninstall app error in secure channel"),
        ),
      );

      const expectedStates: Array<UninstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new SecureChannelError(
            "Uninstall app error in secure channel",
          ),
        },
      ];

      const uninstallAppDeviceAction = new UninstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        uninstallAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        uninstallAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
});
