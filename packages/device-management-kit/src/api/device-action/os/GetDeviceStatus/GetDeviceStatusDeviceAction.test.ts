import { interval, Observable } from "rxjs";

import { CommandResultFactory } from "@api/command/model/CommandResult";
import { getOsVersionCommandResponseMockBuilder } from "@api/command/os/__mocks__/GetOsVersionCommand";
import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
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
import {
  type GetDeviceStatusDAState,
  getDeviceStatusDAStateStep,
} from "./types";

const osVersionCommandResult = (
  props: Partial<GetOsVersionResponse> = {},
  deviceModelId: DeviceModelId = DeviceModelId.NANO_X,
) =>
  CommandResultFactory({
    data: getOsVersionCommandResponseMockBuilder(deviceModelId, props),
  });

const appAndVersionResult = (name: string, version: string) =>
  CommandResultFactory({
    data: {
      name,
      version,
    },
  });

const lockedErrorResult = () =>
  CommandResultFactory({
    error: new GlobalCommandError({
      ...GLOBAL_ERRORS["5515"],
      errorCode: "5515",
    }),
  });

const onboardCheckPendingState = (): GetDeviceStatusDAState => ({
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step: getDeviceStatusDAStateStep.ONBOARD_CHECK,
  },
  status: DeviceActionStatus.Pending,
});

const onboardCheckPendingStatesWithOsVersionFetch =
  (): Array<GetDeviceStatusDAState> => [
    onboardCheckPendingState(),
    onboardCheckPendingState(),
  ];

const unlockRequestedPendingState = (): GetDeviceStatusDAState => ({
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.UnlockDevice,
    step: getDeviceStatusDAStateStep.UNLOCK_DEVICE,
  },
  status: DeviceActionStatus.Pending,
});

const unlockResolvedPendingState = (): GetDeviceStatusDAState => ({
  intermediateValue: {
    requiredUserInteraction: UserInteractionRequired.None,
    step: getDeviceStatusDAStateStep.UNLOCK_DEVICE,
  },
  status: DeviceActionStatus.Pending,
});

