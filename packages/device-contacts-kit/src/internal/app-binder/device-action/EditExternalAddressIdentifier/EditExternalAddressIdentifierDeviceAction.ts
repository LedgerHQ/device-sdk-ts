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
  type EditExternalAddressIdentifierDAError,
  type EditExternalAddressIdentifierDAInput,
  type EditExternalAddressIdentifierDAIntermediateValue,
  type EditExternalAddressIdentifierDAInternalState,
  type EditExternalAddressIdentifierDAOutput,
} from "@api/app-binder/EditExternalAddressIdentifierDeviceActionTypes";
import {
  isContactsAppVersionSupportedForSession,
  type RunningApp,
} from "@internal/app-binder/contactsVersionGuards";
import { ContactsVersionRequirementError } from "@internal/app-binder/model/contactsErrors";
import {
  type EditIdentifierProof,
  SendEditExternalAddressIdentifierTask,
} from "@internal/app-binder/task/SendEditExternalAddressIdentifierTask";

import { validateEditExternalAddressIdentifierInput } from "./validateEditExternalAddressIdentifierInput";

export type EditExternalAddressIdentifierMachineDependencies = {
  readonly isSupported: (app: RunningApp) => boolean;
  readonly editIdentifier: (
    input: EditExternalAddressIdentifierDAInput,
  ) => Promise<
    Awaited<ReturnType<SendEditExternalAddressIdentifierTask["run"]>>
  >;
};

export class EditExternalAddressIdentifierDeviceAction extends XStateDeviceAction<
  EditExternalAddressIdentifierDAOutput,
  EditExternalAddressIdentifierDAInput,
  EditExternalAddressIdentifierDAError,
  EditExternalAddressIdentifierDAIntermediateValue,
  EditExternalAddressIdentifierDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    EditExternalAddressIdentifierDAOutput,
    EditExternalAddressIdentifierDAInput,
    EditExternalAddressIdentifierDAError,
    EditExternalAddressIdentifierDAIntermediateValue,
    EditExternalAddressIdentifierDAInternalState
  > {
    type types = StateMachineTypes<
      EditExternalAddressIdentifierDAOutput,
      EditExternalAddressIdentifierDAInput,
      EditExternalAddressIdentifierDAError,
      EditExternalAddressIdentifierDAIntermediateValue,
      EditExternalAddressIdentifierDAInternalState
    >;

    const { isSupported, editIdentifier } =
      this.extractDependencies(internalApi);
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
        editIdentifier: fromPromise(
          ({ input }: { input: EditExternalAddressIdentifierDAInput }) =>
            editIdentifier(input),
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
            const error = validateEditExternalAddressIdentifierInput(
              context.input,
            );
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
      id: "EditExternalAddressIdentifierDeviceAction",
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
                  event.output.caseOf<EditExternalAddressIdentifierDAInternalState>(
                    {
                      Right: () => context._internalState,
                      Left: (error) => ({ ...context._internalState, error }),
                    },
                  ),
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
                  event.output.caseOf<EditExternalAddressIdentifierDAInternalState>(
                    {
                      Right: (appAndVersion) => ({
                        ...context._internalState,
                        appAndVersion: {
                          name: appAndVersion.name,
                          version: appAndVersion.version,
                        },
                      }),
                      Left: (error) => ({ ...context._internalState, error }),
                    },
                  ),
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
            { target: "EditIdentifier", guard: "contactsSupported" },
            { target: "Error", actions: "assignVersionError" },
          ],
        },
        EditIdentifier: {
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
            id: "editIdentifier",
            src: "editIdentifier",
            input: ({ context }) => context.input,
            onDone: {
              target: "EditIdentifierResultCheck",
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
        EditIdentifierResultCheck: {
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
            scope: input.scope,
            previousIdentifier: input.previousIdentifier,
            identifier: input.newIdentifier,
            blockchainFamily: input.blockchainFamily,
            chainId: input.chainId,
            groupHandle: input.groupHandle,
            // Preserved: the group-level name proof is untouched by an identifier
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
  ): EditExternalAddressIdentifierMachineDependencies {
    const isSupported = (app: RunningApp) =>
      isContactsAppVersionSupportedForSession(internalApi, app);

    const editIdentifier = (
      input: EditExternalAddressIdentifierDAInput,
    ): Promise<
      Awaited<ReturnType<SendEditExternalAddressIdentifierTask["run"]>>
    > =>
      new SendEditExternalAddressIdentifierTask(internalApi, {
        contactName: input.contactName,
        scope: input.scope,
        previousIdentifier: input.previousIdentifier,
        newIdentifier: input.newIdentifier,
        blockchainFamily: input.blockchainFamily,
        chainId: input.chainId,
        groupHandle: input.groupHandle,
        hmacProof: input.hmacProof,
        hmacRest: input.hmacRest,
      }).run();

    return { isSupported, editIdentifier };
  }
}

export type { EditIdentifierProof };
