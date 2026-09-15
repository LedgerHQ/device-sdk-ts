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

// The OS version the device returns freshly via GetOsVersion after the
// dashboard is reached. The version guard must be fed *this*, not session state.
const FRESH_OS_VERSION = "1.7.0";

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
  let getOsVersionMock: ReturnType<typeof vi.fn>;
  let isOsVersionSupportedMock: ReturnType<typeof vi.fn>;
  let renameContactMock: ReturnType<typeof vi.fn>;

  function extractDeps() {
    return {
      getOsVersion: getOsVersionMock,
      isOsVersionSupported: isOsVersionSupportedMock,
      renameContact: renameContactMock,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock = makeDeviceActionInternalApiMock();
    getOsVersionMock = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({ data: { seVersion: FRESH_OS_VERSION } }),
      );
    isOsVersionSupportedMock = vi.fn().mockReturnValue(true);
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

  it("navigates to the dashboard, reads the OS freshly, renames, and completes", () =>
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
        // GetOsVersion clears the stale UnlockDevice interaction: one
        // `pending / none` step before the rename prompt.
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
          // The OS version is read freshly and fed to the guard — not the
          // session state.
          expect(getOsVersionMock).toHaveBeenCalled();
          expect(isOsVersionSupportedMock).toHaveBeenCalledWith(
            FRESH_OS_VERSION,
          );
          resolve();
        },
        onError: reject,
      });
    }));

  it("succeeds when an app was open at start, gating on the freshly-read OS", () =>
    new Promise<void>((resolve, reject) => {
      // An app (Ethereum) is running when rename begins — the scenario that
      // left firmwareVersion absent and made the bug look intermittent. Rename
      // must still succeed by reading the OS version fresh after the dashboard.
      apiMock.getDeviceSessionState.mockReturnValue({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Ethereum", version: "1.23.0" },
        deviceModelId: DeviceModelId.FLEX,
        isSecureConnectionAllowed: true,
      });
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
        RenameContactDAOutput,
        RenameContactDAError,
        RenameContactDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(getOsVersionMock).toHaveBeenCalled();
          expect(isOsVersionSupportedMock).toHaveBeenCalledWith(
            FRESH_OS_VERSION,
          );
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
      isOsVersionSupportedMock.mockReturnValue(false);
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
            requiredUserInteraction: UserInteractionRequired.None,
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
          // The fresh OS version was read and gated on.
          expect(getOsVersionMock).toHaveBeenCalled();
          expect(isOsVersionSupportedMock).toHaveBeenCalledWith(
            FRESH_OS_VERSION,
          );
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
          expect(getOsVersionMock).not.toHaveBeenCalled();
          expect(isOsVersionSupportedMock).not.toHaveBeenCalled();
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
          // Validation fails before the OS is read, the version guard, and any
          // APDU.
          expect(getOsVersionMock).not.toHaveBeenCalled();
          expect(isOsVersionSupportedMock).not.toHaveBeenCalled();
          expect(renameContactMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("surfaces a GetOsVersion failure as the command error, not a version error", () =>
    new Promise<void>((resolve, reject) => {
      setupGoToDashboardDAMock({
        requiredUserInteraction: UserInteractionRequired.UnlockDevice,
      });
      const osVersionError = new ContactsCommandError({
        errorCode: "6f00",
        message: "GetOsVersion failed",
      });
      getOsVersionMock.mockResolvedValue(
        CommandResultFactory({ error: osVersionError }),
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
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: osVersionError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        RenameContactDAOutput,
        RenameContactDAError,
        RenameContactDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          // The version guard is never consulted, and the rename APDU is never
          // sent: the raw command error propagates instead of a
          // ContactsVersionRequirementError.
          expect(isOsVersionSupportedMock).not.toHaveBeenCalled();
          expect(renameContactMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));
});
