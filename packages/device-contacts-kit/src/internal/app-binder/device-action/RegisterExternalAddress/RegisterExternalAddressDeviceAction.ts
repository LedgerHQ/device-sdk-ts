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
  type RegisterExternalAddressDAError,
  type RegisterExternalAddressDAInput,
  type RegisterExternalAddressDAIntermediateValue,
  type RegisterExternalAddressDAInternalState,
  type RegisterExternalAddressDAOutput,
} from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import {
  isContactsSupportedForSession,
  type RunningApp,
} from "@internal/app-binder/isContactsSupportedForSession";
import { ContactsVersionRequirementError } from "@internal/app-binder/model/contactsErrors";
import {
  type RegisterIdentityProofs,
  SendRegisterIdentityTask,
} from "@internal/app-binder/task/SendRegisterIdentityTask";

import { validateRegisterExternalAddressInput } from "./validateRegisterExternalAddressInput";

export type RegisterExternalAddressMachineDependencies = {
  readonly isSupported: (app: RunningApp) => boolean;
  readonly registerIdentity: (
    input: RegisterExternalAddressDAInput,
  ) => Promise<Awaited<ReturnType<SendRegisterIdentityTask["run"]>>>;
};

export class RegisterExternalAddressDeviceAction extends XStateDeviceAction<
  RegisterExternalAddressDAOutput,
  RegisterExternalAddressDAInput,
  RegisterExternalAddressDAError,
  RegisterExternalAddressDAIntermediateValue,
  RegisterExternalAddressDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    RegisterExternalAddressDAOutput,
    RegisterExternalAddressDAInput,
    RegisterExternalAddressDAError,
    RegisterExternalAddressDAIntermediateValue,
    RegisterExternalAddressDAInternalState
  > {
    type types = StateMachineTypes<
      RegisterExternalAddressDAOutput,
      RegisterExternalAddressDAInput,
      RegisterExternalAddressDAError,
      RegisterExternalAddressDAIntermediateValue,
      RegisterExternalAddressDAInternalState
    >;

    const { isSupported, registerIdentity } =
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
        registerIdentity: fromPromise(
          ({ input }: { input: RegisterExternalAddressDAInput }) =>
            registerIdentity(input),
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
            const error = validateRegisterExternalAddressInput(context.input);
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
      id: "RegisterExternalAddressDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          appAndVersion: null,
          proofs: null,
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
                  event.output.caseOf<RegisterExternalAddressDAInternalState>({
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
                  event.output.caseOf<RegisterExternalAddressDAInternalState>({
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
            { target: "RegisterIdentity", guard: "contactsSupported" },
            { target: "Error", actions: "assignVersionError" },
          ],
        },
        RegisterIdentity: {
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
            id: "registerIdentity",
            src: "registerIdentity",
            input: ({ context }) => context.input,
            onDone: {
              target: "RegisterIdentityResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? { ...context._internalState, proofs: event.output.data }
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
        RegisterIdentityResultCheck: {
          always: [
            { target: "Success", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) => {
        const { proofs, error } = context._internalState;
        if (proofs) {
          const { input } = context;
          return Right({
            mode: input.existingContactGroup
              ? ("existingContactGroup" as const)
              : ("newContactGroup" as const),
            contactName: input.contactName,
            scope: input.scope,
            identifier: input.identifier,
            blockchainFamily: input.blockchainFamily,
            chainId: input.chainId,
            groupHandle: proofs.groupHandle,
            hmacProof: proofs.hmacProof,
            hmacRest: proofs.hmacRest,
          });
        }
        return Left(error ?? new UnknownDAError("No error in final state"));
      },
    });
  }

  extractDependencies(
    internalApi: InternalApi,
  ): RegisterExternalAddressMachineDependencies {
    const isSupported = (app: RunningApp) =>
      isContactsSupportedForSession(internalApi, app);

    const registerIdentity = (
      input: RegisterExternalAddressDAInput,
    ): Promise<Awaited<ReturnType<SendRegisterIdentityTask["run"]>>> =>
      new SendRegisterIdentityTask(internalApi, {
        contactName: input.contactName,
        scope: input.scope,
        identifier: input.identifier,
        blockchainFamily: input.blockchainFamily,
        chainId: input.chainId,
        existingContactGroup: input.existingContactGroup,
      }).run();

    return { isSupported, registerIdentity };
  }
}

export type { RegisterIdentityProofs };
