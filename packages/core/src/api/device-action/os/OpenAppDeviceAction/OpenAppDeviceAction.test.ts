import { InvalidStatusWordError } from "@api/command/Errors";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { InternalApi } from "@api/device-action/DeviceAction";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
} from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { DeviceStatus } from "@api/index";

import { OpenAppDeviceAction } from "./OpenAppDeviceAction";
import { OpenAppDAState } from "./types";

describe("OpenAppDeviceAction", () => {
  const getAppAndVersionMock = jest.fn();
  const openAppMock = jest.fn();
  const closeAppMock = jest.fn();
  const getDeviceSessionStateMock = jest.fn();
  const isDeviceOnboardedMock = jest.fn();

  function extractDependenciesMock() {
    return {
      getDeviceSessionState: getDeviceSessionStateMock,
      getAppAndVersion: getAppAndVersionMock,
      openApp: openAppMock,
      closeApp: closeAppMock,
      isDeviceOnboarded: isDeviceOnboardedMock,
    };
  }

  const sendCommandMock = jest.fn();
  const apiGetDeviceSessionStateMock = jest.fn();
  const apiGetDeviceSessionStateObservableMock = jest.fn();
  const setDeviceSessionStateMock = jest.fn();

  function internalApiMock(): InternalApi {
    return {
      sendCommand: sendCommandMock,
      getDeviceSessionState: apiGetDeviceSessionStateMock,
      getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
      setDeviceSessionState: setDeviceSessionStateMock,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    isDeviceOnboardedMock.mockReturnValue(true);
  });

  describe("without overriding `extractDependencies`", () => {
    it("should end if the required application is opened", (done) => {
      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "Bitcoin",
      });

      sendCommandMock.mockResolvedValueOnce({
        name: "Bitcoin",
        version: "0.0.0",
      });

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });
  });

  describe("success cases", () => {
    it("should end in a success if the app is already opened", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "Bitcoin",
      });
      getAppAndVersionMock.mockResolvedValue({
        app: "Bitcoin",
        version: "0.0.0",
      });

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });

    it("should end in a success if the dashboard is open and open app succeeds", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "BOLOS",
      });
      getAppAndVersionMock.mockResolvedValue({
        app: "BOLOS",
        version: "0.0.0",
      });
      openAppMock.mockResolvedValue(undefined);

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // open app
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });
    it("should end in a success if another app is open, close app succeeds and open app succeeds", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "AnotherApp",
      });
      getAppAndVersionMock.mockResolvedValue({
        app: "AnotherApp",
        version: "0.0.0",
      });
      closeAppMock.mockResolvedValue(undefined);
      openAppMock.mockResolvedValue(undefined);

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // close app
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // open app
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
        },
        {
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });
  });

  describe("errors cases", () => {
    it("should end in an error if the device is not onboarded", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "mockedCurrentApp",
      });
      isDeviceOnboardedMock.mockReturnValue(false);

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });

      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          error: new DeviceNotOnboardedError(),
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });

    it("should end in an error if the device is locked", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.LOCKED,
        currentApp: "mockedCurrentApp",
      });

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });

      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Error,
          error: new DeviceLockedError(),
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });

    it("should end in an error if getAppAndVersion throws an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "mockedCurrentApp",
      });

      getAppAndVersionMock.mockRejectedValue(
        new InvalidStatusWordError("mocked error"),
      );

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });

      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new InvalidStatusWordError("mocked error"),
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });
    it("should end in an error if the dashboard is open and open app throws an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "BOLOS",
      });
      getAppAndVersionMock.mockResolvedValue({
        app: "BOLOS",
        version: "0.0.0",
      });
      openAppMock.mockRejectedValue(new InvalidStatusWordError("mocked error"));

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // open app
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new InvalidStatusWordError("mocked error"),
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });

    it("should end in an error if another app is open, and close app throws", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "AnotherApp",
      });
      getAppAndVersionMock.mockResolvedValue({
        app: "AnotherApp",
        version: "0.0.0",
      });
      closeAppMock.mockRejectedValue(
        new InvalidStatusWordError("mocked error"),
      );

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // close app
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new InvalidStatusWordError("mocked error"),
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });

    it("should end in an error if another app is open, close app succeeds but open app throws", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "AnotherApp",
      });
      getAppAndVersionMock.mockResolvedValue({
        app: "AnotherApp",
        version: "0.0.0",
      });
      closeAppMock.mockResolvedValue(undefined);
      openAppMock.mockRejectedValue(new InvalidStatusWordError("mocked error"));

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // close app
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // open app
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new InvalidStatusWordError("mocked error"),
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        internalApiMock(),
        done,
      );
    });
  });

  it("should emit a stopped state if the action is cancelled", (done) => {
    getDeviceSessionStateMock.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      currentApp: "AnotherApp",
    });
    getAppAndVersionMock.mockResolvedValue({
      app: "AnotherApp",
      version: "0.0.0",
    });

    const openAppDeviceAction = new OpenAppDeviceAction({
      input: { appName: "Bitcoin" },
    });
    jest
      .spyOn(openAppDeviceAction, "extractDependencies")
      .mockReturnValue(extractDependenciesMock());

    const expectedStates: Array<OpenAppDAState> = [
      {
        status: DeviceActionStatus.Pending, // get app and version
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
      },
      {
        status: DeviceActionStatus.Stopped,
      },
    ];

    const { cancel } = testDeviceActionStates(
      openAppDeviceAction,
      expectedStates,
      internalApiMock(),
      done,
    );
    cancel();
  });
});
