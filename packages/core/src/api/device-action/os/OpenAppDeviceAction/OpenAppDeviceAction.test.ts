import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
} from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";

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

  const {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
  } = makeDeviceActionInternalApiMock();

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
        installedApps: [],
      });

      sendCommandMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            name: "Bitcoin",
            version: "0.0.0",
          },
        }),
      );

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
        makeDeviceActionInternalApiMock(),
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
      getAppAndVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "Bitcoin",
            version: "0.0.0",
          },
        }),
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
          status: DeviceActionStatus.Completed,
          output: undefined,
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in a success if the dashboard is open and open app succeeds", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "BOLOS",
      });
      getAppAndVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "BOLOS",
            version: "0.0.0",
          },
        }),
      );
      openAppMock.mockResolvedValue(CommandResultFactory({ data: undefined }));

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
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
    it("should end in a success if another app is open, close app succeeds and open app succeeds", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "AnotherApp",
      });
      getAppAndVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "AnotherApp",
            version: "0.0.0",
          },
        }),
      );
      closeAppMock.mockResolvedValue(CommandResultFactory({ data: undefined }));
      openAppMock.mockResolvedValue(CommandResultFactory({ data: undefined }));

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
        makeDeviceActionInternalApiMock(),
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
        makeDeviceActionInternalApiMock(),
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
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if getAppAndVersion throws an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "mockedCurrentApp",
      });

      getAppAndVersionMock.mockReturnValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("mocked error"),
        }),
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
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
    it("should end in an error if the dashboard is open and open app throws an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue(
        CommandResultFactory({
          data: {
            sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
            deviceStatus: DeviceStatus.CONNECTED,
            currentApp: "BOLOS",
          },
        }),
      );
      getAppAndVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "BOLOS",
            version: "0.0.0",
          },
        }),
      );
      openAppMock.mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("mocked error"),
        }),
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
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if another app is open, and close app throws", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "AnotherApp",
      });
      getAppAndVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "AnotherApp",
            version: "0.0.0",
          },
        }),
      );
      closeAppMock.mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("mocked error"),
        }),
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
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if another app is open, close app succeeds but open app throws", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "AnotherApp",
      });
      getAppAndVersionMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "AnotherApp",
            version: "0.0.0",
          },
        }),
      );
      closeAppMock.mockResolvedValue(CommandResultFactory({ data: undefined }));
      openAppMock.mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("mocked error"),
        }),
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
        makeDeviceActionInternalApiMock(),
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
    getAppAndVersionMock.mockResolvedValue(
      CommandResultFactory({
        data: {
          name: "AnotherApp",
          version: "0.0.0",
        },
      }),
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
        status: DeviceActionStatus.Stopped,
      },
    ];

    const { cancel } = testDeviceActionStates(
      openAppDeviceAction,
      expectedStates,
      makeDeviceActionInternalApiMock(),
      done,
    );
    cancel();
  });
});
