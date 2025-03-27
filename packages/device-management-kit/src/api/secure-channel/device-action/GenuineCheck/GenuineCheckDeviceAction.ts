import { Left, Right } from "purify-ts";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetOsVersionCommand,
  type GetOsVersionResponse,
} from "@api/command/os/GetOsVersionCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@api/device-session/DeviceSessionState";
import {
  type GenuineCheckDAError,
  type GenuineCheckDAInput,
  type GenuineCheckDAIntermediateValue,
  type GenuineCheckDAOutput,
  type GenuineCheckStateMachineInternalState,
  type MachineDependencies,
} from "@api/secure-channel/device-action/GenuineCheck/types";
import { ConnectToSecureChannelTask } from "@api/secure-channel/task/ConnectToSecureChannelTask";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import { type Input } from "@api/secure-channel/types";
import { isDeviceGenuine } from "@api/secure-channel/utils";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export class GenuineCheckDeviceAction extends XStateDeviceAction<
  GenuineCheckDAOutput,
  GenuineCheckDAInput,
  GenuineCheckDAError,
  GenuineCheckDAIntermediateValue,
  GenuineCheckStateMachineInternalState
> {
  protected override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GenuineCheckDAOutput,
    GenuineCheckDAInput,
    GenuineCheckDAError,
    GenuineCheckDAIntermediateValue,
    GenuineCheckStateMachineInternalState
  > {
    type types = StateMachineTypes<
      GenuineCheckDAOutput,
      GenuineCheckDAInput,
      GenuineCheckDAError,
      GenuineCheckDAIntermediateValue,
      GenuineCheckStateMachineInternalState
    >;

    const {
      getOsVersion,
      getDeviceVersion,
      getFirmwareVersion,
      genuineCheck,
      getDeviceSessionState,
      setDeviceSessionState,
    } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const goToDashboardMachine = new GoToDashboardDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        goToDashboard: goToDashboardMachine,
        getOsVersion: fromPromise(getOsVersion),
        getDeviceVersion: fromPromise(getDeviceVersion),
        getFirmwareVersion: fromPromise(getFirmwareVersion),
        genuineCheck: fromObservable(genuineCheck),
      },
      guards: {
        hasError: (_) => _.context._internalState.error !== null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwDsCuBLNYDCAFmAMYDWAImAG5bFgCCxALlgPZoB0lNdASmAEMIATwDEAbQAMAXUSgADq1hYW7OSAAeiAIwB2AGwAWDvskBOAKwAmC9YvbJADkMAaEMMQBmT2ZPazuo6SFp6SDpKG+gC+UW6omDj4RGTctAzMbJzIrAAqrOQCsAQARqwCAE4QohDsYBw4VKykdVC5+YUlZZVSskggisqqaOpaCFaGntocEwaOFkYR2oa6bh4IZsEcuta6Nmbajp76tjFx6Ni4hCQU1GmMQxzZeQVFpRVVYOXlrOUc8gA2AiYADMfgBbDitZ4dN7dGTqAYqTIjRDjSbTTyzeaGRbLVaIOa6LY7PYHI4nWIgeIXJLXVJ0e6ZR5tF6dd5XMgSeF9RFDFFjQ5WExhXQbYKGRxWKwrdyoo4cbT+UUOQz+UyeU5U86JDk3HjpB5PdqvLoQXUSbS9BRKJFqPqjKyC4V6MUWCVSmVrfySBVKsxSyxmAKSaKU6k65J6u4ZdiPMBMADysAAap9lOxqrV6mhGs1IfGk6nyum0D0ETa+favJFPNNDBtHAcQ8cQ-j1qEOJ43d5JMFG8dDJrw5dI-SDUzUImU2nMuayzyK8iq2NDELtoFVWZ9JilmY2-X9BxnNvbLYjBMzEPtSO6bcGTGsgXp8XZ5GLVb+ou7aAHaviRu1R3es220Kx-A4EMbEmVcg0kaUrwSG8UjvcdY0nMcixLTNcGzXMWnjDCZ3YedrUGJcf0QAxjElRZMWcSx5hAqxzA4Cw5i3XtRWcKUEJpXUx0ZNCCJQzDMlET5vl+AEgVBcoIRgJhCJfYjuVI21hmXKij2Y1U6PrM8230bQLE7Gs3X9MxVwpM5ENpZD9UEx9FJEoi0DnVTPzI79NB0MChSOXZRS7SQjn0Nt11Y3Z-U48xpQsXiI1vByHzjZz9VE9g50tcsvI0iiEFA0DO30QKzGC0KmJ8LYrH2OYLH2QwLF0BKkKje9DXjAAxLA5IAdwqMAMrQbC6gaJp8KYbq+oGoaSM89T+T0IxhUsGw7AcZwQIcEzvHq2xQJCZirBauy2tQpyprBfrykG1zxK+H4-kBEFwXzSaequmbXLm3lyJ8gqtNMVbbBsDbXFlAqrA7GwrCM1ddK3eKw2vU6BJSydLuu27lLct8fq-PL-qhiIFSMcZtkbZjdE9HRtC7aZlSCbd9DKkITv4lDHNSzGvpxrKP1+7yHVCYxtDJ5Y2NAyRqbbAJfF7WGJhsUVmMvZHbI55KOo1t8ahwsa8xgHXrnx3L+UdCUthZsDdG8W3dEMcGvQiIlHA2Bw4u2ZZ2dHTn0ZR80JMe6SXrk-NjbIU2FuXR1PCFUwXV7N1JWlNtHAMCCov8R2fHMbQfaS6Ntb4yN3IFgn+VCWt9HTiwQKOKZJhsCWJeCAv7KLicA9LvHsoXM3lyrkxa5AzdOwOlvtjbzU0FYCA4HUYdUb9ys1NX-6AFo6Z9A5pWCSyzBozaIY9vw5fsaxEfg9WS8L9qmTHfghDWNe-tGMXjK2Vc44mEJ7AONs3hHBnyCBYCIwZQw2Vvh3e+aEWQwlNDlaO+V-BbhMDiRsIYcSqjxBDSYJlFQBBKtsMCbsJjtzOlzI0rJYRmkjEg9eDomq+HJqYUUQYKoQw9BwSwoR9DSgONTO2FC0YdSnENBhb8vD+GAV2ckLME72H3GLaYtUdJBjFjXERK8u7iNcrqSRQtEAb0lAqSUuh971iPk7AkbEOCq28KBYmjttFa10UpEshjCajBxCZeqngaL2BCttGxBV-C1kpm6L2U8kZQMSjA86qUPGvmuF4-kh8pgGCahEJqsNTyVSmPMZu9VoqQK1BHSh-t3rTRuhI-uyD-p022PYkKys3YKIASfMCxhljRT0OYfex0b7xMqWInmtT9H0PqYw1EIVRYYL0MFJqRwtrSnHs3BwmIQiOFcZ3ISFS0kx3mMA221hHDnJqjiOm9dHasRqmVR0cx+w7OGa1URXcKkGOmVIhAkhR5Q1Yvwt0JTmL1ReXEt5OjYwAGUMDEDoLAeA3yjFjEsD0+Yug9AzFhp4ECBghQ4qMuclsl9dmwM4AAUQeuUQ5+VvA1S2JKbOzEWZ1xPm6Q8QiJSSwdkcDUMQohAA */
      id: "GenuineCheckDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            result: { isGenuine: false },
            getOsVersionResponse: null,
            deviceVersion: null,
            firmwareVersion: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "GoToDashboard",
          },
        },
        GoToDashboard: {
          invoke: {
            id: "goToDashboard",
            src: "goToDashboard",
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
              target: "GoToDashboardCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<GenuineCheckStateMachineInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GoToDashboardCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "GetOsVersion",
            },
          ],
        },
        GetOsVersion: {
          invoke: {
            id: "getOsVersion",
            src: "getOsVersion",
            input: (_) => undefined,
            onDone: {
              target: "GetOsVersionCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    const currentState: DeviceSessionState =
                      getDeviceSessionState();
                    const isSecureConnectionAllowed =
                      _.event.output.data.secureElementFlags
                        .isSecureConnectionAllowed;
                    if (
                      currentState.sessionStateType !==
                      DeviceSessionStateType.Connected
                    ) {
                      setDeviceSessionState({
                        ...currentState,
                        isSecureConnectionAllowed,
                      });
                    }
                    return {
                      ..._.context._internalState,
                      getOsVersionResponse: _.event.output.data,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: _.event.output.error,
                  };
                },
              }),
            },
          },
        },
        GetOsVersionCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "GetDeviceVersion",
            },
          ],
        },
        GetDeviceVersion: {
          invoke: {
            id: "getDeviceVersion",
            src: "getDeviceVersion",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
            }),
            onDone: {
              target: "GetDeviceVersionCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<GenuineCheckStateMachineInternalState>({
                    Right: (deviceVersion) => ({
                      ..._.context._internalState,
                      deviceVersion,
                    }),
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetDeviceVersionCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            { target: "GetFirmwareVersion" },
          ],
        },
        GetFirmwareVersion: {
          invoke: {
            id: "getFirmwareVersion",
            src: "getFirmwareVersion",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
              deviceVersion: _.context._internalState.deviceVersion!,
            }),
            onDone: {
              target: "GetFirmwareVersionCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<GenuineCheckStateMachineInternalState>({
                    Right: (firmwareVersion) => ({
                      ..._.context._internalState,
                      firmwareVersion,
                    }),
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetFirmwareVersionCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            { target: "GenuineCheck" },
          ],
        },
        GenuineCheck: {
          invoke: {
            id: "genuineCheck",
            src: "genuineCheck",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
              finalFirmware: _.context._internalState.firmwareVersion!,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => {
                  switch (_.event.snapshot.context?.type) {
                    case SecureChannelEventType.PermissionRequested: {
                      return {
                        requiredUserInteraction:
                          UserInteractionRequired.AllowSecureConnection,
                      };
                    }
                    case SecureChannelEventType.PermissionGranted: {
                      return {
                        requiredUserInteraction: UserInteractionRequired.None,
                      };
                    }
                    default:
                      return {
                        ..._.context.intermediateValue,
                      };
                  }
                },
                _internalState: (_) => {
                  if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Result
                  ) {
                    return {
                      ..._.context._internalState,
                      result: {
                        isGenuine: isDeviceGenuine(
                          _.event.snapshot.context.payload,
                        ),
                      },
                    };
                  }
                  return _.context._internalState;
                },
              }),
            },
            onDone: {
              target: "GenuineCheckCheck",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GenuineCheckCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "Success",
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
      output: (_) => {
        if (_.context._internalState.error) {
          return Left(_.context._internalState.error);
        } else {
          return Right(_.context._internalState.result);
        }
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const provider = 1; // TODO: get the provider from user configuration

    const getOsVersion = () =>
      internalApi.sendCommand(new GetOsVersionCommand());

    const getDeviceVersion = ({
      input,
    }: Input<{ deviceInfo: GetOsVersionResponse }>) => {
      const { deviceInfo } = input;
      return internalApi
        .getManagerApiService()
        .getDeviceVersion(deviceInfo, provider);
    };

    const getFirmwareVersion = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
      deviceVersion: DeviceVersion;
    }>) => {
      const { deviceInfo, deviceVersion } = input;
      return internalApi
        .getManagerApiService()
        .getFirmwareVersion(deviceInfo, deviceVersion, provider);
    };

    const genuineCheck = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
      finalFirmware: FinalFirmware;
    }>) => {
      const { deviceInfo, finalFirmware } = input;
      const eitherConnection = internalApi
        .getSecureChannelService()
        .genuineCheck(deviceInfo, finalFirmware);
      return new ConnectToSecureChannelTask(internalApi, {
        connection: eitherConnection,
      }).run();
    };

    return {
      getOsVersion,
      getDeviceVersion,
      getFirmwareVersion,
      genuineCheck,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state: DeviceSessionState) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}
