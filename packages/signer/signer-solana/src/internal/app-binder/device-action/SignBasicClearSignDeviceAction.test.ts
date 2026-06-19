import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type SignBasicClearSignDAError,
  type SignBasicClearSignDAInput,
  type SignBasicClearSignDAIntermediateValue,
  type SignBasicClearSignDAOutput,
} from "@api/app-binder/SignBasicClearSignDeviceActionTypes";
import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { SignBasicClearSignDeviceAction } from "./SignBasicClearSignDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const exampleBlockhash = new Uint8Array(32).fill(0xab);
const zeroedTx = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
const patchedTx = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const exampleSignature = new Uint8Array([0xaa, 0xbb]);
const rpcUrl = "https://api.devnet.solana.com";

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let previewMock: ReturnType<typeof vi.fn>;
let delayedSignMock: ReturnType<typeof vi.fn>;
let signMock: ReturnType<typeof vi.fn>;
let zeroBlockhashMock: ReturnType<typeof vi.fn>;
let blockhashService: BlockhashService;

function extractDeps() {
  return {
    previewTransaction: previewMock,
    delayedSignTransaction: delayedSignMock,
    signTransaction: signMock,
    zeroBlockhashFn: zeroBlockhashMock,
  };
}

function run(
  input: SignBasicClearSignDAInput,
  onComplete: (
    states: DeviceActionState<
      SignBasicClearSignDAOutput,
      SignBasicClearSignDAError,
      SignBasicClearSignDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new SignBasicClearSignDeviceAction({ input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any);
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    SignBasicClearSignDAOutput,
    SignBasicClearSignDAError,
    SignBasicClearSignDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

describe("SignBasicClearSignDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    previewMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: Nothing }));
    delayedSignMock = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({ data: Just(exampleSignature) }),
      );
    signMock = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({ data: Just(exampleSignature) }),
      );
    zeroBlockhashMock = vi.fn().mockResolvedValue(zeroedTx);
    blockhashService = {
      fetchLatestBlockhash: vi.fn().mockResolvedValue(exampleBlockhash),
      patchBlockhash: vi.fn().mockReturnValue(patchedTx),
      zeroBlockhash: vi.fn().mockReturnValue(zeroedTx),
    } as unknown as BlockhashService;
  });

  it("happy path: preview accepted, refresh, then delayed-sign the patched tx (0x09)", () =>
    new Promise<void>((resolve, reject) => {
      run(
        {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl,
          blockhashService,
        },
        (states) => {
          try {
            expect(previewMock).toHaveBeenCalledTimes(1);
            expect(delayedSignMock).toHaveBeenCalledTimes(1);
            expect(signMock).not.toHaveBeenCalled();
            expect(
              delayedSignMock.mock.calls[0]![0].input.serializedTransaction,
            ).toStrictEqual(patchedTx);
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleSignature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("preview unsupported (6d00): refresh then fallback one-shot sign (0x06)", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6d00", message: "not supported" } as any),
          }),
        }),
      );
      run(
        {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl,
          blockhashService,
        },
        (states) => {
          try {
            expect(signMock).toHaveBeenCalledTimes(1);
            expect(delayedSignMock).not.toHaveBeenCalled();
            expect(
              signMock.mock.calls[0]![0].input.serializedTransaction,
            ).toStrictEqual(patchedTx);
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleSignature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("preview user rejection (6985): surfaces an error, never signs", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6985", message: "Canceled by user" } as any),
          }),
        }),
      );
      run(
        {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl,
          blockhashService,
        },
        (states) => {
          try {
            expect(delayedSignMock).not.toHaveBeenCalled();
            expect(signMock).not.toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Error,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("preview throws: degrades to a one-shot sign of the original tx", () =>
    new Promise<void>((resolve, reject) => {
      previewMock.mockRejectedValue(new Error("preview boom"));
      run(
        {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl,
          blockhashService,
        },
        (states) => {
          try {
            expect(signMock).toHaveBeenCalledTimes(1);
            expect(delayedSignMock).not.toHaveBeenCalled();
            expect(
              signMock.mock.calls[0]![0].input.serializedTransaction,
            ).toStrictEqual(exampleTx);
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleSignature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("no blockhash source: primary one-shot sign (0x06), no preview", () =>
    new Promise<void>((resolve, reject) => {
      run(
        { derivationPath: defaultDerivation, transaction: exampleTx },
        (states) => {
          try {
            expect(previewMock).not.toHaveBeenCalled();
            expect(delayedSignMock).not.toHaveBeenCalled();
            expect(signMock).toHaveBeenCalledTimes(1);
            expect(
              signMock.mock.calls[0]![0].input.serializedTransaction,
            ).toStrictEqual(exampleTx);
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleSignature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("zero-blockhash failure: degrades to a one-shot sign of the original tx", () =>
    new Promise<void>((resolve, reject) => {
      zeroBlockhashMock.mockRejectedValue(new Error("zero boom"));
      run(
        {
          derivationPath: defaultDerivation,
          transaction: exampleTx,
          rpcUrl,
          blockhashService,
        },
        (states) => {
          try {
            expect(previewMock).not.toHaveBeenCalled();
            expect(signMock).toHaveBeenCalledTimes(1);
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleSignature);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));
});
