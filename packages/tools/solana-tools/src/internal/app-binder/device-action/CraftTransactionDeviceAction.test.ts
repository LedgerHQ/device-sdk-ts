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
import { type TransactionFetcherService } from "@internal/services/TransactionFetcherService";

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
const testTransactionSignature =
  "4bFbdzYqrc5n8nTf4keT4FMRgGMnavYnJ2wMkrZi8RZUzstopVa69ihJrygvdSmWFFzXGjWZ9wf4qG8YgEBGJTbG";
const testFetchedTransaction = "base64-fetched-from-network";

const mockTransactionFetcherService: TransactionFetcherService = {
  fetchTransaction: vi.fn(),
};

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let getPublicKeyMock: ReturnType<typeof vi.fn>;
let fetchTransactionMock: ReturnType<typeof vi.fn>;
let craftTransactionMock: ReturnType<typeof vi.fn>;

function extractDeps(): MachineDependencies {
  return {
    getPublicKey: getPublicKeyMock,
    fetchTransaction: fetchTransactionMock,
    craftTransaction: craftTransactionMock,
  };
}

describe("CraftTransactionDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    getPublicKeyMock = vi.fn();
    fetchTransactionMock = vi.fn();
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
        transactionFetcherService: mockTransactionFetcherService,
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
        transactionFetcherService: mockTransactionFetcherService,
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
        transactionFetcherService: mockTransactionFetcherService,
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
        transactionFetcherService: mockTransactionFetcherService,
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

  it("with serialisedTransaction: skips fetchTransaction", () =>
    new Promise<void>((resolve, reject) => {
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      craftTransactionMock.mockResolvedValue(testCraftedTransaction);

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        serialisedTransaction: testSerialisedTransaction,
        skipOpenApp: true,
        transactionFetcherService: mockTransactionFetcherService,
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
          expect(fetchTransactionMock).not.toHaveBeenCalled();
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(craftTransactionMock).toHaveBeenCalledOnce();
          resolve();
        },
        onError: reject,
      });
    }));

  it("with transactionSignature: fetchTransaction -> getPublicKey -> craftTransaction -> success", () =>
    new Promise<void>((resolve, reject) => {
      fetchTransactionMock.mockResolvedValue(testFetchedTransaction);
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      craftTransactionMock.mockResolvedValue(testCraftedTransaction);

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        transactionSignature: testTransactionSignature,
        skipOpenApp: true,
        transactionFetcherService: mockTransactionFetcherService,
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
          expect(fetchTransactionMock).toHaveBeenCalledOnce();
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(craftTransactionMock).toHaveBeenCalledOnce();
          resolve();
        },
        onError: reject,
      });
    }));

  it("with transactionSignature: fetchTransaction rejects -> error", () =>
    new Promise<void>((resolve, reject) => {
      fetchTransactionMock.mockRejectedValue(
        new Error("Transaction not found"),
      );

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        transactionSignature: testTransactionSignature,
        skipOpenApp: true,
        transactionFetcherService: mockTransactionFetcherService,
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
          error: new UnknownDAError("Transaction not found"),
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
          expect(fetchTransactionMock).toHaveBeenCalledOnce();
          expect(getPublicKeyMock).not.toHaveBeenCalled();
          expect(craftTransactionMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("with transactionSignature: craftTransaction rejects after fetch -> error", () =>
    new Promise<void>((resolve, reject) => {
      fetchTransactionMock.mockResolvedValue(testFetchedTransaction);
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      craftTransactionMock.mockRejectedValue(new Error("craft failed"));

      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        transactionSignature: testTransactionSignature,
        skipOpenApp: true,
        transactionFetcherService: mockTransactionFetcherService,
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
          expect(fetchTransactionMock).toHaveBeenCalledOnce();
          expect(getPublicKeyMock).toHaveBeenCalledOnce();
          expect(craftTransactionMock).toHaveBeenCalledOnce();
          resolve();
        },
        onError: reject,
      });
    }));

  it("with transactionSignature: passes fetched transaction to craftTransaction", () =>
    new Promise<void>((resolve, reject) => {
      fetchTransactionMock.mockResolvedValue(testFetchedTransaction);
      getPublicKeyMock.mockResolvedValue(
        CommandResultFactory({ data: testPublicKey }),
      );
      craftTransactionMock.mockResolvedValue(testCraftedTransaction);

      const testRpcUrl = "https://custom-rpc.example.com";
      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        transactionSignature: testTransactionSignature,
        rpcUrl: testRpcUrl,
        skipOpenApp: true,
        transactionFetcherService: mockTransactionFetcherService,
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
          expect(fetchTransactionMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                transactionSignature: testTransactionSignature,
                rpcUrl: testRpcUrl,
              },
            }),
          );
          expect(craftTransactionMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                publicKey: testPublicKey,
                serialisedTransaction: testFetchedTransaction,
              },
            }),
          );
          resolve();
        },
        onError: reject,
      });
    }));

  it("errors when neither serialisedTransaction nor transactionSignature is provided", () =>
    new Promise<void>((resolve, reject) => {
      const input: CraftTransactionDAInput = {
        derivationPath: defaultDerivation,
        skipOpenApp: true,
        transactionFetcherService: mockTransactionFetcherService,
      };

      const action = new CraftTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          error: new UnknownDAError(
            "Either serialisedTransaction or transactionSignature must be provided",
          ),
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
          expect(fetchTransactionMock).not.toHaveBeenCalled();
          expect(getPublicKeyMock).not.toHaveBeenCalled();
          expect(craftTransactionMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));
});
