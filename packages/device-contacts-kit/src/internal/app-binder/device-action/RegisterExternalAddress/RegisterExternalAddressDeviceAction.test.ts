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
  type RegisterExternalAddressDAError,
  type RegisterExternalAddressDAInput,
  type RegisterExternalAddressDAIntermediateValue,
  type RegisterExternalAddressDAOutput,
} from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import {
  ContactsCommandError,
  ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";

import { RegisterExternalAddressDeviceAction } from "./RegisterExternalAddressDeviceAction";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

const OK_PROOFS = {
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
  hmacRest: new Uint8Array(32).fill(0xaa),
};

const BASE_INPUT = {
  contactName: "Alice",
  scope: "Eth main",
  identifier: new Uint8Array(20).fill(0x11),
  blockchainFamily: "ethereum",
  chainId: 1n,
  appName: "Ethereum",
};

describe("RegisterExternalAddressDeviceAction", () => {
  let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
  let isSupportedMock: ReturnType<typeof vi.fn>;
  let registerIdentityMock: ReturnType<typeof vi.fn>;

  function extractDeps() {
    return {
      isSupported: isSupportedMock,
      registerIdentity: registerIdentityMock,
    };
  }

  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    isSupportedMock = vi.fn().mockReturnValue(true);
    registerIdentityMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: OK_PROOFS }));
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: true,
    });
  });

  function makeAction(input: RegisterExternalAddressDAInput) {
    const action = new RegisterExternalAddressDeviceAction({ input });
    vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());
    return action;
  }

  it("open-app path, new contact group: OpenApp -> VersionGuard -> RegisterIdentity -> Completed", () =>
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
            requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: {
            mode: "newContactGroup",
            contactName: "Alice",
            scope: "Eth main",
            identifier: BASE_INPUT.identifier,
            blockchainFamily: "ethereum",
            chainId: 1n,
            ...OK_PROOFS,
          },
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        RegisterExternalAddressDAOutput,
        RegisterExternalAddressDAError,
        RegisterExternalAddressDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("skip-open-app path, existing contact group: VersionGuard -> RegisterIdentity -> Completed", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const existingContactGroup = {
        groupHandle: new Uint8Array(64).fill(0xcc),
        hmacProof: new Uint8Array(32).fill(0xdd),
      };
      const action = makeAction({
        ...BASE_INPUT,
        skipOpenApp: true,
        existingContactGroup,
      });

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: {
            mode: "existingContactGroup",
            contactName: "Alice",
            scope: "Eth main",
            identifier: BASE_INPUT.identifier,
            blockchainFamily: "ethereum",
            chainId: 1n,
            ...OK_PROOFS,
          },
          status: DeviceActionStatus.Completed,
        },
      ] as DeviceActionState<
        RegisterExternalAddressDAOutput,
        RegisterExternalAddressDAError,
        RegisterExternalAddressDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("version guard rejects on skip-open-app path without opening the app", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      isSupportedMock.mockReturnValue(false);
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: true });

      const expected = [
        {
          error: new ContactsVersionRequirementError(),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RegisterExternalAddressDAOutput,
        RegisterExternalAddressDAError,
        RegisterExternalAddressDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(registerIdentityMock).not.toHaveBeenCalled();
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
        RegisterExternalAddressDAOutput,
        RegisterExternalAddressDAError,
        RegisterExternalAddressDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
      expect(isSupportedMock).not.toHaveBeenCalled();
    }));

  it("surfaces a Register Identity command error", () =>
    new Promise<void>((resolve, reject) => {
      setupOpenAppDAMock();
      const commandError = new ContactsCommandError({
        errorCode: "6a80",
        message: "device rejected",
      });
      registerIdentityMock.mockResolvedValue(
        CommandResultFactory({ error: commandError }),
      );
      const action = makeAction({ ...BASE_INPUT, skipOpenApp: true });

      const expected = [
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
        RegisterExternalAddressDAOutput,
        RegisterExternalAddressDAError,
        RegisterExternalAddressDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));
});
