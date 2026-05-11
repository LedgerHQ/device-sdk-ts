/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  CommandResultFactory,
  CommandResultStatus,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
  TransportDeviceModel,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom, Observable } from "rxjs";

import {
  type RegisterLedgerAccountDAState,
  RegisterLedgerAccountDAStep,
} from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { executeUntilStep } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionUntilStep";

import { RegisterLedgerAccountDeviceAction } from "./RegisterLedgerAccountDeviceAction";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

describe("RegisterLedgerAccountDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const registerLedgerAccountMock = vi.fn();
  const getAddressMock = vi.fn();

  function extractDependenciesMock() {
    return {
      registerLedgerAccount: registerLedgerAccountMock,
      getAddress: getAddressMock,
    };
  }

  function setupDeviceModel(deviceModelId: DeviceModelId) {
    apiMock.getDeviceModel.mockReturnValue({
      id: deviceModelId,
    } as unknown as TransportDeviceModel);
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.15.0" },
      deviceModelId,
      isSecureConnectionAllowed: false,
    });
  }

  const HMAC_PROOF_HEX = "ee".repeat(32);
  const DERIVED_ADDRESS = "0x32323232323232323232323232323232323232323";
  // Address strips 0x and lowercases (storage shape).
  const EXPECTED_ADDRESS_HEX = "32323232323232323232323232323232323232323";

  const VAULT_INPUT = {
    name: "Vault",
    derivationPath: "44'/60'/0'/0/0",
    chainId: 1,
  };

  const getStep = (s: Array<RegisterLedgerAccountDAState>, index: number) => {
    if (s[index]?.status !== DeviceActionStatus.Pending) {
      throw new Error(
        `Step ${index} is not pending: ${JSON.stringify(s[index])}`,
      );
    }
    return s[index];
  };

  describe("Happy path", () => {
    let observable: Observable<RegisterLedgerAccountDAState>;

    beforeEach(() => {
      vi.resetAllMocks();
      setupOpenAppDAMock();
      setupDeviceModel(DeviceModelId.FLEX);

      registerLedgerAccountMock.mockResolvedValueOnce(
        CommandResultFactory({ data: { hmacProofHex: HMAC_PROOF_HEX } }),
      );
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            publicKey: "04" + "11".repeat(64),
            address: DERIVED_ADDRESS,
          },
        }),
      );

      const deviceAction = new RegisterLedgerAccountDeviceAction({
        input: VAULT_INPUT,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );

      observable = deviceAction._execute(apiMock).observable;
    });

    it("opens the app first", async () => {
      const { steps } = await executeUntilStep(0, observable);
      expect(getStep(steps, 0).intermediateValue.step).toBe(
        RegisterLedgerAccountDAStep.OPEN_APP,
      );
    });

    it("registers the ledger account with RegisterWallet user interaction", async () => {
      const { steps } = await executeUntilStep(2, observable);
      expect(getStep(steps, 2).intermediateValue.step).toBe(
        RegisterLedgerAccountDAStep.REGISTER_LEDGER_ACCOUNT,
      );
      expect(getStep(steps, 2).intermediateValue.requiredUserInteraction).toBe(
        UserInteractionRequired.RegisterWallet,
      );
      expect(registerLedgerAccountMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: VAULT_INPUT,
        }),
      );
    });

    it("derives the address silently with chainId framed", async () => {
      const { steps } = await executeUntilStep(3, observable);
      expect(getStep(steps, 3).intermediateValue.step).toBe(
        RegisterLedgerAccountDAStep.GET_ADDRESS,
      );
      expect(getStep(steps, 3).intermediateValue.requiredUserInteraction).toBe(
        UserInteractionRequired.None,
      );
      expect(getAddressMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            derivationPath: VAULT_INPUT.derivationPath,
            checkOnDevice: false,
            returnChainCode: false,
            chainId: VAULT_INPUT.chainId,
          },
        }),
      );
    });

    it("completes with hmacProofHex and normalized addressHex", async () => {
      const result = await lastValueFrom(observable);
      expect(result).toEqual({
        status: DeviceActionStatus.Completed,
        output: {
          hmacProofHex: HMAC_PROOF_HEX,
          addressHex: EXPECTED_ADDRESS_HEX,
        },
      });
    });
  });

  describe("Error paths", () => {
    beforeEach(() => {
      vi.resetAllMocks();
      setupDeviceModel(DeviceModelId.FLEX);
    });

    it("fails fast when OpenApp fails", async () => {
      const openAppError = new InvalidStatusWordError("open-app-fail");
      setupOpenAppDAMock(openAppError);

      const deviceAction = new RegisterLedgerAccountDeviceAction({
        input: VAULT_INPUT,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      const observable = deviceAction._execute(apiMock).observable;

      const result = await lastValueFrom(observable);
      expect(result.status).toBe(DeviceActionStatus.Error);
      expect(registerLedgerAccountMock).not.toHaveBeenCalled();
      expect(getAddressMock).not.toHaveBeenCalled();
    });

    it("surfaces a RegisterLedgerAccount command error and skips GetAddress", async () => {
      setupOpenAppDAMock();
      registerLedgerAccountMock.mockResolvedValueOnce({
        status: CommandResultStatus.Error,
        error: new InvalidStatusWordError("0x6985"),
      });

      const deviceAction = new RegisterLedgerAccountDeviceAction({
        input: VAULT_INPUT,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      const observable = deviceAction._execute(apiMock).observable;

      const result = await lastValueFrom(observable);
      expect(result.status).toBe(DeviceActionStatus.Error);
      expect(getAddressMock).not.toHaveBeenCalled();
    });

    it("surfaces a GetAddress command error", async () => {
      setupOpenAppDAMock();
      registerLedgerAccountMock.mockResolvedValueOnce(
        CommandResultFactory({ data: { hmacProofHex: HMAC_PROOF_HEX } }),
      );
      getAddressMock.mockResolvedValueOnce({
        status: CommandResultStatus.Error,
        error: new InvalidStatusWordError("0x6e00"),
      });

      const deviceAction = new RegisterLedgerAccountDeviceAction({
        input: VAULT_INPUT,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      const observable = deviceAction._execute(apiMock).observable;

      const result = await lastValueFrom(observable);
      expect(result.status).toBe(DeviceActionStatus.Error);
    });
  });
});
