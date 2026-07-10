import {
  type DeviceActionStateMachine,
  hexaStringToBuffer,
  type InternalApi,
  isDashboardName,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { type BackupApp } from "@api/device-action/OsUpdate/Backup/types";
import { type InitRestoreAppStorageError } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";
import { commitRestoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/CommitRestoreAppStorage";
import { initRestoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/InitRestoreAppStorage";
import { restoreAppStorage } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/Substeps/RestoreAppStorage";
import {
  type BackupAppWithStorage,
  InitRestoreAppStorageConsentResult,
  type RestoreAppsStorageDAError,
  type RestoreAppsStorageDAInput,
  type RestoreAppsStorageDAIntermediateValue,
  type RestoreAppsStorageDAInternalState,
  type RestoreAppsStorageDAOutput,
  RestoreAppsStorageSteps,
} from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/types";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

const hasStorageData = (app: BackupApp): app is BackupAppWithStorage =>
  app.data !== undefined;

export class RestoreAppsStorageDeviceAction extends XStateDeviceAction<
  RestoreAppsStorageDAOutput,
  RestoreAppsStorageDAInput,
  RestoreAppsStorageDAError,
  RestoreAppsStorageDAIntermediateValue,
  RestoreAppsStorageDAInternalState
> {
  makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    RestoreAppsStorageDAOutput,
    RestoreAppsStorageDAInput,
    RestoreAppsStorageDAError,
    RestoreAppsStorageDAIntermediateValue,
    RestoreAppsStorageDAInternalState
  > {
    type types = StateMachineTypes<
      RestoreAppsStorageDAOutput,
      RestoreAppsStorageDAInput,
      RestoreAppsStorageDAError,
      RestoreAppsStorageDAIntermediateValue,
      RestoreAppsStorageDAInternalState
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
        initRestoreAppStorage: fromPromise(initRestoreAppStorage(internalAPI)),
        restoreAppStorage: fromPromise(
          restoreAppStorage(internalAPI, this.getLoggerFactory(internalAPI)),
        ),
        commitRestoreAppStorage: fromPromise(
          commitRestoreAppStorage(internalAPI),
        ),
      },
      guards: {
        isDeviceOnDashboard: ({ context }) =>
          isDashboardName(context._internalState.currentApp),
        hasError: ({ context }) => context._internalState.error !== null,
        hasMoreAppsWithStorage: ({ context }) =>
          context._internalState.appsWithStorage.length > 0 &&
          context._internalState.currentAppStorageIndex <
            context._internalState.appsWithStorage.length,
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
      id: "RestoreAppsStorageDeviceAction",
      initial: "WaitForAppAndVersion",
      context: ({ input }) => ({
        input: {
          backupApps: input.backupApps,
          unlockTimeout: input.unlockTimeout,
          isMasterConsentGranted: input.isMasterConsentGranted,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: RestoreAppsStorageSteps.Idle,
        },
        _internalState: {
          error: null,
          currentApp: null,
          appsWithStorage: [],
          currentAppStorageIndex: 0,
          currentAppStorageName: null,
          currentAppStorageDataBytes: null,
          currentAppStorageDataLength: null,
          restoreAppsStorageResult: [],
        },
      }),
      states: {
        WaitForAppAndVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreAppsStorageSteps.WaitForAppAndVersion,
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
                  return _.event.output.caseOf<RestoreAppsStorageDAInternalState>(
                    {
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                      Right: (output) => ({
                        ..._.context._internalState,
                        currentApp: output.name,
                      }),
                    },
                  );
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
              target: "FilterAppsWithStorage",
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
              step: RestoreAppsStorageSteps.GoToDashboard,
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
                  return _.event.output.caseOf<RestoreAppsStorageDAInternalState>(
                    {
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                      Right: () => _.context._internalState,
                    },
                  );
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
        FilterAppsWithStorage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreAppsStorageSteps.FilterAppsWithStorage,
            }),
            _internalState: (_) => ({
              ..._.context._internalState,
              appsWithStorage:
                _.context.input.backupApps.filter(hasStorageData),
            }),
          }),
          always: {
            target: "CheckIfThereIsAppWithStorage",
          },
        },
        CheckIfThereIsAppWithStorage: {
          always: [
            {
              guard: "hasMoreAppsWithStorage",
              target: "ExtractAppData",
            },
            {
              target: "Success",
            },
          ],
        },
        ExtractAppData: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreAppsStorageSteps.ExtractAppData,
            }),
            _internalState: (_) => {
              const currentAppWithStorage =
                _.context._internalState.appsWithStorage[
                  _.context._internalState.currentAppStorageIndex
                ]!;
              const currentAppStorageDataBytes =
                hexaStringToBuffer(currentAppWithStorage.data) ??
                new Uint8Array(0);
              return {
                ..._.context._internalState,
                currentAppStorageName: currentAppWithStorage.appName,
                currentAppStorageDataBytes,
                currentAppStorageDataLength: currentAppStorageDataBytes.length,
              };
            },
          }),
          always: {
            target: "InitRestoreAppStorage",
          },
        },
        InitRestoreAppStorage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreAppsStorageSteps.InitRestoreAppStorage,
              requiredUserInteraction: _.context.input.isMasterConsentGranted
                ? UserInteractionRequired.None
                : UserInteractionRequired.GrantConsent,
            }),
          }),
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            src: "initRestoreAppStorage",
            input: ({ context }) => ({
              appName: context._internalState.currentAppStorageName!,
              appStorageDataLength:
                context._internalState.currentAppStorageDataLength!,
            }),
            onDone: [
              {
                guard: ({ event }) => event.output.isLeft(),
                actions: assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    error: event.output.extract() as InitRestoreAppStorageError,
                  }),
                }),
                target: "Error",
              },
              {
                guard: ({ event }) =>
                  event.output.extract() ===
                  InitRestoreAppStorageConsentResult.REJECTED,
                actions: assign({
                  _internalState: ({ context }) => ({
                    ...context._internalState,
                    restoreAppsStorageResult: [
                      ...context._internalState.restoreAppsStorageResult,
                      {
                        appName: context._internalState.currentAppStorageName!,
                        restoredAppStorage: false,
                      },
                    ],
                    currentAppStorageIndex:
                      context._internalState.currentAppStorageIndex + 1,
                    currentAppStorageName: null,
                    currentAppStorageDataBytes: null,
                    currentAppStorageDataLength: null,
                  }),
                }),
                target: "CheckIfThereIsAppWithStorage",
              },
              {
                target: "RestoreAppStorage",
              },
            ],
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        RestoreAppStorage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreAppsStorageSteps.RestoreAppStorage,
            }),
          }),
          invoke: {
            src: "restoreAppStorage",
            input: ({ context }) => ({
              appStorageData:
                context._internalState.currentAppStorageDataBytes ??
                new Uint8Array(0),
            }),
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreAppsStorageDAInternalState>(
                    {
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                      Right: () => _.context._internalState,
                    },
                  );
                },
              }),
              target: "CheckRestoreAppStorage",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckRestoreAppStorage: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "CommitRestoreAppStorage",
            },
          ],
        },
        CommitRestoreAppStorage: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: RestoreAppsStorageSteps.CommitRestoreAppStorage,
            }),
          }),
          invoke: {
            src: "commitRestoreAppStorage",
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<RestoreAppsStorageDAInternalState>(
                    {
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                      Right: () => ({
                        ..._.context._internalState,
                        restoreAppsStorageResult: [
                          ..._.context._internalState.restoreAppsStorageResult,
                          {
                            appName:
                              _.context._internalState.currentAppStorageName!,
                            restoredAppStorage: true,
                          },
                        ],
                        currentAppStorageIndex:
                          _.context._internalState.currentAppStorageIndex + 1,
                        currentAppStorageName: null,
                        currentAppStorageDataBytes: null,
                        currentAppStorageDataLength: null,
                      }),
                    },
                  );
                },
              }),
              target: "CheckCommitRestoreAppStorage",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckCommitRestoreAppStorage: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "CheckIfThereIsAppWithStorage",
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
        return Right(context._internalState.restoreAppsStorageResult);
      },
    });
  }
}
