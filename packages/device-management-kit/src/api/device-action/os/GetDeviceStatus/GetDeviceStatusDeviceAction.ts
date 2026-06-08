import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetOsVersionCommand,
  type GetOsVersionCommandResult,
  type GetOsVersionResponse,
} from "@api/command/os/GetOsVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { DeviceNotOnboardedError } from "@api/device-action/os/Errors";
import { WaitForAppAndVersionDeviceAction } from "@api/device-action/os/WaitForAppAndVersion/WaitForAppAndVersionDeviceAction";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  type DeviceSessionState,
  DeviceSessionStateType,
  type FirmwareVersion,
} from "@api/device-session/DeviceSessionState";
import { isDashboardName } from "@api/utils/AppName";

import {
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDAIntermediateValue,
  type GetDeviceStatusDAOutput,
  getDeviceStatusDAStateStep,
} from "./types";

type GetDeviceStatusMachineInternalState = {
  readonly onboarded: boolean;
  readonly currentApp: string | null;
  readonly currentAppVersion: string | null;
  readonly osVersionMetadata: GetOsVersionResponse | null;
  readonly error: GetDeviceStatusDAError | null;
};

export type MachineDependencies = {
  readonly getOsVersion: () => Promise<GetOsVersionCommandResult>;
  readonly getDeviceSessionState: () => DeviceSessionState;
  readonly setDeviceSessionState: (
    state: DeviceSessionState,
  ) => DeviceSessionState;
};

