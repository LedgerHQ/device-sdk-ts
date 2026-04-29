import {
  bufferToHexaString,
  type DeviceActionStateMachine,
  DeviceModelId,
  type InternalApi,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { DeviceBackupStorage } from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorage";
import { backupAppsStorage } from "@api/device-action/OsUpdate/Backup/Substeps/BackupAppsStorage";
import { downloadCustomLockScreenDevice } from "@api/device-action/OsUpdate/Backup/Substeps/DownloadCustomLockScreen";
import { getLanguageId } from "@api/device-action/OsUpdate/Backup/Substeps/GetLanguageId";
import { listInstalledApps } from "@api/device-action/OsUpdate/Backup/Substeps/ListInstalledApps";
import { lookForBackup } from "@api/device-action/OsUpdate/Backup/Substeps/LookForBackup";
import { saveBackup } from "@api/device-action/OsUpdate/Backup/Substeps/SaveBackup";
import {
  type BackupDAError,
  type BackupDAInput,
  type BackupDAIntermediateValue,
  type BackupDAInternalState,
  type BackupDAOutput,
  BackupSteps,
} from "@api/device-action/OsUpdate/Backup/types";

export class BackupDeviceAction extends XStateDeviceAction<
  BackupDAOutput,
  BackupDAInput,
  BackupDAError,
  BackupDAIntermediateValue,
  BackupDAInternalState
> {
  protected override makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    BackupDAOutput,
    BackupDAInput,
    BackupDAError,
    BackupDAIntermediateValue,
    BackupDAInternalState
  > {
    type types = StateMachineTypes<
      BackupDAOutput,
      BackupDAInput,
      BackupDAError,
      BackupDAIntermediateValue,
      BackupDAInternalState
    >;

    const { storage } = this.input;
    const deviceBackupStorage = new DeviceBackupStorage(storage);

    return setup({
      types: {
        input: {} as types["input"],
        output: {} as types["output"],
        context: {} as types["context"],
      } as types,
      actors: {
        lookForBackup: fromPromise(lookForBackup(deviceBackupStorage)),
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
        saveBackup: fromPromise(saveBackup(deviceBackupStorage)),
      },
      guards: {
        hasBackup: ({ context }) =>
          context._internalState.backupAlreadyExist === true,
        isDeviceOnboarded: ({ context }) => context.input.isDeviceOnboarded,
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
      id: "BackupDeviceAction",
      initial: "LookForBackup",
      context: ({ input }) => ({
        input: {
          isDeviceOnboarded: input.isDeviceOnboarded,
          deviceId: input.deviceId,
          storage: input.storage,
          unlockTimeout: input.unlockTimeout,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: BackupSteps.Idle,
        },
        _internalState: {
          error: null,
          languageId: undefined,
          installedApps: [],
          backupApps: [],
          clsHexImage: undefined,
          backupAlreadyExist: false,
        },
      }),
      states: {
        LookForBackup: {
          invoke: {
            src: "lookForBackup",
            input: ({ context }) => ({
              deviceId: context.input.deviceId,
            }),
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<BackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (backupAlreadyExist) => ({
                      ..._.context._internalState,
                      backupAlreadyExist,
                    }),
                  });
                },
              }),
              target: "CheckIfBackupExist",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckIfBackupExist: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "hasBackup",
              target: "Success",
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
              step: BackupSteps.GetLanguage,
            }),
          }),
          invoke: {
            src: "getLanguageId",
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<BackupDAInternalState>({
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
              target: "ListInstalledApps",
            },
            {
              target: "SaveBackup",
            },
          ],
        },
        ListInstalledApps: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: BackupSteps.ListInstalledApps,
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
                  return _.event.output.caseOf<BackupDAInternalState>({
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
              target: "BackupAppsStorage",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        BackupAppsStorage: {
          always: {
            guard: "hasError",
            target: "Error",
          },
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: BackupSteps.BackupAppsStorage,
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
                  return _.event.output.caseOf<BackupDAInternalState>({
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
              target: "CheckIfDeviceSupportCustomLockScreenFeature",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckIfDeviceSupportCustomLockScreenFeature: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isCustomLockScreenFeatureSupported",
              target: "DownloadCustomLockScreen",
            },
            {
              target: "SaveBackup",
            },
          ],
        },
        DownloadCustomLockScreen: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: BackupSteps.DownloadCustomLockScreen,
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
                  return _.event.output.caseOf<BackupDAInternalState>({
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
              target: "SaveBackup",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        SaveBackup: {
          always: {
            guard: "hasError",
            target: "Error",
          },
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: BackupSteps.SaveBackup,
            }),
          }),
          invoke: {
            src: "saveBackup",
            input: ({ context }) => ({
              deviceId: context.input.deviceId,
              backup: {
                languageId: context._internalState.languageId,
                installedApps: context._internalState.backupApps,
                clsHexImage: context._internalState.clsHexImage,
                createdAt: new Date(),
              },
            }),
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<BackupDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: () => ({
                      ..._.context._internalState,
                    }),
                  });
                },
              }),
              target: "CheckSaveBackup",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckSaveBackup: {
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
        return Right(undefined);
      },
    });
  }
}
