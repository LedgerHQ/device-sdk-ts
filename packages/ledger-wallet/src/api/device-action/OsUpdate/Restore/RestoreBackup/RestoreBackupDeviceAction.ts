import {
  type ApplicationDependency,
  type DeviceActionStateMachine,
  hexaStringToBuffer,
  type InstallOrUpdateAppsDAOutput,
  type InternalApi,
  isDashboardName,
  type Language,
  LANGUAGE_ID_TO_LANGUAGE,
  OutOfMemoryDAError,
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
import { type RestoreAppStorageResult } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/types";
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
  RestoreBackupStatus,
  RestoreBackupSteps,
} from "@api/device-action/OsUpdate/Restore/RestoreBackup/types";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

const DEFAULT_LANGUAGE = "english";
const SECURITY_KEY_APP_NAME = "Security Key";

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

const isOutOfMemory = (error: unknown): boolean =>
  error instanceof OutOfMemoryDAError;

const computeRestoreStatus = (
  state: RestoreBackupDAInternalState,
): RestoreBackupStatus => {
  if (state.isOutOfMemory) {
    return RestoreBackupStatus.OUT_OF_MEMORY;
  }
  const isFullyRestored =
    !state.isMasterConsentRejected &&
    state.restoredLanguage !== false &&
    state.restoredCLS !== false &&
    (state.restoredApps ?? []).every(
      (app) => app.restoredApp && app.restoredAppStorage !== false,
    );
  return isFullyRestored
    ? RestoreBackupStatus.FULL
    : RestoreBackupStatus.PARTIAL;
};

const isSecurityKeyApp = (app: BackupApp): boolean =>
  app.appName === SECURITY_KEY_APP_NAME;

// The Security Key app is installed and restored in its own pass, before the
// other apps: a single install plan would put the other apps' dependencies
// first.
const getSecurityKeyApps = (apps: BackupApp[]): BackupApp[] =>
  apps.filter(isSecurityKeyApp);

const getOtherApps = (apps: BackupApp[]): BackupApp[] =>
  apps.filter((app) => !isSecurityKeyApp(app));

const toApplicationDependencies = (
  apps: BackupApp[],
): ApplicationDependency[] =>
  apps.map((app): ApplicationDependency => ({ name: app.appName }));

const applyInstallResult = (
  state: RestoreBackupDAInternalState,
  backupApps: BackupApp[],
  output: InstallOrUpdateAppsDAOutput,
): RestoreBackupDAInternalState => {
  const installedAppNames = new Set([
    ...output.successfullyInstalled.map(
      (installedApp) => installedApp.versionName,
    ),
    ...output.alreadyInstalled,
  ]);
  return {
    ...state,
    restoredApps: state.restoredApps?.map(
      (result): RestoreAppResult => ({
        ...result,
        restoredApp:
          result.restoredApp || installedAppNames.has(result.appName),
      }),
    ),
    appsToRestoreStorage: backupApps.filter(
      (app) => installedAppNames.has(app.appName) && app.data !== undefined,
    ),
  };
};

