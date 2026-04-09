import { type Either, Left, Right } from "purify-ts";
import { assign, setup } from "xstate";

import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { GetDeviceMetadataDeviceAction } from "@api/device-action/os/GetDeviceMetadata/GetDeviceMetadataDeviceAction";
import {
  type GetDeviceMetadataDAError,
  type GetDeviceMetadataDAOutput,
} from "@api/device-action/os/GetDeviceMetadata/types";
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
  readonly languagePackages: LanguagePackage[] | null;
};

export type MachineDependencies = Record<string, never>;

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

    // eslint-disable-next-line no-empty-pattern
    const {} = this.extractDependencies();

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;
    const language = this.input.language;

    const { None } = UserInteractionRequired;
    const { GET_DEVICE_METADATA, DEVICE_READY } =
      installLanguagePackageDAStateStep;

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
      },
      guards: {
        hasError: ({ context }: { context: types["context"] }) => {
          return context._internalState.error !== null;
        },
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
        assignGetLanguagePacksSnapshot: assign({
          intermediateValue: (_) =>
            ({
              requiredUserInteraction: None,
              step: GET_DEVICE_METADATA,
            }) satisfies types["context"]["intermediateValue"],
        }),
        assignGetLanguagePacksDone: assign({
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
                return {
                  ..._.context._internalState,
                  languagePackages,
                };
              },
              Left: (error: InstallLanguagePackageDAError) => ({
                ..._.context._internalState,
                error,
              }),
            });
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
          },
          _internalState: {
            error: null,
            deviceInfo: null,
            languagePackages: null,
            languagePackage: null,
            didDeleteAll: false,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "GetLanguagePacks",
          },
        },
        GetLanguagePacks: {
          invoke: {
            id: "GetLanguagePacksFromDeviceMetadata",
            src: "getDeviceMetadata",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: "assignGetLanguagePacksSnapshot",
            },
            onDone: {
              target: "GetLanguagePacksCheck",
              actions: "assignGetLanguagePacksDone",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetLanguagePacksCheck: {
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
        const { languagePackages } = _.context._internalState;

        if (_.context._internalState.error !== null) {
          return Left(_.context._internalState.error);
        }

        if (languagePackages != null && languagePackages.length > 0) {
          return Right({ languagePackages });
        }

        return Left(new UnknownDAError("InstallLanguagePackageMissingResult"));
      },
    });
  }

  extractDependencies(): MachineDependencies {
    return {};
  }
}
