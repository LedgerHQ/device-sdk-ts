import {
  type DeviceActionStateMachine,
  type InternalApi,
  isDashboardName,
  SecureChannelEventType,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { getOsVersion } from "@api/device-action/OsUpdate/Shared/Substeps/GetOsVersion";
import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

import { installFirmware } from "./Substeps/InstallFirmware";
import {
  type InstallOsUpdateDAError,
  type InstallOsUpdateDAInput,
  type InstallOsUpdateDAIntermediateValue,
  type InstallOsUpdateDAInternalState,
  InstallOsUpdateSteps,
} from "./types";

export class InstallOsUpdateDeviceAction extends XStateDeviceAction<
  void,
  InstallOsUpdateDAInput,
  InstallOsUpdateDAError,
  InstallOsUpdateDAIntermediateValue,
  InstallOsUpdateDAInternalState
> {
  protected override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    void,
    InstallOsUpdateDAInput,
    InstallOsUpdateDAError,
    InstallOsUpdateDAIntermediateValue,
    InstallOsUpdateDAInternalState
  > {
    type types = StateMachineTypes<
      void,
      InstallOsUpdateDAInput,
      InstallOsUpdateDAError,
      InstallOsUpdateDAIntermediateValue,
      InstallOsUpdateDAInternalState
    >;

    return setup({
      types: {
        input: {} as types["input"],
        output: {} as types["output"],
        context: {} as types["context"],
      } as types,
      actors: {
        waitForAppAndVersion: waitForAppAndVersion(
          internalApi,
          this.input.unlockTimeout,
        ),
        goToDashboard: goToDashboard(internalApi, this.input.unlockTimeout),
        getDeviceInfo: fromPromise(getOsVersion(internalApi)),
        installFirmware: fromObservable(installFirmware(internalApi)),
      },
      guards: {
        isDeviceOnDashboard: ({ context }) =>
          isDashboardName(context._internalState.currentApp),
        isDeviceInOsuMode: ({ context }) =>
          context._internalState.deviceInfo?.isOsu === true,
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
      id: "InstallOsUpdateDeviceAction",
      initial: "WaitForAppAndVersion",
      context: ({ input }) => ({
        input: {
          osUpdate: input.osUpdate,
          unlockTimeout: input.unlockTimeout,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: InstallOsUpdateSteps.Idle,
        },
        _internalState: {
          error: null,
          currentApp: null,
          deviceInfo: null,
        },
      }),
      states: {
        WaitForAppAndVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: InstallOsUpdateSteps.WaitForAppAndVersion,
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
                _internalState: (_) =>
                  _.event.output.caseOf<InstallOsUpdateDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (getAppAndVersionResponse) => ({
                      ..._.context._internalState,
                      currentApp: getAppAndVersionResponse.name,
                    }),
                  }),
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
              target: "GetDeviceInfo",
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
              step: InstallOsUpdateSteps.GoToDashboard,
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
                _internalState: (_) =>
                  _.event.output.caseOf<InstallOsUpdateDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: () => _.context._internalState,
                  }),
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
        GetDeviceInfo: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: InstallOsUpdateSteps.GetDeviceInfo,
            }),
          }),
          invoke: {
            src: "getDeviceInfo",
            onDone: {
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<InstallOsUpdateDAInternalState>({
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                    Right: (getOsVersionResponse) => ({
                      ..._.context._internalState,
                      deviceInfo: getOsVersionResponse,
                    }),
                  }),
              }),
              target: "CheckGetDeviceInfo",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckGetDeviceInfo: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              guard: "isDeviceInOsuMode",
              target: "InstallFinalFirmware",
            },
            {
              target: "InstallOsuFirmware",
            },
          ],
        },
        InstallOsuFirmware: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: InstallOsUpdateSteps.InstallFirmware,
            }),
          }),
          invoke: {
            id: "installOsuFirmware",
            src: "installFirmware",
            input: ({ context }) => {
              const { osuFirmware } = context.input.osUpdate;
              return {
                deviceInfo: context._internalState.deviceInfo!,
                firmware: {
                  perso: osuFirmware.perso,
                  firmware: osuFirmware.firmware,
                  firmwareKey: osuFirmware.firmwareKey,
                },
              };
            },
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => {
                  switch (_.event.snapshot.context?.type) {
                    case SecureChannelEventType.PermissionRequested:
                      return {
                        ..._.context.intermediateValue,
                        requiredUserInteraction:
                          UserInteractionRequired.AllowSecureConnection,
                      };
                    case SecureChannelEventType.PermissionGranted:
                      return {
                        ..._.context.intermediateValue,
                        requiredUserInteraction: UserInteractionRequired.None,
                      };
                    case SecureChannelEventType.Progress: {
                      const { progress, index, total } =
                        _.event.snapshot.context.payload;

                      let requiredUserInteraction =
                        _.context.intermediateValue.requiredUserInteraction;

                      // The penultimate APDU of the bulk transfer blocks on a device
                      // confirmation before the install can complete.
                      if (index === total - 2) {
                        requiredUserInteraction =
                          UserInteractionRequired.AllowInstallFirmware;
                      }

                      if (index === total - 1) {
                        requiredUserInteraction = UserInteractionRequired.None;
                      }

                      return {
                        ..._.context.intermediateValue,
                        progress,
                        requiredUserInteraction,
                      };
                    }
                    default:
                      return { ..._.context.intermediateValue };
                  }
                },
                _internalState: (_) => {
                  if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Error
                  ) {
                    return {
                      ..._.context._internalState,
                      error:
                        _.event.snapshot.context.error.mapUpdateFirmwareDAErrors(),
                    };
                  }
                  return _.context._internalState;
                },
              }),
            },
            onDone: {
              target: "CheckInstallFirmware",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
          exit: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
        },
        InstallFinalFirmware: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: InstallOsUpdateSteps.InstallFirmware,
            }),
          }),
          invoke: {
            id: "installFinalFirmware",
            src: "installFirmware",
            input: ({ context }) => {
              const { finalFirmware } = context.input.osUpdate;
              return {
                deviceInfo: context._internalState.deviceInfo!,
                firmware: {
                  perso: finalFirmware.perso,
                  firmware: finalFirmware.firmware!,
                  firmwareKey: finalFirmware.firmwareKey!,
                },
              };
            },
            onSnapshot: {
              actions: assign({
                // The device already granted the secure connection before
                // rebooting into the OSU, and the final firmware installs
                // without any further confirmation, so the bulk exchange only
                // reports progress here.
                intermediateValue: (_) =>
                  _.event.snapshot.context?.type ===
                  SecureChannelEventType.Progress
                    ? {
                        ..._.context.intermediateValue,
                        progress: _.event.snapshot.context.payload.progress,
                      }
                    : { ..._.context.intermediateValue },
                _internalState: (_) => {
                  if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Error
                  ) {
                    return {
                      ..._.context._internalState,
                      error:
                        _.event.snapshot.context.error.mapUpdateFirmwareDAErrors(),
                    };
                  }
                  return _.context._internalState;
                },
              }),
            },
            onDone: {
              target: "CheckInstallFirmware",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckInstallFirmware: {
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
      output: ({ context }) =>
        context._internalState.error !== null
          ? Left(context._internalState.error)
          : Right(undefined),
    });
  }
}
