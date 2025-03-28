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
import { ConnectToSecureChannelTask } from "@api/secure-channel/task/ConnectToSecureChannelTask";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import { type Input } from "@api/secure-channel/types";
import { type Application } from "@internal/manager-api/model/Application";

import {
  type InstallAppDAError,
  type InstallAppDAInput,
  type InstallAppDAIntermediateValue,
  type InstallAppDAOutput,
  type InstallAppStateMachineInternalState,
  type MachineDependencies,
} from "./types";

export class InstallAppDeviceAction extends XStateDeviceAction<
  InstallAppDAOutput,
  InstallAppDAInput,
  InstallAppDAError,
  InstallAppDAIntermediateValue,
  InstallAppStateMachineInternalState
> {
  override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    InstallAppDAOutput,
    InstallAppDAInput,
    InstallAppDAError,
    InstallAppDAIntermediateValue,
    InstallAppStateMachineInternalState
  > {
    type types = StateMachineTypes<
      InstallAppDAOutput,
      InstallAppDAInput,
      InstallAppDAError,
      InstallAppDAIntermediateValue,
      InstallAppStateMachineInternalState
    >;

    const {
      getOsVersion,
      getAppList,
      installApp,
      getDeviceSessionState,
      setDeviceSessionState,
    } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const listInstalledAppsMachine = new ListInstalledAppsDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);

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
        listInstalledApps: listInstalledAppsMachine,
        goToDashboard: goToDashboardMachine,
        getOsVersion: fromPromise(getOsVersion),
        getAppList: fromPromise(getAppList),
        installApp: fromObservable(installApp),
      },
      guards: {
        hasError: (_) => _.context._internalState.error !== null,
        appInstalled: (_) =>
          _.context._internalState.installedApps.some(
            (app) => app.name === _.context.input.appName,
          ),
        appNotFound: (_) =>
          _.context._internalState.appList.findIndex(
            ({ versionName }) => versionName === _.context.input.appName,
          ) === -1,
        depAppNotInstalled: (_) => {
          const appToInstall = _.context._internalState.appList.find(
            ({ versionName }) => versionName === _.context.input.appName,
          );
          if (appToInstall?.parentName) {
            return (
              _.context._internalState.installedApps.findIndex(
                ({ name }) => name === appToInstall.parentName,
              ) === -1
            );
          }
          return false;
        },
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
              "App to install not found in manager API",
            ),
          }),
        }),
        assignDepAppNotInstalled: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new UnknownDAError("Dep app is not installed on the device"),
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2sAuBDANjgggA6EAiYAbgJYDGY+1GlA9qgHRlW0BKYWEAngGIA2gAYAuolCEmsSoxZSQAD0QBGAJyjWADgDsAFg0A2HSb2iArMbUBmADQh+iAExrjrS6KuWNtte7Glga2AL6hjmiYuATEHDR0DMxsADKUmFHYeJBEhLCCECxgrJSo5EwA1sU46RiZMTnEsGKSSCAycgqoSqoIBgaWrC6i-i6Wjs4ItqJqnt62BsYuGmoGLguW4ZHoWbGkFAn0XaxpGTsNELmwAMIAFmDUFSISSh3yyT2Ituu6vrZ64yciB0djmogGAxcLmMMwMWxA9TwuXitCOyROtUROEaeTuDyewjUrWksneijavW+tl+fgBE2BelmXnBwUsUJhq3hWORB1RSRYGLO0WylyaeMeIhcxPapK6nymPx0fzpQIQGmWYIhbOhsK55yRcV5iWOAHEmAAVJgkLCwW4AIyYWAAThACkUSmVKsUoBarTb7Y6XS1XrKPhTEEtBjNrAsbAZwYt6VNbB41KI9MNvpGbJyIgj9XsUcb0WbLdbbQ7na6wE6nUwnaxCDgsBgAGb1gC2rB9Zf9laDLzabzl4YQkdY0eMsdWCeMSbUeg0nnWZgC300vmMeuFhaNaIFpb9FcDEHFBMHJM6YdAvTTXiGQT0MOMBgsOjMSZhOgn3i17N1ebcoanDFgevrlgGVZniIRIhle5I3uoVjaNClhPqIL5vh+qq2JY1KBO+GgaBmK5hIBBY8iB+5sCaYAYAA8rAABqNZyCwbqoMUpTlFU3Z0YxLFOmxqDBkOoYISo6hsrMWhBL4OiiNCixqEm3xLsYWjWIYWgZv0mzkTulGHPyNH8cxrHJNBomXmS3SjpoqysPGL7fDoUJQgYOhJp5S7Mssr76KIfj-NuuxGXyppmYJwlWbBYnwXZiEIA5BhORhIQuG57meapiysACinBMM4IzFuBlhcBxmRRguSnBgHFcZ6vEwDVxB1dZMoJfKLgQvlsb+GhOg2Es3npmCXjGEsIxEXC5UxOFoGma1hB1VZF6dbZ3WMno+WaEFIREQELiqXhrAEWYxFQrYOhkdshmVRFJZ0bVtSxdKw7XpJCBjFoTkBTYjKmENc6qjCrDEY+Gj6E+-lPqF80PYtrC0ctq33BKwhSnBm2jplaiDLYWhmHojIaAMKmqgYmj5cYFgWKY6rERo+l3RV+xUSZyPPW1r3owStjveJiVfXjBNE8RpPk0mbLUhsG4M8sOjwwa7NVeiQGEA1Ho8Y192EB1H0SZSQSsP8gKTFDO3Mn+Oq5qzCOq49Aoa4INZ1g2TYtu2TpdqUesG0L8opgTKqTGmr4-iykK22VeaoEwEBwEoGtFtR2MjklAC0OWqpn0LLgsAwrIYaZ2Mru4c8cRY8Hwkw2RnX1rEmbiDMyaYAnt7jXeXC3UYKdQFji8DxTjSWiEmFipd4Ufahys32yrqec3VWJD2e6efb04+qu+re-qy-52-metL6a4F9ieG9G64Srg6YGaWHYN2iDd87qpHsbLKs6wDD3iN94eCC-ZTx8yvsLXoN0XB33fHYf4hMOQnR2jdf4egQQvnTMsP+jskYowEhZCShtwHqDcPhIKlgdD9BGJ5KwqkXA7WLt4FYbgrCLDKgvCuasDxRXwagdeI8G63kZNSdBgUUzTChObL4j8nILm-oTK6SwsGnyeqjWoYDurph2mMQqj4hruGOjhNwYI4ELHVAuYiSi9ycxRi9TAfD66b1cJNbQpivCeXjERSRCBUGzGUjCTKj8oSKUsZXdWFFiDqNHNvMOiltDTxtnPEJnC2AAGUACu1BaCwGHg46+30zDaGsF-EElhSkjCTCCME6wobOSMLdY+bNlECgAKK1nrJEpKmVfpFJWCUspDgcLBBpnTDCZhliLn0uEIAA */
      id: "InstallAppDeviceAction",
      initial: "DeviceReady",
      context: (_) => ({
        input: {
          unlockTimeout: _.input.unlockTimeout,
          appName: _.input.appName,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          progress: 0,
        },
        _internalState: {
          error: null,
          installedApps: [],
          getOsVersionResponse: null,
          appList: [],
        },
      }),
      states: {
        DeviceReady: {
          always: {
            target: "ListInstalledApps",
          },
        },
        ListInstalledApps: {
          value: "ListInstalledApps",
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
                _internalState: (_) =>
                  _.event.output.caseOf<InstallAppStateMachineInternalState>({
                    Right: ({ installedApps }) => ({
                      ..._.context._internalState,
                      installedApps,
                    }),
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
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
              guard: "appInstalled",
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
                _internalState: (_) =>
                  _.event.output.caseOf<InstallAppStateMachineInternalState>({
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
              target: "GetAppList",
            },
          ],
        },
        GetAppList: {
          invoke: {
            id: "getAppList",
            src: "getAppList",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
            }),
            onDone: {
              target: "GetAppListCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<InstallAppStateMachineInternalState>({
                    Right: (appList) => ({
                      ..._.context._internalState,
                      appList,
                    }),
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
            },
          },
        },
        GetAppListCheck: {
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
              guard: "depAppNotInstalled",
              actions: "assignDepAppNotInstalled",
            },
            {
              target: "InstallApp",
            },
          ],
        },
        InstallApp: {
          invoke: {
            id: "installApp",
            src: "installApp",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
              app: _.context._internalState.appList.find(
                ({ versionName }) => versionName === _.context.input.appName,
              )!,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => {
                  if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Progress
                  ) {
                    return {
                      ..._.context.intermediateValue,
                      progress: _.event.snapshot.context.payload.progress,
                    };
                  }
                  return { ..._.context.intermediateValue };
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
          description: "App installed successfully",
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

    const getAppList = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
    }>) => {
      const { deviceInfo } = input;
      return internalApi.getManagerApiService().getAppList(deviceInfo);
    };

    const installApp = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
      app: Application;
    }>) => {
      const { deviceInfo, app } = input;
      const eitherConnection = internalApi
        .getSecureChannelService()
        .installApp(deviceInfo, app);
      return new ConnectToSecureChannelTask(internalApi, {
        connection: eitherConnection,
      }).run();
    };

    return {
      getOsVersion,
      getAppList,
      installApp,
      getDeviceSessionState: () => internalApi.getDeviceSessionState(),
      setDeviceSessionState: (state) =>
        internalApi.setDeviceSessionState(state),
    };
  }
}
