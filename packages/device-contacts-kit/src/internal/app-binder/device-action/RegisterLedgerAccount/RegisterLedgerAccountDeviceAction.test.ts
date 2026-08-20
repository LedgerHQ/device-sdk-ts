import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, it, vi } from "vitest";

import {
  type RegisterLedgerAccountDAError,
  type RegisterLedgerAccountDAInput,
  type RegisterLedgerAccountDAIntermediateValue,
  type RegisterLedgerAccountDAOutput,
} from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { setupWaitForAppAndVersionDAMock } from "@internal/app-binder/device-action/__test-utils__/setupWaitForAppAndVersionDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import {
  ContactsCommandError,
  ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";

import { RegisterLedgerAccountDeviceAction } from "./RegisterLedgerAccountDeviceAction";
import { validateRegisterLedgerAccountInput } from "./validateRegisterLedgerAccountInput";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
    WaitForAppAndVersionDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

const FRESH_APP = { name: "Ethereum", version: "1.15.0" };

const HMAC_PROOF = new Uint8Array(32).fill(0xdd);
const OK_PROOF = { hmacProof: HMAC_PROOF };

const BASE_INPUT = {
  accountName: "Alice",
  derivationPath: "m/44'/60'/0'/0/0",
  blockchainFamily: "ethereum",
  chainId: 1n,
  appName: "Ethereum",
};

const EXPECTED_OUTPUT = {
  accountName: "Alice",
  derivationPath: "m/44'/60'/0'/0/0",
  blockchainFamily: "ethereum",
  chainId: 1n,
  hmacProof: HMAC_PROOF,
};

describe("RegisterLedgerAccountDeviceAction", () => {
  let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
  let isSupportedMock: ReturnType<typeof vi.fn>;
  let registerLedgerAccountMock: ReturnType<typeof vi.fn>;

  function extractDeps() {
    return {
      isSupported: isSupportedMock,
      registerLedgerAccount: registerLedgerAccountMock,
    };
  }

  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    setupWaitForAppAndVersionDAMock(FRESH_APP);
    isSupportedMock = vi.fn().mockReturnValue(true);
    registerLedgerAccountMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: OK_PROOF }));
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: true,
    });
  });

  function makeAction(input: RegisterLedgerAccountDAInput) {
    const action = new RegisterLedgerAccountDeviceAction({ input });
    vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());
    return action;
  }

  it("open-app path: OpenApp -> WaitForAppAndVersion -> RegisterLedgerAccount -> Completed", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: false });

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
          status: DeviceActionStatus.Pending,
        },
        // Silent WaitForAppAndVersion read (no interaction).
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: EXPECTED_OUTPUT,
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("skip-open-app path: WaitForAppAndVersion -> RegisterLedgerAccount -> Completed", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: true });

      const expected = [
        // Silent WaitForAppAndVersion read (no interaction).
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: EXPECTED_OUTPUT,
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("version guard rejects on skip-open-app path without registering", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      isSupportedMock.mockReturnValue(false);
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: true });

      const expected = [
        // Silent WaitForAppAndVersion read still runs before the guard.
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new ContactsVersionRequirementError(),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(registerLedgerAccountMock).not.toHaveBeenCalled();
    }));

  it("surfaces an open-app failure as the device action error", () =>
    new Promise<void>((resolve, reject) => {
      const openAppError = new UnknownDAError("open app failed");
      setupOpenAppDAMock(openAppError);
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: false });

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: openAppError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
    }));

  it("surfaces a Register Ledger Account command error", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const commandError = new ContactsCommandError({
        errorCode: "6a80",
        message: "device rejected",
      });
      registerLedgerAccountMock.mockResolvedValue(
        CommandResultFactory({ error: commandError }),
      );
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: true });

      const expected = [
        // Silent WaitForAppAndVersion read (no interaction).
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: commandError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("surfaces invalid input as a typed error state on the skip-open-app path", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const invalidInput = {
        ...BASE_INPUT,
        skipOpenApp: true,
        accountName: "",
      };
      const validationError = validateRegisterLedgerAccountInput(invalidInput);
      const action = makeAction(invalidInput);

      const expected = [
        {
          error: validationError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      // Validation fails before the version guard and before any APDU.
      expect(isSupportedMock).not.toHaveBeenCalled();
      expect(registerLedgerAccountMock).not.toHaveBeenCalled();
    }));

  it("validates only after opening the app on the default path", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const invalidInput = {
        ...BASE_INPUT,
        skipOpenApp: false,
        accountName: "",
      };
      const validationError = validateRegisterLedgerAccountInput(invalidInput);
      const action = makeAction(invalidInput);

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: validationError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(registerLedgerAccountMock).not.toHaveBeenCalled();
    }));

  it("evaluates support from the fresh WaitForAppAndVersion result, not stale session state", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      // Session state (from beforeEach) reports version 1.15.0; the fresh read
      // reports a different version, which is what the guard must use.
      const freshApp = { name: "Ethereum", version: "9.9.9" };
      setupWaitForAppAndVersionDAMock(freshApp);
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: true });

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: EXPECTED_OUTPUT,
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          try {
            expect(isSupportedMock).toHaveBeenCalledWith(freshApp);
            resolve();
          } catch (e) {
            reject(e as Error);
          }
        },
        onError: reject,
      });
    }));

  it("surfaces a WaitForAppAndVersion failure as the device action error", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const waitError = new UnknownDAError("could not read app and version");
      setupWaitForAppAndVersionDAMock({ error: waitError });
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: true });

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: waitError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RegisterLedgerAccountDAOutput,
        RegisterLedgerAccountDAError,
        RegisterLedgerAccountDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      // The version guard and the APDU are never reached.
      expect(isSupportedMock).not.toHaveBeenCalled();
      expect(registerLedgerAccountMock).not.toHaveBeenCalled();
    }));
});
