import { type Either, Left, Right } from "purify-ts";
import { type Observable } from "rxjs";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  DeleteLanguagePackCommand,
  type DeleteLanguagePackCommandResult,
} from "@api/command/os/DeleteLanguagePackCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import {
  DeleteLanguagePackDAError,
  MissingLanguagePackageDAError,
  MissingLanguagePackagesForOSDAError,
} from "@api/device-action/os/Errors";
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
  readonly deleteCurrentLanguagePack: () => Promise<DeleteLanguagePackCommandResult>;
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

    const { deleteCurrentLanguagePack, installLanguagePack } =
      this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;
    const language = this.input.language;

    const { None } = UserInteractionRequired;
    const {
      GET_DEVICE_METADATA,
      DEVICE_READY,
      DELETE_CURRENT_LANGUAGE_PACK,
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
        deleteCurrentLanguagePack: fromPromise(deleteCurrentLanguagePack),
        installLanguagePack: fromObservable(
          ({ input }: { input: { apduInstallUrl: string } }) =>
            installLanguagePack(input.apduInstallUrl),
        ),
      },
      guards: {
        // The default language package (English) cannot be installed as a language pack.
        // If the requested language is English, we still delete all installed packs and only skip the install step.
        isDefaultLanguage: ({ context }) =>
          context.input.language === "english",
        hasError: ({ context }: { context: types["context"] }) =>
          context._internalState.error !== null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
        assignGetDeviceMetadataSnapshot: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignGetDeviceMetadataDone: assign({
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
                    error: new MissingLanguagePackagesForOSDAError(
                      `Language packages not found for OS ${metadata?.firmwareVersion?.os}.`,
                    ) as InstallLanguagePackageDAError,
                  };
                }
                const languagePackage = languagePackages.find(
                  (lp) => lp.language === language,
                );
                if (!languagePackage) {
                  return {
                    ..._.context._internalState,
                    error: new MissingLanguagePackageDAError(
                      `Language package not found for ${language}.`,
                    ),
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
        assignDeleteCurrentLanguagePackSnapshot: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: None,
              step: DELETE_CURRENT_LANGUAGE_PACK,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignDeleteCurrentLanguagePackDone: assign({
          _internalState: (_) => {
            const result = _.event["output"] as DeleteLanguagePackCommandResult;
            if (isSuccessCommandResult(result)) {
              return _.context._internalState;
            }

            return {
              ..._.context._internalState,
              error: new DeleteLanguagePackDAError(
                "message" in result.error
                  ? result.error.message
                  : "Delete language pack failed.",
              ),
            };
          },
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
      /** @xstate-layout N4IgpgJg5mDOIC5QEkB2sAuBDANjgMlqlAK5YwAKWAxgNblgAiYAbgJbVgCC1GbA9qgB0AYQAWYOgCUwARxJwMkQsTIwAxAG0ADAF1EoAA79YbPoIMgAHogBMATltCAjPYCsAZm0AWAOwAObTdfe18AGhAAT0RvRyEPW39nZw9nb20PBIBfLIi0TFwCIlIGKjoGZnZOHnNhcUlaGXlFZWK1MC1nfSQQY1NayxsEBydXTx8AoJDwqMRk+yE-ADY3Vb9fNxSPHLz0bDwVEsoaehhKjm5eAWEAcTAMc84AWXusCCxsdQhBMCE2VBY-FovzuD1YFxe2He2B03SMJjM10GiH8cUc9iWS3cbhWthWEWiw20S0WzkxvhS3g8S38wVsOxA+X2RVUpROFXB1SugiEoMeYEhbw+WHUYAATmL+GKhIYcB8AGZSgC2vPu-MF0KwsMsfURFh6Q1RTnRmOxuPxswQSSEbm0drttPs-l8LoZTMKh3aZVOTE5l1qQk9bLo9ToWj0OoRAwNc2pHiEtlioXSTu8Sw8BLstnjvjxqxdQQ8Gypbr2HrawZ9-Jq10DFeOIYkYc0XUj-SRMYQKXTCaTvhT-jTGctRfj-kSzm0-hp-aWPlLBQO9bA3o5VX9teYOHuYBEJAlYFQGCDDdoXx+fwBQN+W53e4PR5PK5O2p6uujoCGrgSQinbnsdqxEs3jeLYMyElivguDi2a2mB-7aPYC7Mk+q5nH6NY8reSj3mKh7Hsu3rnqgvz-ICwJCNhu77nhj6ES+rZvlGHafnM9g-n+AE+BiIFgZmCBuImQiDum3iDm4zq+JiyHlqyp5rhcmHCFRuH4ahJyihKUoynKGCKmKKoqTRan0XQr7wu2+qsV27FOJxgE8aB4GIB4oEJnmSy2M4EmJr4MlLnJz7lOh65KUI7oBUcQVnt8JGXuRvwRSyUXeuZvTMVZ1h2C6-i-h4AG2sB6TBPxwRQQBnkJFifjpPSuSMmWkVeuyIWKdywhJepYbipK0qygqyrhY1yXNWZEZMZZqDIsMOV5QVxIgVM-Fid4iyePMdpFiBGw5PVqD8BAcCWJ1plVhh7VtnqU2dgAtEs-E3W4Qj2C9r1vW92z1SdgVob6oXtaITaNHICiYK0gWXR+WUIKB-HOEJaQJGB060vDdW7IuI2VgpXIBnyfoasKkMsdDtqrf2r1LCESSrG4-H2Ktth5p4tirB4OLeM4-lY-JrW47WXW0KGtDE5lX7eU9-jswBL0rEExL8UzuX5QkXiIem-afRjKGnTjG5YWA244cZdE-ScovXdZ3l4r+jopLY9qTsOhLs1BCRJNS-75VLXNfcNgt62F30pebE1XdN2bjnNxKZMsrPLQBwlDqzjm5n5fuYwHfP68IADKJDUJwsDwGHUNDF4CPOmJqTAVOIGlVL8RM-YTtebZSEZzrZvBX9bUBgAolpYoW9NFerc4Vc+7Xg7eIrrNNysuabGkwTUrtWRAA */
      id: "InstallLanguagePackageDeviceAction",
      initial: "CheckRequestedLanguage",
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
        CheckRequestedLanguage: {
          always: [
            {
              guard: "isDefaultLanguage",
              target: "DeleteCurrentLanguagePack",
            },
            { target: "GetDeviceMetadata" },
          ],
        },
        GetDeviceMetadata: {
          invoke: {
            id: "GetDeviceMetadata",
            src: "getDeviceMetadata",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
              forceUpdate: true, // ensures the Language pack is fresh and forces user to go to Dashboard
              useSecureChannel: true,
            }),
            onSnapshot: {
              actions: "assignGetDeviceMetadataSnapshot",
            },
            onDone: {
              target: "LanguagePackCheck",
              actions: "assignGetDeviceMetadataDone",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        LanguagePackCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            { target: "DeleteCurrentLanguagePack" },
          ],
        },
        DeleteCurrentLanguagePack: {
          invoke: {
            id: "DeleteCurrentLanguagePack",
            src: "deleteCurrentLanguagePack",
            onSnapshot: {
              actions: "assignDeleteCurrentLanguagePackSnapshot",
            },
            onDone: {
              target: "DeleteCurrentLanguagePackResultCheck",
              actions: "assignDeleteCurrentLanguagePackDone",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        DeleteCurrentLanguagePackResultCheck: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isDefaultLanguage",
              target: "Success",
            },
            { target: "InstallLanguagePack" },
          ],
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
        if (_.context._internalState.error !== null) {
          return Left(_.context._internalState.error);
        }
        return Right(undefined);
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      deleteCurrentLanguagePack: () =>
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
