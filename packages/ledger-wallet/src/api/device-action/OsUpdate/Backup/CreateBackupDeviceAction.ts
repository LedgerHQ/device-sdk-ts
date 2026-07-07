import {
  bufferToHexaString,
  type DeviceActionStateMachine,
  DeviceModelId,
  type InternalApi,
  isDashboardName,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { backupAppsStorage } from "@api/device-action/OsUpdate/Backup/Substeps/BackupAppsStorage";
import { downloadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Backup/Substeps/DownloadCustomLockScreen";
import { getIsOnboarded } from "@api/device-action/OsUpdate/Backup/Substeps/GetIsOnboarded";
import { getLanguageId } from "@api/device-action/OsUpdate/Backup/Substeps/GetLanguageId";
import { goToDashboard } from "@api/device-action/OsUpdate/Backup/Substeps/GoToDashboard";
import { listInstalledApps } from "@api/device-action/OsUpdate/Backup/Substeps/ListInstalledApps";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Backup/Substeps/WaitForAppAndVersion";
import {
  type CreateBackupDAError,
  type CreateBackupDAInput,
  type CreateBackupDAIntermediateValue,
  type CreateBackupDAInternalState,
  type CreateBackupDAOutput,
  CreateBackupSteps,
} from "@api/device-action/OsUpdate/Backup/types";

export class CreateBackupDeviceAction extends XStateDeviceAction<
  CreateBackupDAOutput,
  CreateBackupDAInput,
  CreateBackupDAError,
  CreateBackupDAIntermediateValue,
  CreateBackupDAInternalState
> {
  protected override makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    CreateBackupDAOutput,
    CreateBackupDAInput,
    CreateBackupDAError,
    CreateBackupDAIntermediateValue,
    CreateBackupDAInternalState
  > {
    type types = StateMachineTypes<
      CreateBackupDAOutput,
      CreateBackupDAInput,
      CreateBackupDAError,
      CreateBackupDAIntermediateValue,
      CreateBackupDAInternalState
    >;

    return setup({
      types: {
        input: {} as types["input"],
        output: {} as types["output"],
        context: {} as types["context"],
      } as types,
      actors: {
        waitForAppAndVersion: waitForAppAndVersion(
          internalAPI,
          this.input.unlockTimeout,
        ),
        goToDashboard: goToDashboard(internalAPI, this.input.unlockTimeout),
        getIsOnboarded: fromPromise(getIsOnboarded(internalAPI)),
        getLanguageId: fromPromise(getLanguageId(internalAPI)),
        listInstalledApps: listInstalledApps(
          internalAPI,
          this.input.unlockTimeout,
        ),
        downloadCustomLockScreen: downloadCustomLockScreenDevice(
          internalAPI,
          this.input.unlockTimeout,
          true,
        ),
        backupAppsStorage: fromPromise(
          backupAppsStorage(internalAPI, this.getLoggerFactory(internalAPI)),
        ),
      },
      guards: {
        isDeviceOnDashboard: ({ context }) =>
          isDashboardName(context._internalState.currentApp),
        isDeviceOnboarded: ({ context }) =>
          context._internalState.isDeviceOnboarded,
        isCustomLockScreenFeatureSupported: () =>
          [DeviceModelId.APEX, DeviceModelId.FLEX, DeviceModelId.STAX].includes(
            internalAPI.getDeviceModel().id,
          ),
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
      id: "CreateBackupDeviceAction",
      initial: "WaitForAppAndVersion",
      context: ({ input }) => ({
        input: {
          unlockTimeout: input.unlockTimeout,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: CreateBackupSteps.Idle,
        },
        _internalState: {
          error: null,
          currentApp: null,
          isDeviceOnboarded: false,
          languageId: undefined,
          installedApps: [],
          backupApps: [],
          clsHexImage: undefined,
        },
      }),
      states: {
        WaitForAppAndVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CreateBackupSteps.WaitForAppAndVersion,
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
                  return _.event.output.caseOf<CreateBackupDAInternalState>({
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
              step: CreateBackupSteps.GoToDashboard,
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
                  return _.event.output.caseOf<CreateBackupDAInternalState>({
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
              step: CreateBackupSteps.GetIsOnboarded,
            }),
          }),
          invoke: {
            src: "getIsOnboarded",
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<CreateBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (isDeviceOnboarded) => ({
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
              target: "GetLanguage",
            },
          ],
        },
        GetLanguage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CreateBackupSteps.GetLanguage,
            }),
          }),
          invoke: {
            src: "getLanguageId",
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<CreateBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (languageId) => ({
                      ..._.context._internalState,
                      languageId,
                    }),
                  });
                },
              }),
              target: "CheckGetLanguage",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckGetLanguage: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "CheckIfDeviceIsOnboarded",
            },
          ],
        },
        CheckIfDeviceIsOnboarded: {
          always: [
            {
              guard: "isDeviceOnboarded",
              target: "ListInstalledApps",
            },
            {
              target: "Success",
            },
          ],
        },
        ListInstalledApps: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CreateBackupSteps.ListInstalledApps,
            }),
          }),
          invoke: {
            src: "listInstalledApps",
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
                  return _.event.output.caseOf<CreateBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (output) => ({
                      ..._.context._internalState,
                      installedApps: output.installedApps.filter(
                        (app) => app.name !== "",
                      ),
                    }),
                  });
                },
              }),
              target: "CheckListInstalledApps",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckListInstalledApps: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "BackupAppsStorage",
            },
          ],
        },
        BackupAppsStorage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CreateBackupSteps.BackupAppsStorage,
            }),
          }),
          invoke: {
            src: "backupAppsStorage",
            input: ({ context }) => ({
              installedApps: context._internalState.installedApps,
            }),
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<CreateBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (backupApps) => ({
                      ..._.context._internalState,
                      backupApps,
                    }),
                  });
                },
              }),
              target: "CheckBackupAppsStorage",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckBackupAppsStorage: {
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
              target: "DownloadCustomLockScreen",
            },
            {
              target: "Success",
            },
          ],
        },
        DownloadCustomLockScreen: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CreateBackupSteps.DownloadCustomLockScreen,
            }),
          }),
          invoke: {
            src: "downloadCustomLockScreen",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
              allowedEmpty: true,
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
                  return _.event.output.caseOf<CreateBackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (output) => ({
                      ..._.context._internalState,
                      clsHexImage:
                        "imageData" in output && output.imageData.length > 0
                          ? bufferToHexaString(output.imageData, true)
                          : undefined,
                    }),
                  });
                },
              }),
              target: "CheckDownloadCustomLockScreen",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckDownloadCustomLockScreen: {
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
          languageId: context._internalState.languageId,
          installedApps: context._internalState.backupApps,
          clsHexImage: context._internalState.clsHexImage,
          createdAt: new Date(),
        });
      },
    });
  }
}
