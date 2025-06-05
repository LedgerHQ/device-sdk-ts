import { Left, Right } from "purify-ts";
import { type Observable } from "rxjs";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import { ListAppsDeviceAction } from "@api/device-action/os/ListApps/ListAppsDeviceAction";
import {
  GetApplicationsMetadataTask,
  type GetApplicationsMetadataTaskResult,
  type InstalledApp,
} from "@api/device-action/task/GetApplicationsMetadataTask";
import {
  GetFirmwareMetadataTask,
  type GetFirmwareMetadataTaskResult,
} from "@api/device-action/task/GetFirmwareMetadataTask";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  type Catalog,
  type CustomImage,
  DeviceSessionStateType,
  type FirmwareUpdateContext,
  type FirmwareVersion,
  type InstalledLanguagePackage,
} from "@api/device-session/DeviceSessionState";
import { installedAppResultGuard } from "@api/secure-channel/device-action/ListInstalledApps/types";
import { ConnectToSecureChannelTask } from "@api/secure-channel/task/ConnectToSecureChannelTask";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import { type SecureChannelEvent } from "@api/secure-channel/task/types";
import { type Application } from "@internal/manager-api/model/Application";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

import {
  type GetDeviceMetadataDAError,
  type GetDeviceMetadataDAInput,
  type GetDeviceMetadataDAIntermediateValue,
  type GetDeviceMetadataDAOutput,
} from "./types";

type GetDeviceMetadataMachineInternalState = {
  readonly error: GetDeviceMetadataDAError | null;
  readonly deviceVersion: DeviceVersion | null;
  readonly firmware: FinalFirmware | null;
  readonly firmwareVersion: FirmwareVersion | null;
  readonly firmwareUpdateContext: FirmwareUpdateContext | null;
  readonly customImage: CustomImage | null;
  readonly installedApps: InstalledApp[] | null;
  readonly applications: Application[] | null;
  readonly applicationsUpdates: Application[] | null;
  readonly installedLanguages: InstalledLanguagePackage[] | null;
  readonly catalog: Catalog | null;
};

export type GetDeviceMetadataFromContextTaskResult = {
  readonly firmwareVersion: FirmwareVersion;
  readonly firmwareUpdateContext: FirmwareUpdateContext;
  readonly customImage: CustomImage;
  readonly applications: Application[];
  readonly applicationsUpdates: Application[];
  readonly installedLanguages: InstalledLanguagePackage[];
  readonly catalog: Catalog;
} | null;