describe("GetDeviceStatusDeviceAction", () => {
  const getAppAndVersionMock = vi.fn();
  const getOsVersionMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const waitForDeviceUnlockMock = vi.fn();
  const setDeviceSessionState = vi.fn();

  function extractDependenciesMock() {
    return {
      getAppAndVersion: getAppAndVersionMock,
      getOsVersion: getOsVersionMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      waitForDeviceUnlock: waitForDeviceUnlockMock,
      setDeviceSessionState: setDeviceSessionState,
    };
  }

  const {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
  } = makeDeviceActionInternalApiMock();
  beforeEach(() => {
    vi.resetAllMocks();
    getOsVersionMock.mockResolvedValue(osVersionCommandResult());
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

        // GetAppAndVersion is called first to determine the current app, then
        // GetOsVersion is called because the app is BOLOS (dashboard).
        sendCommandMock.mockImplementation((command) =>
          command.name === "getOsVersion"
            ? Promise.resolve(osVersionCommandResult())
            : Promise.resolve(appAndVersionResult("BOLOS", "1.0.0")),
        );

        const expectedStates: Array<GetDeviceStatusDAState> = [
          ...onboardCheckPendingStatesWithOsVersionFetch(),
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

        // First GetAppAndVersion fails because the device is locked, then it
        // succeeds (BOLOS) once unlocked, then GetOsVersion is fetched.
        let appCall = 0;
        sendCommandMock.mockImplementation((command) => {
          if (command.name === "getOsVersion") {
            return Promise.resolve(osVersionCommandResult());
          }
          appCall += 1;
          if (appCall === 1) {
            return Promise.resolve(lockedErrorResult());
          }
          return Promise.resolve(appAndVersionResult("BOLOS", "1.0.0"));
        });

        const expectedStates: Array<GetDeviceStatusDAState> = [
          onboardCheckPendingState(),
          unlockRequestedPendingState(),
          unlockResolvedPendingState(),
          unlockResolvedPendingState(),
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

        // GetAppAndVersion always reports a locked device, so the unlock
        // polling times out.
        sendCommandMock.mockImplementation((command) =>
          command.name === "getOsVersion"
            ? Promise.resolve(osVersionCommandResult())
            : Promise.resolve(lockedErrorResult()),
        );

        const expectedStates: Array<GetDeviceStatusDAState> = [
          onboardCheckPendingState(),
          unlockRequestedPendingState(),
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

        // GetAppAndVersion is not supported (CLA_NOT_SUPPORTED), which means we
        // are on the dashboard of an old firmware: the current app is BOLOS so
        // the OS version can still be fetched.
        sendCommandMock.mockImplementation((command) =>
          command.name === "getOsVersion"
            ? Promise.resolve(osVersionCommandResult())
            : Promise.resolve(
                CommandResultFactory({
                  error: new GlobalCommandError({
                    ...GLOBAL_ERRORS["6e00"],
                    errorCode: "6e00",
                  }),
                }),
              ),
        );

        const expectedStates: Array<GetDeviceStatusDAState> = [
          ...onboardCheckPendingStatesWithOsVersionFetch(),
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
          appAndVersionResult("BOLOS", "1.0.0"),
        );

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: undefined },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          ...onboardCheckPendingStatesWithOsVersionFetch(),
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
        // The session state is stateful so the firmware version enrichment from
        // the OS version (which reads back the ready state) can be observed.
        let sessionState: object = {
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          deviceModelId: DeviceModelId.NANO_X,
        };
        getDeviceSessionStateMock.mockImplementation(() => sessionState);
        setDeviceSessionState.mockImplementation((state) => {
          sessionState = state;
          return state;
        });

        getAppAndVersionMock.mockResolvedValue(
          appAndVersionResult("BOLOS", "1.0.0"),
        );

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: undefined },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const osVersionData = getOsVersionCommandResponseMockBuilder(
          DeviceModelId.NANO_X,
        );
        const expectedStates: Array<GetDeviceStatusDAState> = [
          ...onboardCheckPendingStatesWithOsVersionFetch(),
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
              // and then enriched with the firmware version from the OS version.
              expect(setDeviceSessionState).toHaveBeenCalledWith({
                deviceModelId: DeviceModelId.NANO_X,
                sessionStateType:
                  DeviceSessionStateType.ReadyWithoutSecureChannel,
                deviceStatus: DeviceStatus.CONNECTED,
                currentApp: {
                  name: "BOLOS",
                  version: "1.0.0",
                },
                installedApps: [],
                isSecureConnectionAllowed:
                  osVersionData.secureElementFlags.isSecureConnectionAllowed,
                firmwareVersion: {
                  mcu: osVersionData.mcuSephVersion,
                  bootloader: osVersionData.mcuBootloaderVersion,
                  os: osVersionData.seVersion,
                  metadata: osVersionData,
                },
              });
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("should not fetch the OS version when an app other than BOLOS is open", () =>
      new Promise<void>((resolve, reject) => {
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          deviceModelId: DeviceModelId.NANO_X,
        });

        // An application is open: the device is necessarily onboarded and the
        // OS version cannot be read outside of the dashboard.
        getAppAndVersionMock.mockResolvedValue(
          appAndVersionResult("Bitcoin", "2.1.0"),
        );

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: undefined },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          onboardCheckPendingState(),
          {
            status: DeviceActionStatus.Completed,
            output: {
              currentApp: "Bitcoin",
              currentAppVersion: "2.1.0",
            },
          },
        ];

        testDeviceActionStates(
          getDeviceStateDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
              expect(getOsVersionMock).not.toHaveBeenCalled();
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("GIVEN a non-onboarded device WHEN checking the device status THEN it returns the device status by default", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.0.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });
        getAppAndVersionMock.mockResolvedValue(
          appAndVersionResult("BOLOS", "1.0.0"),
        );
        getOsVersionMock.mockResolvedValue(
          osVersionCommandResult({
            secureElementFlags: {
              ...getOsVersionCommandResponseMockBuilder().secureElementFlags,
              isOnboarded: false,
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
          ...onboardCheckPendingStatesWithOsVersionFetch(),
          {
            status: DeviceActionStatus.Completed,
            output: {
              currentApp: "BOLOS",
              currentAppVersion: "1.0.0",
            },
          },
        ];

        // WHEN
        testDeviceActionStates(
          getDeviceStateDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            // THEN
            onDone: resolve,
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
          .mockResolvedValueOnce(lockedErrorResult())
          .mockResolvedValueOnce(appAndVersionResult("BOLOS", "1.0.0"));

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
          onboardCheckPendingState(),
          unlockRequestedPendingState(),
          unlockResolvedPendingState(),
          unlockResolvedPendingState(),
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
    it("GIVEN a non-onboarded device and the non-onboarded allowance is disabled WHEN checking the device status THEN it returns a not-onboarded error", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.0.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });
        // A non-onboarded device sits on the dashboard (BOLOS), so the app check
        // succeeds and the OS version reveals the onboarding status.
        getAppAndVersionMock.mockResolvedValue(
          appAndVersionResult("BOLOS", "1.0.0"),
        );
        getOsVersionMock.mockResolvedValue(
          osVersionCommandResult({
            secureElementFlags: {
              ...getOsVersionCommandResponseMockBuilder().secureElementFlags,
              isOnboarded: false,
            },
          }),
        );

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: {
            unlockTimeout: 500,
            allowNonOnboardedDevice: false,
          },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          ...onboardCheckPendingStatesWithOsVersionFetch(),
          {
            error: new DeviceNotOnboardedError(),
            status: DeviceActionStatus.Error,
          },
        ];

        // WHEN
        testDeviceActionStates(
          getDeviceStateDeviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            // THEN
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

        getAppAndVersionMock.mockResolvedValue(lockedErrorResult());

        waitForDeviceUnlockMock.mockImplementation(
          () =>
            new Observable((o) => {
              o.error(new DeviceLockedError("Device locked."));
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
          onboardCheckPendingState(),
          unlockRequestedPendingState(),
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
          onboardCheckPendingState(),
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
          onboardCheckPendingState(),
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

      sendCommandMock.mockImplementation((command) =>
        command.name === "getOsVersion"
          ? Promise.resolve(osVersionCommandResult())
          : Promise.resolve(appAndVersionResult("BOLOS", "1.0.0")),
      );

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      const expectedStates: Array<GetDeviceStatusDAState> = [
        onboardCheckPendingState(),
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
