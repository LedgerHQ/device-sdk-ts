import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, it, vi } from "vitest";

import {
  type CraftTransactionDAError,
  type CraftTransactionDAInput,
  type CraftTransactionDAIntermediateValue,
} from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { CraftTransactionDeviceAction } from "./CraftTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTxB64 = "EXAMPLE=";

const contextModuleStub: ContextModule = {
  getSolanaContext: vi.fn(),
} as unknown as ContextModule;

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getPublicKeyMock: ReturnType<typeof vi.fn>;
let craftTransactionMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    getPublicKey: getPublicKeyMock,
    craftTransaction: craftTransactionMock,
  };
}

describe("CraftTransactionDeviceAction (Solana)", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    // device present, app already open
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.1" },
      deviceModelId: DeviceModelId.NANO_X,
      isSecureConnectionAllowed: true,
    });

    getPublicKeyMock = vi.fn();
    craftTransactionMock = vi.fn();
  });

  it("happy path (skip open): getPublicKey -> craftTransaction -> success", () =>
    new Promise<void>((resolve, reject) => {
      const newPayer = "4T7JpXjQH99Nct4m7P8a9Q9i9kq6Dh1x1tP7u1L6mQqs";
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: newPayer }),
      );
      const craftedB64 = "ZmFrZUNyYWZ0ZWRUeA==";
      craftTransactionMock.mockResolvedValue(craftedB64);

      const action = new CraftTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as CraftTransactionDAInput,
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // GetPublicKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // CraftTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // Success
        { output: craftedB64, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        string,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        CraftTransactionDAInput,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("getPublicKey returns error -> Error", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("pkErr"),
        }),
      );
      craftTransactionMock.mockResolvedValue("unused");

      const action = new CraftTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as CraftTransactionDAInput,
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // GetPublicKey (error result)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // Error
        {
          error: expect.anything(),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        string,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        CraftTransactionDAInput,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("craftTransaction resolves falsy -> UnknownDAError -> Error", () =>
    new Promise<void>((resolve, reject) => {
      const newPayer = "3uWw3w8oHAp8Jti3XQGz2qA2kQqiYk5p9VbXoFq5ULbR";
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: newPayer }),
      );
      craftTransactionMock.mockResolvedValue("");

      const action = new CraftTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as CraftTransactionDAInput,
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // GetPublicKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // CraftTransaction (falsy result)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // Error
        {
          error: expect.anything(),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        string,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        CraftTransactionDAInput,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("craftTransaction throws -> Error", () =>
    new Promise<void>((resolve, reject) => {
      const newPayer = "9Xnq9Yk9j5Hk3de9G4m2f3mM9b2R1dJb1u7C6G3P4VY7";
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: newPayer }),
      );
      craftTransactionMock.mockRejectedValue(new Error("boom"));

      const action = new CraftTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as CraftTransactionDAInput,
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        // GetPublicKey
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // CraftTransaction (throws)
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // Error
        {
          error: expect.anything(),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        string,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        CraftTransactionDAInput,
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));
});
