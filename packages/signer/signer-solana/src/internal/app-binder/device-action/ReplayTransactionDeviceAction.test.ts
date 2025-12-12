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
  type ReplayTransactionDAError,
  type ReplayTransactionDAInput,
  type ReplayTransactionDAIntermediateValue,
} from "@api/app-binder/ReplayTransactionDeviceActionTypes";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { ReplayTransactionDeviceAction } from "./ReplayTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTxB64 = "EXAMPLE=";

const contextModuleStub: ContextModule = {
  getSolanaContext: vi.fn(),
} as unknown as ContextModule;

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getPublicKeyMock: ReturnType<typeof vi.fn>;
let replayTransactionMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    getPublicKey: getPublicKeyMock,
    replayTransaction: replayTransactionMock,
  };
}

describe("ReplayTransactionDeviceAction (Solana)", () => {
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
    replayTransactionMock = vi.fn();
  });

  it("happy path (skip open): getPublicKey -> replayTransaction -> success", () =>
    new Promise<void>((resolve, reject) => {
      const newPayer = "4T7JpXjQH99Nct4m7P8a9Q9i9kq6Dh1x1tP7u1L6mQqs";
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: newPayer }),
      );
      const swappedB64 = "ZmFrZVN3YXBwZWRUeA==";
      replayTransactionMock.mockResolvedValue(swappedB64);

      const action = new ReplayTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as ReplayTransactionDAInput,
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
        // ReplayTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        // Success
        { output: swappedB64, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        string,
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        ReplayTransactionDAInput,
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("getPublicKey returns error -> Error", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("pkErr"),
        }),
      );
      replayTransactionMock.mockResolvedValue("unused");

      const action = new ReplayTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as ReplayTransactionDAInput,
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
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        ReplayTransactionDAInput,
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("replayTransaction resolves falsy -> UnknownDAError -> Error", () =>
    new Promise<void>((resolve, reject) => {
      const newPayer = "3uWw3w8oHAp8Jti3XQGz2qA2kQqiYk5p9VbXoFq5ULbR";
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: newPayer }),
      );
      replayTransactionMock.mockResolvedValue("");

      const action = new ReplayTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as ReplayTransactionDAInput,
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
        // ReplayTransaction (falsy result)
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
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        ReplayTransactionDAInput,
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("replayTransaction throws -> Error", () =>
    new Promise<void>((resolve, reject) => {
      const newPayer = "9Xnq9Yk9j5Hk3de9G4m2f3mM9b2R1dJb1u7C6G3P4VY7";
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: newPayer }),
      );
      replayTransactionMock.mockRejectedValue(new Error("boom"));

      const action = new ReplayTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serialisedTransaction: exampleTxB64,
          skipOpenApp: true,
          contextModule: contextModuleStub,
        } as ReplayTransactionDAInput,
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
        // ReplayTransaction (throws)
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
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        string,
        ReplayTransactionDAInput,
        ReplayTransactionDAError,
        ReplayTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));
});
