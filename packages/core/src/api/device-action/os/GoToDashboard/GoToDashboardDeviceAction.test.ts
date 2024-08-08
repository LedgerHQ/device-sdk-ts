import { CommandResultFactory } from "@api/command/model/CommandResult";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGetDeviceStatusMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";

import { GoToDashboardDeviceAction } from "./GoToDashboardDeviceAction";
import { GoToDashboardDAState } from "./types";

jest.mock("@api/device-action/os/GetDeviceStatus/GetDeviceStatusDeviceAction");

describe("GoToDashboardDeviceAction", () => {
  const closeAppMock = jest.fn();
  const getAppAndVersionMock = jest.fn();
  const getDeviceSessionStateMock = jest.fn();
  const saveSessionStateMock = jest.fn();

  function extractDependenciesMock() {
    return {
      closeApp: closeAppMock,
      getAppAndVersion: getAppAndVersionMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      saveSessionState: saveSessionStateMock,
    };
  }

  const {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
  } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("without overriding `extractDependencies`", () => {
    it("should run the device action with device already on dashboard", (done) => {
      setupGetDeviceStatusMock();

      const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
        input: { unlockTimeout: 500 },
      });

      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "BOLOS",
        installedApps: [],
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
        done,
      );
    });

    it("should run the device action with device not on dashboard", (done) => {
      setupGetDeviceStatusMock({
        currentApp: "Bitcoin",
        currentAppVersion: "1.0.0",
      });

      const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
        input: { unlockTimeout: 500 },
      });

      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "Bitcoin",
        installedApps: [],
      });

      sendCommandMock
        .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
        .mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              name: "BOLOS",
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
        done,
      );
    });
  });

  describe("success cases", () => {
    it("should success if the device is already on dashboard", (done) => {
      setupGetDeviceStatusMock();

      const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
        input: { unlockTimeout: 500 },
      });

      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.Connected,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "BOLOS",
      });

      getAppAndVersionMock.mockReturnValue({
        app: "BOLOS",
        version: "1.0.0",
      });

      jest
        .spyOn(goToDashboardDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
          output: undefined,
          status: DeviceActionStatus.Completed,
        },
      ];

      testDeviceActionStates(
        goToDashboardDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should success if the device is not on dashboard", (done) => {
      setupGetDeviceStatusMock();

      const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
        input: { unlockTimeout: 500 },
      });

      jest
        .spyOn(goToDashboardDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.Connected,
        deviceStatus: DeviceStatus.CONNECTED,
      });

      closeAppMock.mockResolvedValue(undefined);
      getAppAndVersionMock.mockReturnValue({
        app: "BOLOS",
        version: "1.0.0",
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
        done,
      );
    });
  });

  describe("error cases", () => {
    it("should return an error if GetDeviceStatus return an error", (done) => {
      setupGetDeviceStatusMock(new UnknownDAError("Unknown error"));

      const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
        input: { unlockTimeout: 500 },
      });

      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "BOLOS",
        installedApps: [],
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
        done,
      );
    });

    describe("not on dashboard", () => {
      it("should return an error if closeApp fails", (done) => {
        setupGetDeviceStatusMock({
          currentApp: "Bitcoin",
          currentAppVersion: "1.0.0",
        });

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: {},
        });

        jest
          .spyOn(goToDashboardDeviceAction, "extractDependencies")
          .mockReturnValue(extractDependenciesMock());

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: "Bitcoin",
        });

        closeAppMock.mockRejectedValue(new UnknownDAError("Close app failed"));

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
            error: new UnknownDAError("Close app failed"),
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          done,
        );
      });

      it("should return an error if getAppAndVersion fails", (done) => {
        setupGetDeviceStatusMock({
          currentApp: "Bitcoin",
          currentAppVersion: "1.0.0",
        });

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        jest
          .spyOn(goToDashboardDeviceAction, "extractDependencies")
          .mockReturnValue(extractDependenciesMock());

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: "Bitcoin",
        });

        closeAppMock.mockResolvedValue(undefined);
        getAppAndVersionMock.mockRejectedValue(
          new UnknownDAError("Get app and version failed"),
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
            error: new UnknownDAError("Get app and version failed"),
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          done,
        );
      });

      it("should return an error if getAppAndVersion does not return an app name", (done) => {
        setupGetDeviceStatusMock({
          currentApp: "Bitcoin",
          currentAppVersion: "1.0.0",
        });

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        jest
          .spyOn(goToDashboardDeviceAction, "extractDependencies")
          .mockReturnValue(extractDependenciesMock());

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: "Bitcoin",
        });

        closeAppMock.mockResolvedValue(undefined);
        getAppAndVersionMock.mockResolvedValue({
          app: null,
          version: "1.0.0",
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
          done,
        );
      });

      it("should return an error if SaveSessionState fails", (done) => {
        setupGetDeviceStatusMock({
          currentApp: "Bitcoin",
          currentAppVersion: "1.0.0",
        });

        const goToDashboardDeviceAction = new GoToDashboardDeviceAction({
          input: { unlockTimeout: 500 },
        });

        jest
          .spyOn(goToDashboardDeviceAction, "extractDependencies")
          .mockReturnValue(extractDependenciesMock());

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: "Bitcoin",
        });

        closeAppMock.mockResolvedValue(undefined);
        getAppAndVersionMock.mockResolvedValue({
          app: "BOLOS",
          version: "1.0.0",
        });

        saveSessionStateMock.mockImplementation(() => {
          throw new Error("Save session state failed");
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
            error: new UnknownDAError("SaveAppStateError"),
          },
        ];

        testDeviceActionStates(
          goToDashboardDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          done,
        );
      });
    });
  });
});
