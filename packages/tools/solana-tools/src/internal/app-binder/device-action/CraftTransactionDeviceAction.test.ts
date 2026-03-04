import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CraftTransactionDAError,
  type CraftTransactionDAInput,
  type CraftTransactionDAIntermediateValue,
} from "@api/app-binder/CraftTransactionDeviceActionTypes";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "./__test-utils__/testDeviceActionStates";
import {
  CraftTransactionDeviceAction,
  type MachineDependencies,
} from "./CraftTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const testPublicKey = "2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB";
const testSerialisedTransaction = "base64-serialised-input";
const testCraftedTransaction = "base64-crafted-output";

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getPublicKeyMock: ReturnType<typeof vi.fn>;
let craftTransactionMock: ReturnType<typeof vi.fn>;

function extractDeps(): MachineDependencies {
  return {
    getPublicKey: getPublicKeyMock,
    craftTransaction: craftTransactionMock,
  };
}

describe("CraftTransactionDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    getPublicKeyMock = vi.fn();
    craftTransactionMock = vi.fn();
  });

  it("happy path (skipOpenApp): getPublicKey -> craftTransaction -> success", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      craftTransactionMock.mockResolvedValue(testCraftedTransaction);

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        serialisedTransaction: testSerialisedTransaction,
        skipOpenApp: true,
      };

      const action = new CraftTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

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
          output: testCraftedTransaction,
          status: DeviceActionStatus.Completed,
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
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(craftTransactionMock).toHaveBeenCalledOnce();
          resolve();
        },
        onError: reject,
      });
    }));

  it("getPublicKey rejects -> error", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockRejectedValue(new Error("device disconnected"));
      craftTransactionMock.mockResolvedValue(testCraftedTransaction);

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        serialisedTransaction: testSerialisedTransaction,
        skipOpenApp: true,
      };

      const action = new CraftTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: new UnknownDAError("device disconnected"),
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
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(craftTransactionMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("craftTransaction rejects -> error", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      craftTransactionMock.mockRejectedValue(new Error("craft failed"));

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        serialisedTransaction: testSerialisedTransaction,
        skipOpenApp: true,
      };

      const action = new CraftTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

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
          error: new UnknownDAError("craft failed"),
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
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(craftTransactionMock).toHaveBeenCalledOnce();
          resolve();
        },
        onError: reject,
      });
    }));

  it("passes correct arguments to dependencies", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      craftTransactionMock.mockResolvedValue(testCraftedTransaction);

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        serialisedTransaction: testSerialisedTransaction,
        skipOpenApp: true,
      };

      const action = new CraftTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

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
          output: testCraftedTransaction,
          status: DeviceActionStatus.Completed,
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
      >(action, expected, apiMock, {
        onDone: () => {
          expect(getPublicKeyMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                derivationPath: defaultDerivation,
                checkOnDevice: false,
              },
            }),
          );
          expect(craftTransactionMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                publicKey: testPublicKey,
                serialisedTransaction: testSerialisedTransaction,
              },
            }),
          );
          resolve();
        },
        onError: reject,
      });
    }));
});
