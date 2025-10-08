import { Left, Right } from "purify-ts";
import { assign, setup } from "xstate";

import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { UnsupportedFirmwareDAError } from "@api/device-action/os/Errors";
import { GetDeviceMetadataDeviceAction } from "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction";
import type { GetDeviceMetadataDAOutput } from "@api/device-action/os/GetDeviceMetadata/types";
import { InstallOrUpdateAppsDeviceAction } from "@api/device-action/os/InstallOrUpdateApps/InstallOrUpdateAppsDeviceAction";
import type { InstallOrUpdateAppsDAOutput } from "@api/device-action/os/InstallOrUpdateApps/types";
import { OpenAppDeviceAction } from "@api/device-action/os/OpenAppDeviceAction/OpenAppDeviceAction";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";

import {
  type OpenAppWithDependenciesDAError,
  type OpenAppWithDependenciesDAInput,
  type OpenAppWithDependenciesDAIntermediateValue,
  type OpenAppWithDependenciesDAOutput,
} from "./types";

type OpenAppWithDependenciesMachineInternalState = {
  readonly error: OpenAppWithDependenciesDAError | null;
  readonly deviceMetadata: GetDeviceMetadataDAOutput | null;
  readonly installResult: InstallOrUpdateAppsDAOutput | null;
};

export class OpenAppWithDependenciesDeviceAction extends XStateDeviceAction<
  OpenAppWithDependenciesDAOutput,
  OpenAppWithDependenciesDAInput,
  OpenAppWithDependenciesDAError,
  OpenAppWithDependenciesDAIntermediateValue,
  OpenAppWithDependenciesMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    OpenAppWithDependenciesDAOutput,
    OpenAppWithDependenciesDAInput,
    OpenAppWithDependenciesDAError,
    OpenAppWithDependenciesDAIntermediateValue,
    OpenAppWithDependenciesMachineInternalState
  > {
    type types = StateMachineTypes<
      OpenAppWithDependenciesDAOutput,
      OpenAppWithDependenciesDAInput,
      OpenAppWithDependenciesDAError,
      OpenAppWithDependenciesDAIntermediateValue,
      OpenAppWithDependenciesMachineInternalState
    >;

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const getMetadataMachine = new GetDeviceMetadataDeviceAction({
      input: {
        unlockTimeout,
        useSecureChannel: true,
        forceUpdate: false,
      },
    }).makeStateMachine(internalApi);

    const installAppsMachine = new InstallOrUpdateAppsDeviceAction({
      input: {
        unlockTimeout,
        applications: [...this.input.dependencies, this.input.application],
        allowMissingApplication: false,
      },
    }).makeStateMachine(internalApi);

    const openAppMachine = new OpenAppDeviceAction({
      input: {
        unlockTimeout,
        appName: this.input.application.name,
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
        getMetadata: getMetadataMachine,
        installApps: installAppsMachine,
        openApp: openAppMachine,
      },
      guards: {
        hasError: ({ context }) => context._internalState.error !== null,
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
      id: "OpenAppWithDependenciesDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            application: _.input.application,
            dependencies: _.input.dependencies,
            requireLatestFirmware: _.input.requireLatestFirmware,
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            installPlan: null,
          },
          _internalState: {
            error: null,
            deviceMetadata: null,
            installResult: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: [
            {
              target: "GetDeviceMetadata",
            },
          ],
        },
        GetDeviceMetadata: {
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "getMetadata",
            src: "getMetadata",
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
                }),
              }),
            },
            onDone: {
              target: "GetDeviceMetadataCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<OpenAppWithDependenciesMachineInternalState>(
                    {
                      Right: (data) => {
                        if (
                          _.context.input.requireLatestFirmware &&
                          data.firmwareUpdateContext.availableUpdate !==
                            undefined
                        ) {
                          return {
                            ..._.context._internalState,
                            error: new UnsupportedFirmwareDAError(
                              "Firmware is not the latest version",
                            ),
                          };
                        } else {
                          return {
                            ..._.context._internalState,
                            deviceMetadata: data,
                          };
                        }
                      },
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
        GetDeviceMetadataCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "InstallDependencies",
            },
          ],
        },
        InstallDependencies: {
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "installApps",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
              applications: [
                ..._.context.input.dependencies,
                _.context.input.application,
              ],
              allowMissingApplication: false,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.context.intermediateValue,
                  requiredUserInteraction:
                    _.event.snapshot.context.intermediateValue
                      .requiredUserInteraction,
                  installPlan:
                    _.event.snapshot.context.intermediateValue.installPlan,
                }),
              }),
            },
            onDone: {
              target: "InstallDependenciesCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<OpenAppWithDependenciesMachineInternalState>(
                    {
                      Right: (data) => ({
                        ..._.context._internalState,
                        installResult: data,
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
        InstallDependenciesCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "OpenApp",
            },
          ],
        },
        OpenApp: {
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "openApp",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
              appName: _.context.input.application.name,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.context.intermediateValue,
                  requiredUserInteraction:
                    _.event.snapshot.context.intermediateValue
                      .requiredUserInteraction,
                  installPlan: null,
                }),
              }),
            },
            onDone: {
              target: "OpenAppCheck",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<OpenAppWithDependenciesMachineInternalState>(
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
        OpenAppCheck: {
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
        const { error, deviceMetadata, installResult } = context._internalState;
        if (error) {
          return Left(error);
        }
        return Right({
          deviceMetadata: deviceMetadata!,
          installResult: installResult!,
        });
      },
    });
  }
}
