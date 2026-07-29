import {
  type DeviceActionStateMachine,
  type InternalApi,
  isDashboardName,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { isCustomLockScreenSupported } from "@api/customLockScreenUtils/screenSpecs";
import { NoCustomLockScreenImageDAError } from "@api/device-action/customLockScreenDeviceActionErrors";
import { deleteLanguagePack } from "@api/device-action/OsUpdate/CleanDevice/Substeps/DeleteLanguagePack";
import { getCustomLockScreenInfo } from "@api/device-action/OsUpdate/CleanDevice/Substeps/GetCustomLockScreenInfo";
import { removeCustomLockScreen } from "@api/device-action/OsUpdate/CleanDevice/Substeps/RemoveCustomLockScreen";
import { uninstallApp } from "@api/device-action/OsUpdate/CleanDevice/Substeps/UninstallApp";
import {
  type CleanDeviceDAError,
  type CleanDeviceDAInput,
  type CleanDeviceDAIntermediateValue,
  type CleanDeviceDAInternalState,
  type CleanDeviceDAOutput,
  CleanDeviceSteps,
} from "@api/device-action/OsUpdate/CleanDevice/types";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { listInstalledApps } from "@api/device-action/OsUpdate/Shared/Substeps/ListInstalledApps";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

export class CleanDeviceDeviceAction extends XStateDeviceAction<
  CleanDeviceDAOutput,
  CleanDeviceDAInput,
  CleanDeviceDAError,
  CleanDeviceDAIntermediateValue,
  CleanDeviceDAInternalState
> {
  protected override makeStateMachine(
    internalAPI: InternalApi,
  ): DeviceActionStateMachine<
    CleanDeviceDAOutput,
    CleanDeviceDAInput,
    CleanDeviceDAError,
    CleanDeviceDAIntermediateValue,
    CleanDeviceDAInternalState
  > {
    type types = StateMachineTypes<
      CleanDeviceDAOutput,
      CleanDeviceDAInput,
      CleanDeviceDAError,
      CleanDeviceDAIntermediateValue,
      CleanDeviceDAInternalState
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
        listInstalledApps: listInstalledApps(
          internalAPI,
          this.input.unlockTimeout,
        ),
        uninstallApp: uninstallApp(internalAPI, this.input.unlockTimeout),
        deleteLanguagePack: fromPromise(deleteLanguagePack(internalAPI)),
        getCustomLockScreenInfo: getCustomLockScreenInfo(
          internalAPI,
          this.input.unlockTimeout,
        ),
        removeCustomLockScreen: removeCustomLockScreen(
          internalAPI,
          this.input.unlockTimeout,
        ),
      },
      guards: {
        isDeviceOnDashboard: ({ context }) =>
          isDashboardName(context._internalState.currentApp),
        hasError: ({ context }) => context._internalState.error !== null,
        hasMoreAppsToUninstall: ({ context }) =>
          context._internalState.currentAppIndex <
          context._internalState.installedApps.length,
        isCustomLockScreenFeatureSupported: () =>
          isCustomLockScreenSupported(internalAPI.getDeviceModel().id),
        hasCustomLockScreen: ({ context }) =>
          context._internalState.hasCustomLockScreen,
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
      id: "CleanDeviceDeviceAction",
      initial: "WaitForAppAndVersion",
      context: ({ input }) => ({
        input: {
          unlockTimeout: input.unlockTimeout,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: CleanDeviceSteps.Idle,
        },
        _internalState: {
          error: null,
          currentApp: null,
          installedApps: [],
          currentAppIndex: 0,
          uninstalledApps: [] as string[],
          languagePackRemoved: undefined,
          customLockScreenRemoved: undefined,
          hasCustomLockScreen: false,
        },
      }),
      states: {
        WaitForAppAndVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CleanDeviceSteps.WaitForAppAndVersion,
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
                  return _.event.output.caseOf<CleanDeviceDAInternalState>({
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
              target: "ListInstalledApps",
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
              step: CleanDeviceSteps.GoToDashboard,
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
                  return _.event.output.caseOf<CleanDeviceDAInternalState>({
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
        ListInstalledApps: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CleanDeviceSteps.ListInstalledApps,
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
                  return _.event.output.caseOf<CleanDeviceDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (output) => ({
                      ..._.context._internalState,
                      installedApps: output.installedApps.filter(
                        (app) => app.name !== "",
                      ),
                      currentAppIndex: 0,
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
              target: "CheckIfThereAreMoreAppsToUninstall",
            },
          ],
        },
        CheckIfThereAreMoreAppsToUninstall: {
          always: [
            {
              guard: "hasMoreAppsToUninstall",
              target: "UninstallApp",
            },
            {
              target: "DeleteLanguagePack",
            },
          ],
        },
        UninstallApp: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CleanDeviceSteps.UninstallApps,
            }),
          }),
          invoke: {
            src: "uninstallApp",
            input: ({ context }) => ({
              unlockTimeout: context.input.unlockTimeout,
              appName:
                context._internalState.installedApps[
                  context._internalState.currentAppIndex
                ]!.name,
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
                  return _.event.output.caseOf<CleanDeviceDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: () => ({
                      ..._.context._internalState,
                      currentAppIndex:
                        _.context._internalState.currentAppIndex + 1,
                    }),
                  });
                },
              }),
              target: "CheckUninstallApp",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckUninstallApp: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "CheckIfThereAreMoreAppsToUninstall",
            },
          ],
        },
        DeleteLanguagePack: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CleanDeviceSteps.DeleteLanguagePack,
            }),
          }),
          invoke: {
            src: "deleteLanguagePack",
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<CleanDeviceDAInternalState>({
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
              target: "CheckDeleteLanguagePack",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckDeleteLanguagePack: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "CheckIfDeviceSupportsCustomLockScreenFeature",
            },
          ],
        },
        CheckIfDeviceSupportsCustomLockScreenFeature: {
          always: [
            {
              guard: "isCustomLockScreenFeatureSupported",
              target: "GetCustomLockScreenInfo",
            },
            {
              target: "Success",
            },
          ],
        },
        GetCustomLockScreenInfo: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CleanDeviceSteps.GetCustomLockScreenInfo,
            }),
          }),
          invoke: {
            src: "getCustomLockScreenInfo",
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
                  return _.event.output.caseOf<CleanDeviceDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (output) => ({
                      ..._.context._internalState,
                      hasCustomLockScreen: output.hasCustomLockScreen,
                    }),
                  });
                },
              }),
              target: "CheckGetCustomLockScreenInfo",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckGetCustomLockScreenInfo: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "hasCustomLockScreen",
              target: "RemoveCustomLockScreen",
            },
            {
              target: "Success",
            },
          ],
        },
        RemoveCustomLockScreen: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: CleanDeviceSteps.RemoveCustomLockScreen,
            }),
          }),
          invoke: {
            src: "removeCustomLockScreen",
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
                  return _.event.output.caseOf<CleanDeviceDAInternalState>({
                    Left: (error) =>
                      error instanceof NoCustomLockScreenImageDAError
                        ? {
                            ..._.context._internalState,
                            customLockScreenRemoved: true,
                          }
                        : {
                            ..._.context._internalState,
                            error,
                          },
                    Right: () => ({
                      ..._.context._internalState,
                    }),
                  });
                },
              }),
              target: "CheckRemoveCustomLockScreen",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckRemoveCustomLockScreen: {
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
        Success: { type: "final" },
        Error: { type: "final" },
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
