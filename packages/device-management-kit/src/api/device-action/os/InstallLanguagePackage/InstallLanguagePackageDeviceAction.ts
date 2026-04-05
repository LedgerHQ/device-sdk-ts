import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  DeleteLanguagePackCommand,
  type DeleteLanguagePackCommandResult,
} from "@api/command/os/DeleteLanguagePackCommand";
import {
  GetOsVersionCommand,
  type GetOsVersionCommandResult,
  type GetOsVersionResponse,
} from "@api/command/os/GetOsVersionCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import {
  GetLanguagePackageByLanguageTask,
  type GetLanguagePackageByLanguageTaskResult,
} from "@api/device-action/task/GetLanguagePackageByLanguageTask";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import { type LanguagePackage } from "@internal/manager-api/model/Language";

import {
  type InstallLanguagePackageDAError,
  type InstallLanguagePackageDAInput,
  type InstallLanguagePackageDAIntermediateValue,
  type InstallLanguagePackageDAOutput,
  installLanguagePackageDAStateStep,
  type Language,
} from "./types";

type InstallLanguagePackageMachineInternalState = {
  readonly error: InstallLanguagePackageDAError | null;
  readonly deviceInfo: GetOsVersionResponse | null;
  readonly languagePackage: LanguagePackage | null;
  readonly didDeleteAll: boolean;
};

export type MachineDependencies = {
  readonly getDeviceInfo: () => Promise<GetOsVersionCommandResult>;
  readonly deleteAllLanguagePacks: () => Promise<DeleteLanguagePackCommandResult>;
  readonly resolveLanguagePackage: (args: {
    input: { deviceInfo: GetOsVersionResponse; language: Language };
  }) => Promise<GetLanguagePackageByLanguageTaskResult>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class InstallLanguagePackageDeviceAction extends XStateDeviceAction<
  InstallLanguagePackageDAOutput,
  InstallLanguagePackageDAInput,
  InstallLanguagePackageDAError,
  InstallLanguagePackageDAIntermediateValue,
  InstallLanguagePackageMachineInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    InstallLanguagePackageDAOutput,
    InstallLanguagePackageDAInput,
    InstallLanguagePackageDAError,
    InstallLanguagePackageDAIntermediateValue,
    InstallLanguagePackageMachineInternalState
  > {
    type types = StateMachineTypes<
      InstallLanguagePackageDAOutput,
      InstallLanguagePackageDAInput,
      InstallLanguagePackageDAError,
      InstallLanguagePackageDAIntermediateValue,
      InstallLanguagePackageMachineInternalState
    >;

    const { getDeviceInfo, deleteAllLanguagePacks, resolveLanguagePackage } =
      this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;
    const language = this.input.language;

    const goToDashboardMachine = new GoToDashboardDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);

    return setup({
      types: {
        input: {
          unlockTimeout,
          language,
        } as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        goToDashboard: goToDashboardMachine,
        getDeviceInfo: fromPromise(getDeviceInfo),
        deleteAllLanguagePacks: fromPromise(deleteAllLanguagePacks),
        resolveLanguagePackage: fromPromise<
          GetLanguagePackageByLanguageTaskResult,
          { deviceInfo: GetOsVersionResponse; language: Language }
        >(async ({ input }) => resolveLanguagePackage({ input })),
      },
      guards: {
        hasError: ({ context }: { context: types["context"] }) => {
          return context._internalState.error !== null;
        },
        isDeleteAllLanguages: ({ context }: { context: types["context"] }) =>
          context.input.language === "english",
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"] as InstallLanguagePackageDAError,
          }),
        }),
        assignGetDeviceInfoStep: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: installLanguagePackageDAStateStep.GET_DEVICE_INFO,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignDeleteAllStep: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: installLanguagePackageDAStateStep.DELETE_ALL_LANGUAGE_PACKS,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignResolveStep: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: installLanguagePackageDAStateStep.RESOLVE_LANGUAGE_PACKAGE,
            }) satisfies types["context"]["intermediateValue"],
        }),
      },
    }).createMachine({
      id: "InstallLanguagePackageDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
            language: _.input.language,
          },
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: installLanguagePackageDAStateStep.GO_TO_DASHBOARD,
          },
          _internalState: {
            error: null,
            deviceInfo: null,
            languagePackage: null,
            didDeleteAll: false,
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
                  return _.event.output.caseOf<InstallLanguagePackageMachineInternalState>(
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
              target: "GetDeviceInfo",
            },
          ],
        },
        GetDeviceInfo: {
          entry: "assignGetDeviceInfoStep",
          invoke: {
            src: "getDeviceInfo",
            onDone: {
              target: "GetDeviceInfoCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      deviceInfo: _.event.output.data,
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
        GetDeviceInfoCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "DeleteAllLanguagePacks",
              guard: "isDeleteAllLanguages",
            },
            {
              target: "ResolveLanguagePackage",
            },
          ],
        },
        DeleteAllLanguagePacks: {
          entry: "assignDeleteAllStep",
          invoke: {
            src: "deleteAllLanguagePacks",
            onDone: {
              target: "AfterLanguageOperation",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      didDeleteAll: true,
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
        ResolveLanguagePackage: {
          entry: "assignResolveStep",
          invoke: {
            src: "resolveLanguagePackage",
            input: ({ context }) => ({
              deviceInfo: context._internalState.deviceInfo!,
              language: context.input.language,
            }),
            onDone: {
              target: "AfterLanguageOperation",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      languagePackage: _.event.output.data,
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
        AfterLanguageOperation: {
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
        const { error, languagePackage, didDeleteAll } =
          _.context._internalState;
        if (error) {
          return Left(error);
        }
        if (didDeleteAll) {
          return Right(undefined);
        }
        if (languagePackage !== null) {
          return Right(languagePackage);
        }
        return Left(new UnknownDAError("InstallLanguagePackageMissingResult"));
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getDeviceInfo = async () =>
      internalApi.sendCommand(new GetOsVersionCommand());

    const deleteAllLanguagePacks = async () =>
      internalApi.sendCommand(
        new DeleteLanguagePackCommand({ languagePackageId: 0xff }),
      );

    const resolveLanguagePackage = async ({
      input,
    }: {
      input: { deviceInfo: GetOsVersionResponse; language: Language };
    }) => new GetLanguagePackageByLanguageTask(internalApi, input).run();

    return {
      getDeviceInfo,
      deleteAllLanguagePacks,
      resolveLanguagePackage,
    };
  }
}
