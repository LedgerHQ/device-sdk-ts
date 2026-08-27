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
  type EditExternalAddressIdentifierDAError,
  type EditExternalAddressIdentifierDAInput,
  type EditExternalAddressIdentifierDAIntermediateValue,
  type EditExternalAddressIdentifierDAOutput,
} from "@api/app-binder/EditExternalAddressIdentifierDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { setupWaitForAppAndVersionDAMock } from "@internal/app-binder/device-action/__test-utils__/setupWaitForAppAndVersionDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import {
  ContactsCommandError,
  ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";

import { EditExternalAddressIdentifierDeviceAction } from "./EditExternalAddressIdentifierDeviceAction";
import { validateEditExternalAddressIdentifierInput } from "./validateEditExternalAddressIdentifierInput";

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
const PREVIOUS_IDENTIFIER = new Uint8Array(20).fill(0x11);
const NEW_IDENTIFIER = new Uint8Array(20).fill(0x22);

const OK_PROOF = { hmacRest: HMAC_REST_NEW };

const BASE_INPUT = {
  contactName: "Alice",
  scope: "Eth main",
  previousIdentifier: PREVIOUS_IDENTIFIER,
  newIdentifier: NEW_IDENTIFIER,
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: GROUP_HANDLE,
  hmacProof: HMAC_PROOF,
  hmacRest: HMAC_REST_OLD,
  appName: "Ethereum",
};

const EXPECTED_OUTPUT = {
  contactName: "Alice",
  scope: "Eth main",
  previousIdentifier: PREVIOUS_IDENTIFIER,
  identifier: NEW_IDENTIFIER,
  blockchainFamily: "ethereum",
  chainId: 1n,
  groupHandle: GROUP_HANDLE,
  // Preserved: the group-level name proof is unchanged by an identifier edit.
  hmacProof: HMAC_PROOF,
  // Rotated: only the address-level proof changes.
  hmacRest: HMAC_REST_NEW,
};

describe("EditExternalAddressIdentifierDeviceAction", () => {
  let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
  let isSupportedMock: ReturnType<typeof vi.fn>;
  let editIdentifierMock: ReturnType<typeof vi.fn>;

  function extractDeps() {
    return {
      isSupported: isSupportedMock,
      editIdentifier: editIdentifierMock,
    };
  }

  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    setupWaitForAppAndVersionDAMock(FRESH_APP);
    isSupportedMock = vi.fn().mockReturnValue(true);
    editIdentifierMock = vi
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

  function makeAction(input: EditExternalAddressIdentifierDAInput) {
    const action = new EditExternalAddressIdentifierDeviceAction({ input });
    vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());
    return action;
  }

  it("open-app path: OpenApp -> VersionGuard -> EditIdentifier -> Completed", () =>
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("skip-open-app path: VersionGuard -> EditIdentifier -> Completed, preserving the group proof", () =>
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          try {
            // The device rotates only the address-level hmac_rest; the contact
            // group's name proof passes through unchanged.
            expect(EXPECTED_OUTPUT.hmacProof).toBe(HMAC_PROOF);
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

  it("version guard rejects on skip-open-app path without running EDIT IDENTIFIER", () =>
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(editIdentifierMock).not.toHaveBeenCalled();
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
    }));

  it("surfaces an Edit Identifier command error", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const commandError = new ContactsCommandError({
        errorCode: "6982",
        message: "seed mismatch",
      });
      editIdentifierMock.mockResolvedValue(
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
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
        validateEditExternalAddressIdentifierInput(invalidInput);
      const action = makeAction(invalidInput);

      const expected = [
        {
          error: validationError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
      expect(editIdentifierMock).not.toHaveBeenCalled();
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
        validateEditExternalAddressIdentifierInput(invalidInput);
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(editIdentifierMock).not.toHaveBeenCalled();
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
      expect(editIdentifierMock).not.toHaveBeenCalled();
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
        EditExternalAddressIdentifierDAOutput,
        EditExternalAddressIdentifierDAError,
        EditExternalAddressIdentifierDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));
});
