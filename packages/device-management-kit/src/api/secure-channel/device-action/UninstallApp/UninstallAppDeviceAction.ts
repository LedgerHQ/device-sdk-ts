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
import { UnknownDAError } from "@api/device-action/os/Errors";
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
import { ListInstalledAppsDeviceAction } from "@api/secure-channel/device-action/ListInstalledApps/ListInstalledAppsDeviceAction";
import { type InstalledApp } from "@api/secure-channel/device-action/ListInstalledApps/types";
import { ConnectToSecureChannelTask } from "@api/secure-channel/task/ConnectToSecureChannelTask";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import { type Input } from "@api/secure-channel/types";
import { type Application } from "@internal/manager-api/model/Application";

import {
  type MachineDependencies,
  type UninstallAppDAError,
  type UninstallAppDAInput,
  type UninstallAppDAIntermediateValue,
  type UninstallAppDAOutput,
  type UninstallAppStateMachineInternalState,
} from "./types";

export class UninstallAppDeviceAction extends XStateDeviceAction<
  UninstallAppDAOutput,
  UninstallAppDAInput,
  UninstallAppDAError,
  UninstallAppDAIntermediateValue,
  UninstallAppStateMachineInternalState
> {
  override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    UninstallAppDAOutput,
    UninstallAppDAInput,
    UninstallAppDAError,
    UninstallAppDAIntermediateValue,
    UninstallAppStateMachineInternalState
  > {
    type types = StateMachineTypes<
      UninstallAppDAOutput,
      UninstallAppDAInput,
      UninstallAppDAError,
      UninstallAppDAIntermediateValue,
      UninstallAppStateMachineInternalState
    >;

    const {
      getOsVersion,
      getAppsByHash,
      uninstallApp,
      getDeviceSessionState,
      setDeviceSessionState,
    } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const goToDashboardMachine = new GoToDashboardDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);

    const listInstalledAppsMachine = new ListInstalledAppsDeviceAction({
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
        listInstalledApps: listInstalledAppsMachine,
        goToDashboard: goToDashboardMachine,
        getOsVersion: fromPromise(getOsVersion),
        getAppsByHash: fromPromise(getAppsByHash),
        uninstallApp: fromObservable(uninstallApp),
      },
      guards: {
        hasError: (_) => _.context._internalState.error !== null,
        appNotInstalled: (_) =>
          !_.context._internalState.installedApps.some(
            (app) => app.name === _.context.input.appName,
          ),
        appNotFound: (_) =>
          _.context._internalState.appList.findIndex(
            (app) => app?.versionName === _.context.input.appName,
          ) === -1,
        isDepAppOfOther: (_) =>
          _.context._internalState.appList.some(
            (app) => app?.parentName === _.context.input.appName,
          ),
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
        assignAppNotFound: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new UnknownDAError(
              "App to uninstall not found in manager API",
            ),
          }),
        }),
        assignIsDepAppOfOther: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new UnknownDAError(
              "App to uninstall is a dependency of another installed app",
            ),
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2sAuBDANjgggA6EAiYAbgJYDGY+1GlA9qgHRlW0BKYWEAngGIA2gAYAuolCEmsSoxZSQAD0QBGAJyjWADgDsAFg0A2HSb2iArMbUBmADQh+iAExrjrS6KuWNtte7Glga2AL6hjmiYuATEHDR0DMxsAOJMACpMJFiwABYARkxYAE4QghAsYKyUqORMANZVUBlZOQVFpWKSSCAycgqoSqoIxi6WrKJq1rYGNgaiBrOOzgi2th5qonouorYuo9YBBuGR6Nh4RKQUCfQDrGmZ2XmFJWVgxcVMxayEOFgYADMvgBbVjNR5tF6dCRKPryZJDRAHCZTYwzOYLJZOdR6DSeFy2MwBPaaXzGE4gKLnWJXTiJO4PVrPDoQADCuTA1HqIhhPThA0RCE2XlY+0semMomMBgsOjMyyRoh0E28BmClhc+0mxwilLOMUu8Vot2S9xaT3ar3ZnO5wjU3Wksnhih6w2F2jFEqlMqV8uxq0stlYgTlGg02wJOjCuqpBri12NSRY9zAGAA8rAAGrvOQscqVaq1BpNVMZ7PFXOoLqwp0C13qDVqVhaIK+HSifazNQK1YuPHGLTWQxabaLSwU2MXeN0k3JlKlrM55LWrk8h29WsI+tCjRqAysebSvY6TWagw6HvnvFeDsaGX6UR+Wx6Cf6qe0m5J1IL8uVle2+0a36LdQDdXd90PEIXBPU9zx7dFWD0LwxgMHYFkmckYzfGkjXpU15wwS4ABlKEwfNUCqGo6kaFNCOIEjMGrPlNxdUDXFscVRR0VFxXDJCL39PYgxcPRbD8NQ9DUOV9BfLDonfXDZ2-OjCAYjB-zXIDnUGbcRIkxDNEfEIwwCFx4MDYNjFMMxw01Qlo1OeScITPC51TYjSPUjlVztdd+RAlRXEkvQDK0O8xN3NQzP9HR9xvKxCT0E9Jj0WTdVQJgIDgJRJ2cmcvy0us2IQABaYwezK18nMNFylPYFyeD4FZHWA1jAoQVCezccYb02JDDPcQkqupGr8oZc1IRZQqAuGaDxhMfQxjsKMlQcf1NBcFVdlmPs9wJNVhrjD9E3GiFmStbz6mmtrhijTaFu4tZRJMSZzJCqNnyS9x5m2DRDoU2qv1osslza-ybvUNwg02DRLFi+YZnbSx4JE5sJO8Xc3CsWZMMckbp0-Bkf1B1B-2unTiokuxWGlJULHWWwOzGcymwMKnULEuzRn+vLCfw9z6M88nBR2VLRWQ6xxR0GxRhRpsb2fNYjDcXFZLxo7FKBgiPMwMnmNain2rGDiD01PdUs0NVu0EtUtq8KydginV1YBsbTQAZQAV2oWhYHgfXtJFsxtGsXbuMsCPdh7bjPG8AkNFi70-B50a+eTABRD4vmF3Tg88UZd3DyO1pWDj9wlCwLFMDQ+1xcdwlCIA */
      id: "UninstallAppDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
            appName: _.input.appName,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            installedApps: [],
            appList: [],
            getOsVersionResponse: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "ListInstalledApps",
          },
        },
        ListInstalledApps: {
          invoke: {
            id: "listInstalledApps",
            src: "listInstalledApps",
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
              target: "ListInstalledAppsCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<UninstallAppStateMachineInternalState>(
                    {
                      Right: ({ installedApps }) => ({
                        ..._.context._internalState,
                        installedApps,
                      }),
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
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
        ListInstalledAppsCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "Success",
              guard: "appNotInstalled",
            },
            {
              target: "GetAppsByHash",
            },
          ],
        },
        GetAppsByHash: {
          invoke: {
            id: "getAppsByHash",
            src: "getAppsByHash",
            input: (_) => _.context._internalState.installedApps!,
            onDone: {
              target: "GetAppsByHashCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf({
                    Right: (apps) => ({
                      ..._.context._internalState,
                      appList: apps,
                    }),
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetAppsByHashCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "Error",
              guard: "appNotFound",
              actions: "assignAppNotFound",
            },
            {
              target: "Error",
              guard: "isDepAppOfOther",
              actions: "assignIsDepAppOfOther",
            },
            {
              target: "GoToDashboard",
            },
          ],
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
                _internalState: (_) => {
                  return _.event.output.caseOf<UninstallAppStateMachineInternalState>(
                    {
                      Right: () => _.context._internalState,
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
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
              target: "UninstallApp",
            },
          ],
        },
        UninstallApp: {
          invoke: {
            id: "uninstallApp",
            src: "uninstallApp",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
              app: _.context._internalState.appList.find(
                (app) => app?.versionName === _.context.input.appName,
              )!,
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
              }),
            },
            onDone: {
              target: "ListInstalledApps",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        Success: {
          type: "final",
          description: "App uninstalled successfully",
        },
        Error: {
          type: "final",
        },
      },
      output: ({ context }) =>
        context._internalState.error
          ? Left(context._internalState.error)
          : Right(void 0),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getOsVersion = () =>
      internalApi.sendCommand(new GetOsVersionCommand());

    const getAppsByHash = ({ input }: Input<InstalledApp[]>) => {
      const appHashes = input.map((app) => app.hash);
      return internalApi.getManagerApiService().getAppsByHash(appHashes);
    };

    const uninstallApp = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
      app: Application;
    }>) => {
      const { deviceInfo, app } = input;
      const eitherConnection = internalApi
        .getSecureChannelService()
        .uninstallApp(deviceInfo, app);
      return new ConnectToSecureChannelTask(internalApi, {
        connection: eitherConnection,
      }).run();
    };

    return {
      getOsVersion,
      getAppsByHash,
      uninstallApp,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}
