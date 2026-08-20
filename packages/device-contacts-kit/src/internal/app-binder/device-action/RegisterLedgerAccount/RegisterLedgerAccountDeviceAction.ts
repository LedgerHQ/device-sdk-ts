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
  type RegisterLedgerAccountDAError,
  type RegisterLedgerAccountDAInput,
  type RegisterLedgerAccountDAIntermediateValue,
  type RegisterLedgerAccountDAInternalState,
  type RegisterLedgerAccountDAOutput,
} from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import {
  isContactsSupportedForSession,
  type RunningApp,
} from "@internal/app-binder/isContactsSupportedForSession";
import { ContactsVersionRequirementError } from "@internal/app-binder/model/contactsErrors";
import {
  type RegisterLedgerAccountProof,
  SendRegisterLedgerAccountTask,
} from "@internal/app-binder/task/SendRegisterLedgerAccountTask";

import { validateRegisterLedgerAccountInput } from "./validateRegisterLedgerAccountInput";

export type RegisterLedgerAccountMachineDependencies = {
  readonly isSupported: (app: RunningApp) => boolean;
  readonly registerLedgerAccount: (
    input: RegisterLedgerAccountDAInput,
  ) => Promise<Awaited<ReturnType<SendRegisterLedgerAccountTask["run"]>>>;
};

export class RegisterLedgerAccountDeviceAction extends XStateDeviceAction<
  RegisterLedgerAccountDAOutput,
  RegisterLedgerAccountDAInput,
  RegisterLedgerAccountDAError,
  RegisterLedgerAccountDAIntermediateValue,
  RegisterLedgerAccountDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    RegisterLedgerAccountDAOutput,
    RegisterLedgerAccountDAInput,
    RegisterLedgerAccountDAError,
    RegisterLedgerAccountDAIntermediateValue,
    RegisterLedgerAccountDAInternalState
  > {
    type types = StateMachineTypes<
      RegisterLedgerAccountDAOutput,
      RegisterLedgerAccountDAInput,
      RegisterLedgerAccountDAError,
      RegisterLedgerAccountDAIntermediateValue,
      RegisterLedgerAccountDAInternalState
    >;

    const { isSupported, registerLedgerAccount } =
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
        registerLedgerAccount: fromPromise(
          ({ input }: { input: RegisterLedgerAccountDAInput }) =>
            registerLedgerAccount(input),
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
            const error = validateRegisterLedgerAccountInput(context.input);
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
      id: "RegisterLedgerAccountDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          appAndVersion: null,
          proof: null,
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
                  event.output.caseOf<RegisterLedgerAccountDAInternalState>({
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
          // Silent read — no user interaction required for this step.
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "waitForAppAndVersion",
            src: "waitForAppAndVersionStateMachine",
            input: () => ({}),
            onDone: {
              target: "CheckAppAndVersion",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf<RegisterLedgerAccountDAInternalState>({
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
            { target: "RegisterLedgerAccount", guard: "contactsSupported" },
            { target: "Error", actions: "assignVersionError" },
          ],
        },
        RegisterLedgerAccount: {
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
            id: "registerLedgerAccount",
            src: "registerLedgerAccount",
            input: ({ context }) => context.input,
            onDone: {
              target: "RegisterLedgerAccountResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        proof: event.output.data.hmacProof,
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
        RegisterLedgerAccountResultCheck: {
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
            accountName: input.accountName,
            derivationPath: input.derivationPath,
            blockchainFamily: input.blockchainFamily,
            chainId: input.chainId,
            hmacProof: proof,
          });
        }
        return Left(error ?? new UnknownDAError("No error in final state"));
      },
    });
  }

  extractDependencies(
    internalApi: InternalApi,
  ): RegisterLedgerAccountMachineDependencies {
    const isSupported = (app: RunningApp) =>
      isContactsSupportedForSession(internalApi, app);

    const registerLedgerAccount = (
      input: RegisterLedgerAccountDAInput,
    ): Promise<Awaited<ReturnType<SendRegisterLedgerAccountTask["run"]>>> =>
      new SendRegisterLedgerAccountTask(internalApi, {
        accountName: input.accountName,
        derivationPath: input.derivationPath,
        blockchainFamily: input.blockchainFamily,
        chainId: input.chainId,
      }).run();

    return { isSupported, registerLedgerAccount };
  }
}

export type { RegisterLedgerAccountProof };