const mergeAppsStorageResults = (
  restoredApps: RestoreAppResult[] | undefined,
  appsStorageResults: RestoreAppStorageResult[],
): RestoreAppResult[] | undefined =>
  restoredApps?.map((restoredApp) => {
    const appStorageResult = appsStorageResults.find(
      (storageResult) => storageResult.appName === restoredApp.appName,
    );
    return appStorageResult
      ? {
          ...restoredApp,
          restoredAppStorage: appStorageResult.restoredAppStorage,
        }
      : restoredApp;
  });

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
        installSecurityKeyAppFirst: installOrUpdateApps(
          internalAPI,
          unlockTimeout,
          toApplicationDependencies(getSecurityKeyApps(backup.installedApps)),
        ),
        installOrUpdateApps: installOrUpdateApps(
          internalAPI,
          unlockTimeout,
          toApplicationDependencies(getOtherApps(backup.installedApps)),
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
        hasSecurityKeyAppToReinstall: ({ context }) =>
          getSecurityKeyApps(context.input.backup.installedApps).length > 0,
        hasOtherAppsToReinstall: ({ context }) =>
          getOtherApps(context.input.backup.installedApps).length > 0,
        isCustomLockScreenFeatureSupported: () =>
          isCustomLockScreenSupported(internalAPI.getDeviceModel().id),
        hasBackedUpCustomLockScreen: ({ context }) =>
          context.input.backup.clsHexImage !== undefined,
        hasError: ({ context }) => context._internalState.error !== null,
        isOutOfMemory: ({ context }) => context._internalState.isOutOfMemory,
        hasAppsToRestoreStorage: ({ context }) =>
          context._internalState.appsToRestoreStorage.length > 0,
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
          isMasterConsentRejected: false,
          isOutOfMemory: false,
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
                languagePackConsentEnabled: !hasBackedUpNonEnglishLanguage(
                  contextBackup.languageId,
                ),
                lockScreenPictureConsentEnabled:
                  contextBackup.clsHexImage === undefined,
                appNumber: contextBackup.installedApps.length,
                appStorageNumber: contextBackup.installedApps.filter(
                  (app) => app.data === undefined,
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
                    isMasterConsentRejected: true,
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
                    Left: (error) => {
                      if (isRefusedByUser(error)) {
                        return _.context._internalState;
                      }
                      if (isOutOfMemory(error)) {
                        return {
                          ..._.context._internalState,
                          isOutOfMemory: true,
                        };
                      }
                      return { ..._.context._internalState, error };
                    },
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
              guard: "isOutOfMemory",
              target: "Success",
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
              guard: "hasSecurityKeyAppToReinstall",
              target: "InstallSecurityKeyAppFirst",
            },
            {
              target: "CheckOtherAppsToReinstall",
            },
          ],
        },
        InstallSecurityKeyAppFirst: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreBackupSteps.InstallOrUpdateApps,
            }),
          }),
          invoke: {
            src: "installSecurityKeyAppFirst",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
              applications: toApplicationDependencies(
                getSecurityKeyApps(context.input.backup.installedApps),
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
                    Left: (error) => {
                      if (isRefusedByUser(error)) {
                        return {
                          ..._.context._internalState,
                          appsToRestoreStorage: [],
                        };
                      }
                      if (isOutOfMemory(error)) {
                        return {
                          ..._.context._internalState,
                          isOutOfMemory: true,
                          appsToRestoreStorage: [],
                        };
                      }
                      return { ..._.context._internalState, error };
                    },
                    Right: (output) =>
                      applyInstallResult(
                        _.context._internalState,
                        getSecurityKeyApps(
                          _.context.input.backup.installedApps,
                        ),
                        output,
                      ),
                  });
                },
              }),
              target: "CheckInstallSecurityKeyAppFirst",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckInstallSecurityKeyAppFirst: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isOutOfMemory",
              target: "Success",
            },
            {
              guard: "hasAppsToRestoreStorage",
              target: "RestoreSecurityKeyAppStorageFirst",
            },
            {
              target: "CheckOtherAppsToReinstall",
            },
          ],
        },
        RestoreSecurityKeyAppStorageFirst: {
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
                    Right: (appsStorageResults) => ({
                      ..._.context._internalState,
                      restoredApps: mergeAppsStorageResults(
                        _.context._internalState.restoredApps,
                        appsStorageResults,
                      ),
                    }),
                  });
                },
              }),
              target: "CheckRestoreSecurityKeyAppStorageFirst",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckRestoreSecurityKeyAppStorageFirst: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "CheckOtherAppsToReinstall",
            },
          ],
        },
        CheckOtherAppsToReinstall: {
          always: [
            {
              guard: "hasOtherAppsToReinstall",
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
              applications: toApplicationDependencies(
                getOtherApps(context.input.backup.installedApps),
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
                    Left: (error) => {
                      if (isRefusedByUser(error)) {
                        return {
                          ..._.context._internalState,
                          appsToRestoreStorage: [],
                        };
                      }
                      if (isOutOfMemory(error)) {
                        return {
                          ..._.context._internalState,
                          isOutOfMemory: true,
                          appsToRestoreStorage: [],
                        };
                      }
                      return { ..._.context._internalState, error };
                    },
                    Right: (output) =>
                      applyInstallResult(
                        _.context._internalState,
                        getOtherApps(_.context.input.backup.installedApps),
                        output,
                      ),
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
              guard: "isOutOfMemory",
              target: "Success",
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
                    Right: (appsStorageResults) => ({
                      ..._.context._internalState,
                      restoredApps: mergeAppsStorageResults(
                        _.context._internalState.restoredApps,
                        appsStorageResults,
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
                intermediateValue: (_) => {
                  const { intermediateValue } = _.event.snapshot.context;
                  // With master consent granted, the user already approved the restore:
                  // do not forward the hardcoded confirm load/commit image
                  // interactions, but keep any other required interaction.
                  const shouldHideInteraction =
                    _.context._internalState.isMasterConsentGranted &&
                    (intermediateValue.requiredUserInteraction ===
                      UserInteractionRequired.ConfirmLoadImage ||
                      intermediateValue.requiredUserInteraction ===
                        UserInteractionRequired.ConfirmCommitImage);
                  return {
                    ...intermediateValue,
                    ...(shouldHideInteraction
                      ? {
                          requiredUserInteraction: UserInteractionRequired.None,
                        }
                      : {}),
                    step: _.context.intermediateValue.step,
                  };
                },
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
          restoreStatus: computeRestoreStatus(context._internalState),
          restoredLanguage: context._internalState.restoredLanguage,
          restoredCLS: context._internalState.restoredCLS,
          restoredApps: context._internalState.restoredApps,
        });
      },
    });
  }
}
