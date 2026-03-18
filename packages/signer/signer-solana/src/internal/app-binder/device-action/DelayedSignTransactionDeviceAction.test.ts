import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  InvalidStatusWordError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type DelayedSignDAError,
  type DelayedSignDAInput,
  type DelayedSignDAIntermediateValue,
  delayedSignDAStateSteps,
} from "@api/app-binder/DelayedSignTransactionDeviceActionTypes";
import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "./__test-utils__/testDeviceActionStates";
import { DelayedSignTransactionDeviceAction } from "./DelayedSignTransactionDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const exampleBlockhash = new Uint8Array(32).fill(0xab);
const exampleSignature = new Uint8Array([0xaa, 0xbb]);

const zeroedTx = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
const patchedTx = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let previewMock: ReturnType<typeof vi.fn>;
let delayedSignMock: ReturnType<typeof vi.fn>;
let fallbackSignMock: ReturnType<typeof vi.fn>;
let fetchBlockhashMock: ReturnType<typeof vi.fn>;
let zeroBlockhashMock: ReturnType<typeof vi.fn>;
let patchBlockhashMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    previewTransaction: previewMock,
    delayedSignTransaction: delayedSignMock,
    fallbackSignTransaction: fallbackSignMock,
    fetchBlockhashFn: fetchBlockhashMock,
    zeroBlockhashFn: zeroBlockhashMock,
    patchBlockhashFn: patchBlockhashMock,
  };
}

describe("DelayedSignTransactionDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    previewMock = vi.fn();
    delayedSignMock = vi.fn();
    fallbackSignMock = vi.fn();
    fetchBlockhashMock = vi.fn();
    zeroBlockhashMock = vi.fn().mockResolvedValue(zeroedTx);
    patchBlockhashMock = vi.fn().mockResolvedValue(patchedTx);
  });

  it("happy path: preview accepted -> delayed sign (INS 0x09)", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(CommandResultFactory({ data: Nothing }));
      fetchBlockhashMock.mockResolvedValue(exampleBlockhash);
      delayedSignMock.mockResolvedValue(
        CommandResultFactory({ data: Just(exampleSignature) }),
      );

      const input: DelayedSignDAInput = {
        derivationPath: defaultDerivation,
        transaction: exampleTx,
        rpcUrl: "https://api.devnet.solana.com",
      };

      const action = new DelayedSignTransactionDeviceAction({ input });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.FETCH_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.PATCH_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.DELAYED_SIGN,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: exampleSignature, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates<
        Uint8Array,
        DelayedSignDAInput,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >(action, expected, apiMock, {
        onDone: () => {
          expect(previewMock).toHaveBeenCalledTimes(1);
          expect(delayedSignMock).toHaveBeenCalledTimes(1);
          expect(fallbackSignMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("protocol fallback (0x6d00): preview unsupported -> fallback sign (INS 0x06)", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            errorCode: "6d00",
            message: "Instruction not supported",
          }),
        }),
      );
      fetchBlockhashMock.mockResolvedValue(exampleBlockhash);
      fallbackSignMock.mockResolvedValue(
        CommandResultFactory({ data: Just(exampleSignature) }),
      );

      const action = new DelayedSignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl: "https://api.devnet.solana.com",
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.FETCH_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.PATCH_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.FALLBACK_TO_NON_DELAYED_SIGN,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: exampleSignature, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(delayedSignMock).not.toHaveBeenCalled();
          expect(fallbackSignMock).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));

  it("user rejection (0x6985) during preview -> error (no fallback)", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            errorCode: "6985",
            message: "Canceled by user",
          }),
        }),
      );

      const action = new DelayedSignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl: "https://api.devnet.solana.com",
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: expect.objectContaining({
            _tag: "SolanaAppCommandError",
          }),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(delayedSignMock).not.toHaveBeenCalled();
          expect(fallbackSignMock).not.toHaveBeenCalled();
          expect(fetchBlockhashMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("user rejection (0x6985) during preview -> error (no fallback)", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            errorCode: "6985",
            message: "Conditions of use not satisfied (Canceled by user)",
          }),
        }),
      );

      const action = new DelayedSignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl: "https://api.devnet.solana.com",
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: expect.objectContaining({
            _tag: "SolanaAppCommandError",
          }),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(delayedSignMock).not.toHaveBeenCalled();
          expect(fallbackSignMock).not.toHaveBeenCalled();
          expect(fetchBlockhashMock).not.toHaveBeenCalled();
          resolve();
        },
        onError: reject,
      });
    }));

  it("generic preview error -> fallback sign", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("unexpected"),
        }),
      );
      fetchBlockhashMock.mockResolvedValue(exampleBlockhash);
      fallbackSignMock.mockResolvedValue(
        CommandResultFactory({ data: Just(exampleSignature) }),
      );

      const action = new DelayedSignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl: "https://api.devnet.solana.com",
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.FETCH_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.PATCH_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.FALLBACK_TO_NON_DELAYED_SIGN,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: exampleSignature, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(fallbackSignMock).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));

  it("fetch blockhash failure -> error", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(CommandResultFactory({ data: Nothing }));
      fetchBlockhashMock.mockRejectedValue(new Error("network error"));

      const action = new DelayedSignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl: "https://api.devnet.solana.com",
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.FETCH_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: expect.objectContaining({
            _tag: "UnknownDAError",
          }),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("delayed sign failure (0x6f11 hash mismatch) -> error", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(CommandResultFactory({ data: Nothing }));
      fetchBlockhashMock.mockResolvedValue(exampleBlockhash);
      delayedSignMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            errorCode: "6f11",
            message: "Delayed signing hash mismatch",
          }),
        }),
      );

      const action = new DelayedSignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl: "https://api.devnet.solana.com",
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps());

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.FETCH_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.PATCH_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.DELAYED_SIGN,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          error: expect.objectContaining({
            _tag: "SolanaAppCommandError",
          }),
          status: DeviceActionStatus.Error,
        },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: resolve,
        onError: reject,
      });
    }));

  it("uses custom fetchBlockhash callback when provided", () =>
    new Promise<void>((resolve, reject) => {
      const customFetchBlockhash = vi.fn().mockResolvedValue(exampleBlockhash);

      previewMock.mockResolvedValue(CommandResultFactory({ data: Nothing }));
      delayedSignMock.mockResolvedValue(
        CommandResultFactory({ data: Just(exampleSignature) }),
      );

      const action = new DelayedSignTransactionDeviceAction({
        input: {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          fetchBlockhash: customFetchBlockhash,
        },
      });
      vi.spyOn(action, "extractDependencies").mockReturnValue({
        ...extractDeps(),
        fetchBlockhashFn: async (arg0: {
          input: {
            rpcUrl?: string;
            fetchBlockhash?: () => Promise<Uint8Array>;
          };
        }) => {
          if (arg0.input.fetchBlockhash) {
            return arg0.input.fetchBlockhash();
          }
          throw new Error("No rpcUrl provided");
        },
      });

      const expected = [
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
            step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.FETCH_BLOCKHASH,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.PATCH_TRANSACTION,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: delayedSignDAStateSteps.DELAYED_SIGN,
          },
          status: DeviceActionStatus.Pending,
        },
        { output: exampleSignature, status: DeviceActionStatus.Completed },
      ] as DeviceActionState<
        Uint8Array,
        DelayedSignDAError,
        DelayedSignDAIntermediateValue
      >[];

      testDeviceActionStates(action, expected, apiMock, {
        onDone: () => {
          expect(customFetchBlockhash).toHaveBeenCalledTimes(1);
          resolve();
        },
        onError: reject,
      });
    }));
});
