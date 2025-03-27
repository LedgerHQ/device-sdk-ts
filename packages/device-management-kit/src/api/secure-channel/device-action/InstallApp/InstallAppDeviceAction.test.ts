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
  type SecureChannelEventPayload,
  SecureChannelEventType,
} from "@api/secure-channel/task/types";
import { type Application } from "@internal/manager-api/model/Application";
import { SecureChannelError } from "@internal/secure-channel/model/Errors";

import { InstallAppDeviceAction } from "./InstallAppDeviceAction";
import { type InstallAppDAState } from "./types";

vi.mock(
  "@api/secure-channel/device-action/ListInstalledApps/ListInstalledAppsDeviceAction",
);
vi.mock("@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction");

describe("InstallAppDeviceAction", () => {
  const getOsVersionMock = vi.fn();
  const getAppListMock = vi.fn();
  const installAppMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const setDeviceSessionStateMock = vi.fn();
  const extractDependenciesMock = () => ({
    getOsVersion: getOsVersionMock,
    getAppList: getAppListMock,
    installApp: installAppMock,
    getDeviceSessionState: getDeviceSessionStateMock,
    setDeviceSessionState: setDeviceSessionStateMock,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should finish successfully when the app is already installed on the device", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([
        { installedApps: [{ name: "Bitcoin" } as InstalledApp] },
      ]);

      const expectedStates: Array<InstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      const installAppDeviceAction = new InstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        installAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        installAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should finish successfully when the app is not installed", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([
        { installedApps: [] },
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
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "BOLOS", version: "0.0.0" },
        isSecureConnectionAllowed: false,
      });
      getAppListMock.mockResolvedValue(
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
      installAppMock.mockImplementation(() =>
        of(
          {
            type: SecureChannelEventType.Progress,
            payload: {
              progress: 0,
            } as SecureChannelEventPayload["Progress"],
          },
          {
            type: SecureChannelEventType.Progress,
            payload: {
              progress: 0.55,
            } as SecureChannelEventPayload["Progress"],
          },
          {
            type: SecureChannelEventType.Progress,
            payload: {
              progress: 1,
            } as SecureChannelEventPayload["Progress"],
          },
        ),
      );

      const expectedStates: Array<InstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0.55,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 1,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 1,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 1,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      const installAppDeviceAction = new InstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        installAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        installAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
  it("should finish unsuccessfully when the dep app is not installed", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([{ installedApps: [] }]);
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
      getAppListMock.mockResolvedValue(
        Right([
          {
            versionName: "Bitcoin",
            parentName: "test_parent",
          } as Application,
        ]),
      );

      const expectedStates: Array<InstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError("Dep app is not installed on the device"),
        },
      ];

      const installAppDeviceAction = new InstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        installAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        installAppDeviceAction,
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
      setupListInstalledAppsMock([{ installedApps: [] }]);
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
      getAppListMock.mockResolvedValueOnce(Right([]));

      const expectedStates: Array<InstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError("App to install not found in manager API"),
        },
      ];

      const installAppDeviceAction = new InstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        installAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        installAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));

  it("should finish unsuccessfully when there is error in installApp", () =>
    new Promise<void>((resolve, reject) => {
      setupListInstalledAppsMock([{ installedApps: [] }]);
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
      getAppListMock.mockResolvedValueOnce(
        Right([{ versionName: "Bitcoin" } as Application]),
      );
      installAppMock.mockReturnValue(
        throwError(
          () => new SecureChannelError("Install app error in secure channel"),
        ),
      );

      const expectedStates: Array<InstallAppDAState> = [
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            progress: 0,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new SecureChannelError("Install app error in secure channel"),
        },
      ];

      const installAppDeviceAction = new InstallAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      vi.spyOn(
        installAppDeviceAction,
        "extractDependencies",
      ).mockImplementation(extractDependenciesMock);

      testDeviceActionStates(
        installAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        {
          onDone: resolve,
          onError: reject,
        },
      );
    }));
});