const firmwareVersionFromOsVersion = (
  data: GetOsVersionResponse,
): FirmwareVersion => ({
  mcu: data.mcuSephVersion,
  bootloader: data.mcuBootloaderVersion,
  os: data.seVersion,
  metadata: data,
});

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class GetDeviceStatusDeviceAction extends XStateDeviceAction<
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAInput,
  GetDeviceStatusDAError,
  GetDeviceStatusDAIntermediateValue,
  GetDeviceStatusMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GetDeviceStatusDAOutput,
    GetDeviceStatusDAInput,
    GetDeviceStatusDAError,
    GetDeviceStatusDAIntermediateValue,
    GetDeviceStatusMachineInternalState
  > {
    type types = StateMachineTypes<
      GetDeviceStatusDAOutput,
      GetDeviceStatusDAInput,
      GetDeviceStatusDAError,
      GetDeviceStatusDAIntermediateValue,
      GetDeviceStatusMachineInternalState
    >;

    const { getOsVersion, getDeviceSessionState, setDeviceSessionState } =
      this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const updateSessionFromOsVersion = (data: GetOsVersionResponse) => {
      const currentState = getDeviceSessionState();
      if (currentState.sessionStateType === DeviceSessionStateType.Connected) {
        return;
      }
      setDeviceSessionState({
        ...currentState,
        firmwareVersion: firmwareVersionFromOsVersion(data),
        isSecureConnectionAllowed:
          data.secureElementFlags.isSecureConnectionAllowed,
      });
    };

    const waitForAppAndVersion = new WaitForAppAndVersionDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);

    return setup({
      types: {
        input: {
          unlockTimeout,
        } as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        waitForAppAndVersion,
        getOsVersion: fromPromise(getOsVersion),
      },
      guards: {
        isCurrentAppBolos: ({ context }) =>
          isDashboardName(context._internalState.currentApp),
        isOnboardedFromOsVersion: ({ context }) =>
          context._internalState.osVersionMetadata?.secureElementFlags
            .isOnboarded === true,
        hasError: ({ context }) => context._internalState.error !== null,
      },
      actions: {
        assignErrorDeviceNotOnboarded: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new DeviceNotOnboardedError(),
          }),
        }),
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwBcAiYBuBLAxmAMpoCGaArrFnoQIL5q4D2AdgHQ0FgBKYpEAJ4BiANoAGALqJQAB2axcTNjJAAPRAFoArAHZx7AIwAmQ7oCcugMyHzANmMAWYwBoQgxI8vsAHOJM+VuLmVj5e2gC+EW6omDjcJORUXPSMLBwA8qwARsykAE4QuKxQAMIAFmD4ANZiUqryisqsqhoImo4O7OGhPj4h5n6Obh4IunZ2RoZ+ena6nYaGUTHoKcRklNTxqc3sWbkFRSUVVbWihtJIII1K6a1aVtoGTxOOjtbv84YjiObik7ofPM7GFDP9jNofMsQLE1olNmsGLsADLMGrFMqVGp1S5yBS3FRXNqaOzadjiHx2KyORbzcRBczmH4IbTOdjaabaKmdGy6XSRaIw1bbdZJLa0MBI9LsVHo45Ys4XBr45r3dps-n0ubaGxgx6PZlWULkkLBGmDCzGYzQ2Ei+HJEVStjsACqsDA+SdrBdrAANmjqmthBA2GB2MVsMxqmG3R6vT7-TU1hJcdcVXciYgglZycYQiYqRTQoZtMynDmbM4aW8rHYzD4BSs4hL7eLuF7Xe7PWk2AmA0GPflmPl2LJfeQAGbDgC2nbjPe9fv7IpTyqaGdAbXmxnZPkMNNM820VuZ+8M7Dsb3MznpwW31sFtpbGwdEo7dFksjorAgADUPYobAnNiIasGGEZRmGT4JC+bY7NKH5fj+-75IBrDAdUCAQfg5DpCmq5XDcqqZmMjgGDY-yGJeejjFRzJ2P47DZoEJb+Hyx42sKz5ioiC7sIh35-gB6QYcIg7DqO45oFO+SztBhCtrxuwCchwlAQqWGsJGOHNPh9SEemhKbogdLsIMTjmPuNF1nYZaOBW+5OPu9l1oCjZCs2ME8Y6fGIb6BC4WwdDYKQuDjtkvq8HAFC+mgokEXi65GeoiBguYZJOPSJa6Hm1hGsyuglkxxiUjYVjXlq7nyaKCI+cpn7+Tp6TBaF4WRXwsAxXFCpiEqBlJS0JFAo4vg+BCe55e8-QFUVVglVShjlWRtZ2FEgqsMwEBwKo1WKXVG5pgNaokmRZmQg4fyLHR7ieCNpjGPyx7aNo6UNo4nGeQpsFKdKax8AIoyJQSg3Ge0L07q9F3+Istk3Qg1IjUaZ7GNS-LlU4H1wt9+3OvseSFBiGFrsDx01mZ15mHooReFaVj0fZ5Jci5zissYIKY3a2NvnxsrVITCrE8RoMdDucxWgx1jpZCELDHDgKTC9jg6mNXKLDSHPcbV3O7LG3bNH2SYioLB3EmCI1-HuVL6Cj4hU6eNjsIVD3UrWfKXVCj5cV5Wvtr5n6CShaFE-1JMkWzPgXpCjh+Faw3Mjq5jdOlJhGvo-RzRr3uvr79VjgFzQtWFpARVFnWxcHQNCylCBm+eKPjJL4jWMEdNww4O46vSFVsfyD5Nlj3na9KRAUPghCwPAIdV20QIR7e-RzOYbNK98cN7ndgR-BSzgo+YmdfYPOfSgAovkQ75MbyVtItehmSrJgcijz2uHD+pmXyQSQnyVLs2tQA */
      id: "GetDeviceStatusDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        const sessionState = getDeviceSessionState();
        const { sessionStateType } = sessionState;
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: getDeviceStatusDAStateStep.WAIT_FOR_APP_AND_VERSION,
          },
          _internalState: {
            onboarded: false,
            currentApp:
              sessionStateType ===
              DeviceSessionStateType.ReadyWithoutSecureChannel
                ? sessionState.currentApp.name
                : null,
            currentAppVersion: null,
            osVersionMetadata: null,
            error: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "WaitForAppAndVersion",
          },
        },
        WaitForAppAndVersion: {
          // We check the current app and version using the getAppAndVersion
          // command. This command is supported both on the dashboard (BOLOS)
          // and inside applications, so it is used to determine the currently
          // running app before deciding whether to read the OS version.
          invoke: {
            src: "waitForAppAndVersion",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.context.intermediateValue,
                  requiredUserInteraction:
                    _.event.snapshot.context.intermediateValue
                      .requiredUserInteraction,
                }),
              }),
            },
            onDone: {
              target: "WaitForAppAndVersionResultCheck",
              actions: assign({
                _internalState: (_): GetDeviceStatusMachineInternalState => {
                  return _.event.output.caseOf<GetDeviceStatusMachineInternalState>(
                    {
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                      Right: (output) => {
                        const state: DeviceSessionState =
                          getDeviceSessionState();
                        if (
                          state.sessionStateType !==
                          DeviceSessionStateType.Connected
                        ) {
                          // Update the current app
                          setDeviceSessionState({
                            ...state,
                            currentApp: output,
                          });
                        } else {
                          setDeviceSessionState({
                            deviceModelId: state.deviceModelId,
                            sessionStateType:
                              DeviceSessionStateType.ReadyWithoutSecureChannel,
                            deviceStatus: DeviceStatus.CONNECTED,
                            currentApp: output,
                            installedApps: [],
                            isSecureConnectionAllowed: false,
                          });
                        }
                        return {
                          ..._.context._internalState,
                          currentApp: output.name,
                          currentAppVersion: output.version,
                        };
                      },
                    },
                  );
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        WaitForAppAndVersionResultCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "OnboardingCheck",
            },
          ],
        },
        OnboardingCheck: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
              step: getDeviceStatusDAStateStep.ONBOARD_CHECK,
            }),
          }),
          always: [
            {
              // The OS version (and thus the onboarding flag) can only be read
              // on the dashboard. If we are inside an application, fetching it
              // would fail, so we only fetch it when the current app is BOLOS.
              guard: "isCurrentAppBolos",
              target: "GetOsVersion",
            },
            {
              // A non-BOLOS application can only run on an onboarded device, so
              // if an app is open we can safely consider the device onboarded
              // without reading the OS version.
              target: "Success",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  onboarded: true,
                }),
              }),
            },
          ],
        },
        GetOsVersion: {
          invoke: {
            src: "getOsVersion",
            onDone: {
              target: "OnboardingResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    updateSessionFromOsVersion(_.event.output.data);
                    return {
                      ..._.context._internalState,
                      osVersionMetadata: _.event.output.data,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: _.event.output.error,
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        OnboardingResultCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isOnboardedFromOsVersion",
              target: "Success",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  onboarded: true,
                }),
              }),
            },
            {
              target: "Error",
              actions: "assignErrorDeviceNotOnboarded",
            },
          ],
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: (args) => {
        // TODO: instead we should rely on the current state ("Success" or "Error")
        const { context } = args;
        const { error, currentApp, currentAppVersion } = context._internalState;
        if (error) {
          return Left(error);
        }
        return Right<GetDeviceStatusDAOutput>({
          currentApp: currentApp!,
          currentAppVersion: currentAppVersion!,
        });
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      getOsVersion: () => internalApi.sendCommand(new GetOsVersionCommand()),
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}
