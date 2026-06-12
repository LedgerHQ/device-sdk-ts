import { CommandResultFactory } from "@api/command/model/CommandResult";
import { getOsVersionCommandResponseMockBuilder } from "@api/command/os/__mocks__/GetOsVersionCommand";
import { type GetAppAndVersionResponse } from "@api/command/os/GetAppAndVersionCommand";
import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import {
  GLOBAL_ERRORS,
  GlobalCommandError,
} from "@api/command/utils/GlobalCommandError";
import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupWaitForAppAndVersionMock } from "@api/device-action/__test-utils__/setupTestMachine";
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
  type GetDeviceStatusDARequiredInteraction,
  type GetDeviceStatusDAState,
  getDeviceStatusDAStateStep,
} from "./types";

vi.mock(
  "@api/device-action/os/WaitForAppAndVersion/WaitForAppAndVersionDeviceAction",
);

const osVersionCommandResult = (
  props: Partial<GetOsVersionResponse> = {},
  deviceModelId: DeviceModelId = DeviceModelId.NANO_X,
) =>
  CommandResultFactory({
    data: getOsVersionCommandResponseMockBuilder(deviceModelId, props),
  });

const appAndVersion = (
  name: string,
  version: string,
): GetAppAndVersionResponse => ({
  name,
  version,
});

const onboardCheckPendingState = (
  requiredUserInteraction: GetDeviceStatusDARequiredInteraction = UserInteractionRequired.None,
): GetDeviceStatusDAState => ({
  intermediateValue: {
    requiredUserInteraction,
    step: getDeviceStatusDAStateStep.ONBOARD_CHECK,
  },
  status: DeviceActionStatus.Pending,
});

const waitForAppAndVersionPendingState = (
  requiredUserInteraction: GetDeviceStatusDARequiredInteraction = UserInteractionRequired.None,
): GetDeviceStatusDAState => ({
  intermediateValue: {
    requiredUserInteraction,
    step: getDeviceStatusDAStateStep.WAIT_FOR_APP_AND_VERSION,
  },
  status: DeviceActionStatus.Pending,
});

