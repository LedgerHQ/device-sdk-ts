import {
  type ApplicationDependency,
  type DeviceActionStateMachine,
  hexaStringToBuffer,
  type InternalApi,
  isDashboardName,
  type Language,
  LANGUAGE_ID_TO_LANGUAGE,
  RefusedByUserDAError,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isMasterConsentSupported } from "@api/command/OsUpdate/Restore/RequestMasterConsentCommand";
import { isCustomLockScreenSupported } from "@api/customLockScreenUtils/screenSpecs";
import { type BackupApp } from "@api/device-action/OsUpdate/Backup/types";
import { getIsOnboarded } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/GetIsOnboarded";
import { installLanguagePackage } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallLanguagePackage";
import { installOrUpdateApps } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/InstallOrUpdateApps";
import { requestMasterConsent } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RequestMasterConsent";
import { restoreAppsStorage } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/RestoreAppsStorage";
import { uploadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Restore/RestoreBackup/Substeps/UploadCustomLockScreen";
import {
  RequestMasterConsentResult,
  type RestoreAppResult,
  type RestoreBackupDAError,
  type RestoreBackupDAInput,
  type RestoreBackupDAIntermediateValue,
  type RestoreBackupDAInternalState,
  type RestoreBackupDAOutput,
  RestoreBackupSteps,
} from "@api/device-action/OsUpdate/Restore/RestoreBackup/types";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

const DEFAULT_LANGUAGE = "english";

const langIdToLanguage = (
  languageId: number | undefined,
): Language | undefined =>
  languageId === undefined ? undefined : LANGUAGE_ID_TO_LANGUAGE[languageId];

const hasBackedUpNonEnglishLanguage = (languageId: number | undefined) => {
  const language = langIdToLanguage(languageId);
  return language !== undefined && language !== DEFAULT_LANGUAGE;
};

const isRefusedByUser = (error: unknown): boolean =>
  error instanceof RefusedByUserDAError;

export class RestoreBackupDeviceAction extends XStateDeviceAction<
  RestoreBackupDAOutput,
  RestoreBackupDAInput,
  RestoreBackupDAError,
  RestoreBackupDAIntermediateValue,
  RestoreBackupDAInternalState
> {
  protected override makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    RestoreBackupDAOutput,
    RestoreBackupDAInput,
    RestoreBackupDAError,
    RestoreBackupDAIntermediateValue,
    RestoreBackupDAInternalState
  > {
    type types = StateMachineTypes<
      RestoreBackupDAOutput,
      RestoreBackupDAInput,
      RestoreBackupDAError,
      RestoreBackupDAIntermediateValue,
      RestoreBackupDAInternalState
    >;

    const { backup, unlockTimeout } = this.input;

    return setup({
      types: {
        input: {} as types["input"],
        output: {} as types["output"],
        context: {} as types["context"],
      } as types,
      actors: {
        waitForAppAndVersion: waitForAppAndVersion(internalAPI, unlockTimeout),
        goToDashboard: goToDashboard(internalAPI, unlockTimeout),
        getIsOnboarded: fromPromise(getIsOnboarded(internalAPI)),
        requestMasterConsent: fromPromise(requestMasterConsent(internalAPI)),
        installLanguagePackage: installLanguagePackage(
          internalAPI,
          unlockTimeout,
          langIdToLanguage(backup.languageId) ?? DEFAULT_LANGUAGE,
        ),
        installOrUpdateApps: installOrUpdateApps(
          internalAPI,
          unlockTimeout,
          backup.installedApps.map(
            (app): ApplicationDependency => ({ name: app.appName }),
          ),
        ),
        restoreAppsStorage: restoreAppsStorage(internalAPI, unlockTimeout),
        uploadCustomLockScreen: uploadCustomLockScreenDevice(
          internalAPI,
          unlockTimeout,
          hexaStringToBuffer(backup.clsHexImage ?? "") ?? new Uint8Array(0),
        ),
      },
      guards: {
        isDeviceOnDashboard: ({ context }) =>
          isDashboardName(context._internalState.currentApp),
        isDeviceOnboarded: ({ context }) =>
          context._internalState.isDeviceOnboarded,
        isMasterConsentFeatureSupported: () =>
          isMasterConsentSupported(internalAPI.getDeviceModel().id),
        hasBackedUpNonEnglishLanguage: ({ context }) =>
          hasBackedUpNonEnglishLanguage(context.input.backup.languageId),
        hasAppsToReinstall: ({ context }) =>
          context.input.backup.installedApps.length > 0,
        isCustomLockScreenFeatureSupported: () =>
          isCustomLockScreenSupported(internalAPI.getDeviceModel().id),
        hasBackedUpCustomLockScreen: ({ context }) =>
          context.input.backup.clsHexImage !== undefined,
        hasError: ({ context }) => context._internalState.error !== null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: should never happen
          }),
        }),
      },
    }).createMachine({
      id: "RestoreBackupDeviceAction",
      initial: "WaitForAppAndVersion",
      context: ({ input }) => ({
        input: {
          backup: input.backup,
          unlockTimeout: input.unlockTimeout,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: RestoreBackupSteps.Idle,
        },
        _internalState: {
          error: null,
          currentApp: null,
          isDeviceOnboarded: false,
          isMasterConsentGranted: false,
          restoredLanguage: hasBackedUpNonEnglishLanguage(
            input.backup.languageId,
          )
            ? false
            : undefined,
          restoredCLS:
            input.backup.clsHexImage !== undefined ? false : undefined,
          restoredApps:
            input.backup.installedApps.length > 0
              ? input.backup.installedApps.map(
                  (app): RestoreAppResult => ({
                    appName: app.appName,
                    restoredApp: false,
                    restoredAppStorage:
                      app.data !== undefined ? false : undefined,
                  }),
                )
              : undefined,
          appsToRestoreStorage: [],
        },
      }),
      states: {
        WaitForAppAndVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.WaitForAppAndVersion,
            }),
          }),
          invoke: {
            src: "waitForAppAndVersion",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: _.context.intermediateValue.step,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (output) => ({
                      ..._.context._internalState,
                      currentApp: output.name,
                    }),
                  });
                },
              }),
              target: "CheckIfDeviceIsOnDashboard",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckIfDeviceIsOnDashboard: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isDeviceOnDashboard",
              target: "GetIsOnboarded",
            },
            {
              target: "GoToDashboard",
            },
          ],
        },
        GoToDashboard: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.GoToDashboard,
            }),
          }),
          invoke: {
            src: "goToDashboard",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: _.context.intermediateValue.step,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: () => _.context._internalState,
                  });
                },
              }),
              target: "CheckGoToDashboard",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckGoToDashboard: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "WaitForAppAndVersion",
            },
          ],
        },
        GetIsOnboarded: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.GetIsOnboarded,
            }),
          }),
          invoke: {
            src: "getIsOnboarded",
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: ({ isDeviceOnboarded }) => ({
                      ..._.context._internalState,
                      isDeviceOnboarded,
                    }),
                  });
                },
              }),
              target: "CheckGetIsOnboarded",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckGetIsOnboarded: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isMasterConsentFeatureSupported",
              target: "RequestMasterConsent",
            },
            {
              target: "CheckBackedUpLanguage",
            },
          ],
        },
        RequestMasterConsent: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.RequestMasterConsent,
              requiredUserInteraction: UserInteractionRequired.GrantConsent,
            }),
          }),
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "requestMasterConsent",
            input: ({ context }) => {
              const { backup: contextBackup } = context.input;
              return {
                languagePackConsentEnabled: hasBackedUpNonEnglishLanguage(
                  contextBackup.languageId,
                ),
                lockScreenPictureConsentEnabled:
                  contextBackup.clsHexImage !== undefined,
                appNumber: contextBackup.installedApps.length,
                appStorageNumber: contextBackup.installedApps.filter(
                  (app) => app.data !== undefined,
                ).length,
              };
            },
            onDone: [
              {
                guard: ({ event }) => event.output.isLeft(),
                actions: assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    error: event.output.extract() as RestoreBackupDAError,
                  }),
                }),
                target: "Error",
              },
              {
                guard: ({ event }) =>
                  event.output.extract() ===
                  RequestMasterConsentResult.REJECTED,
                actions: assign({
                  _internalState: ({ context }) => ({
                    ...context._internalState,
                    isMasterConsentGranted: false,
                  }),
                }),
                target: "Success",
              },
              {
                actions: assign({
                  _internalState: ({ context }) => ({
                    ...context._internalState,
                    isMasterConsentGranted: true,
                  }),
                }),
                target: "CheckBackedUpLanguage",
              },
            ],
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckBackedUpLanguage: {
          always: [
            {
              guard: "hasBackedUpNonEnglishLanguage",
              target: "InstallLanguagePackage",
            },
            {
              target: "CheckIfDeviceIsOnboarded",
            },
          ],
        },
        InstallLanguagePackage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.InstallLanguagePackage,
            }),
          }),
          invoke: {
            src: "installLanguagePackage",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
              language: langIdToLanguage(context.input.backup.languageId)!,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: _.context.intermediateValue.step,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreBackupDAInternalState>({
                    Left: (error) =>
                      isRefusedByUser(error)
                        ? _.context._internalState
                        : { ..._.context._internalState, error },
                    Right: () => ({
                      ..._.context._internalState,
                      restoredLanguage: true,
                    }),
                  });
                },
              }),
              target: "CheckIfDeviceIsOnboarded",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckIfDeviceIsOnboarded: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isDeviceOnboarded",
              target: "CheckAppsToReinstall",
            },
            {
              target: "Success",
            },
          ],
        },
        CheckAppsToReinstall: {
          always: [
            {
              guard: "hasAppsToReinstall",
              target: "InstallOrUpdateApps",
            },
            {
              target: "CheckIfDeviceSupportCustomLockScreenFeature",
            },
          ],
        },
        InstallOrUpdateApps: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.InstallOrUpdateApps,
            }),
          }),
          invoke: {
            src: "installOrUpdateApps",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
              applications: context.input.backup.installedApps.map(
                (app): ApplicationDependency => ({ name: app.appName }),
              ),
              allowMissingApplication: true,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: _.context.intermediateValue.step,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreBackupDAInternalState>({
                    Left: (error) =>
                      isRefusedByUser(error)
                        ? {
                            ..._.context._internalState,
                            appsToRestoreStorage: [],
                          }
                        : { ..._.context._internalState, error },
                    Right: (output) => {
                      const installedAppNames = new Set([
                        ...output.successfullyInstalled.map(
                          (a) => a.versionName,
                        ),
                        ...output.alreadyInstalled,
                      ]);
                      const { backup: contextBackup } = _.context.input;
                      return {
                        ..._.context._internalState,
                        restoredApps:
                          _.context._internalState.restoredApps?.map(
                            (result): RestoreAppResult => ({
                              ...result,
                              restoredApp: installedAppNames.has(
                                result.appName,
                              ),
                            }),
                          ),
                        appsToRestoreStorage:
                          contextBackup.installedApps.filter((app: BackupApp) =>
                            installedAppNames.has(app.appName),
                          ),
                      };
                    },
                  });
                },
              }),
              target: "CheckInstallOrUpdateApps",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckInstallOrUpdateApps: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "RestoreAppsStorage",
            },
          ],
        },
        RestoreAppsStorage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.RestoreAppsStorage,
            }),
          }),
          invoke: {
            src: "restoreAppsStorage",
            input: ({ context }) => ({
              backupApps: context._internalState.appsToRestoreStorage,
              isMasterConsentGranted:
                context._internalState.isMasterConsentGranted,
              unlockTimeout: context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: _.context.intermediateValue.step,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (results) => ({
                      ..._.context._internalState,
                      restoredApps: _.context._internalState.restoredApps?.map(
                        (result): RestoreAppResult => {
                          const match = results.find(
                            (r) => r.appName === result.appName,
                          );
                          return match
                            ? {
                                ...result,
                                restoredAppStorage: match.restoredAppStorage,
                              }
                            : result;
                        },
                      ),
                    }),
                  });
                },
              }),
              target: "CheckRestoreAppsStorage",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckRestoreAppsStorage: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "CheckIfDeviceSupportCustomLockScreenFeature",
            },
          ],
        },
        CheckIfDeviceSupportCustomLockScreenFeature: {
          always: [
            {
              guard: "isCustomLockScreenFeatureSupported",
              target: "CheckBackedUpCustomLockScreen",
            },
            {
              target: "Success",
            },
          ],
        },
        CheckBackedUpCustomLockScreen: {
          always: [
            {
              guard: "hasBackedUpCustomLockScreen",
              target: "UploadCustomLockScreen",
            },
            {
              target: "Success",
            },
          ],
        },
        UploadCustomLockScreen: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.UploadCustomLockScreen,
            }),
          }),
          invoke: {
            src: "uploadCustomLockScreen",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
              imageData: hexaStringToBuffer(context.input.backup.clsHexImage!)!,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: _.context.intermediateValue.step,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreBackupDAInternalState>({
                    Left: (error) =>
                      isRefusedByUser(error)
                        ? _.context._internalState
                        : { ..._.context._internalState, error },
                    Right: () => ({
                      ..._.context._internalState,
                      restoredCLS: true,
                    }),
                  });
                },
              }),
              target: "CheckUploadCustomLockScreen",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckUploadCustomLockScreen: {
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
      output: ({ context }) => {
        if (context._internalState.error !== null) {
          return Left(context._internalState.error);
        }
        return Right({
          restoredLanguage: context._internalState.restoredLanguage,
          restoredCLS: context._internalState.restoredCLS,
          restoredApps: context._internalState.restoredApps,
        });
      },
    });
  }
}
