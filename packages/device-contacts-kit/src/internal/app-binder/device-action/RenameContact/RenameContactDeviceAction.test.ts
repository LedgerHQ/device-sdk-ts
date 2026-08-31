import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  GoToDashboardDeviceAction,
  OpenAppDeviceAction,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RenameContactDAError,
  type RenameContactDAInput,
  type RenameContactDAIntermediateValue,
  type RenameContactDAOutput,
} from "@api/app-binder/RenameContactDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardDAMock } from "@internal/app-binder/device-action/__test-utils__/setupGoToDashboardDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import {
  ContactsCommandError,
  ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";

import { RenameContactDeviceAction } from "./RenameContactDeviceAction";
import { validateRenameContactInput } from "./validateRenameContactInput";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    GoToDashboardDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

const OK_PROOF = { hmacProof: new Uint8Array(32).fill(0xee) };

const BASE_INPUT: RenameContactDAInput = {
  previousContactName: "Alice",
  newContactName: "Bob",
  groupHandle: new Uint8Array(64).fill(0xcc),
  hmacProof: new Uint8Array(32).fill(0xdd),
};

const EXPECTED_OUTPUT: RenameContactDAOutput = {
  previousContactName: "Alice",
  contactName: "Bob",
  groupHandle: BASE_INPUT.groupHandle,
  hmacProof: OK_PROOF.hmacProof,
};

describe("RenameContactDeviceAction", () => {
  let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
  let isOsSupportedMock: ReturnType<typeof vi.fn>;
  let renameContactMock: ReturnType<typeof vi.fn>;

  function extractDeps() {
    return {
      isOsSupported: isOsSupportedMock,
      renameContact: renameContactMock,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock = makeDeviceActionInternalApiMock();
    isOsSupportedMock = vi.fn().mockReturnValue(true);
    renameContactMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: OK_PROOF }));
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "BOLOS", version: "1.7.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: true,
    });
  });

  function makeAction(input: RenameContactDAInput) {
    const action = new RenameContactDeviceAction({ input });
    vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());
    return action;
  }

  it("navigates to the dashboard, checks the OS, renames, and completes", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardDAMock({
        requiredUserInteraction: UserInteractionRequired.UnlockDevice,
      });
      const action = makeAction(BASE_INPUT);

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
        RenameContactDAOutput,
        RenameContactDAError,
        RenameContactDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          // Rename is a dashboard op: it navigates to the dashboard and never
          // opens an app.
          expect(GoToDashboardDeviceAction).toHaveBeenCalled();
          expect(OpenAppDeviceAction).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("rejects on an unsupported OS version without sending the APDU", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardDAMock({
        requiredUserInteraction: UserInteractionRequired.UnlockDevice,
      });
      isOsSupportedMock.mockReturnValue(false);
      const action = makeAction(BASE_INPUT);

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
          error: new ContactsVersionRequirementError(),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RenameContactDAOutput,
        RenameContactDAError,
        RenameContactDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(renameContactMock).not.toHaveBeenCalled();
          expect(OpenAppDeviceAction).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("surfaces a go-to-dashboard failure as the device action error", () =>
    new Promise<void>((resolve, reject) => {
      const dashboardError = new UnknownDAError("go to dashboard failed");
      setupGoToDashboardDAMock({
        error: dashboardError,
        requiredUserInteraction: UserInteractionRequired.UnlockDevice,
      });
      const action = makeAction(BASE_INPUT);

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
          error: dashboardError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RenameContactDAOutput,
        RenameContactDAError,
        RenameContactDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(isOsSupportedMock).not.toHaveBeenCalled();
          expect(renameContactMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("surfaces a rename command error (e.g. seed mismatch)", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardDAMock({
        requiredUserInteraction: UserInteractionRequired.UnlockDevice,
      });
      const commandError = new ContactsCommandError({
        errorCode: "6982",
        message: "wrong seed",
      });
      renameContactMock.mockResolvedValue(
        CommandResultFactory({ error: commandError }),
      );
      const action = makeAction(BASE_INPUT);

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
          error: commandError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RenameContactDAOutput,
        RenameContactDAError,
        RenameContactDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("surfaces invalid input as a typed error after reaching the dashboard", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardDAMock({
        requiredUserInteraction: UserInteractionRequired.UnlockDevice,
      });
      const invalidInput = { ...BASE_INPUT, newContactName: "" };
      const validationError = validateRenameContactInput(invalidInput);
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
            requiredUserInteraction: UserInteractionRequired.UnlockDevice,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: validationError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RenameContactDAOutput,
        RenameContactDAError,
        RenameContactDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          // Validation fails before the version guard and before any APDU.
          expect(isOsSupportedMock).not.toHaveBeenCalled();
          expect(renameContactMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));
});
