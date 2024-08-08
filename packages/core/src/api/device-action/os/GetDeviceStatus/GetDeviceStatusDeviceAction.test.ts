import { interval, Observable } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { DeviceActionStatus } from "@api/device-action/model/DeviceActionState";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  DeviceLockedError,
  DeviceNotOnboardedError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";

import { GetDeviceStatusDeviceAction } from "./GetDeviceStatusDeviceAction";
import { GetDeviceStatusDAState } from "./types";

describe("GetDeviceStatusDeviceAction", () => {
  const getAppAndVersionMock = jest.fn();
  const getDeviceSessionStateMock = jest.fn();
  const waitForDeviceUnlockMock = jest.fn();
  const saveSessionStateMock = jest.fn();
  const isDeviceOnboardedMock = jest.fn();

  function extractDependenciesMock() {
    return {
      getAppAndVersion: getAppAndVersionMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      waitForDeviceUnlock: waitForDeviceUnlockMock,
      saveSessionState: saveSessionStateMock,
      isDeviceOnboarded: isDeviceOnboardedMock,
    };
  }

  const {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
  } = makeDeviceActionInternalApiMock();
  beforeEach(() => {
    jest.resetAllMocks();
    isDeviceOnboardedMock.mockReturnValue(true);
  });

  describe("without overriding `extractDependencies`", () => {
    it("should run the device action with an unlocked device", (done) => {
      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.Connected,
        deviceStatus: DeviceStatus.CONNECTED,
      });

      sendCommandMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "BOLOS",
            version: "1.0.0",
          },
        }),
      );

      const expectedStates: Array<GetDeviceStatusDAState> = [
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
          output: {
            currentApp: "BOLOS",
            currentAppVersion: "1.0.0",
          },
          status: DeviceActionStatus.Completed,
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should run the device action with a locked device", (done) => {
      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.LOCKED,
        currentApp: "mockedCurrentApp",
        installedApps: [],
      });

      apiGetDeviceSessionStateObservableMock.mockImplementation(
        () =>
          new Observable((o) => {
            const inner = interval(50).subscribe({
              next: (i) => {
                if (i > 2) {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.CONNECTED,
                    currentApp: "mockedCurrentApp",
                    installedApps: [],
                  });
                  o.complete();
                } else {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.LOCKED,
                    currentApp: "mockedCurrentApp",
                    installedApps: [],
                  });
                }
              },
            });

            return () => {
              inner.unsubscribe();
            };
          }),
      );

      sendCommandMock.mockResolvedValue(
        CommandResultFactory({
          data: {
            name: "BOLOS",
            version: "1.0.0",
          },
        }),
      );

      const expectedStates: Array<GetDeviceStatusDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
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
          output: {
            currentApp: "BOLOS",
            currentAppVersion: "1.0.0",
          },
          status: DeviceActionStatus.Completed,
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
  });

  describe("success cases", () => {
    it("should return the device status if the device is unlocked", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: "mockedCurrentApp",
      });

      getAppAndVersionMock.mockResolvedValue({
        app: "BOLOS",
        version: "1.0.0",
      });

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: undefined },
      });

      jest
        .spyOn(getDeviceStateDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<GetDeviceStatusDAState> = [
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
          status: DeviceActionStatus.Completed,
          output: {
            currentApp: "BOLOS",
            currentAppVersion: "1.0.0",
          },
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should return the device status if the device is locked and the user unlocks the device", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.LOCKED,
        currentApp: "mockedCurrentApp",
      });

      getAppAndVersionMock.mockResolvedValue({
        app: "BOLOS",
        version: "1.0.0",
      });

      waitForDeviceUnlockMock.mockImplementation(
        () =>
          new Observable((o) => {
            const inner = interval(50).subscribe({
              next: (i) => {
                if (i > 2) {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.CONNECTED,
                    currentApp: "mockedCurrentApp",
                  });
                  o.complete();
                } else {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.LOCKED,
                    currentApp: "mockedCurrentApp",
                  });
                }
              },
            });

            return () => {
              inner.unsubscribe();
            };
          }),
      );

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      jest
        .spyOn(getDeviceStateDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<GetDeviceStatusDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
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
          status: DeviceActionStatus.Completed,
          output: {
            currentApp: "BOLOS",
            currentAppVersion: "1.0.0",
          },
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
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
        deviceStatus: DeviceStatus.LOCKED,
        currentApp: "mockedCurrentApp",
      });
      isDeviceOnboardedMock.mockReturnValue(false);

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      jest
        .spyOn(getDeviceStateDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<GetDeviceStatusDAState> = [
        {
          error: new DeviceNotOnboardedError(),
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if the device is locked and the user does not unlock", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.LOCKED,
        currentApp: "mockedCurrentApp",
      });

      apiGetDeviceSessionStateObservableMock.mockImplementation(
        () =>
          new Observable((o) => {
            const inner = interval(200).subscribe({
              next: () => {
                o.next({
                  sessionStateType:
                    DeviceSessionStateType.ReadyWithoutSecureChannel,
                  deviceStatus: DeviceStatus.LOCKED,
                  currentApp: "mockedCurrentApp",
                  installedApps: [],
                });
              },
            });

            return () => {
              inner.unsubscribe();
            };
          }),
      );

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      jest
        .spyOn(getDeviceStateDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<GetDeviceStatusDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new DeviceLockedError("Device locked."),
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if the GetAppAndVersion command fails", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.LOCKED,
        currentApp: "mockedCurrentApp",
      });

      getAppAndVersionMock.mockRejectedValue(
        new Error("GetAppAndVersion error"),
      );

      waitForDeviceUnlockMock.mockImplementation(
        () =>
          new Observable((o) => {
            const inner = interval(50).subscribe({
              next: (i) => {
                if (i > 2) {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.CONNECTED,
                    currentApp: "mockedCurrentApp",
                  });
                  o.complete();
                } else {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.LOCKED,
                    currentApp: "mockedCurrentApp",
                  });
                }
              },
            });

            return () => {
              inner.unsubscribe();
            };
          }),
      );

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      jest
        .spyOn(getDeviceStateDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<GetDeviceStatusDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
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
          error: new UnknownDAError("GetAppAndVersionError"),
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("should end in an error if saveSessionState fails", (done) => {
      getDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.LOCKED,
        currentApp: "mockedCurrentApp",
      });

      getAppAndVersionMock.mockResolvedValue({
        app: null,
        version: null,
      });

      waitForDeviceUnlockMock.mockImplementation(
        () =>
          new Observable((o) => {
            const inner = interval(50).subscribe({
              next: (i) => {
                if (i > 2) {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.CONNECTED,
                    currentApp: "mockedCurrentApp",
                  });
                  o.complete();
                } else {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.LOCKED,
                    currentApp: "mockedCurrentApp",
                  });
                }
              },
            });

            return () => {
              inner.unsubscribe();
            };
          }),
      );

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      jest
        .spyOn(getDeviceStateDeviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

      const expectedStates: Array<GetDeviceStatusDAState> = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
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
          error: new UnknownDAError("SaveAppStateError"),
          status: DeviceActionStatus.Error,
        },
      ];

      testDeviceActionStates(
        getDeviceStateDeviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });
  });

  it("should emit a stopped state if the action is cancelled", (done) => {
    apiGetDeviceSessionStateMock.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      currentApp: "mockedCurrentApp",
      installedApps: [],
    });

    sendCommandMock.mockResolvedValue(
      CommandResultFactory({
        data: {
          name: "BOLOS",
          version: "1.0.0",
        },
      }),
    );

    const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
      input: { unlockTimeout: 500 },
    });

    const expectedStates: Array<GetDeviceStatusDAState> = [
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
      getDeviceStateDeviceAction,
      expectedStates,
      makeDeviceActionInternalApiMock(),
      done,
    );
    cancel();
  });
});
