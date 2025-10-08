import { interval, Observable } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import {
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@api/command/utils/GlobalCommandError";
import { DeviceModelId } from "@api/device/DeviceModel";
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
import { type GetDeviceStatusDAState } from "./types";

describe("GetDeviceStatusDeviceAction", () => {
  const getAppAndVersionMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const waitForDeviceUnlockMock = vi.fn();
  const setDeviceSessionState = vi.fn();
  const isDeviceOnboardedMock = vi.fn();

  function extractDependenciesMock() {
    return {
      getAppAndVersion: getAppAndVersionMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      waitForDeviceUnlock: waitForDeviceUnlockMock,
      setDeviceSessionState: setDeviceSessionState,
      isDeviceOnboarded: isDeviceOnboardedMock,
    };
  }

  const {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
  } = makeDeviceActionInternalApiMock();
  beforeEach(() => {
    vi.resetAllMocks();
    isDeviceOnboardedMock.mockReturnValue(true);
  });

  describe("without overriding `extractDependencies`", () => {
    it("should run the device action with an unlocked device", () =>
      new Promise<void>((resolve, reject) => {
        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          deviceModelId: DeviceModelId.NANO_X,
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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should run the device action with a locked device", () =>
      new Promise<void>((resolve, reject) => {
        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 1500 },
        });

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });

        sendCommandMock
          .mockResolvedValueOnce(
            CommandResultFactory({
              error: new GlobalCommandError({
                ...GLOBAL_ERRORS["5515"],
                errorCode: "5515",
              }),
            }),
          )
          .mockResolvedValue(
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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should timeout with a locked device", () =>
      new Promise<void>((resolve, reject) => {
        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 200 },
        });

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });

        sendCommandMock
          .mockResolvedValueOnce(
            CommandResultFactory({
              error: new GlobalCommandError({
                ...GLOBAL_ERRORS["5515"],
                errorCode: "5515",
              }),
            }),
          )
          .mockResolvedValue(
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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should run the device action with an old firmware not supporting GetAppAndVersion", () =>
      new Promise<void>((resolve, reject) => {
        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          deviceModelId: DeviceModelId.NANO_X,
        });

        sendCommandMock.mockResolvedValue(
          CommandResultFactory({
            error: new GlobalCommandError({
              ...GLOBAL_ERRORS["6e00"],
              errorCode: "6e00",
            }),
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
            output: {
              currentApp: "BOLOS",
              currentAppVersion: "0.0.0",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(
          getDeviceStateDeviceAction,
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
    it("should return the device status if the device is unlocked", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        getAppAndVersionMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              name: "BOLOS",
              version: "1.0.0",
            },
          }),
        );

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: undefined },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
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
          {
            onDone: () => {
              // Session should be updated with current app
              expect(setDeviceSessionState).toHaveBeenCalledWith({
                sessionStateType:
                  DeviceSessionStateType.ReadyWithoutSecureChannel,
                deviceStatus: DeviceStatus.CONNECTED,
                currentApp: {
                  name: "BOLOS",
                  version: "1.0.0",
                },
              });
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("should return the device status and update session if the device is not ready", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
        });

        getAppAndVersionMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              name: "BOLOS",
              version: "1.0.0",
            },
          }),
        );

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: undefined },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
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
          {
            onDone: () => {
              // Session should be set as ready if GetAppAndVersionCommand was successful
              expect(setDeviceSessionState).toHaveBeenCalledWith({
                sessionStateType:
                  DeviceSessionStateType.ReadyWithoutSecureChannel,
                deviceStatus: DeviceStatus.CONNECTED,
                currentApp: {
                  name: "BOLOS",
                  version: "1.0.0",
                },
                installedApps: [],
                isSecureConnectionAllowed: false,
              });
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("should return the device status if the device is locked and the user unlocks the device", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        getAppAndVersionMock
          .mockResolvedValueOnce(
            CommandResultFactory({
              error: new GlobalCommandError({
                ...GLOBAL_ERRORS["5515"],
                errorCode: "5515",
              }),
            }),
          )
          .mockResolvedValueOnce(
            CommandResultFactory({
              data: {
                name: "BOLOS",
                version: "1.0.0",
              },
            }),
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
                      currentApp: {
                        name: "mockedCurrentApp",
                        version: "1.0.0",
                      },
                    });
                    o.complete();
                  } else {
                    o.next({
                      sessionStateType:
                        DeviceSessionStateType.ReadyWithoutSecureChannel,
                      deviceStatus: DeviceStatus.LOCKED,
                      currentApp: {
                        name: "mockedCurrentApp",
                        version: "1.0.0",
                      },
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

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });

  describe("errors cases", () => {
    it("should end in an error if the device is not onboarded", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });
        isDeviceOnboardedMock.mockReturnValue(false);

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should end in an error if the device is locked and the user does not unlock", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        getAppAndVersionMock.mockResolvedValue(
          CommandResultFactory({
            error: new GlobalCommandError({
              ...GLOBAL_ERRORS["5515"],
              errorCode: "5515",
            }),
          }),
        );

        apiGetDeviceSessionStateObservableMock.mockImplementation(
          () =>
            new Observable((o) => {
              const inner = interval(200).subscribe({
                next: () => {
                  o.next({
                    sessionStateType:
                      DeviceSessionStateType.ReadyWithoutSecureChannel,
                    deviceStatus: DeviceStatus.LOCKED,
                    currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
                    installedApps: [],
                    deviceModelId: DeviceModelId.NANO_X,
                    isSecureConnectionAllowed: false,
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

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
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
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should end in an error if the GetAppAndVersion command fails", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        const error = new GlobalCommandError({
          ...GLOBAL_ERRORS["5501"],
          errorCode: "5501",
        });

        getAppAndVersionMock.mockResolvedValue(CommandResultFactory({ error }));

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
                      currentApp: {
                        name: "mockedCurrentApp",
                        version: "1.0.0",
                      },
                    });
                    o.complete();
                  } else {
                    o.next({
                      sessionStateType:
                        DeviceSessionStateType.ReadyWithoutSecureChannel,
                      deviceStatus: DeviceStatus.LOCKED,
                      currentApp: {
                        name: "mockedCurrentApp",
                        version: "1.0.0",
                      },
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

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error,
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          getDeviceStateDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));

    it("should end in an error if getAppAndVersion actor throws an error", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        getAppAndVersionMock.mockImplementation(() => {
          throw new UnknownDAError("error");
        });

        waitForDeviceUnlockMock.mockImplementation(
          () =>
            new Observable((o) => {
              o.complete();
            }),
        );

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDAError("error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          getDeviceStateDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: resolve,
            onError: reject,
          },
        );
      }));
  });

  it("should emit a stopped state if the action is cancelled", () =>
    new Promise<void>((resolve, reject) => {
      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        installedApps: [],
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: false,
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
        {
          onDone: resolve,
          onError: reject,
        },
      );
      cancel();
    }));
});
