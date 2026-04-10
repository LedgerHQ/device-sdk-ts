import { type Either, Left, Right } from "purify-ts";
import { type Observable } from "rxjs";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import {
  DeleteLanguagePackCommand,
  type DeleteLanguagePackCommandResult,
} from "@api/command/os/DeleteLanguagePackCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { GetDeviceMetadataDeviceAction } from "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction";
import {
  type GetDeviceMetadataDAError,
  type GetDeviceMetadataDAOutput,
} from "@api/device-action/os/GetDeviceMetadata/types";
import {
  type InstallLanguagePackageEvent,
  InstallLanguagePackageTask,
} from "@api/device-action/task/InstallLanguagePackageTask";
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
} from "./types";

type InstallLanguagePackageMachineInternalState = {
  readonly error: InstallLanguagePackageDAError | null;
  readonly languagePackage: LanguagePackage | null;
};

export type MachineDependencies = {
  readonly prepareInstallLanguagePack: () => Promise<DeleteLanguagePackCommandResult>;
  readonly installLanguagePack: (
    apduInstallUrl: string,
  ) => Observable<InstallLanguagePackageEvent>;
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

    const { prepareInstallLanguagePack, installLanguagePack } =
      this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;
    const language = this.input.language;

    const { None } = UserInteractionRequired;
    const {
      GET_DEVICE_METADATA,
      DEVICE_READY,
      PREPARE_LANGUAGE_PACK_INSTALL,
      INSTALL_LANGUAGE_PACK,
    } = installLanguagePackageDAStateStep;

    const getDeviceMetadataMachine = new GetDeviceMetadataDeviceAction({
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
        getDeviceMetadata: getDeviceMetadataMachine,
        prepareInstallLanguagePack: fromPromise(prepareInstallLanguagePack),
        installLanguagePack: fromObservable(
          ({ input }: { input: { apduInstallUrl: string } }) =>
            installLanguagePack(input.apduInstallUrl),
        ),
      },
      guards: {
        hasError: ({ context }: { context: types["context"] }) =>
          context._internalState.error !== null,
        hasNoLanguagePacks: ({ context }) =>
          !context._internalState.languagePackage,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
        assignGetLanguagePackSnapshot: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignGetLanguagePackDone: assign({
          _internalState: (_) => {
            const output = _.event["output"] as Either<
              GetDeviceMetadataDAError,
              GetDeviceMetadataDAOutput
            >;
            return output.caseOf({
              Right: (metadata) => {
                const languagePackages = metadata.catalog.languagePackages;
                if (!languagePackages) {
                  return {
                    ..._.context._internalState,
                    error: new UnknownDAError(
                      "Device metadata missing OS version response.",
                    ) as InstallLanguagePackageDAError,
                  };
                }
                const languagePackage = languagePackages.find(
                  (lp) => lp.language === language,
                );
                if (!languagePackage) {
                  return {
                    ..._.context._internalState,
                    error: new UnknownDAError("Language package not found."),
                  };
                }
                return {
                  ..._.context._internalState,
                  languagePackage,
                };
              },
              Left: (error: InstallLanguagePackageDAError) => ({
                ..._.context._internalState,
                error,
              }),
            });
          },
        }),
        assignPrepareinstallLanguagePackSnapshot: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: None,
              step: PREPARE_LANGUAGE_PACK_INSTALL,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignInstallLanguagePackSnapshot: assign({
          intermediateValue: (_) => {
            const event = _.event["snapshot"]
              .context as InstallLanguagePackageEvent | null;
            const currentProgress =
              "progress" in _.context.intermediateValue
                ? (_.context.intermediateValue.progress ?? 0)
                : 0;
            return {
              requiredUserInteraction: None,
              step: INSTALL_LANGUAGE_PACK,
              progress:
                event?.type === "progress" ? event.progress : currentProgress,
            } satisfies types["context"]["intermediateValue"];
          },
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
            requiredUserInteraction: None,
            step: DEVICE_READY,
            progress: 0,
          },
          _internalState: {
            error: null,
            languagePackage: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "GetLanguagePack",
          },
        },
        GetLanguagePack: {
          invoke: {
            id: "GetLanguagePackFromMetadata",
            src: "getDeviceMetadata",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: "assignGetLanguagePackSnapshot",
            },
            onDone: {
              target: "GetLanguagePackCheck",
              actions: "assignGetLanguagePackDone",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetLanguagePackCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "hasNoLanguagePacks",
              target: "Error",
            },
            { target: "PrepareInstallLanguagePack" },
          ],
        },
        PrepareInstallLanguagePack: {
          invoke: {
            id: "PrepareInstallLanguagePack",
            src: "prepareInstallLanguagePack",
            onSnapshot: {
              actions: "assignPrepareinstallLanguagePackSnapshot",
            },
            onDone: {
              target: "InstallLanguagePack",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        InstallLanguagePack: {
          invoke: {
            id: "InstallLanguagePack",
            src: "installLanguagePack",
            input: ({ context }) => ({
              apduInstallUrl:
                context._internalState.languagePackage!.apduInstallUrl,
            }),
            onSnapshot: {
              actions: "assignInstallLanguagePackSnapshot",
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
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: (_) => {
        const { languagePackage } = _.context._internalState;

        if (_.context._internalState.error !== null) {
          return Left(_.context._internalState.error);
        }

        if (languagePackage) return Right(languagePackage);

        return Left(new UnknownDAError("InstallLanguagePackageMissingResult"));
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      /**
       * Prepare language pack installation by deleting any installed language pack from memory
       * This command will be ignored by the device if the default language (= English) is used
       */
      prepareInstallLanguagePack: () =>
        internalApi.sendCommand(
          new DeleteLanguagePackCommand({ languagePackageId: 0xff }),
        ),
      installLanguagePack: (apduInstallUrl: string) =>
        new InstallLanguagePackageTask(internalApi, {
          apduInstallUrl,
        }).run(),
    };
  }
}