export type MachineDependencies = {
  readonly getDeviceMetadata: () => Promise<GetDeviceMetadataFromContextTaskResult>;
  readonly getFirmwareMetadata: () => Promise<GetFirmwareMetadataTaskResult>;
  readonly getApplicationsMetadata: (arg0: {
    input: {
      deviceVersion: DeviceVersion;
      firmware: FinalFirmware;
      firmwareVersion: FirmwareVersion;
      installedApps: InstalledApp[];
    };
  }) => Promise<GetApplicationsMetadataTaskResult>;
  readonly listAppsSecureChannel: (arg0: {
    input: {
      firmware: FinalFirmware;
      firmwareVersion: FirmwareVersion;
    };
  }) => Observable<SecureChannelEvent>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class GetDeviceMetadataDeviceAction extends XStateDeviceAction<
  GetDeviceMetadataDAOutput,
  GetDeviceMetadataDAInput,
  GetDeviceMetadataDAError,
  GetDeviceMetadataDAIntermediateValue,
  GetDeviceMetadataMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GetDeviceMetadataDAOutput,
    GetDeviceMetadataDAInput,
    GetDeviceMetadataDAError,
    GetDeviceMetadataDAIntermediateValue,
    GetDeviceMetadataMachineInternalState
  > {
    type types = StateMachineTypes<
      GetDeviceMetadataDAOutput,
      GetDeviceMetadataDAInput,
      GetDeviceMetadataDAError,
      GetDeviceMetadataDAIntermediateValue,
      GetDeviceMetadataMachineInternalState
    >;

    const {
      getDeviceMetadata,
      getFirmwareMetadata,
      getApplicationsMetadata,
      listAppsSecureChannel,
    } = this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const goToDashboardMachine = new GoToDashboardDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);
    const listAppsMachine = new ListAppsDeviceAction({
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
        goToDashboard: goToDashboardMachine,
        getDeviceMetadata: fromPromise(getDeviceMetadata),
        getFirmwareMetadata: fromPromise(getFirmwareMetadata),
        getApplicationsMetadata: fromPromise(getApplicationsMetadata),
        listApps: listAppsMachine,
        listAppsSecureChannel: fromObservable(listAppsSecureChannel),
      },
      guards: {
        hasError: ({ context }) => context._internalState.error !== null,
        hasMetadata: ({ context }) =>
          context._internalState.firmwareVersion !== null &&
          context._internalState.firmwareUpdateContext !== null &&
          context._internalState.customImage !== null &&
          context._internalState.applications !== null &&
          context._internalState.applicationsUpdates !== null &&
          context._internalState.installedLanguages !== null &&
          context._internalState.catalog !== null,
        forceUpdate: ({ context }) => Boolean(context.input.forceUpdate),
        useSecureChannel: ({ context }) =>
          Boolean(context.input.useSecureChannel),
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      id: "GetDeviceMetadataDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            useSecureChannel: _.input.useSecureChannel,
            forceUpdate: _.input.forceUpdate,
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            deviceVersion: null,
            firmware: null,
            firmwareVersion: null,
            firmwareUpdateContext: null,
            customImage: null,
            installedApps: null,
            applications: null,
            applicationsUpdates: null,
            installedLanguages: null,
            catalog: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: [
            {
              target: "GoToDashboard",
              guard: "forceUpdate",
            },
            {
              target: "GetDeviceMetadataFromContext",
            },
          ],
        },
        GetDeviceMetadataFromContext: {
          invoke: {
            src: "getDeviceMetadata",
            onDone: {
              target: "GetDeviceMetadataFromContextResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (_.event.output === null) {
                    return _.context._internalState;
                  } else {
                    return {
                      ..._.context._internalState,
                      firmwareVersion: _.event.output.firmwareVersion,
                      firmwareUpdateContext:
                        _.event.output.firmwareUpdateContext,
                      customImage: _.event.output.customImage,
                      applications: _.event.output.applications,
                      applicationsUpdates: _.event.output.applicationsUpdates,
                      installedLanguages: _.event.output.installedLanguages,
                      catalog: _.event.output.catalog,
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
        GetDeviceMetadataFromContextResultCheck: {
          always: [
            {
              target: "Success",
              guard: "hasMetadata",
            },
            {
              target: "GoToDashboard",
            },
          ],
        },
        GoToDashboard: {
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "dashboard",
            src: "goToDashboard",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "GoToDashboardCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf({
                    Right: () => _.context._internalState,
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
        GoToDashboardCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "GetFirmwareMetadata",
            },
          ],
        },
        GetFirmwareMetadata: {
          invoke: {
            src: "getFirmwareMetadata",
            onDone: {
              target: "GetFirmwareMetadataResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    const deviceState = internalApi.getDeviceSessionState();
                    if (
                      deviceState.sessionStateType !==
                      DeviceSessionStateType.Connected
                    ) {
                      internalApi.setDeviceSessionState({
                        ...deviceState,
                        firmwareVersion: _.event.output.data.firmwareVersion,
                        firmwareUpdateContext:
                          _.event.output.data.firmwareUpdateContext,
                        customImage: _.event.output.data.customImage,
                      });
                    }
                    return {
                      ..._.context._internalState,
                      deviceVersion: _.event.output.data.deviceVersion,
                      firmware: _.event.output.data.firmware,
                      firmwareVersion: _.event.output.data.firmwareVersion,
                      firmwareUpdateContext:
                        _.event.output.data.firmwareUpdateContext,
                      customImage: _.event.output.data.customImage,
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
        GetFirmwareMetadataResultCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "useSecureChannel",
              target: "ListAppsSecureChannel",
            },
            {
              target: "ListApps",
            },
          ],
        },
        ListAppsSecureChannel: {
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "listAppsSecureChannel",
            src: "listAppsSecureChannel",
            input: (_) => ({
              firmware: _.context._internalState.firmware!,
              firmwareVersion: _.context._internalState.firmwareVersion!,
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
                    SecureChannelEventType.Error
                  ) {
                    return {
                      ..._.context._internalState,
                      error: _.event.snapshot.context.error.mapDAErrors(),
                    };
                  } else if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Result
                  ) {
                    if (
                      installedAppResultGuard(_.event.snapshot.context.payload)
                    ) {
                      return {
                        ..._.context._internalState,
                        installedApps: _.event.snapshot.context.payload.map(
                          (app) => ({
                            name: app.name,
                            hash: app.hash,
                            hashCode: app.hash_code_data,
                          }),
                        ),
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
              target: "ListAppsCheck",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ListApps: {
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "listApps",
            src: "listApps",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "ListAppsCheck",
              actions: assign({
                _internalState: (_) => {
                  if (_.event.output.isLeft()) {
                    return {
                      ..._.context._internalState,
                      error: _.event.output.extract(),
                    };
                  } else {
                    return {
                      ..._.context._internalState,
                      installedApps: _.event.output
                        .unsafeCoerce()
                        .map((app) => ({
                          name: app.appName,
                          hash: app.appFullHash,
                          hashCode: app.appCodeHash,
                        })),
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
        ListAppsCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "GetApplicationsMetadata",
            },
          ],
        },
        GetApplicationsMetadata: {
          invoke: {
            src: "getApplicationsMetadata",
            input: (_) => ({
              deviceVersion: _.context._internalState.deviceVersion!,
              firmware: _.context._internalState.firmware!,
              firmwareVersion: _.context._internalState.firmwareVersion!,
              installedApps: _.context._internalState.installedApps!,
            }),
            onDone: {
              target: "GetApplicationsMetadataResultCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    const deviceState = internalApi.getDeviceSessionState();
                    if (
                      deviceState.sessionStateType !==
                      DeviceSessionStateType.Connected
                    ) {
                      internalApi.setDeviceSessionState({
                        ...deviceState,
                        installedApps: _.event.output.data.applications,
                        appsUpdates: _.event.output.data.applicationsUpdates,
                        installedLanguages:
                          _.event.output.data.installedLanguages,
                        catalog: _.event.output.data.catalog,
                      });
                    }
                    return {
                      ..._.context._internalState,
                      applications: _.event.output.data.applications,
                      applicationsUpdates:
                        _.event.output.data.applicationsUpdates,
                      installedLanguages:
                        _.event.output.data.installedLanguages,
                      catalog: _.event.output.data.catalog,
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
        GetApplicationsMetadataResultCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
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
      output: (args) => {
        const { context } = args;
        const {
          error,
          firmwareVersion,
          firmwareUpdateContext,
          customImage,
          applications,
          applicationsUpdates,
          installedLanguages,
          catalog,
        } = context._internalState;
        if (error) {
          return Left(error);
        }
        return Right({
          firmwareVersion: firmwareVersion!,
          firmwareUpdateContext: firmwareUpdateContext!,
          customImage: customImage!,
          applications: applications!,
          applicationsUpdates: applicationsUpdates!,
          installedLanguages: installedLanguages!,
          catalog: catalog!,
        });
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getDeviceMetadata = async () => {
      const deviceState = internalApi.getDeviceSessionState();
      if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
        return null;
      }
      if (
        deviceState.firmwareVersion?.metadata === undefined ||
        deviceState.firmwareUpdateContext === undefined ||
        deviceState.customImage === undefined ||
        deviceState.installedApps.length === 0 ||
        deviceState.appsUpdates === undefined ||
        deviceState.installedLanguages === undefined ||
        deviceState.catalog === undefined
      ) {
        return null;
      }
      return {
        firmwareVersion: deviceState.firmwareVersion,
        firmwareUpdateContext: deviceState.firmwareUpdateContext,
        customImage: deviceState.customImage,
        applications: deviceState.installedApps,
        applicationsUpdates: deviceState.appsUpdates,
        installedLanguages: deviceState.installedLanguages,
        catalog: deviceState.catalog,
      };
    };

    const getFirmwareMetadata = async () =>
      new GetFirmwareMetadataTask(internalApi).run();

    const getApplicationsMetadata = async (arg0: {
      input: {
        deviceVersion: DeviceVersion;
        firmware: FinalFirmware;
        firmwareVersion: FirmwareVersion;
        installedApps: InstalledApp[];
      };
    }) =>
      new GetApplicationsMetadataTask(internalApi, {
        deviceVersion: arg0.input.deviceVersion,
        firmware: arg0.input.firmware,
        firmwareVersion: arg0.input.firmwareVersion,
        installedApps: arg0.input.installedApps,
      }).run();

    const listAppsSecureChannel = (arg0: {
      input: {
        firmware: FinalFirmware;
        firmwareVersion: FirmwareVersion;
      };
    }) => {
      const { firmware, firmwareVersion } = arg0.input;
      const connection = internalApi
        .getSecureChannelService()
        .listInstalledApps(firmwareVersion.metadata!, firmware);
      return new ConnectToSecureChannelTask(internalApi, {
        connection,
      }).run();
    };

    return {
      getDeviceMetadata,
      getFirmwareMetadata,
      getApplicationsMetadata,
      listAppsSecureChannel,
    };
  }
}