describe("GetDeviceStatusDeviceAction", () => {
  const getOsVersionMock = vi.fn();
  const getDeviceSessionStateMock = vi.fn();
  const setDeviceSessionState = vi.fn();

  function extractDependenciesMock() {
    return {
      getOsVersion: getOsVersionMock,
      getDeviceSessionState: getDeviceSessionStateMock,
      setDeviceSessionState: setDeviceSessionState,
    };
  }

  const {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
  } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
    getOsVersionMock.mockResolvedValue(osVersionCommandResult());
  });

  describe("without overriding `extractDependencies`", () => {
    it("should run the device action with the device on the dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(appAndVersion("BOLOS", "1.0.0"));

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          deviceModelId: DeviceModelId.NANO_X,
        });

        // The current app is BOLOS (dashboard), so the OS version is fetched.
        sendCommandMock.mockResolvedValue(osVersionCommandResult());

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
          onboardCheckPendingState(),
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

    it("should run the device action when the device needs to be unlocked", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(
          appAndVersion("BOLOS", "1.0.0"),
          UserInteractionRequired.UnlockDevice,
        );

        apiGetDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.LOCKED,
          deviceModelId: DeviceModelId.NANO_X,
        });

        sendCommandMock.mockResolvedValue(osVersionCommandResult());

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(
            UserInteractionRequired.UnlockDevice,
          ),
          onboardCheckPendingState(),
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
  });

  describe("success cases", () => {
    it("should return the device status if the device is on the dashboard", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(appAndVersion("BOLOS", "1.0.0"));

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: undefined },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
          onboardCheckPendingState(),
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

    it("should return the device status and update the session firmware version", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(appAndVersion("BOLOS", "1.0.0"));

        // The session must already be ready (not Connected) for the firmware
        // version enrichment from the OS version to be applied. The session
        // state is stateful so the enrichment can be observed.
        let sessionState: object = {
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.0.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        };
        getDeviceSessionStateMock.mockImplementation(() => sessionState);
        setDeviceSessionState.mockImplementation((state) => {
          sessionState = state;
          return state;
        });

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
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
          onboardCheckPendingState(),
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
              // Session should be enriched with the firmware version from the OS version.
              expect(setDeviceSessionState).toHaveBeenCalledWith(
                expect.objectContaining({
                  isSecureConnectionAllowed:
                    osVersionData.secureElementFlags.isSecureConnectionAllowed,
                  firmwareVersion: {
                    mcu: osVersionData.mcuSephVersion,
                    bootloader: osVersionData.mcuBootloaderVersion,
                    os: osVersionData.seVersion,
                    metadata: osVersionData,
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("should not fetch the OS version when an app other than BOLOS is open", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(appAndVersion("Bitcoin", "2.1.0"));

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.Connected,
          deviceStatus: DeviceStatus.CONNECTED,
          deviceModelId: DeviceModelId.NANO_X,
        });

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: undefined },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
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

    it("should surface the unlock interaction then return the device status", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(
          appAndVersion("BOLOS", "1.0.0"),
          UserInteractionRequired.UnlockDevice,
        );

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(
            UserInteractionRequired.UnlockDevice,
          ),
          onboardCheckPendingState(),
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
        setupWaitForAppAndVersionMock(appAndVersion("BOLOS", "1.0.0"));

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.0.0" },
          installedApps: [],
          deviceModelId: DeviceModelId.NANO_X,
          isSecureConnectionAllowed: false,
        });

        // The device sits on the dashboard (BOLOS), so the OS version reveals
        // the onboarding status.
        getOsVersionMock.mockResolvedValue(
          osVersionCommandResult({
            secureElementFlags: {
              ...getOsVersionCommandResponseMockBuilder().secureElementFlags,
              isOnboarded: false,
            },
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
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
          onboardCheckPendingState(),
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
        setupWaitForAppAndVersionMock(
          new DeviceLockedError("Device locked."),
          UserInteractionRequired.UnlockDevice,
        );

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(
            UserInteractionRequired.UnlockDevice,
          ),
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

    it("should end in an error if the WaitForAppAndVersion sub-action fails", () =>
      new Promise<void>((resolve, reject) => {
        const error = new GlobalCommandError({
          ...GLOBAL_ERRORS["5501"],
          errorCode: "5501",
        });

        setupWaitForAppAndVersionMock(error);

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.LOCKED,
          currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        });

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
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

    it("should end in an error if the GetOsVersion command fails", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(appAndVersion("BOLOS", "1.0.0"));

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.0.0" },
        });

        const error = new GlobalCommandError({
          ...GLOBAL_ERRORS["5501"],
          errorCode: "5501",
        });

        getOsVersionMock.mockResolvedValue(CommandResultFactory({ error }));

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
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

    it("should end in an error if the getOsVersion actor throws an error", () =>
      new Promise<void>((resolve, reject) => {
        setupWaitForAppAndVersionMock(appAndVersion("BOLOS", "1.0.0"));

        getDeviceSessionStateMock.mockReturnValue({
          sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
          deviceStatus: DeviceStatus.CONNECTED,
          currentApp: { name: "BOLOS", version: "1.0.0" },
        });

        getOsVersionMock.mockImplementation(() => {
          throw new UnknownDAError("error");
        });

        const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
          input: { unlockTimeout: 500 },
        });

        vi.spyOn(
          getDeviceStateDeviceAction,
          "extractDependencies",
        ).mockReturnValue(extractDependenciesMock());

        const expectedStates: Array<GetDeviceStatusDAState> = [
          waitForAppAndVersionPendingState(),
          waitForAppAndVersionPendingState(),
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
      setupWaitForAppAndVersionMock(appAndVersion("BOLOS", "1.0.0"));

      apiGetDeviceSessionStateMock.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        currentApp: { name: "mockedCurrentApp", version: "1.0.0" },
        installedApps: [],
        deviceModelId: DeviceModelId.NANO_X,
        isSecureConnectionAllowed: false,
      });

      sendCommandMock.mockResolvedValue(osVersionCommandResult());

      const getDeviceStateDeviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout: 500 },
      });

      const expectedStates: Array<GetDeviceStatusDAState> = [
        waitForAppAndVersionPendingState(),
        waitForAppAndVersionPendingState(),
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
