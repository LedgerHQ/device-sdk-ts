import { Left, Right } from "purify-ts";
import { type Observable } from "rxjs";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { OutOfMemoryDAError } from "@api/device-action/os/Errors";
import { GetDeviceMetadataDeviceAction } from "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import {
  BuildAppsInstallPlanTask,
  type BuildAppsInstallPlanTaskResult,
} from "@api/device-action/task/BuildAppsInstallPlanTask";
import {
  PredictOutOfMemoryTask,
  type PredictOutOfMemoryTaskResult,
} from "@api/device-action/task/PredictOutOfMemoryTask";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { type GetOsVersionResponse } from "@api/index";
import { ConnectToSecureChannelTask } from "@api/secure-channel/task/ConnectToSecureChannelTask";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import { type SecureChannelEvent } from "@api/secure-channel/task/types";
import { type Application } from "@internal/manager-api/model/Application";

import {
  type ApplicationDependency,
  type InstallOrUpdateAppsDAError,
  type InstallOrUpdateAppsDAInput,
  type InstallOrUpdateAppsDAIntermediateValue,
  type InstallOrUpdateAppsDAOutput,
} from "./types";

type InstallOrUpdateAppsMachineInternalState = {
  readonly error: InstallOrUpdateAppsDAError | null;
  readonly osVersion: GetOsVersionResponse | null;
  readonly currentIndex: number;
};

