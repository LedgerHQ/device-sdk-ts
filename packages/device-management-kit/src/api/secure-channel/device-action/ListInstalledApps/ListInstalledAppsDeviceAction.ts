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
import { ConnectToSecureChannelTask } from "@api/secure-channel/task/ConnectToSecureChannelTask";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

import {
  type Input,
  installedAppResultGuard,
  type ListInstalledAppsDAError,
  type ListInstalledAppsDAInput,
  type ListInstalledAppsDAIntermediateValue,
  type ListInstalledAppsDAOutput,
  type ListInstalledAppsStateMachineInternalState,
  type MachineDependencies,
} from "./types";

export class ListInstalledAppsDeviceAction extends XStateDeviceAction<
  ListInstalledAppsDAOutput,
  ListInstalledAppsDAInput,
  ListInstalledAppsDAError,
  ListInstalledAppsDAIntermediateValue,
  ListInstalledAppsStateMachineInternalState
> {
  protected override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    ListInstalledAppsDAOutput,
    ListInstalledAppsDAInput,
    ListInstalledAppsDAError,
    ListInstalledAppsDAIntermediateValue,
    ListInstalledAppsStateMachineInternalState
  > {
    type types = StateMachineTypes<
      ListInstalledAppsDAOutput,
      ListInstalledAppsDAInput,
      ListInstalledAppsDAError,
      ListInstalledAppsDAIntermediateValue,
      ListInstalledAppsStateMachineInternalState
    >;

    const {
      getOsVersion,
      getDeviceVersion,
      getFirmwareVersion,
      listInstalledApps,
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
        listInstalledApps: fromObservable(listInstalledApps),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2sAuBDANjgggA6EAiYAbgJYDGY+1GlA9qgHRlW0BKYWEAngGIA2gAYAuolCEmsSoxZSQAD0QBGAJyjWADgDsAFg0A2HSb2iArMbUBmADQh+iAExrjrS6KuWNtte7Glga2AL6hjmiYuATEHDR0DMxsAOJMACpMJFiwABYARkxYAE4QghAsYKyUqORMANZVUBlZOQVFpWKSSCAycgqoSqoIxi6WrKJq1rYGNgaiBrOOzgi2th5qonouorYuo9YBBuGR6Nh4RKQUCfQDrGmZ2XmFJWVgxcVMxayEOFgYADMvgBbVjNR5tF6dCRKPryZJDRAHCZTYwzOYLJZOdR6DSeFy2MwBPaaXzGE4gKLnWJXTiJO4PVrPDoQADCuTA1HqIhhPThA0RCE2XlY+0semMomMBgsOjMyyRoh0E28BmClhc+0mxwilLOMUu8Vot2S9xaT3ar3ZnO5wjU3Wksnhih6w2F2jFEqlMqV8uxq0stlYgTlGg02wJOjCuqpBri12NSRY9zAGAA8rAAGrvOQscqVaq1BpNVMZ7PFXOoLqwp0C13qDVqVhaIK+HSifazNQK1YuPHGLTWQxabaLSwU2MXeN0k3JlKlrM55LWrk8h29WsI+tCjRqAysebSvY6TWagw6HvnvFeDsaGX6UR+Wx6Cf6qe0m5J1IL8uVle2+0a36LdQDdXd90PEIXBPU9zx7dFWD0LwxgMHYFkmckYzfGkjXpU15wwS4ABlKEwfNUCqGo6kaFNCOIEjMGrPlNxdUDXFscVRR0VFxXDJCL39PYgxcPRbD8NQ9DUOV9BfLDonfXDZ2-OjCAYjB-zXIDnUGbcRIkxDNEfEIwwCFx4MDYNjFMMxw01Qlo1OeScITPC51TYjSPUjlVztdd+RAlRXEkvQDK0O8xN3NQzP9HR9xvKxCT0E9Jj0WTdVQJgIDgJRJ2cmcvy0us2IQABaYwezK18nMNFylPYFyeD4FZHWA1jAoQVCezccYb02JDDPcQkqupGr8oZc1IRZQqAuGaDxhMfQxjsKMlQcf1NBcFVdlmPs9wJNVhrjD9E3GiFmStbz6mmtrhijTaFu4tZRJMSZzJCqNnyS9x5m2DRDoU2qv1osslza-ybvUNwg02DRLFi+YZnbSx4JE5sJO8Xc3CsWZMMckbp0-Bkf1B1B-2unTiokuxWGlJULHWWwOzGcymwMKnULEuzRn+vLCfw9z6M88nBR2VLRWQ6xxR0GxRhRpsb2fNYjDcXFZLxo7FKBgiPMwMnmNain2rGDiD01PdUs0NVu0EtUtq8KydginV1YBsbTQAZQAV2oWhYHgfXtJFsxtGsXbuMsCPdh7bjPG8AkNFi70-B50a+eTABRD4vmF3Tg88UZd3DyO1pWDj9wlCwLFMDQ+1xcdwlCIA */
      id: "ListInstalledAppsDeviceAction",
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
            getOsVersionResponse: null,
            deviceVersion: null,
            firmwareVersion: null,
            result: { installedApps: [] },
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
                  _.event.output.caseOf<ListInstalledAppsStateMachineInternalState>(
                    {
                      Right: () => _.context._internalState,
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  ),
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
                  _.event.output.caseOf<ListInstalledAppsStateMachineInternalState>(
                    {
                      Right: (deviceVersion) => ({
                        ..._.context._internalState,
                        deviceVersion,
                      }),
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  ),
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
                  _.event.output.caseOf<ListInstalledAppsStateMachineInternalState>(
                    {
                      Right: (firmwareVersion) => ({
                        ..._.context._internalState,
                        firmwareVersion,
                      }),
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  ),
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
            { target: "ListInstalledApps" },
          ],
        },
        ListInstalledApps: {
          invoke: {
            id: "listInstalledApps",
            src: "listInstalledApps",
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
                    if (
                      installedAppResultGuard(_.event.snapshot.context.payload)
                    ) {
                      return {
                        ..._.context._internalState,
                        result: {
                          installedApps: _.event.snapshot.context.payload,
                        },
                      };
                    }
                    throw new Error(
                      `Invalid result ${JSON.stringify(_.event.snapshot.context.payload)}`,
                    );
                  }
                  return { ..._.context._internalState };
                },
              }),
            },
            onDone: {
              target: "Success",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ListInstalledAppsCheck: {
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

    const listInstalledApps = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
      finalFirmware: FinalFirmware;
    }>) => {
      const { deviceInfo, finalFirmware } = input;
      const eitherConnection = internalApi
        .getSecureChannelService()
        .listInstalledApps(deviceInfo, finalFirmware);
      return new ConnectToSecureChannelTask(internalApi, {
        connection: eitherConnection,
      }).run();
    };

    return {
      getOsVersion,
      getDeviceVersion,
      getFirmwareVersion,
      listInstalledApps,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}
