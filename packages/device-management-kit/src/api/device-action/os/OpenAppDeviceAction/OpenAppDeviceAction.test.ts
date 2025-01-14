import { lastValueFrom } from "rxjs";

import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGetDeviceStatusMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";

import { OpenAppDeviceAction } from "./OpenAppDeviceAction";
import type { OpenAppDAState } from "./types";

jest.mock("@api/device-action/os/GetDeviceStatus/GetDeviceStatusDeviceAction");

describe("OpenAppDeviceAction", () => {
  const getAppAndVersionMock = jest.fn();
  const openAppMock = jest.fn();
  const closeAppMock = jest.fn();
  const getDeviceSessionStateMock = jest.fn();
  const setDeviceSessionStateMock = jest.fn();
  const isDeviceOnboardedMock = jest.fn();

  function extractDependenciesMock() {
    return {
      getDeviceSessionState: getDeviceSessionStateMock,
      setDeviceSessionState: setDeviceSessionStateMock,
      getAppAndVersion: getAppAndVersionMock,
      openApp: openAppMock,
      closeApp: closeAppMock,
      isDeviceOnboarded: isDeviceOnboardedMock,
    };
  }

  const { getDeviceSessionState: apiGetDeviceSessionStateMock } =
    makeDeviceActionInternalApiMock();

  beforeEach(() => {
    jest.resetAllMocks();
    isDeviceOnboardedMock.mockReturnValue(true);
  });

  describe("without overriding `extractDependencies`", () => {
    it("should end if the required application is opened", (done) => {
      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "Bitcoin", version: "1.0.0" },
        installedApps: [],
        deviceModelId: DeviceModelId.NANO_X,
      });
      setupGetDeviceStatusMock([
        {
          currentApp: "Bitcoin",
          currentAppVersion: "0.0.0",
        },
      ]);

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get onboarding status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // get device status
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
        currentApp: { name: "Bitcoin", version: "1.0.0" },
      });

      setupGetDeviceStatusMock([
        {
          currentApp: "Bitcoin",
          currentAppVersion: "1.0.0",
        },
      ]);
      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin", unlockTimeout: undefined },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get onboarding status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
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
        currentApp: { name: "BOLOS", version: "0.0.0" },
      });

      setupGetDeviceStatusMock([
        {
          currentApp: "Bitcoin",
          currentAppVersion: "1.0.0",
        },
      ]);

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

      const { observable } = testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );

      lastValueFrom(observable).then(() => {
        expect(setDeviceSessionStateMock).toHaveBeenCalledWith({
          deviceStatus: DeviceStatus.CONNECTED,
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          currentApp: { name: "Bitcoin", version: "1.0.0" },
        });
      });
    });

    it("should end in a success if another app is open, close app succeeds and open app succeeds", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "AnotherApp", version: "0.0.0" },
      });
      setupGetDeviceStatusMock([
        {
          currentApp: "AnotherApp",
          currentAppVersion: "0.0.0",
        },
        { currentApp: "Bitcoin", currentAppVersion: "1.0.0" },
      ]);
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
          status: DeviceActionStatus.Pending, // get device status
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
          status: DeviceActionStatus.Pending, // get app and version
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
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

      const { observable } = testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );

      lastValueFrom(observable).then(() => {
        expect(setDeviceSessionStateMock).toHaveBeenCalledWith({
          currentApp: { name: "Bitcoin", version: "1.0.0" },
          deviceStatus: DeviceStatus.CONNECTED,
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        });
      });
    });
  });

  describe("errors cases", () => {
    it("should end in an error if the device is not onboarded", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
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
        currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
      });

      setupGetDeviceStatusMock([new DeviceLockedError()]);

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });

      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
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

    it("should end in an error if getAppAndVersion returns an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
      });

      setupGetDeviceStatusMock([new InvalidStatusWordError("mocked error")]);

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
          status: DeviceActionStatus.Pending, // get device status
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

    it("should end in an error if the dashboard is open and open app returns an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue(
        CommandResultFactory({
          data: {
            sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
            deviceStatus: DeviceStatus.CONNECTED,
            currentApp: { name: "BOLOS", version: "0.0.0" },
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
      setupGetDeviceStatusMock([
        {
          currentApp: "BOLOS",
          currentAppVersion: "0.0.0",
        },
      ]);
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
          status: DeviceActionStatus.Pending, // get onboarded status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // get device status
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

    it("should end in an error if another app is open, and close app returns an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "AnotherApp", version: "0.0.0" },
      });
      setupGetDeviceStatusMock([
        {
          currentApp: "AnotherApp",
          currentAppVersion: "0.0.0",
        },
      ]);
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
          status: DeviceActionStatus.Pending, // get onboarded status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // get device status
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

    it("should end in an error if another app is open, close app succeeds but open app returns an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "AnotherApp", version: "0.0.0" },
      });
      setupGetDeviceStatusMock([
        {
          currentApp: "AnotherApp",
          currentAppVersion: "0.0.0",
        },
      ]);
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
          status: DeviceActionStatus.Pending, // get onboarded status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // get device status
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

    it("should end in an error if getAppAndVersion actor throws an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
      });

      setupGetDeviceStatusMock([new UnknownDAError("Unknown error")]);

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });

      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get onboarded status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // get device status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError("Unknown error"),
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if openApp actor throws an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue(
        CommandResultFactory({
          data: {
            sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
            deviceStatus: DeviceStatus.CONNECTED,
            currentApp: { name: "BOLOS", version: "0.0.0" },
          },
        }),
      );
      setupGetDeviceStatusMock([
        {
          currentApp: "BOLOS",
          currentAppVersion: "0.0.0",
        },
      ]);
      openAppMock.mockImplementation(() => {
        throw new UnknownDAError("Unknown error");
      });

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get device onboarded
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // get device status
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
          error: new UnknownDAError("Unknown error"),
        },
      ];

      testDeviceActionStates(
        openAppDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if closeApp actor throws an error", (done) => {
      getDeviceSessionStateMock.mockReturnValue(
        CommandResultFactory({
          data: {
            sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
            deviceStatus: DeviceStatus.CONNECTED,
            currentApp: { name: "BOLOS", version: "0.0.0" },
          },
        }),
      );
      setupGetDeviceStatusMock([
        {
          currentApp: "anApp",
          currentAppVersion: "0.0.0",
        },
      ]);
      closeAppMock.mockImplementation(() => {
        throw new UnknownDAError("Unknown error");
      });

      const openAppDeviceAction = new OpenAppDeviceAction({
        input: { appName: "Bitcoin" },
      });
      jest
        .spyOn(openAppDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<OpenAppDAState> = [
        {
          status: DeviceActionStatus.Pending, // get onboarded status
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
        },
        {
          status: DeviceActionStatus.Pending, // get device status
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
          error: new UnknownDAError("Unknown error"),
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
      currentApp: { name: "AnotherApp", version: "0.0.0" },
    });
    setupGetDeviceStatusMock([
      {
        currentApp: "AnotherApp",
        currentAppVersion: "0.0.0",
      },
    ]);

    const openAppDeviceAction = new OpenAppDeviceAction({
      input: { appName: "Bitcoin" },
    });
    jest
      .spyOn(openAppDeviceAction, "extractDependencies")
      .mockReturnValue(extractDependenciesMock());

    const expectedStates: Array<OpenAppDAState> = [
      {
        status: DeviceActionStatus.Pending, // get device onboarded
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
      },
      {
        status: DeviceActionStatus.Pending, // get device status
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
