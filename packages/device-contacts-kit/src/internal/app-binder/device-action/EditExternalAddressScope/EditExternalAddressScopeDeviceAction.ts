import {
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  WaitForAppAndVersionDeviceAction,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type EditExternalAddressScopeDAError,
  type EditExternalAddressScopeDAInput,
  type EditExternalAddressScopeDAIntermediateValue,
  type EditExternalAddressScopeDAInternalState,
  type EditExternalAddressScopeDAOutput,
} from "@api/app-binder/EditExternalAddressScopeDeviceActionTypes";
import {
  isContactsAppVersionSupportedForSession,
  type RunningApp,
} from "@internal/app-binder/contactsVersionGuards";
import { ContactsVersionRequirementError } from "@internal/app-binder/model/contactsErrors";
import {
  type EditScopeProof,
  SendEditExternalAddressScopeTask,
} from "@internal/app-binder/task/SendEditExternalAddressScopeTask";

import { validateEditExternalAddressScopeInput } from "./validateEditExternalAddressScopeInput";

export type EditExternalAddressScopeMachineDependencies = {
  readonly isSupported: (app: RunningApp) => boolean;
  readonly editScope: (
    input: EditExternalAddressScopeDAInput,
  ) => Promise<Awaited<ReturnType<SendEditExternalAddressScopeTask["run"]>>>;
};

export class EditExternalAddressScopeDeviceAction extends XStateDeviceAction<
  EditExternalAddressScopeDAOutput,
  EditExternalAddressScopeDAInput,
  EditExternalAddressScopeDAError,
  EditExternalAddressScopeDAIntermediateValue,
  EditExternalAddressScopeDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    EditExternalAddressScopeDAOutput,
    EditExternalAddressScopeDAInput,
    EditExternalAddressScopeDAError,
    EditExternalAddressScopeDAIntermediateValue,
    EditExternalAddressScopeDAInternalState
  > {
    type types = StateMachineTypes<
      EditExternalAddressScopeDAOutput,
      EditExternalAddressScopeDAInput,
      EditExternalAddressScopeDAError,
      EditExternalAddressScopeDAIntermediateValue,
      EditExternalAddressScopeDAInternalState
    >;

    const { isSupported, editScope } = this.extractDependencies(internalApi);
    const appName = this.input.appName;

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName },
        }).makeStateMachine(internalApi),
        waitForAppAndVersionStateMachine: new WaitForAppAndVersionDeviceAction({
          input: {},
        }).makeStateMachine(internalApi),
        editScope: fromPromise(
          ({ input }: { input: EditExternalAddressScopeDAInput }) =>
            editScope(input),
        ),
      },
      guards: {
        skipOpenApp: ({ context }) => context.input.skipOpenApp === true,
        noInternalError: ({ context }) => context._internalState.error === null,
        contactsSupported: ({ context }) => {
          const { appAndVersion } = context._internalState;
          return appAndVersion !== null && isSupported(appAndVersion);
        },
      },
      actions: {
        assignValidationError: assign({
          _internalState: ({ context }) => {
            const error = validateEditExternalAddressScopeInput(context.input);
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
      id: "EditExternalAddressScopeDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          appAndVersion: null,
          hmacRest: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "ValidateInput", guard: "skipOpenApp" },
            { target: "OpenAppDeviceAction" },
          ],
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: () => ({ appName }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "CheckOpenAppResult",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf<EditExternalAddressScopeDAInternalState>({
                    Right: () => context._internalState,
                    Left: (error) => ({ ...context._internalState, error }),
                  }),
              }),
            },
          },
        },
        CheckOpenAppResult: {
          always: [
            { target: "ValidateInput", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // Input validation runs inside the device action (after the app is
        // opened) so invalid caller input surfaces as a typed terminal error
        // state on the observable instead of a synchronous throw. Runs on both
        // the open-app and skip-open-app paths.
        ValidateInput: {
          entry: "assignValidationError",
          always: [
            { target: "WaitForAppAndVersion", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // Read the running app + version freshly from the device (rather than
        // the possibly-stale session state) so the version guard evaluates the
        // app that is actually running — e.g. when open-app is skipped and the
        // app was changed outside DMK. Runs on both paths.
        WaitForAppAndVersion: {
          // Start the phase from a clean value, clearing any interaction left
          // over from the OpenApp phase (e.g. ConfirmOpenApp).
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "waitForAppAndVersion",
            src: "waitForAppAndVersionStateMachine",
            input: () => ({}),
            // Propagate the child DA's intermediate value so a consuming client
            // can render, e.g., a "please unlock your device" prompt when the
            // device is locked. Mirrors the OpenAppDeviceAction invoke above.
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "CheckAppAndVersion",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf<EditExternalAddressScopeDAInternalState>({
                    Right: (appAndVersion) => ({
                      ...context._internalState,
                      appAndVersion: {
                        name: appAndVersion.name,
                        version: appAndVersion.version,
                      },
                    }),
                    Left: (error) => ({ ...context._internalState, error }),
                  }),
              }),
            },
          },
        },
        CheckAppAndVersion: {
          always: [
            { target: "VersionGuard", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // Version guard evaluates support from the fresh WaitForAppAndVersion
        // result. Runs on both the open-app and skip-open-app paths.
        VersionGuard: {
          always: [
            { target: "EditScope", guard: "contactsSupported" },
            { target: "Error", actions: "assignVersionError" },
          ],
        },
        EditScope: {
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
            id: "editScope",
            src: "editScope",
            input: ({ context }) => context.input,
            onDone: {
              target: "EditScopeResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        hmacRest: event.output.data.hmacRest,
                      }
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
        EditScopeResultCheck: {
          always: [
            { target: "Success", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) => {
        const { hmacRest, error } = context._internalState;
        if (hmacRest) {
          const { input } = context;
          return Right({
            contactName: input.contactName,
            previousScope: input.previousScope,
            scope: input.newScope,
            identifier: input.identifier,
            blockchainFamily: input.blockchainFamily,
            chainId: input.chainId,
            groupHandle: input.groupHandle,
            // Preserved: the group-level name proof is untouched by a scope
            // edit — only `hmacRest` (the address-level proof) rotates.
            hmacProof: input.hmacProof,
            hmacRest,
          });
        }
        return Left(error ?? new UnknownDAError("No error in final state"));
      },
    });
  }

  extractDependencies(
    internalApi: InternalApi,
  ): EditExternalAddressScopeMachineDependencies {
    const isSupported = (app: RunningApp) =>
      isContactsAppVersionSupportedForSession(internalApi, app);

    const editScope = (
      input: EditExternalAddressScopeDAInput,
    ): Promise<Awaited<ReturnType<SendEditExternalAddressScopeTask["run"]>>> =>
      new SendEditExternalAddressScopeTask(internalApi, {
        contactName: input.contactName,
        previousScope: input.previousScope,
        newScope: input.newScope,
        identifier: input.identifier,
        blockchainFamily: input.blockchainFamily,
        chainId: input.chainId,
        groupHandle: input.groupHandle,
        hmacProof: input.hmacProof,
        hmacRest: input.hmacRest,
      }).run();

    return { isSupported, editScope };
  }
}

export type { EditScopeProof };