export type MachineDependencies = {
  readonly buildInstallPlan: (arg0: {
    input: {
      applications: ApplicationDependency[];
      allowMissingApplication: boolean;
    };
  }) => Promise<BuildAppsInstallPlanTaskResult>;
  readonly predictOutOfMemory: (arg0: {
    input: {
      installPlan: Application[];
    };
  }) => Promise<PredictOutOfMemoryTaskResult>;
  readonly installApp: (arg0: {
    input: {
      osVersion: GetOsVersionResponse;
      application: Application;
    };
  }) => Observable<SecureChannelEvent>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class InstallOrUpdateAppsDeviceAction extends XStateDeviceAction<
  InstallOrUpdateAppsDAOutput,
  InstallOrUpdateAppsDAInput,
  InstallOrUpdateAppsDAError,
  InstallOrUpdateAppsDAIntermediateValue,
  InstallOrUpdateAppsMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    InstallOrUpdateAppsDAOutput,
    InstallOrUpdateAppsDAInput,
    InstallOrUpdateAppsDAError,
    InstallOrUpdateAppsDAIntermediateValue,
    InstallOrUpdateAppsMachineInternalState
  > {
    type types = StateMachineTypes<
      InstallOrUpdateAppsDAOutput,
      InstallOrUpdateAppsDAInput,
      InstallOrUpdateAppsDAError,
      InstallOrUpdateAppsDAIntermediateValue,
      InstallOrUpdateAppsMachineInternalState
    >;

    const { buildInstallPlan, predictOutOfMemory, installApp } =
      this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const updateMetadataMachine = new GetDeviceMetadataDeviceAction({
      input: {
        unlockTimeout,
        useSecureChannel: true,
        forceUpdate: false,
      },
    }).makeStateMachine(internalApi);

    const goToDashboardMachine = new GoToDashboardDeviceAction({
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
        updateMetadata: updateMetadataMachine,
        buildInstallPlan: fromPromise(buildInstallPlan),
        predictOutOfMemory: fromPromise(predictOutOfMemory),
        goToDashboard: goToDashboardMachine,
        installApp: fromObservable(installApp),
      },
      guards: {
        hasError: ({ context }) => context._internalState.error !== null,
        hasInstallPlan: (_) => _.context.intermediateValue.installPlan !== null,
        hasMoreApps: (_) =>
          _.context._internalState.currentIndex <
          _.context.intermediateValue.installPlan!.installPlan.length,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
        nextAppIndex: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            currentIndex: _.context._internalState.currentIndex + 1,
          }),
        }),
        cleanupDeviceState: () => {
          // After app successful installation, cleanup the device session state
          // to force fetching the new device state when required
          const state = internalApi.getDeviceSessionState();
          if (state.sessionStateType !== DeviceSessionStateType.Connected) {
            internalApi.setDeviceSessionState({
              ...state,
              installedApps: [],
              appsUpdates: undefined,
            });
          }
        },
      },
    }).createMachine({
      id: "InstallOrUpdateAppsDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            applications: _.input.applications,
            allowMissingApplication: _.input.allowMissingApplication,
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            installPlan: null,
          },
          _internalState: {
            error: null,
            osVersion: null,
            currentIndex: 0,
          },
        };
      },
      states: {
        DeviceReady: {
          always: [
            {
              target: "UpdateDeviceMetadata",
            },
          ],
        },
        UpdateDeviceMetadata: {
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "updateMetadata",
            src: "updateMetadata",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
              useSecureChannel: true,
              forceUpdate: false,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.context.intermediateValue,
                  requiredUserInteraction:
                    _.event.snapshot.context.intermediateValue
                      .requiredUserInteraction,
                  deviceId:
                    _.event.snapshot.context.intermediateValue.deviceId ??
                    _.context.intermediateValue.deviceId,
                }),
              }),
            },
            onDone: {
              target: "UpdateDeviceMetadataCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<InstallOrUpdateAppsMachineInternalState>(
                    {
                      Right: (data) => ({
                        ..._.context._internalState,
                        osVersion: data.firmwareVersion.metadata!,
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
        UpdateDeviceMetadataCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "Success",
              guard: "hasInstallPlan",
            },
            {
              target: "BuildInstallPlan",
            },
          ],
        },
        BuildInstallPlan: {
          invoke: {
            src: "buildInstallPlan",
            input: (_) => ({
              applications: _.context.input.applications,
              allowMissingApplication: _.context.input.allowMissingApplication,
            }),
            onDone: {
              target: "BuildInstallPlanCheck",
              actions: assign({
                _internalState: (_) => {
                  if ("error" in _.event.output) {
                    return {
                      ..._.context._internalState,
                      error: _.event.output.error,
                    };
                  } else {
                    return _.context._internalState;
                  }
                },
                intermediateValue: (_) => {
                  if ("error" in _.event.output) {
                    return _.context.intermediateValue;
                  } else {
                    return {
                      ..._.context.intermediateValue,
                      installPlan: {
                        installPlan: _.event.output.installPlan,
                        alreadyInstalled: _.event.output.alreadyInstalled,
                        missingApplications: _.event.output.missingApplications,
                        currentIndex: 0,
                        currentProgress: 0,
                      },
                    };
                  }
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        BuildInstallPlanCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "PredictOutOfMemory",
              guard: "hasMoreApps",
            },
            {
              target: "Success",
            },
          ],
        },
        PredictOutOfMemory: {
          invoke: {
            src: "predictOutOfMemory",
            input: (_) => ({
              installPlan: _.context.intermediateValue.installPlan!.installPlan,
            }),
            onDone: {
              target: "PredictOutOfMemoryCheck",
              actions: assign({
                _internalState: (_) => {
                  if ("error" in _.event.output) {
                    return {
                      ..._.context._internalState,
                      error: _.event.output.error,
                    };
                  } else if (_.event.output.outOfMemory) {
                    return {
                      ..._.context._internalState,
                      error: new OutOfMemoryDAError(
                        "Not enough memory for those applications",
                      ),
                    };
                  } else {
                    return _.context._internalState;
                  }
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        PredictOutOfMemoryCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
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
                  _.event.output.caseOf<InstallOrUpdateAppsMachineInternalState>(
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
              target: "InstallApp",
              actions: "cleanupDeviceState",
            },
          ],
        },
        InstallApp: {
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "installApp",
            src: "installApp",
            input: (_) => ({
              osVersion: _.context._internalState.osVersion!,
              application:
                _.context.intermediateValue.installPlan!.installPlan[
                  _.context._internalState.currentIndex
                ]!,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => {
                  switch (_.event.snapshot.context?.type) {
                    case SecureChannelEventType.DeviceId: {
                      return {
                        ..._.context.intermediateValue,
                        deviceId: _.event.snapshot.context.payload.deviceId,
                      };
                    }
                    case SecureChannelEventType.PermissionRequested: {
                      return {
                        ..._.context.intermediateValue,
                        requiredUserInteraction:
                          UserInteractionRequired.AllowSecureConnection,
                      };
                    }
                    case SecureChannelEventType.PermissionGranted: {
                      const deviceState = internalApi.getDeviceSessionState();
                      if (
                        deviceState.sessionStateType !==
                        DeviceSessionStateType.Connected
                      ) {
                        internalApi.setDeviceSessionState({
                          ...deviceState,
                          isSecureConnectionAllowed: true,
                        });
                      }
                      return {
                        ..._.context.intermediateValue,
                        requiredUserInteraction: UserInteractionRequired.None,
                      };
                    }
                    case SecureChannelEventType.Progress: {
                      return {
                        ..._.context.intermediateValue,
                        installPlan: {
                          ..._.context.intermediateValue.installPlan!,
                          currentIndex: _.context._internalState.currentIndex,
                          currentProgress:
                            _.event.snapshot.context.payload.progress,
                        },
                      };
                    }
                    default:
                      return _.context.intermediateValue;
                  }
                },
                _internalState: (_) => {
                  if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Error
                  ) {
                    return {
                      ..._.context._internalState,
                      error:
                        _.event.snapshot.context.error.mapInstallDAErrors(),
                    };
                  }
                  return _.context._internalState;
                },
              }),
            },
            onDone: {
              target: "InstallAppCheck",
              actions: "nextAppIndex",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        InstallAppCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "InstallApp",
              guard: "hasMoreApps",
            },
            {
              target: "UpdateDeviceMetadata",
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
        const { context } = args;
        const { error } = context._internalState;
        const { installPlan } = context.intermediateValue;
        if (error) {
          return Left(error);
        }
        return Right({
          successfullyInstalled: installPlan!.installPlan,
          alreadyInstalled: installPlan!.alreadyInstalled,
          missingApplications: installPlan!.missingApplications,
        });
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const buildInstallPlan = async (arg0: {
      input: {
        applications: ApplicationDependency[];
        allowMissingApplication: boolean;
      };
    }) =>
      new BuildAppsInstallPlanTask(internalApi, {
        applications: arg0.input.applications,
        allowMissingApplication: arg0.input.allowMissingApplication,
      }).run();

    const predictOutOfMemory = async (arg0: {
      input: {
        installPlan: Application[];
      };
    }) =>
      new PredictOutOfMemoryTask(internalApi, {
        installPlan: arg0.input.installPlan,
      }).run();

    const installApp = (arg0: {
      input: {
        osVersion: GetOsVersionResponse;
        application: Application;
      };
    }) => {
      const { osVersion, application } = arg0.input;
      const connection = internalApi
        .getSecureChannelService()
        .installApp(osVersion, application);
      return new ConnectToSecureChannelTask(internalApi, {
        connection,
      }).run();
    };

    return {
      buildInstallPlan,
      predictOutOfMemory,
      installApp,
    };
  }
}
