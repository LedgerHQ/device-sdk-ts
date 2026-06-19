import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
} from "@ledgerhq/device-management-kit";
import { Just } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type SignGenericClearSignDAError,
  type SignGenericClearSignDAInput,
  type SignGenericClearSignDAIntermediateValue,
  type SignGenericClearSignDAOutput,
} from "@api/app-binder/SignGenericClearSignDeviceActionTypes";
import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { SignGenericClearSignDeviceAction } from "./SignGenericClearSignDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const exampleBlockhash = new Uint8Array(32).fill(0xab);
const patchedTx = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const exampleSignature = new Uint8Array([0xaa, 0xbb]);
const rpcUrl = "https://api.devnet.solana.com";

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let promptMock: ReturnType<typeof vi.fn>;
let delayedSignMock: ReturnType<typeof vi.fn>;
let blockhashService: BlockhashService;

function extractDeps() {
  return {
    promptUiDisplay: promptMock,
    delayedSignTransaction: delayedSignMock,
  };
}

function run(
  input: SignGenericClearSignDAInput,
  onComplete: (
    states: DeviceActionState<
      SignGenericClearSignDAOutput,
      SignGenericClearSignDAError,
      SignGenericClearSignDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new SignGenericClearSignDeviceAction({ input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any);
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    SignGenericClearSignDAOutput,
    SignGenericClearSignDAError,
    SignGenericClearSignDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

describe("SignGenericClearSignDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    promptMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: undefined }));
    delayedSignMock = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({ data: Just(exampleSignature) }),
      );
    blockhashService = {
      fetchLatestBlockhash: vi.fn().mockResolvedValue(exampleBlockhash),
      patchBlockhash: vi.fn().mockReturnValue(patchedTx),
      zeroBlockhash: vi.fn(),
    } as unknown as BlockhashService;
  });

  it("prompt approved: refreshes the blockhash then delayed-signs the patched tx", () =>
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
            expect(promptMock).toHaveBeenCalledTimes(1);
            expect(delayedSignMock).toHaveBeenCalledTimes(1);
            expect(
              delayedSignMock.mock.calls[0]![0].input.serializedTransaction,
            ).toStrictEqual(patchedTx);
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
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

  it("prompt approved, no blockhash source: delayed-signs the original tx", () =>
    new Promise<void>((resolve, reject) => {
      run(
        { derivationPath: defaultDerivation, transaction: exampleTx },
        (states) => {
          try {
            expect(delayedSignMock).toHaveBeenCalledTimes(1);
            expect(
              delayedSignMock.mock.calls[0]![0].input.serializedTransaction,
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

  it("prompt user cancel (6985): surfaces an error, never signs", () =>
    new Promise<void>((resolve, reject) => {
      promptMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6985", message: "Canceled by user" } as any),
          }),
        }),
      );
      run(
        { derivationPath: defaultDerivation, transaction: exampleTx, rpcUrl },
        (states) => {
          try {
            expect(delayedSignMock).not.toHaveBeenCalled();
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

  it("prompt non-cancel error (6a80): degrades, never signs", () =>
    new Promise<void>((resolve, reject) => {
      promptMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6a80", message: "merge engine failure" } as any),
          }),
        }),
      );
      run(
        { derivationPath: defaultDerivation, transaction: exampleTx, rpcUrl },
        (states) => {
          try {
            expect(delayedSignMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toBe("degraded");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("prompt throws: degrades, never signs", () =>
    new Promise<void>((resolve, reject) => {
      promptMock.mockRejectedValue(new Error("prompt boom"));
      run(
        { derivationPath: defaultDerivation, transaction: exampleTx, rpcUrl },
        (states) => {
          try {
            expect(delayedSignMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toBe("degraded");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("delayed sign failure (hash mismatch): surfaces an error", () =>
    new Promise<void>((resolve, reject) => {
      delayedSignMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6f11", message: "hash mismatch" } as any),
          }),
        }),
      );
      run(
        { derivationPath: defaultDerivation, transaction: exampleTx, rpcUrl },
        (states) => {
          try {
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
});
