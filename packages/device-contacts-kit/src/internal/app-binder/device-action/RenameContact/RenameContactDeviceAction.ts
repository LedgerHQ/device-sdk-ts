import {
  type DeviceActionStateMachine,
  GetOsVersionCommand,
  type GetOsVersionCommandResult,
  GoToDashboardDeviceAction,
  type InternalApi,
  isSuccessCommandResult,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type RenameContactDAError,
  type RenameContactDAInput,
  type RenameContactDAIntermediateValue,
  type RenameContactDAInternalState,
  type RenameContactDAOutput,
} from "@api/app-binder/RenameContactDeviceActionTypes";
import { renameRequiresDerivationPath } from "@api/model/ContactsVersionRequirements";
import { isContactsOsVersionSupportedForSession } from "@internal/app-binder/contactsVersionGuards";
import { ContactsVersionRequirementError } from "@internal/app-binder/model/contactsErrors";
import {
  type RenameContactProof,
  SendRenameContactTask,
} from "@internal/app-binder/task/SendRenameContactTask";

import { validateRenameContactInput } from "./validateRenameContactInput";

export type RenameContactMachineDependencies = {
  readonly getOsVersion: () => Promise<GetOsVersionCommandResult>;
  readonly isOsVersionSupported: (osVersion: string) => boolean;
  readonly renameContact: (
    input: RenameContactDAInput,
    includeDerivationPath: boolean,
  ) => Promise<Awaited<ReturnType<SendRenameContactTask["run"]>>>;
};

