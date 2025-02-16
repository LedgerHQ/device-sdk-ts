import { CommandResultFactory } from "@api/command/model/CommandResult";
import {
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@api/command/utils/GlobalCommandError";
import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGetDeviceStatusMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { UnknownDeviceExchangeError } from "@root/src";

import { GoToDashboardDeviceAction } from "./GoToDashboardDeviceAction";
import { type GoToDashboardDAState } from "./types";

vi.mock("@api/device-action/os/GetDeviceStatus/GetDeviceStatusDeviceAction");

describe("GoToDashboardDeviceAction", () => {
  const closeAppMock = vi.fn();
  const getAppAndVersionMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const setDeviceSessionStateMock = vi.fn();

  function extractDependenciesMock() {
    return {
      closeApp: closeAppMock,
      getAppAndVersion: getAppAndVersionMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      setDeviceSessionState: setDeviceSessionStateMock,
    };
  }

  const {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
  } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("without overriding `extractDependencies`", () => {
    it("should run the device action with device already on dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceStatusMock();

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.5.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });

        const expectedStates: Array<GoToDashboardDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending, // GetDeviceStatus events (mocked for tests)
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: undefined,
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should run the device action with device not on dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceStatusMock([
          {
            currentApp: "Bitcoin",
            currentAppVersion: "1.0.0",
          },
        ]);

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "Bitcoin", version: "1.0.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });

        sendCommandMock
          .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
          .mockResolvedValueOnce(
            CommandResultFactory({
              data: {
                name: "BOLOS",
                version: "1.5.0",
              },
            }),
          );

        const expectedStates: Array<GoToDashboardDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: undefined,
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });

  describe("success cases", () => {
    it("should success if the device is already on dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceStatusMock();

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.5.0" },
        });

        getAppAndVersionMock.mockReturnValue({
          app: "BOLOS",
          version: "1.5.0",
        });

        vi.spyOn(
          goToDashboardDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GoToDashboardDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: undefined,
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should success if the device is not on dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceStatusMock();

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          goToDashboardDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
        });

        closeAppMock.mockResolvedValue(
          CommandResultFactory({ data: undefined }),
        );
        getAppAndVersionMock.mockReturnValue(
          CommandResultFactory({
            data: {
              name: "BOLOS",
              version: "1.5.0",
            },
          }),
        );

        const expectedStates: Array<GoToDashboardDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            output: undefined,
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });

  describe("error cases", () => {
    it("should return an error if GetDeviceStatus return an error", () =>
      new Promise<void>((resolve, reject) => {
        setupGetDeviceStatusMock([new UnknownDAError("Unknown error")]);

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.5.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });

        const expectedStates: Array<GoToDashboardDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("Unknown error"),
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    describe("not on dashboard", () => {
      it("should return an error if closeApp fails", () =>
        new Promise<void>((resolve, reject) => {
          setupGetDeviceStatusMock([
            {
              currentApp: "Bitcoin",
              currentAppVersion: "1.0.0",
            },
          ]);

          const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
            input: {},
          });

          vi.spyOn(
            goToDashboardDeviceAction,
            "extractDependencies",
          ).mockReturnValue(extractDependenciesMock());

          getDeviceSessionStateMock.mockReturnValue({
            sessionStateType: DeviceSessionStateType.Connected,
            deviceStatus: DeviceStatus.CONNECTED,
            currentApp: "Bitcoin",
          });

          closeAppMock.mockReturnValue(
            CommandResultFactory({
              error: new UnknownDeviceExchangeError("Close app failed"),
            }),
          );

          const expectedStates: Array<GoToDashboardDAState> = [
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              status: DeviceActionStatus.Error,
              error: new UnknownDeviceExchangeError("Close app failed"),
            },
          ];

          testDeviceActionStates(
            goToDashboardDeviceAction,
            expectedStates,
            makeDeviceActionInternalApiMock(),
            {
              onDone: resolve,
              onError: reject,
            },
          );
        }));

      it("should return an error if getAppAndVersion fails", () =>
        new Promise<void>((resolve, reject) => {
          setupGetDeviceStatusMock([
            {
              currentApp: "Bitcoin",
              currentAppVersion: "1.0.0",
            },
          ]);

          const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
            input: { unlockTimeout: 500 },
          });
          const error = new GlobalCommandError({
            ...GLOBAL_ERRORS["5501"],
            errorCode: "5501",
          });

          vi.spyOn(
            goToDashboardDeviceAction,
            "extractDependencies",
          ).mockReturnValue(extractDependenciesMock());

          getDeviceSessionStateMock.mockReturnValue({
            sessionStateType: DeviceSessionStateType.Connected,
            deviceStatus: DeviceStatus.CONNECTED,
            currentApp: "Bitcoin",
          });

          closeAppMock.mockResolvedValue(
            CommandResultFactory({ data: undefined }),
          );
          getAppAndVersionMock.mockResolvedValue(
            CommandResultFactory({
              error,
            }),
          );

          const expectedStates: Array<GoToDashboardDAState> = [
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              status: DeviceActionStatus.Error,
              error,
            },
          ];

          testDeviceActionStates(
            goToDashboardDeviceAction,
            expectedStates,
            makeDeviceActionInternalApiMock(),
            {
              onDone: resolve,
              onError: reject,
            },
          );
        }));

      it("should return an error if getAppAndVersion does not return an app name", () =>
        new Promise<void>((resolve, reject) => {
          setupGetDeviceStatusMock([
            {
              currentApp: "Bitcoin",
              currentAppVersion: "1.0.0",
            },
          ]);

          const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
            input: { unlockTimeout: 500 },
          });

          vi.spyOn(
            goToDashboardDeviceAction,
            "extractDependencies",
          ).mockReturnValue(extractDependenciesMock());

          getDeviceSessionStateMock.mockReturnValue({
            sessionStateType: DeviceSessionStateType.Connected,
            deviceStatus: DeviceStatus.CONNECTED,
            currentApp: "Bitcoin",
          });

          closeAppMock.mockResolvedValue(
            CommandResultFactory({ data: undefined }),
          );
          getAppAndVersionMock.mockResolvedValue(
            CommandResultFactory({
              data: {
                name: null,
                version: "1.0.0",
              },
            }),
          );

          const expectedStates: Array<GoToDashboardDAState> = [
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
              },
              status: DeviceActionStatus.Pending,
            },
            {
              status: DeviceActionStatus.Error,
              error: new UnknownDAError("currentApp === null"),
            },
          ];

          testDeviceActionStates(
            goToDashboardDeviceAction,
            expectedStates,
            makeDeviceActionInternalApiMock(),
            {
              onDone: resolve,
              onError: reject,
            },
          );
        }));
    });
  });
});
