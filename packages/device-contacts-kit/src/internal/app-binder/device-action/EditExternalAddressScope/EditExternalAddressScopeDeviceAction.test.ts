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
  type EditExternalAddressScopeDAError,
  type EditExternalAddressScopeDAInput,
  type EditExternalAddressScopeDAIntermediateValue,
  type EditExternalAddressScopeDAOutput,
} from "@api/app-binder/EditExternalAddressScopeDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { setupWaitForAppAndVersionDAMock } from "@internal/app-binder/device-action/__test-utils__/setupWaitForAppAndVersionDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import {
  ContactsCommandError,
  ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";

import { EditExternalAddressScopeDeviceAction } from "./EditExternalAddressScopeDeviceAction";
import { validateEditExternalAddressScopeInput } from "./validateEditExternalAddressScopeInput";

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

const GROUP_HANDLE = new Uint8Array(64).fill(0xcc);
const HMAC_PROOF = new Uint8Array(32).fill(0xdd);
const HMAC_REST_OLD = new Uint8Array(32).fill(0xaa);
const HMAC_REST_NEW = new Uint8Array(32).fill(0x88);
const IDENTIFIER = new Uint8Array(20).fill(0x11);

const OK_PROOF = { hmacRest: HMAC_REST_NEW };

const BASE_INPUT = {
  contactName: "Alice",
  previousScope: "Eth main",
  newScope: "Eth cold",
  identifier: IDENTIFIER,
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: GROUP_HANDLE,
  hmacProof: HMAC_PROOF,
  hmacRest: HMAC_REST_OLD,
  appName: "Ethereum",
};

const EXPECTED_OUTPUT = {
  contactName: "Alice",
  previousScope: "Eth main",
  scope: "Eth cold",
  identifier: IDENTIFIER,
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: GROUP_HANDLE,
  // Preserved: the group-level name proof is unchanged by a scope edit.
  hmacProof: HMAC_PROOF,
  // Rotated: only the address-level proof changes.
  hmacRest: HMAC_REST_NEW,
};

describe("EditExternalAddressScopeDeviceAction", () => {
  let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
  let isSupportedMock: ReturnType<typeof vi.fn>;
  let editScopeMock: ReturnType<typeof vi.fn>;

  function extractDeps() {
    return {
      isSupported: isSupportedMock,
      editScope: editScopeMock,
    };
  }

  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    setupWaitForAppAndVersionDAMock(FRESH_APP);
    isSupportedMock = vi.fn().mockReturnValue(true);
    editScopeMock = vi
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

  function makeAction(input: EditExternalAddressScopeDAInput) {
    const action = new EditExternalAddressScopeDeviceAction({ input });
    vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());
    return action;
  }

  it("open-app path: OpenApp -> VersionGuard -> EditScope -> Completed", () =>
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
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("skip-open-app path: VersionGuard -> EditScope -> Completed, preserving the group proof and identifier", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          try {
            // The device rotates only the address-level hmac_rest; the contact
            // group's name proof and the entry's identifier pass through
            // unchanged.
            expect(EXPECTED_OUTPUT.hmacProof).toBe(HMAC_PROOF);
            expect(EXPECTED_OUTPUT.identifier).toBe(IDENTIFIER);
            expect(EXPECTED_OUTPUT.hmacRest).toBe(HMAC_REST_NEW);
            expect(EXPECTED_OUTPUT.hmacRest).not.toBe(HMAC_REST_OLD);
            resolve();
          } catch (e) {
            reject(e as Error);
          }
        },
        onError: reject,
      });
    }));

  it("version guard rejects on skip-open-app path without running EDIT SCOPE", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      isSupportedMock.mockReturnValue(false);
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
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new ContactsVersionRequirementError(),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(editScopeMock).not.toHaveBeenCalled();
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
    }));

  it("surfaces an Edit Scope command error", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const commandError = new ContactsCommandError({
        errorCode: "6982",
        message: "seed mismatch",
      });
      editScopeMock.mockResolvedValue(
        CommandResultFactory({ error: commandError }),
      );
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
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
        contactName: "",
      };
      const validationError =
        validateEditExternalAddressScopeInput(invalidInput);
      const action = makeAction(invalidInput);

      const expected = [
        {
          error: validationError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
      expect(editScopeMock).not.toHaveBeenCalled();
    }));

  it("validates only after opening the app on the default path", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const invalidInput = {
        ...BASE_INPUT,
        skipOpenApp: false,
        contactName: "",
      };
      const validationError =
        validateEditExternalAddressScopeInput(invalidInput);
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(editScopeMock).not.toHaveBeenCalled();
    }));

  it("evaluates support from the fresh WaitForAppAndVersion result, not stale session state", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
      expect(editScopeMock).not.toHaveBeenCalled();
    }));

  it("propagates the UnlockDevice interaction emitted by WaitForAppAndVersion", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      setupWaitForAppAndVersionDAMock(
        FRESH_APP,
        UserInteractionRequired.UnlockDevice,
      );
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
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
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
        EditExternalAddressScopeDAOutput,
        EditExternalAddressScopeDAError,
        EditExternalAddressScopeDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));
});