export class RenameContactDeviceAction extends XStateDeviceAction<
  RenameContactDAOutput,
  RenameContactDAInput,
  RenameContactDAError,
  RenameContactDAIntermediateValue,
  RenameContactDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    RenameContactDAOutput,
    RenameContactDAInput,
    RenameContactDAError,
    RenameContactDAIntermediateValue,
    RenameContactDAInternalState
  > {
    type types = StateMachineTypes<
      RenameContactDAOutput,
      RenameContactDAInput,
      RenameContactDAError,
      RenameContactDAIntermediateValue,
      RenameContactDAInternalState
    >;

    const { getOsVersion, isOsVersionSupported, renameContact } =
      this.extractDependencies(internalApi);
    // Device model is stable for the session; the fresh OS version comes from
    // the GetOsVersion step. Together they decide whether the rename payload
    // must still carry the DERIVATION_PATH (DSDK-1481).
    const { deviceModelId } = internalApi.getDeviceSessionState();

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        // Rename is an OS/dashboard command: navigate to the dashboard (which
        // closes any running app) instead of opening an embedded app. There is
        // no OpenAppDeviceAction here by design.
        goToDashboardStateMachine: new GoToDashboardDeviceAction({
          input: {},
        }).makeStateMachine(internalApi),
        getOsVersion: fromPromise(getOsVersion),
        renameContact: fromPromise(
          ({
            input,
          }: {
            input: {
              args: RenameContactDAInput;
              includeDerivationPath: boolean;
            };
          }) => renameContact(input.args, input.includeDerivationPath),
        ),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        // Gate on the OS version read freshly via `GetOsVersion`, never the
        // session state. `osVersion` is populated by the GetOsVersion step
        // that precedes this guard; a command failure short-circuits to Error
        // before we get here, so a null here would be a machine-wiring bug.
        contactsOsSupported: ({ context }) => {
          const { osVersion } = context._internalState;
          return osVersion !== null && isOsVersionSupported(osVersion);
        },
      },
      actions: {
        assignValidationError: assign({
          _internalState: ({ context }) => {
            const error = validateRenameContactInput(context.input);
            return error
              ? { ...context._internalState, error }
              : context._internalState;
          },
        }),
        assignVersionError: assign({
          _internalState: ({ context }) => ({
            ...context._internalState,
            error: new ContactsVersionRequirementError(),
          }),
        }),
        assignErrorFromEvent: assign({
          _internalState: ({ context, event }) => ({
            ...context._internalState,
            error: new UnknownDAError(
              event["error"] instanceof Error
                ? event["error"].message
                : String(event["error"]),
            ),
          }),
        }),
      },
    }).createMachine({
      id: "RenameContactDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          osVersion: null,
          proof: null,
        },
      }),
      states: {
        InitialState: {
          always: { target: "GoToDashboard" },
        },
        // Always navigate to the dashboard first — rename is an OS command and
        // must not run inside an app. Closing any running app happens here.
        GoToDashboard: {
          invoke: {
            id: "goToDashboard",
            src: "goToDashboardStateMachine",
            input: () => ({}),
            onSnapshot: {
              actions: assign({
                // The child surfaces both requiredUserInteraction and a step;
                // only the interaction is part of this action's contract.
                intermediateValue: ({ event }) => ({
                  requiredUserInteraction:
                    event.snapshot.context.intermediateValue
                      .requiredUserInteraction,
                }),
              }),
            },
            onDone: {
              target: "GoToDashboardCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf<RenameContactDAInternalState>({
                    Right: () => context._internalState,
                    Left: (error) => ({ ...context._internalState, error }),
                  }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GoToDashboardCheck: {
          always: [
            { target: "ValidateInput", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // Input validation runs inside the device action so invalid caller input
        // surfaces as a typed terminal error state on the observable instead of
        // a synchronous throw.
        ValidateInput: {
          entry: "assignValidationError",
          always: [
            { target: "GetOsVersion", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // Read the OS version freshly from the device now that the dashboard
        // (BOLOS) is reached, so the version guard evaluates real firmware
        // rather than the session state — whose `firmwareVersion` is often
        // absent on this path (GoToDashboard re-reads only the running app).
        GetOsVersion: {
          // Clear the stale interaction GoToDashboard leaves behind (e.g.
          // UnlockDevice) so this internal command step asks the user for
          // nothing. This is the one `pending / none` step of the phase.
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "getOsVersion",
            src: "getOsVersion",
            onDone: {
              target: "GetOsVersionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        osVersion: event.output.data.seVersion,
                      }
                    : // A command failure surfaces as itself, never as a
                      // ContactsVersionRequirementError.
                      { ...context._internalState, error: event.output.error },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetOsVersionResultCheck: {
          always: [
            { target: "VersionGuard", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // OS-only version guard: rename is served by the device OS, so only the
        // device model and OS version are checked (no embedded-app version).
        // The OS version comes from the fresh GetOsVersion result above.
        VersionGuard: {
          always: [
            { target: "RenameContact", guard: "contactsOsSupported" },
            { target: "Error", actions: "assignVersionError" },
          ],
        },
        RenameContact: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.RegisterWallet,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "renameContact",
            src: "renameContact",
            input: ({ context }) => ({
              args: context.input,
              // Fresh OS version (from GetOsVersion) is guaranteed set here: a
              // null would have failed the VersionGuard before this state. The
              // ?? "" is a defensive no-path fallback that can never trigger.
              includeDerivationPath: renameRequiresDerivationPath(
                deviceModelId,
                context._internalState.osVersion ?? "",
              ),
            }),
            onDone: {
              target: "RenameContactResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? { ...context._internalState, proof: event.output.data }
                    : {
                        ...context._internalState,
                        error: event.output.error,
                      },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        RenameContactResultCheck: {
          always: [
            { target: "Success", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) => {
        const { proof, error } = context._internalState;
        if (proof) {
          const { input } = context;
          return Right({
            previousContactName: input.previousContactName,
            contactName: input.newContactName,
            groupHandle: input.groupHandle,
            hmacProof: proof.hmacProof,
          });
        }
        return Left(error ?? new UnknownDAError("No error in final state"));
      },
    });
  }

  extractDependencies(
    internalApi: InternalApi,
  ): RenameContactMachineDependencies {
    const getOsVersion = (): Promise<GetOsVersionCommandResult> =>
      internalApi.sendCommand(new GetOsVersionCommand());

    const isOsVersionSupported = (osVersion: string) =>
      isContactsOsVersionSupportedForSession(internalApi, osVersion);

    const renameContact = (
      input: RenameContactDAInput,
      includeDerivationPath: boolean,
    ): Promise<Awaited<ReturnType<SendRenameContactTask["run"]>>> =>
      new SendRenameContactTask(internalApi, {
        previousContactName: input.previousContactName,
        newContactName: input.newContactName,
        groupHandle: input.groupHandle,
        hmacProof: input.hmacProof,
        includeDerivationPath,
      }).run();

    return { getOsVersion, isOsVersionSupported, renameContact };
  }
}

export type { RenameContactProof };
