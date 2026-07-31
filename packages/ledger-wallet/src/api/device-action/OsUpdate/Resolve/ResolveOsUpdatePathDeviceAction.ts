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

import { goToDashboard } from "@api/device-action/OsUpdate/Shared/Substeps/GoToDashboard";
import { waitForAppAndVersion } from "@api/device-action/OsUpdate/Shared/Substeps/WaitForAppAndVersion";

import { getOsVersion } from "./Substeps/GetOsVersion";
import { resolveOsUpdatePath } from "./Substeps/ResolveOsUpdatePath";
import {
  type ResolveOsUpdatePathDAError,
  type ResolveOsUpdatePathDAInput,
  type ResolveOsUpdatePathDAIntermediateValue,
  type ResolveOsUpdatePathDAInternalState,
  type ResolveOsUpdatePathDAOutput,
  ResolveOsUpdatePathSteps,
} from "./types";

export class ResolveOsUpdatePathDeviceAction extends XStateDeviceAction<
  ResolveOsUpdatePathDAOutput,
  ResolveOsUpdatePathDAInput,
  ResolveOsUpdatePathDAError,
  ResolveOsUpdatePathDAIntermediateValue,
  ResolveOsUpdatePathDAInternalState
> {
  protected override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    ResolveOsUpdatePathDAOutput,
    ResolveOsUpdatePathDAInput,
    ResolveOsUpdatePathDAError,
    ResolveOsUpdatePathDAIntermediateValue,
    ResolveOsUpdatePathDAInternalState
  > {
    type types = StateMachineTypes<
      ResolveOsUpdatePathDAOutput,
      ResolveOsUpdatePathDAInput,
      ResolveOsUpdatePathDAError,
      ResolveOsUpdatePathDAIntermediateValue,
      ResolveOsUpdatePathDAInternalState
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
        getOsVersion: fromPromise(getOsVersion(internalApi)),
        resolveOsUpdatePath: fromPromise(resolveOsUpdatePath(internalApi)),
      },
      guards: {
        isDeviceOnDashboard: ({ context }) =>
          isDashboardName(context._internalState.currentApp),
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
      id: "ResolveOsUpdatePathDeviceAction",
      initial: "WaitForAppAndVersion",
      context: ({ input }) => ({
        input: {
          unlockTimeout: input.unlockTimeout,
        },
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: ResolveOsUpdatePathSteps.Idle,
        },
        _internalState: {
          error: null,
          currentApp: null,
          getOsVersionResponse: null,
          osUpdates: [],
        },
      }),
      states: {
        WaitForAppAndVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: ResolveOsUpdatePathSteps.WaitForAppAndVersion,
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
                  return _.event.output.caseOf<ResolveOsUpdatePathDAInternalState>(
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
              target: "GetOsVersion",
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
              step: ResolveOsUpdatePathSteps.GoToDashboard,
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
                  return _.event.output.caseOf<ResolveOsUpdatePathDAInternalState>(
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
        GetOsVersion: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: ResolveOsUpdatePathSteps.GetOsVersion,
            }),
          }),
          invoke: {
            src: "getOsVersion",
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<ResolveOsUpdatePathDAInternalState>(
                    {
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                      Right: (getOsVersionResponse) => ({
                        ..._.context._internalState,
                        getOsVersionResponse,
                      }),
                    },
                  );
                },
              }),
              target: "CheckGetOsVersion",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckGetOsVersion: {
          always: [
            {
              guard: "hasError",
              target: "Error",
            },
            {
              target: "ResolveOsUpdatePath",
            },
          ],
        },
        ResolveOsUpdatePath: {
          entry: assign({
            intermediateValue: (_) => ({
              ..._.context.intermediateValue,
              step: ResolveOsUpdatePathSteps.ResolveOsUpdatePath,
            }),
          }),
          invoke: {
            src: "resolveOsUpdatePath",
            input: ({ context }) => ({
              getOsVersionResponse:
                context._internalState.getOsVersionResponse!,
            }),
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<ResolveOsUpdatePathDAInternalState>(
                    {
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                      Right: (osUpdates) => ({
                        ..._.context._internalState,
                        osUpdates,
                      }),
                    },
                  );
                },
              }),
              target: "CheckResolveOsUpdatePath",
            },
            onError: {
              actions: "assignErrorFromEvent",
              target: "Error",
            },
          },
        },
        CheckResolveOsUpdatePath: {
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
          : Right(context._internalState.osUpdates),
    });
  }
}
