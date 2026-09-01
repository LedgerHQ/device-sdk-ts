import {
  type DeviceActionStateMachine,
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
import { isContactsOsSupportedForSession } from "@internal/app-binder/contactsVersionGuards";
import { ContactsVersionRequirementError } from "@internal/app-binder/model/contactsErrors";
import {
  type RenameContactProof,
  SendRenameContactTask,
} from "@internal/app-binder/task/SendRenameContactTask";

import { validateRenameContactInput } from "./validateRenameContactInput";

export type RenameContactMachineDependencies = {
  readonly isOsSupported: () => boolean;
  readonly renameContact: (
    input: RenameContactDAInput,
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

    const { isOsSupported, renameContact } =
      this.extractDependencies(internalApi);

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
        renameContact: fromPromise(
          ({ input }: { input: RenameContactDAInput }) => renameContact(input),
        ),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        contactsOsSupported: () => isOsSupported(),
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
            { target: "VersionGuard", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // OS-only version guard: rename is served by the device OS, so only the
        // device model and OS version are checked (no embedded-app version).
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
            input: ({ context }) => context.input,
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
    const isOsSupported = () => isContactsOsSupportedForSession(internalApi);

    const renameContact = (
      input: RenameContactDAInput,
    ): Promise<Awaited<ReturnType<SendRenameContactTask["run"]>>> =>
      new SendRenameContactTask(internalApi, {
        previousContactName: input.previousContactName,
        newContactName: input.newContactName,
        groupHandle: input.groupHandle,
        hmacProof: input.hmacProof,
      }).run();

    return { isOsSupported, renameContact };
  }
}

export type { RenameContactProof };
