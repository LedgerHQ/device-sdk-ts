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
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransactionDeviceAction";

const defaultDerivation = "44'/118'/0'/0/0";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let signMock: ReturnType<typeof vi.fn>;

const extractDeps = () => {
  return {
    signTransaction: signMock,
  };
};

describe("SignTransactionDeviceAction (Cosmos)", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Cosmos", version: "1.0.0" },
      deviceModelId: DeviceModelId.NANO_X,
      isSecureConnectionAllowed: true,
    });
    signMock = vi.fn();
  });

  it("happy path (skip open): directly signs the transaction", () =>
    new Promise<void>((resolve, reject) => {
      const signature = new Uint8Array([0xaa, 0xbb]);
      signMock.mockResolvedValue(CommandResultFactory({ data: signature }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serializedSignDoc: exampleTx,
          options: { skipOpenApp: true, bech32Prefix: "cosmos" },
        } as SignTransactionDAInput,
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected: DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[] = [
        // signTransaction
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
          },
          status: DeviceActionStatus.Pending,
        },
        // success
        { output: signature, status: DeviceActionStatus.Completed },
      ];

      testDeviceActionStates<
        Uint8Array,
        SignTransactionDAInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));

  it("propagates signTransaction errors as DeviceActionStatus.Error", () =>
    new Promise<void>((resolve, reject) => {
      const error = new InvalidStatusWordError("sigErr");
      signMock.mockResolvedValue(CommandResultFactory({ error }));

      const action = new SignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          serializedSignDoc: exampleTx,
          options: { skipOpenApp: true, bech32Prefix: "cosmos" },
        } as SignTransactionDAInput,
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
          },
          status: DeviceActionStatus.Pending,
        },

        {
          error: expect.anything() as unknown as SignTransactionDAError,
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        Uint8Array,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >[];

      testDeviceActionStates<
        Uint8Array,
        SignTransactionDAInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >(action, expected, apiMock, { onDone: resolve, onError: reject });
    }));
});
